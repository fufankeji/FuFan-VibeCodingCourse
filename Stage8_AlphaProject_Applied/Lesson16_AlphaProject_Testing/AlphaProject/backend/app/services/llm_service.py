"""F3 T007 — LLM provider abstraction + degrade chain.

Three providers (primary / backup / local) all speak the OpenAI-compatible
chat-completions protocol; we hide them behind a small `_Client` protocol
so tests can inject fakes without touching the real `openai` SDK.

Degrade chain (spec US-3 / FR-004 / FR-005):
  primary → backup → local → TemplateSignal (caller renders pure template).

Each successful provider call also estimates cost = tokens × per-1k price.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    api_key: str
    base_url: str
    model: str
    timeout_s: float = 5.0


@dataclass(frozen=True)
class LLMResponse:
    text: str
    source: str  # "llm_primary" | "llm_backup" | "llm_local"
    cost_cny: float


class TemplateSignal:
    """Sentinel — caller should render the rule-based template."""

    def __repr__(self) -> str:  # pragma: no cover - cosmetic
        return "<TemplateSignal>"


class _Client(Protocol):
    def chat_complete(
        self, *, model: str, messages: list[dict[str, str]], timeout: float
    ) -> dict: ...


_Provider = tuple[ProviderConfig, _Client]


class LLMService:
    def __init__(
        self,
        *,
        primary: _Provider | None,
        backup: _Provider | None,
        local: _Provider | None,
        price_in: float,
        price_out: float,
    ) -> None:
        self.primary = primary
        self.backup = backup
        self.local = local
        self.price_in = price_in
        self.price_out = price_out

    def _cost(self, prompt_tokens: int, completion_tokens: int) -> float:
        return (
            prompt_tokens / 1000.0 * self.price_in
            + completion_tokens / 1000.0 * self.price_out
        )

    def _try(
        self, provider: _Provider, label: str, messages: list[dict[str, str]]
    ) -> LLMResponse | None:
        cfg, client = provider
        try:
            raw = client.chat_complete(
                model=cfg.model, messages=messages, timeout=cfg.timeout_s
            )
        except Exception as exc:
            logger.warning("LLM provider %s failed: %s", label, exc)
            return None
        text = (raw.get("text") or "").strip()
        if not text:
            logger.warning("LLM provider %s returned empty text", label)
            return None
        cost = self._cost(
            int(raw.get("prompt_tokens") or 0),
            int(raw.get("completion_tokens") or 0),
        )
        return LLMResponse(text=text, source=label, cost_cny=cost)

    def complete(
        self, messages: list[dict[str, str]]
    ) -> LLMResponse | TemplateSignal:
        chain: list[tuple[_Provider | None, str]] = [
            (self.primary, "llm_primary"),
            (self.backup, "llm_backup"),
            (self.local, "llm_local"),
        ]
        for provider, label in chain:
            if provider is None:
                continue
            out = self._try(provider, label, messages)
            if out is not None:
                return out
        return TemplateSignal()


# ── Concrete OpenAI-compatible adapter (used in production wiring) ──────────
class OpenAICompatClient:
    """Thin adapter around the `openai` SDK; the SDK supports an arbitrary
    base_url, so it covers DeepSeek / Qwen / Ollama equally."""

    def __init__(self, *, api_key: str, base_url: str) -> None:
        from openai import OpenAI  # local import to avoid hard dep at import time

        self._client = OpenAI(api_key=api_key or "sk-placeholder", base_url=base_url)

    def chat_complete(
        self, *, model: str, messages: list[dict[str, str]], timeout: float
    ) -> dict:
        resp = self._client.chat.completions.create(
            model=model, messages=messages, timeout=timeout
        )
        choice = resp.choices[0]
        usage = getattr(resp, "usage", None)
        return {
            "text": choice.message.content or "",
            "prompt_tokens": getattr(usage, "prompt_tokens", 0) if usage else 0,
            "completion_tokens": getattr(usage, "completion_tokens", 0) if usage else 0,
        }


def build_default_service(settings) -> LLMService:
    """Wire LLMService from app.config.Settings without forcing tests to."""
    primary: _Provider | None = None
    backup: _Provider | None = None
    local: _Provider | None = None
    if settings.LLM_PRIMARY_API_KEY and settings.LLM_PRIMARY_BASE_URL:
        primary = (
            ProviderConfig(
                name="primary",
                api_key=settings.LLM_PRIMARY_API_KEY,
                base_url=settings.LLM_PRIMARY_BASE_URL,
                model=settings.LLM_PRIMARY_MODEL,
                timeout_s=settings.LLM_PRIMARY_TIMEOUT_S,
            ),
            OpenAICompatClient(
                api_key=settings.LLM_PRIMARY_API_KEY,
                base_url=settings.LLM_PRIMARY_BASE_URL,
            ),
        )
    if settings.LLM_BACKUP_API_KEY and settings.LLM_BACKUP_BASE_URL:
        backup = (
            ProviderConfig(
                name="backup",
                api_key=settings.LLM_BACKUP_API_KEY,
                base_url=settings.LLM_BACKUP_BASE_URL,
                model=settings.LLM_BACKUP_MODEL,
                timeout_s=settings.LLM_BACKUP_TIMEOUT_S,
            ),
            OpenAICompatClient(
                api_key=settings.LLM_BACKUP_API_KEY,
                base_url=settings.LLM_BACKUP_BASE_URL,
            ),
        )
    if settings.OLLAMA_BASE_URL and settings.OLLAMA_MODEL:
        local = (
            ProviderConfig(
                name="local",
                api_key="",
                base_url=settings.OLLAMA_BASE_URL,
                model=settings.OLLAMA_MODEL,
                timeout_s=settings.LLM_BACKUP_TIMEOUT_S,
            ),
            OpenAICompatClient(api_key="", base_url=settings.OLLAMA_BASE_URL),
        )
    return LLMService(
        primary=primary,
        backup=backup,
        local=local,
        price_in=settings.LLM_PRICE_PER_1K_INPUT,
        price_out=settings.LLM_PRICE_PER_1K_OUTPUT,
    )

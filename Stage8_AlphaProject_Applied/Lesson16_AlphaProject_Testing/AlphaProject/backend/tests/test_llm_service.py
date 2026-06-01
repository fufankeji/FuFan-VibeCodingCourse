"""T007: llm_service — multi-provider degrade chain + cost accumulation.

[出参验证] mock：主超时→切备；备失败→返模板信号；每次调用累加成本。
"""
import pytest

from app.services.llm_service import (
    LLMResponse,
    LLMService,
    ProviderConfig,
    TemplateSignal,
)


class _FakeClient:
    """Replaces openai.OpenAI; programmable success/failure."""

    def __init__(self, *, text=None, exc=None, prompt_tokens=10, completion_tokens=20):
        self.text = text
        self.exc = exc
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.calls = 0

    def chat_complete(self, *, model, messages, timeout):
        self.calls += 1
        if self.exc:
            raise self.exc
        return {
            "text": self.text or "",
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
        }


def _cfg(name, key="k", base="https://x", model="m"):
    return ProviderConfig(name=name, api_key=key, base_url=base, model=model, timeout_s=5.0)


def test_primary_success_returns_text_and_cost():
    primary = _FakeClient(text="第一段。第二段。第三段。", prompt_tokens=100, completion_tokens=50)
    svc = LLMService(
        primary=(_cfg("primary"), primary),
        backup=None,
        local=None,
        price_in=0.001,
        price_out=0.002,
    )
    res = svc.complete([{"role": "user", "content": "hi"}])
    assert isinstance(res, LLMResponse)
    assert res.text.startswith("第一段")
    assert res.source == "llm_primary"
    # cost = 100/1000 * 0.001 + 50/1000 * 0.002 = 0.0001 + 0.0001 = 0.0002
    assert res.cost_cny == pytest.approx(0.0002)
    assert primary.calls == 1


def test_primary_timeout_falls_to_backup():
    primary = _FakeClient(exc=TimeoutError("primary slow"))
    backup = _FakeClient(text="backup ok")
    svc = LLMService(
        primary=(_cfg("primary"), primary),
        backup=(_cfg("backup"), backup),
        local=None,
        price_in=0.001,
        price_out=0.001,
    )
    res = svc.complete([{"role": "user", "content": "x"}])
    assert res.source == "llm_backup"
    assert res.text == "backup ok"
    assert primary.calls == 1
    assert backup.calls == 1


def test_both_fail_returns_template_signal():
    primary = _FakeClient(exc=RuntimeError("fail"))
    backup = _FakeClient(exc=RuntimeError("fail"))
    svc = LLMService(
        primary=(_cfg("primary"), primary),
        backup=(_cfg("backup"), backup),
        local=None,
        price_in=0,
        price_out=0,
    )
    res = svc.complete([{"role": "user", "content": "x"}])
    assert isinstance(res, TemplateSignal)


def test_empty_text_treated_as_failure():
    primary = _FakeClient(text="")  # 0-character output → fail (FR-005)
    backup = _FakeClient(text="ok 备份")
    svc = LLMService(
        primary=(_cfg("primary"), primary),
        backup=(_cfg("backup"), backup),
        local=None,
        price_in=0,
        price_out=0,
    )
    res = svc.complete([{"role": "user", "content": "x"}])
    assert res.source == "llm_backup"
    assert res.text == "ok 备份"


def test_no_providers_configured_returns_template_signal():
    svc = LLMService(primary=None, backup=None, local=None, price_in=0, price_out=0)
    assert isinstance(svc.complete([{"role": "user", "content": "x"}]), TemplateSignal)


def test_local_used_when_primary_backup_both_skipped():
    local = _FakeClient(text="本地兜底输出")
    svc = LLMService(
        primary=None,
        backup=None,
        local=(_cfg("local"), local),
        price_in=0,
        price_out=0,
    )
    res = svc.complete([{"role": "user", "content": "x"}])
    assert res.source == "llm_local"
    assert res.text == "本地兜底输出"

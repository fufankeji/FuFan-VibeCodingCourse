"""F3 T008 — compliance filter.

Two responsibilities (FR-008, FR-009, FR-010):
1. Strip / replace recommendation-style words ("建议买入", "目标价", ...).
2. Truncate body to ≤200 chars and append the mandatory disclaimer tail.

Disclaimer wording is fixed by PRD §7.4 / spec FR-009; tests assert the
exact string so it cannot drift.
"""
from __future__ import annotations

DISCLAIMER = "以上为信息整理，不构成投资建议"

# Forbidden words (PRD §2.3 Anti-Pattern 2 + FR-008).
# Replacement strategy: collapse the phrase to a neutral fragment so the
# sentence still scans, instead of leaving a hole.
FORBIDDEN_WORDS: tuple[str, ...] = (
    "建议买入",
    "建议卖出",
    "强烈推荐",
    "目标价",
    "抄底",
    "满仓",
    "梭哈",
    "all in",
    "All In",
    "ALL IN",
)

_NEUTRAL = "[已脱敏]"


def truncate_to_words(text: str, limit: int = 200) -> str:
    """Hard truncate to `limit` characters; append '...' if any chars dropped."""
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + "..."


def scrub_forbidden(text: str) -> str:
    out = text
    for w in FORBIDDEN_WORDS:
        if w in out:
            out = out.replace(w, _NEUTRAL)
    return out


def apply_compliance(text: str, *, limit: int = 200) -> str:
    """Scrub forbidden words → truncate body → ensure disclaimer suffix.

    The disclaimer is appended *outside* the 200-char cap, since it is a
    fixed regulatory string and the cap governs LLM-generated body only.
    """
    body = scrub_forbidden(text)
    # Strip an already-present disclaimer so we don't double-append.
    if DISCLAIMER in body:
        body = body.replace(DISCLAIMER, "").rstrip("，。 \n")
    body = truncate_to_words(body, limit)
    # Ensure final sentence is closed before disclaimer for readability
    body = body.rstrip()
    return f"{body}\n\n{DISCLAIMER}"

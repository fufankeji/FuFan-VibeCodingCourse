"""T008: sensitive_filter — forbidden-words replacement + disclaimer tail.

[出参验证] "建议买入/目标价/强烈推荐" → 替换；任意输出末尾必含风险尾标。
"""
import pytest

from app.explain.sensitive_filter import (
    DISCLAIMER,
    FORBIDDEN_WORDS,
    apply_compliance,
    truncate_to_words,
)


def test_disclaimer_appended_to_clean_text():
    out = apply_compliance("行业景气度回升。")
    assert out.endswith(DISCLAIMER)


def test_disclaimer_not_doubled():
    out = apply_compliance(f"事实陈述。{DISCLAIMER}")
    assert out.count(DISCLAIMER) == 1


@pytest.mark.parametrize("bad", list(FORBIDDEN_WORDS))
def test_forbidden_words_are_replaced(bad):
    out = apply_compliance(f"分析师{bad}该股。")
    assert bad not in out
    assert out.endswith(DISCLAIMER)


def test_replacement_is_neutral():
    out = apply_compliance("券商建议买入并给出目标价 100。")
    # neutral replacement, no investment-advice tone remains
    assert "建议买入" not in out
    assert "目标价" not in out


def test_truncate_at_200_chinese_chars_then_disclaimer():
    long = "茅" * 250  # 250 汉字
    out = apply_compliance(long)
    # Body part (excluding disclaimer) must not exceed 200
    body = out[: -len(DISCLAIMER)].rstrip()
    # truncated body ends with "..." marker (FR-010)
    assert body.endswith("...")
    # length excluding the ellipsis ≤ 200
    assert len(body.rstrip(".")) <= 200


def test_boundary_exactly_200_keeps_intact():
    body = "茅" * 200
    out = truncate_to_words(body, 200)
    assert out == body


def test_boundary_201_triggers_truncation():
    body = "茅" * 201
    out = truncate_to_words(body, 200)
    assert out.endswith("...")
    assert len(out.rstrip(".")) <= 200

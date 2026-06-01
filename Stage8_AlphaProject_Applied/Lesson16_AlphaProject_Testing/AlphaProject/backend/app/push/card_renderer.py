"""卡片渲染 (002-T005).

- FR-002: text / interactive 两种 msg_type 的 content 字段 JSON 字符串化
- FR-014: 飞书平台禁用词兜底替换
- Edge Cases: 单卡超长截断 + 跳转链接

注: 内容合规 (买卖建议词) 由 F3 内容侧负责. F6 只做飞书平台禁用词兜底.
当前 BANNED_REPLACEMENTS 留最小防御集; 真上线可由配置注入扩展.
"""

from __future__ import annotations

import json

from app.models.push import PushRequest

# 飞书平台层面已知会触发拒收的违规词 (MVP 占位最小集; FR-014)
BANNED_REPLACEMENTS: dict[str, str] = {
    # 极端措辞做兜底替换, 真实词表上线时按平台反馈扩展
    "明牌": "信号",
    "稳赚": "可能上行",
    "翻倍": "上涨",
}

# 飞书单条消息 content 上限 (MVP 保守值, 实测以飞书文档为准)
MAX_CONTENT_BYTES = 30_000


def _scrub_banned(text: str) -> str:
    for bad, good in BANNED_REPLACEMENTS.items():
        text = text.replace(bad, good)
    return text


def _truncate(text: str, limit: int = MAX_CONTENT_BYTES) -> str:
    if len(text.encode("utf-8")) <= limit:
        return text
    # truncate to fit limit minus suffix budget
    suffix = "...\n查看完整内容: http://localhost/dashboard"
    budget = limit - len(suffix.encode("utf-8")) - 32
    encoded = text.encode("utf-8")[:budget]
    # safe decode boundary
    return encoded.decode("utf-8", errors="ignore") + suffix


def render(req: PushRequest) -> str:
    """Render a single PushRequest's content into IM API content JSON string."""
    raw = req.content
    if req.msg_type.value == "text":
        text = _scrub_banned(str(raw.get("text", "")))
        text = _truncate(text)
        return json.dumps({"text": text}, ensure_ascii=False)
    # interactive: scrub any text-bearing leaf strings shallowly
    scrubbed: dict = json.loads(_scrub_banned(json.dumps(raw, ensure_ascii=False)))
    payload = json.dumps(scrubbed, ensure_ascii=False)
    if len(payload.encode("utf-8")) > MAX_CONTENT_BYTES:
        # Fall back to text envelope with link
        return json.dumps(
            {"text": _truncate("卡片内容过长")},
            ensure_ascii=False,
        )
    return payload


def render_batch(reqs: list[PushRequest], cap: int = 10) -> str:
    """Render multiple requests merged into a single text envelope.

    spec §2.3: ≤10 股/卡 (cap default). Overflow indicated in body.
    """
    head = reqs[:cap]
    overflow = len(reqs) - len(head)
    lines: list[str] = ["[批量异动]"]
    for r in head:
        snippet = ""
        if r.msg_type.value == "text":
            snippet = str(r.content.get("text", ""))
        else:
            snippet = json.dumps(r.content, ensure_ascii=False)[:120]
        if r.code:
            lines.append(f"- {r.code} {r.signal or ''}: {snippet}")
        else:
            lines.append(f"- {snippet}")
    if overflow > 0:
        lines.append(f"...另有 {overflow} 条 (Dashboard 查看)")
    body = _scrub_banned("\n".join(lines))
    body = _truncate(body)
    return json.dumps({"text": body}, ensure_ascii=False)

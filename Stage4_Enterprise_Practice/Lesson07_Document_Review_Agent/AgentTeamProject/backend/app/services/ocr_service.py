"""
Mock OCR Service — MVP phase.

Text extraction uses real PDF/DOCX parsing libraries where available.
Field extraction uses DeepSeek LLM to identify structured contract fields.
"""

import json
import random
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.sse import sse_manager
from app.models.audit_log import AuditLog
from app.models.extracted_field import ExtractedField
from app.models.session import ReviewSession

STRUCTURED_FIELDS = [
    "party_a",
    "party_b",
    "contract_amount",
    "effective_date",
    "governing_law",
]

# Prompts
_EXTRACTION_SYSTEM = """你是一名专业合同分析助手。请从以下合同文本中提取结构化字段信息。
返回严格的 JSON 对象，包含以下键（如未找到则返回空字符串）：
party_a, party_b, contract_amount, effective_date, governing_law

示例输出：
{
  "party_a": "甲方公司名称",
  "party_b": "乙方公司名称",
  "contract_amount": "100万元人民币",
  "effective_date": "2024年1月1日",
  "governing_law": "中国法律"
}
只返回 JSON，不要其他内容。"""


def extract_text(file_path: str) -> str:
    """Extract raw text from a PDF or DOCX file."""
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        return _extract_pdf_text(file_path)
    elif suffix == ".docx":
        return _extract_docx_text(file_path)
    else:
        return ""


def _extract_pdf_text(file_path: str) -> str:
    try:
        import PyPDF2

        text_parts = []
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text_parts.append(page.extract_text() or "")
        return "\n".join(text_parts)
    except Exception:
        return ""


def _extract_docx_text(file_path: str) -> str:
    try:
        from docx import Document

        doc = Document(file_path)
        return "\n".join(para.text for para in doc.paragraphs if para.text.strip())
    except Exception:
        return ""


async def extract_fields(session_id: str, text: str, db: Session) -> None:
    """Use LLM to extract structured fields and persist to DB."""
    # Update session state to scanning
    session: ReviewSession | None = db.query(ReviewSession).filter(ReviewSession.id == session_id).first()
    if not session:
        return

    session.state = "scanning"
    session.updated_at = datetime.utcnow()
    db.add(session)
    db.commit()

    await sse_manager.publish(
        session_id,
        "state_changed",
        {"session_id": session_id, "state": "scanning"},
    )

    # Attempt LLM extraction; fall back to empty values on failure
    extracted: dict[str, str] = {}
    try:
        extracted = await _llm_extract_fields(text)
    except Exception:
        extracted = {f: "" for f in STRUCTURED_FIELDS}

    # Persist each field
    for field_name in STRUCTURED_FIELDS:
        value = extracted.get(field_name, "")
        confidence = random.randint(40, 99)
        needs_verification = confidence < 60

        field = ExtractedField(
            session_id=session_id,
            field_name=field_name,
            field_value=value,
            original_value=value,
            confidence_score=confidence,
            needs_human_verification=needs_verification,
            verification_status="unverified",
            source_evidence_text=_find_evidence(text, value),
        )
        db.add(field)

    db.commit()

    # Write audit log
    audit = AuditLog(
        session_id=session_id,
        event_type="fields_extracted",
        actor_id="system",
        actor_type="system",
        metadata_json=json.dumps({"field_count": len(STRUCTURED_FIELDS)}),
    )
    db.add(audit)
    db.commit()

    await sse_manager.publish(
        session_id,
        "fields_extracted",
        {"session_id": session_id, "field_count": len(STRUCTURED_FIELDS)},
    )

    # Trigger LangGraph workflow if available
    await _trigger_workflow(session_id, text, db)


async def _llm_extract_fields(text: str) -> dict[str, str]:
    from app.config import get_llm
    from langchain_core.messages import HumanMessage, SystemMessage

    llm = get_llm()
    # Truncate to avoid token limits
    truncated = text[:8000] if len(text) > 8000 else text
    messages = [
        SystemMessage(content=_EXTRACTION_SYSTEM),
        HumanMessage(content=f"合同文本：\n\n{truncated}"),
    ]
    response = await llm.ainvoke(messages)
    content = response.content.strip()
    # Strip markdown code fences if present
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(lines[1:-1]) if len(lines) > 2 else content
    return json.loads(content)


def _find_evidence(text: str, value: str) -> str:
    """Return a short surrounding snippet as evidence."""
    if not value or not text:
        return ""
    idx = text.find(value)
    if idx == -1:
        return ""
    start = max(0, idx - 50)
    end = min(len(text), idx + len(value) + 50)
    return text[start:end]


async def _trigger_workflow(session_id: str, text: str, db: Session) -> None:
    """Trigger LangGraph review workflow after OCR completes."""
    try:
        from app.services.hitl_service import hitl_service

        session: ReviewSession | None = db.query(ReviewSession).filter(ReviewSession.id == session_id).first()
        if not session:
            return

        thread_id = session.langgraph_thread_id

        # hitl_service.trigger_workflow_for_session handles:
        # 1. Updating session state to "scanning"
        # 2. Running workflow in background thread
        # 3. Persisting review items to DB
        # 4. Pushing SSE events
        hitl_service.trigger_workflow_for_session(session_id, thread_id, text, db)
    except ImportError:
        # Workflow module not yet available; skip silently
        pass

from pathlib import Path

from fastapi import APIRouter, Depends, Header
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.database import get_db
from app.models.report import ReviewReport
from app.models.session import ReviewSession
from app.schemas.report import ReviewReportResponse
from app.services import report_service

router = APIRouter()


@router.get("/{session_id}/report", response_model=ReviewReportResponse)
async def get_report(
    session_id: str,
    x_user_id: str = Header(default="anonymous", alias="X-User-ID"),
    db: Session = Depends(get_db),
):
    session = db.query(ReviewSession).filter(ReviewSession.id == session_id).first()
    if not session:
        raise APIError.not_found("ReviewSession")

    report = db.query(ReviewReport).filter(ReviewReport.session_id == session_id).first()
    if not report:
        # Trigger generation on first request if session state allows
        if session.state in {"report_ready", "hitl_medium_confirm", "hitl_field_verify"}:
            return await report_service.generate_report(session_id, db)
        raise APIError.not_found("ReviewReport")

    return ReviewReportResponse.model_validate(report)


@router.get("/{session_id}/report/download")
def download_report(session_id: str, db: Session = Depends(get_db)):
    report = db.query(ReviewReport).filter(ReviewReport.session_id == session_id).first()
    if not report:
        raise APIError.not_found("ReviewReport")

    if report.report_status != "ready":
        raise APIError.bad_request("报告尚未生成完成，请稍后再试")

    # Prefer PDF, fall back to JSON
    file_path = report.pdf_path or report.json_path
    if not file_path or not Path(file_path).exists():
        raise APIError.not_found("报告文件")

    media_type = "application/pdf" if file_path.endswith(".pdf") else "application/json"
    filename = Path(file_path).name

    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

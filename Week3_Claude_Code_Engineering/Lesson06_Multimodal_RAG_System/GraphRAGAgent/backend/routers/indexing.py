"""B 组：Indexing Pipeline（4 个端点）"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from models.schemas import APIResponse, StartIndexRequest
from services import document_service as doc_svc
from services import indexing_service as idx_svc

router = APIRouter(prefix="/index", tags=["Indexing"])


@router.post("/start", status_code=202)
async def start_indexing(body: StartIndexRequest):
    doc = doc_svc.get_document(body.doc_id)
    if not doc:
        return JSONResponse(
            status_code=404,
            content=APIResponse.err(2001, f"Document '{body.doc_id}' not found").model_dump(),
        )
    meta = idx_svc.start_indexing(body.doc_id)
    return APIResponse.ok({
        "job_id": meta["job_id"],
        "doc_id": meta["doc_id"],
        "status": meta["status"],
        "stage": meta["stage"],
        "created_at": meta["created_at"],
    })


@router.get("/status/{job_id}")
async def get_job_status(job_id: str):
    meta = idx_svc.get_job_status(job_id)
    if not meta:
        return JSONResponse(
            status_code=404,
            content=APIResponse.err(2002, f"Job '{job_id}' not found").model_dump(),
        )
    return APIResponse.ok(meta)


@router.get("/result/{job_id}")
async def get_job_result(job_id: str):
    result = idx_svc.get_job_result(job_id)
    if not result:
        return JSONResponse(
            status_code=404,
            content=APIResponse.err(2002, f"Job '{job_id}' not found").model_dump(),
        )
    if result.get("status") not in ("done",) and "stats" not in result:
        return JSONResponse(
            status_code=400,
            content=APIResponse.err(2003, f"Job '{job_id}' is still running (status={result.get('status')})").model_dump(),
        )
    return APIResponse.ok(result)


@router.delete("/jobs/{job_id}")
async def cancel_job(job_id: str):
    meta = idx_svc.get_job_status(job_id)
    if not meta:
        return JSONResponse(
            status_code=404,
            content=APIResponse.err(2002, f"Job '{job_id}' not found").model_dump(),
        )
    ok, prev_status = idx_svc.cancel_job(job_id)
    return APIResponse.ok({
        "cancelled": True,
        "job_id": job_id,
        "previous_status": prev_status,
    })

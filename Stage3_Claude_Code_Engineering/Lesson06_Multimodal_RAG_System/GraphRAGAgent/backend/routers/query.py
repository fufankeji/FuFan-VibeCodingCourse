"""D 组：QA 问答（4 个端点）"""
import asyncio
from functools import partial

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from models.schemas import APIResponse, BatchQueryRequest, QueryRequest
from services import qa_service as svc

router = APIRouter(prefix="/query", tags=["QA"])


@router.post("")
async def run_query(body: QueryRequest):
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            partial(svc.run_query, body.question, [m.model_dump() for m in body.history]),
        )
        return APIResponse.ok(result)
    except ValueError as e:
        if "KG_EMPTY" in str(e):
            return JSONResponse(
                status_code=400,
                content=APIResponse.err(3002, "Knowledge graph is empty. Index documents first.").model_dump(),
            )
        return JSONResponse(
            status_code=500,
            content=APIResponse.err(4001, str(e)).model_dump(),
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content=APIResponse.err(4001, f"QA service error: {e}").model_dump(),
        )


@router.post("/batch", status_code=202)
async def start_batch(body: BatchQueryRequest):
    if len(body.questions) > 20:
        return JSONResponse(
            status_code=400,
            content=APIResponse.err(1001, "Maximum 20 questions per batch").model_dump(),
        )
    result = svc.start_batch(body.questions)
    return APIResponse.ok(result)


@router.get("/batch/{batch_id}")
async def get_batch_result(batch_id: str):
    result = svc.get_batch_result(batch_id)
    if not result:
        return JSONResponse(
            status_code=404,
            content=APIResponse.err(2002, f"Batch '{batch_id}' not found").model_dump(),
        )
    return APIResponse.ok(result)


@router.get("/history")
async def get_query_history(page: int = 1, page_size: int = 20):
    page_size = min(page_size, 50)
    result = svc.get_history(page, page_size)
    return APIResponse.ok(result)

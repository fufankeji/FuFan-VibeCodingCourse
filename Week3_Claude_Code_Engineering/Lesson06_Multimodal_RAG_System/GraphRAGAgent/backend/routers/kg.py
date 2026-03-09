"""C 组：知识图谱（6 个端点）"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from models.schemas import APIResponse
from services import kg_service as svc

router = APIRouter(prefix="/kg", tags=["Knowledge Graph"])


@router.get("/nodes")
async def list_nodes(
    type: str | None = None,
    doc_id: str | None = None,
    confidence: str | None = None,
    page: int = 1,
    page_size: int = 50,
):
    page_size = min(page_size, 200)
    result = svc.get_nodes(page, page_size, type, doc_id, confidence)
    if result["total"] == 0 and not any([type, doc_id, confidence]):
        return JSONResponse(
            status_code=400,
            content=APIResponse.err(3002, "Knowledge graph is empty. Index documents first.").model_dump(),
        )
    return APIResponse.ok(result)


@router.get("/edges")
async def list_edges(
    doc_id: str | None = None,
    relation: str | None = None,
    page: int = 1,
    page_size: int = 100,
):
    page_size = min(page_size, 500)
    result = svc.get_edges(page, page_size, doc_id, relation)
    return APIResponse.ok(result)


@router.get("/nodes/{node_id}")
async def get_node_detail(node_id: str):
    node = svc.get_node_detail(node_id)
    if not node:
        return JSONResponse(
            status_code=404,
            content=APIResponse.err(3001, f"Node '{node_id}' not found").model_dump(),
        )
    return APIResponse.ok(node)


@router.get("/nodes/{node_id}/neighbors")
async def get_node_neighbors(node_id: str, hops: int = 1):
    result = svc.get_neighbors(node_id, hops)
    if result is None:
        return JSONResponse(
            status_code=404,
            content=APIResponse.err(3001, f"Node '{node_id}' not found").model_dump(),
        )
    return APIResponse.ok(result)


@router.get("/stats")
async def get_kg_stats():
    stats = svc.get_stats()
    return APIResponse.ok(stats)


@router.get("/export")
async def export_kg(format: str = "json", doc_id: str | None = None):
    result = svc.export_kg(doc_id)
    return APIResponse.ok(result)

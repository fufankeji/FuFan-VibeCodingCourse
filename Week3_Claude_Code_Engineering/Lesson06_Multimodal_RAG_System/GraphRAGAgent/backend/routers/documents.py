"""A 组：文档管理（4 个端点）"""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from models.schemas import APIResponse
from services import document_service as svc

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", status_code=200)
async def upload_document(
    file: UploadFile = File(...),
    language: str = Form("ch"),
    enable_formula: bool = Form(True),
    enable_table: bool = Form(True),
):
    content = await file.read()
    ok, code, msg = svc.validate_upload(file.filename or "", len(content))
    if not ok:
        return JSONResponse(
            status_code=400,
            content=APIResponse.err(code, msg).model_dump(),
        )
    doc = svc.save_upload(file.filename or "upload", content, language, enable_formula, enable_table)
    # Remove internal field
    doc.pop("upload_filename", None)
    return APIResponse.ok(doc)


@router.get("/{doc_id}")
async def get_document(doc_id: str):
    doc = svc.get_document(doc_id)
    if not doc:
        return JSONResponse(
            status_code=404,
            content=APIResponse.err(2001, f"Document '{doc_id}' not found").model_dump(),
        )
    doc.pop("upload_filename", None)
    return APIResponse.ok(doc)


@router.get("")
async def list_documents(
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    format: str | None = None,
):
    page_size = min(page_size, 100)
    result = svc.list_documents(page, page_size, status, format)
    for item in result["items"]:
        item.pop("upload_filename", None)
    return APIResponse.ok(result)


@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    doc = svc.get_document(doc_id)
    if not doc:
        return JSONResponse(
            status_code=404,
            content=APIResponse.err(2001, f"Document '{doc_id}' not found").model_dump(),
        )
    ok, removed_nodes, removed_edges = svc.delete_document(doc_id)
    return APIResponse.ok({
        "deleted": True,
        "doc_id": doc_id,
        "removed_nodes": removed_nodes,
        "removed_edges": removed_edges,
    })

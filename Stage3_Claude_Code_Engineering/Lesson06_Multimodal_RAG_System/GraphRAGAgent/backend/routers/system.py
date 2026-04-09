"""F 组：系统（4 个端点）"""
import os
import time
from pathlib import Path

from fastapi import APIRouter

from models.schemas import APIResponse
from storage import file_store as fs

router = APIRouter(tags=["System"])

_START_TIME = time.time()


@router.get("/health")
async def health_check():
    env_path = Path(__file__).parent.parent / ".env"
    from dotenv import load_dotenv
    load_dotenv(env_path, override=False)

    mineru_python = Path(os.getenv("MINERU_PYTHON", "F:/GraphRAGAgent/mineru_mvp/.venv/Scripts/python.exe"))
    langextract_python = Path("F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe")
    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
    deepseek_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

    components = {
        "mineru_venv": {
            "status": "ok" if mineru_python.exists() else "error",
            "path": str(mineru_python),
            "exists": mineru_python.exists(),
        },
        "langextract_venv": {
            "status": "ok" if langextract_python.exists() else "error",
            "path": str(langextract_python),
            "exists": langextract_python.exists(),
        },
        "deepseek_api": {
            "status": "ok" if deepseek_key else "error",
            "base_url": deepseek_url,
            "key_configured": bool(deepseek_key),
        },
        "storage": {
            "status": "ok",
            "kg_nodes_exists": fs.kg_nodes_path().exists(),
            "kg_edges_exists": fs.kg_edges_path().exists(),
            "uploads_dir_exists": fs.UPLOADS_DIR.exists(),
        },
    }

    overall = "healthy" if all(c["status"] == "ok" for c in components.values()) else "degraded"

    return APIResponse.ok({
        "status": overall,
        "version": "1.0.0",
        "uptime_seconds": round(time.time() - _START_TIME, 1),
        "components": components,
    })


@router.get("/system/stats")
async def system_stats():
    from services import indexing_service as idx_svc

    docs = list(fs.load_docs_index().values())
    nodes = fs.load_kg_nodes()
    edges = fs.load_kg_edges()
    history = fs.load_query_history()

    type_dist: dict[str, int] = {}
    for n in nodes:
        t = n.get("type", "UNKNOWN")
        type_dist[t] = type_dist.get(t, 0) + 1

    return APIResponse.ok({
        "total_documents": len(docs),
        "indexed_documents": sum(1 for d in docs if d.get("status") == "indexed"),
        "failed_documents": sum(1 for d in docs if d.get("status") == "failed"),
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "type_distribution": type_dist,
        "total_queries": len(history),
        "active_jobs": idx_svc.count_active_jobs(),
        "storage_used_mb": fs.storage_used_mb(),
    })


@router.get("/system/formats")
async def list_formats():
    return APIResponse.ok({
        "formats": [
            {"ext": "pdf",  "description": "PDF 文档（文本型/扫描型/混合型）", "max_size_mb": 200, "max_pages": 600, "requires_ocr": False},
            {"ext": "docx", "description": "Microsoft Word（新版）", "max_size_mb": 200, "max_pages": 600, "requires_ocr": False},
            {"ext": "doc",  "description": "Microsoft Word（旧版）", "max_size_mb": 200, "max_pages": 600, "requires_ocr": False},
            {"ext": "pptx", "description": "PowerPoint（新版）", "max_size_mb": 200, "max_pages": 600, "requires_ocr": False},
            {"ext": "ppt",  "description": "PowerPoint（旧版）", "max_size_mb": 200, "max_pages": 600, "requires_ocr": False},
            {"ext": "png",  "description": "PNG 图片（单页）", "max_size_mb": 200, "max_pages": 1, "requires_ocr": True},
            {"ext": "jpg",  "description": "JPEG 图片（单页）", "max_size_mb": 200, "max_pages": 1, "requires_ocr": True},
            {"ext": "jpeg", "description": "JPEG 图片（单页）", "max_size_mb": 200, "max_pages": 1, "requires_ocr": True},
            {"ext": "html", "description": "HTML 文件", "max_size_mb": 200, "max_pages": 600, "requires_ocr": False},
        ],
        "ocr_languages": [
            {"code": "ch", "name": "中文（默认）"},
            {"code": "en", "name": "英文"},
            {"code": "japan", "name": "日文"},
            {"code": "korean", "name": "韩文"},
            {"code": "french", "name": "法文"},
            {"code": "german", "name": "德文"},
        ],
        "notes": [
            "language 参数默认值为 'ch'（非 'zh'），遵循 PaddleOCR v3 语言代码规范",
            "上传时不需要携带 Content-Type，服务端自动识别",
            "PNG/JPG/JPEG 单次最多处理 1 页",
        ],
    })


@router.get("/system/demo")
async def get_demo_data():
    # Try backend KG first, then fall back to graphrag_pipeline/output
    nodes = fs.load_kg_nodes()
    edges = fs.load_kg_edges()

    if not nodes:
        # Fallback: load from existing graphrag_pipeline output
        legacy_nodes_path = Path("F:/GraphRAGAgent/graphrag_pipeline/output/kg_nodes.json")
        legacy_edges_path = Path("F:/GraphRAGAgent/graphrag_pipeline/output/kg_edges.json")
        if legacy_nodes_path.exists():
            import json
            nodes = json.loads(legacy_nodes_path.read_text(encoding="utf-8"))
            edges = json.loads(legacy_edges_path.read_text(encoding="utf-8")) if legacy_edges_path.exists() else []
        else:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=400,
                content=APIResponse.err(3002, "No demo data available. Index a document first.").model_dump(),
            )

    type_counts: dict[str, int] = {}
    for n in nodes:
        t = n.get("type", "UNKNOWN")
        type_counts[t] = type_counts.get(t, 0) + 1

    import networkx as nx
    G = nx.Graph()
    for n in nodes:
        G.add_node(n["id"])
    for e in edges:
        G.add_edge(e["source"], e["target"])

    return APIResponse.ok({
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "nodes": len(nodes),
            "edges": len(edges),
            "type_counts": type_counts,
            "density": round(nx.density(G), 4) if G.number_of_nodes() > 1 else 0.0,
        },
    })

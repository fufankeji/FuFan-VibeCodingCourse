"""
GraphRAG Studio — FastAPI Backend
Entry point: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""
import sys
from pathlib import Path

# Ensure backend/ is in sys.path for absolute imports
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).parent / ".env", override=True)

from routers import documents, indexing, kg, query, search, system

app = FastAPI(
    title="GraphRAG Studio API",
    description="Multimodal RAG Q&A system backend — MinerU + LangExtract + Agentic-RAG",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All routers under /api/v1. Each router carries its own sub-prefix.
# documents.router  prefix="/documents" → /api/v1/documents
# indexing.router   prefix="/index"     → /api/v1/index
# kg.router         prefix="/kg"        → /api/v1/kg
# query.router      prefix="/query"     → /api/v1/query
# search.router     prefix="/search"    → /api/v1/search
# system.router     no prefix           → /api/v1/health, /api/v1/system/...
PREFIX = "/api/v1"
app.include_router(documents.router, prefix=PREFIX)
app.include_router(indexing.router,  prefix=PREFIX)
app.include_router(kg.router,        prefix=PREFIX)
app.include_router(query.router,     prefix=PREFIX)
app.include_router(search.router,    prefix=PREFIX)
app.include_router(system.router,    prefix=PREFIX)


@app.get("/")
async def root():
    return {"msg": "GraphRAG Studio API v1.0.0", "docs": "/docs", "health": "/api/v1/health"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

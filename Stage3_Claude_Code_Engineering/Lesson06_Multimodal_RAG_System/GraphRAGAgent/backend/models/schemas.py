"""
Pydantic v2 schemas — all API data objects per backend_service_specification-v1.0.md
"""
from __future__ import annotations

import uuid
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Universal response envelope
# ---------------------------------------------------------------------------

class APIResponse(BaseModel, Generic[T]):
    code: int = 0
    msg: str = "success"
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data: Optional[T] = None

    @classmethod
    def ok(cls, data: Any = None) -> "APIResponse":
        return cls(code=0, msg="success", data=data)

    @classmethod
    def err(cls, code: int, msg: str) -> "APIResponse":
        return cls(code=code, msg=msg, data=None)


# ---------------------------------------------------------------------------
# A. Document schemas
# ---------------------------------------------------------------------------

class DocumentInfo(BaseModel):
    doc_id: str
    filename: str
    format: str
    size_bytes: int
    pages: Optional[int] = None
    uploaded_at: str
    status: str  # uploaded | indexed | failed
    language: str = "ch"
    enable_formula: bool = True
    enable_table: bool = True


class DocumentListData(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[DocumentInfo]


class DeleteDocumentData(BaseModel):
    deleted: bool
    doc_id: str
    removed_nodes: int
    removed_edges: int


# ---------------------------------------------------------------------------
# B. Indexing job schemas
# ---------------------------------------------------------------------------

class IndexingProgress(BaseModel):
    parsed_pages: int = 0
    total_pages: int = 0
    extracted_entities: int = 0


class IndexingJobStatus(BaseModel):
    job_id: str
    doc_id: str
    status: str  # submitted|queued|parsing|extracting|indexing|done|failed|cancelled
    stage: str = ""
    progress: IndexingProgress = Field(default_factory=IndexingProgress)
    created_at: str
    elapsed_seconds: float = 0.0
    error: Optional[str] = None


class StartIndexRequest(BaseModel):
    doc_id: str


class CancelJobData(BaseModel):
    cancelled: bool
    job_id: str
    previous_status: str


# ---------------------------------------------------------------------------
# C. KG schemas
# ---------------------------------------------------------------------------

class KGNode(BaseModel):
    id: str
    name: str
    type: str
    source_doc: str
    char_start: Optional[int] = None
    char_end: Optional[int] = None
    confidence: Optional[str] = None
    page: int = 0
    degree: int = 0


class KGNodeDetail(KGNode):
    degree_centrality: float = 0.0
    neighbor_count: int = 0


class KGEdge(BaseModel):
    source: str
    target: str
    relation: str = "CO_OCCURS_IN"
    doc_id: str
    page: int = 0


class KGNodeListData(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[KGNode]


class KGEdgeListData(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[KGEdge]


class KGStatsData(BaseModel):
    total_nodes: int
    total_edges: int
    density: float
    type_distribution: dict[str, int]
    relation_types: dict[str, int]
    top5_central_nodes: list[dict]
    source_documents: list[str]


class KGExportData(BaseModel):
    format: str
    doc_id: Optional[str]
    total_nodes: int
    total_edges: int
    exported_at: str
    nodes: list[KGNode]
    edges: list[KGEdge]


class NeighborInfo(BaseModel):
    id: str
    name: str
    type: str
    page: int


class NeighborsData(BaseModel):
    center: NeighborInfo
    hops: int
    neighbors_by_hop: dict[str, list[NeighborInfo]]
    total_neighbors: int


# ---------------------------------------------------------------------------
# D. QA schemas
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str  # human | ai
    content: str


class QueryRequest(BaseModel):
    question: str
    history: list[ChatMessage] = Field(default_factory=list)


class ToolCallRecord(BaseModel):
    tool: str
    input: dict
    output: str


class QAResult(BaseModel):
    query_id: str
    question: str
    answer: str
    tool_calls: list[ToolCallRecord] = Field(default_factory=list)
    cited_nodes: list[str] = Field(default_factory=list)
    elapsed_seconds: float
    created_at: str


class QAHistoryData(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[QAResult]


class BatchQueryRequest(BaseModel):
    questions: list[str] = Field(..., max_length=20)


class BatchQueryData(BaseModel):
    batch_id: str
    total: int
    status: str
    created_at: str


class BatchResultData(BaseModel):
    batch_id: str
    total: int
    completed: int
    failed: int
    status: str
    results: list[QAResult]


# ---------------------------------------------------------------------------
# E. Search schemas
# ---------------------------------------------------------------------------

class EntitySearchData(BaseModel):
    query: str
    total: int
    items: list[KGNode]


class PathNode(BaseModel):
    id: str
    name: str
    type: str


class PathEdge(BaseModel):
    source: str
    target: str
    relation: str


class PathInfo(BaseModel):
    length: int
    nodes: list[PathNode]
    edges: list[PathEdge]


class PathSearchData(BaseModel):
    from_node: PathNode = Field(alias="from")
    to_node: PathNode = Field(alias="to")
    max_hops: int
    paths: list[PathInfo]
    total_paths: int

    model_config = {"populate_by_name": True}


class GraphSearchData(BaseModel):
    query: str
    matched_nodes: list[KGNode]
    subgraph_edges: list[KGEdge]


# ---------------------------------------------------------------------------
# F. System schemas
# ---------------------------------------------------------------------------

class ComponentHealth(BaseModel):
    status: str  # ok | error
    path: Optional[str] = None
    exists: Optional[bool] = None
    base_url: Optional[str] = None
    key_configured: Optional[bool] = None
    kg_nodes_exists: Optional[bool] = None
    kg_edges_exists: Optional[bool] = None
    uploads_dir_exists: Optional[bool] = None


class HealthData(BaseModel):
    status: str
    version: str
    uptime_seconds: float
    components: dict[str, ComponentHealth]


class SystemStatsData(BaseModel):
    total_documents: int
    indexed_documents: int
    failed_documents: int
    total_nodes: int
    total_edges: int
    type_distribution: dict[str, int]
    total_queries: int
    active_jobs: int
    storage_used_mb: float


class FormatInfo(BaseModel):
    ext: str
    description: str
    max_size_mb: int
    max_pages: int
    requires_ocr: bool


class FormatsData(BaseModel):
    formats: list[FormatInfo]
    ocr_languages: list[dict]
    notes: list[str]


class DemoData(BaseModel):
    nodes: list[KGNode]
    edges: list[KGEdge]
    stats: dict


# ---------------------------------------------------------------------------
# B3 index result
# ---------------------------------------------------------------------------

class IndexResultStats(BaseModel):
    blocks: int = 0
    block_types: dict[str, int] = Field(default_factory=dict)
    pages: int = 0
    raw_extractions: int = 0
    nodes: int = 0
    edges: int = 0
    type_counts: dict[str, int] = Field(default_factory=dict)
    alignment_counts: dict[str, int] = Field(default_factory=dict)
    elapsed_seconds: float = 0.0


class ExtractionRecord(BaseModel):
    text: str
    type: str
    char_start: Optional[int] = None
    char_end: Optional[int] = None
    alignment: Optional[str] = None
    page: int = 0
    doc_id: str


class IndexResultData(BaseModel):
    job_id: str
    doc_id: str
    status: str
    stats: Optional[IndexResultStats] = None
    extractions: Optional[list[ExtractionRecord]] = None
    nodes: Optional[list[KGNode]] = None
    edges: Optional[list[KGEdge]] = None

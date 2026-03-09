/**
 * GraphRAG Studio — Backend API Client
 * Base: http://localhost:8000/api/v1
 * All functions return the `data` field; throw ApiError on code !== 0
 */

const BASE = 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  code: number;
  constructor(code: number, msg: string) {
    super(msg);
    this.code = code;
  }
}

async function request<T>(
  method: string,
  path: string,
  options: {
    body?: unknown;
    formData?: FormData;
    params?: Record<string, string | number | boolean | undefined | null>;
  } = {}
): Promise<T> {
  let url = BASE + path;

  if (options.params) {
    const parts = Object.entries(options.params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    if (parts.length) url += '?' + parts.join('&');
  }

  const init: RequestInit = { method };
  if (options.formData) {
    init.body = options.formData;
  } else if (options.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, init);
  const json = await res.json();
  if (json.code !== 0) throw new ApiError(json.code, json.msg ?? 'Unknown error');
  return json.data as T;
}

const get = <T>(path: string, params?: Record<string, string | number | boolean | undefined | null>) =>
  request<T>('GET', path, { params });
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, { body });
const postForm = <T>(path: string, fd: FormData) => request<T>('POST', path, { formData: fd });
const del = <T>(path: string) => request<T>('DELETE', path);

// ─── Response Types ───────────────────────────────────────────────────────────

export interface ApiDoc {
  doc_id: string;
  filename: string;
  format: string;
  pages: number | null;
  status: 'uploaded' | 'indexing' | 'indexed' | 'failed';
  upload_date: string;
  job_id?: string | null;
  file_size?: number;
  error_msg?: string | null;
}

export interface ApiJobStatus {
  job_id: string;
  doc_id: string;
  status: 'submitted' | 'queued' | 'parsing' | 'extracting' | 'indexing' | 'done' | 'failed' | 'cancelled';
  stage: string;
  progress: number; // 0.0–1.0
  started_at?: string;
  updated_at?: string;
  error_msg?: string | null;
}

export interface ApiIndexResult {
  job_id: string;
  doc_id: string;
  status: string;
  nodes_added: number;
  edges_added: number;
  total_nodes: number;
  total_edges: number;
  pages_processed: number;
  extractions_count: number;
  duration_seconds: number;
}

export interface ApiKGNode {
  id: string;
  name: string;
  type: string;
  page: number;
  confidence: string;
  degree: number;
  doc_id: string;
  // Only present in detail endpoint:
  degree_centrality?: number;
  neighbor_count?: number;
}

export interface ApiKGEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  doc_id: string;
  page: number;
}

export interface ApiHealthData {
  status: string;
  version: string;
  uptime_seconds: number;
  components: {
    mineru_venv: { status: string };
    langextract_venv: { status: string };
    deepseek_api: { status: string };
    storage: { status: string };
  };
}

export interface ApiStats {
  total_documents: number;
  indexed_documents: number;
  failed_documents: number;
  total_nodes: number;
  total_edges: number;
  total_queries: number;
  active_jobs: number;
  storage_used_mb: number;
}

export interface ApiToolCall {
  step: number;
  tool_name: string;
  tool_input: string;
  tool_output: string;
}

export interface ApiQueryResult {
  id: string;
  question: string;
  answer: string;
  tool_calls: ApiToolCall[];
  cited_nodes: string[]; // node IDs
  duration_seconds: number;
  timestamp: string;
}

export interface ApiSearchResult {
  query: string;
  total: number;
  items: ApiKGNode[];
}

export interface ApiPathResult {
  from: { id: string; name: string; type: string };
  to: { id: string; name: string; type: string };
  max_hops: number;
  total_paths: number;
  paths: Array<{
    length: number;
    nodes: Array<{ id: string; name: string; type: string }>;
    edges?: Array<{ source: string; target: string; relation: string }>;
  }>;
}

export interface ApiGraphSearchResult {
  query: string;
  matched_nodes: ApiKGNode[];
  subgraph_edges: ApiKGEdge[];
  total_nodes: number;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export const api = {
  // A: Documents
  listDocuments: (page = 1, pageSize = 100) =>
    get<{ total: number; page: number; page_size: number; items: ApiDoc[] }>(
      '/documents', { page, page_size: pageSize }
    ),

  getDocument: (docId: string) => get<ApiDoc>(`/documents/${docId}`),

  uploadDocument: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return postForm<{ doc_id: string; filename: string; format: string; status: string }>(
      '/documents/upload', fd
    );
  },

  deleteDocument: (docId: string) =>
    del<{ doc_id: string; removed_nodes: number; removed_edges: number }>(`/documents/${docId}`),

  // B: Indexing
  startIndexing: (docId: string) =>
    post<{ job_id: string; doc_id: string; status: string }>('/index/start', { doc_id: docId }),

  getJobStatus: (jobId: string) => get<ApiJobStatus>(`/index/status/${jobId}`),

  getJobResult: (jobId: string) => get<ApiIndexResult>(`/index/result/${jobId}`),

  cancelJob: (jobId: string) => del<{ job_id: string }>(`/index/jobs/${jobId}`),

  // C: Knowledge Graph
  getNodes: (params?: { page?: number; pageSize?: number; type?: string; docId?: string }) =>
    get<{ total: number; page: number; page_size: number; items: ApiKGNode[] }>('/kg/nodes', {
      page: params?.page,
      page_size: params?.pageSize ?? 500,
      type: params?.type,
      doc_id: params?.docId,
    }),

  getEdges: (params?: { page?: number; pageSize?: number; docId?: string }) =>
    get<{ total: number; page: number; page_size: number; items: ApiKGEdge[] }>('/kg/edges', {
      page: params?.page,
      page_size: params?.pageSize ?? 2000,
      doc_id: params?.docId,
    }),

  getNodeDetail: (nodeId: string) => get<ApiKGNode>(`/kg/nodes/${nodeId}`),

  getNodeNeighbors: (nodeId: string, hops = 1) =>
    get<{
      center: ApiKGNode;
      hops: number;
      neighbors_by_hop: Record<string, ApiKGNode[]>;
      total_neighbors: number;
    }>(`/kg/nodes/${nodeId}/neighbors`, { hops }),

  getKGStats: () =>
    get<{ total_nodes: number; total_edges: number; type_distribution: Record<string, number> }>('/kg/stats'),

  exportKG: () => get<{ nodes: ApiKGNode[]; edges: ApiKGEdge[] }>('/kg/export'),

  // D: QA Query
  query: (question: string, history: { question: string; answer: string }[] = []) =>
    post<ApiQueryResult>('/query', { question, history }),

  getQueryHistory: (page = 1, pageSize = 50) =>
    get<{ total: number; page: number; page_size: number; items: ApiQueryResult[] }>(
      '/query/history', { page, page_size: pageSize }
    ),

  // E: Search
  searchEntities: (q: string, type?: string, limit = 15) =>
    get<ApiSearchResult>('/search/entities', {
      q,
      type: type && type !== '全部类型' ? type : undefined,
      limit,
    }),

  searchPath: (fromId: string, toId: string, maxHops = 3) =>
    get<ApiPathResult>('/search/path', { from: fromId, to: toId, max_hops: maxHops }),

  searchGraph: (q: string, includeNeighbors = false) =>
    get<ApiGraphSearchResult>('/search/graph', { q, include_neighbors: includeNeighbors }),

  // F: System
  getHealth: () => get<ApiHealthData>('/health'),

  getSystemStats: () => get<ApiStats>('/system/stats'),

  getDemoData: () =>
    get<{ nodes: ApiKGNode[]; edges: ApiKGEdge[]; stats: Record<string, unknown> }>('/system/demo'),
};

// Mock data for GraphRAG Studio

export interface KGNode {
  id: string;
  name: string;
  type: 'TECHNOLOGY' | 'CONCEPT' | 'PERSON' | 'ORGANIZATION' | 'LOCATION';
  page: number;
  confidence: 'match_exact' | 'match_greater' | 'match_lesser' | 'match_fuzzy';
  degree: number;
  centrality: number;
  doc_id: string;
  description?: string;
}

export interface KGEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  weight: number;
}

export interface Document {
  id: string;
  filename: string;
  format: string;
  pages: number;
  status: 'uploaded' | 'indexing' | 'indexed' | 'failed';
  upload_date: string;
  job_id?: string;
  index_stage?: string;
  progress?: number;
  error?: string;
  result?: {
    nodes: number;
    edges: number;
    pages: number;
    extractions: number;
    duration: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'human' | 'ai';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  citedNodes?: { id: string; name: string; type: string }[];
  duration?: number;
}

export interface ToolCall {
  step: number;
  tool: string;
  input: string;
  output: string;
}

export interface HistoryItem {
  id: string;
  question: string;
  timestamp: string;
  group: '今天' | '昨天' | '更早';
}

// Entity type colors
export const TYPE_COLORS: Record<string, string> = {
  TECHNOLOGY: '#58a6ff',
  CONCEPT: '#bc8cff',
  PERSON: '#3fb950',
  ORGANIZATION: '#ff7b72',
  LOCATION: '#ffa657',
};

// Mock KG Nodes
export const mockNodes: KGNode[] = [
  { id: 'n1', name: 'GraphRAG', type: 'TECHNOLOGY', page: 0, confidence: 'match_exact', degree: 39, centrality: 0.92, doc_id: 'd1', description: 'A knowledge graph enhanced retrieval-augmented generation system that combines structured graph data with LLM capabilities.' },
  { id: 'n2', name: 'Knowledge Graph', type: 'CONCEPT', page: 1, confidence: 'match_exact', degree: 35, centrality: 0.88, doc_id: 'd1', description: 'A structured representation of real-world entities and their relationships.' },
  { id: 'n3', name: 'LLM', type: 'TECHNOLOGY', page: 0, confidence: 'match_exact', degree: 28, centrality: 0.85, doc_id: 'd1', description: 'Large Language Models - neural networks trained on vast text corpora.' },
  { id: 'n4', name: 'RAG', type: 'TECHNOLOGY', page: 1, confidence: 'match_exact', degree: 24, centrality: 0.82, doc_id: 'd1', description: 'Retrieval-Augmented Generation - combining retrieval with generation.' },
  { id: 'n5', name: 'Entity Extraction', type: 'CONCEPT', page: 2, confidence: 'match_exact', degree: 18, centrality: 0.72, doc_id: 'd1' },
  { id: 'n6', name: 'DeepSeek', type: 'TECHNOLOGY', page: 3, confidence: 'match_exact', degree: 15, centrality: 0.68, doc_id: 'd1' },
  { id: 'n7', name: 'LangChain', type: 'TECHNOLOGY', page: 2, confidence: 'match_exact', degree: 14, centrality: 0.65, doc_id: 'd1' },
  { id: 'n8', name: 'Vector Search', type: 'CONCEPT', page: 1, confidence: 'match_greater', degree: 12, centrality: 0.60, doc_id: 'd1' },
  { id: 'n9', name: 'Transformer', type: 'TECHNOLOGY', page: 3, confidence: 'match_exact', degree: 20, centrality: 0.78, doc_id: 'd2' },
  { id: 'n10', name: 'Attention Mechanism', type: 'CONCEPT', page: 2, confidence: 'match_exact', degree: 16, centrality: 0.70, doc_id: 'd2' },
  { id: 'n11', name: 'BERT', type: 'TECHNOLOGY', page: 1, confidence: 'match_exact', degree: 13, centrality: 0.62, doc_id: 'd2' },
  { id: 'n12', name: 'GPT', type: 'TECHNOLOGY', page: 0, confidence: 'match_exact', degree: 22, centrality: 0.80, doc_id: 'd2' },
  { id: 'n13', name: 'Microsoft Research', type: 'ORGANIZATION', page: 0, confidence: 'match_exact', degree: 8, centrality: 0.45, doc_id: 'd1' },
  { id: 'n14', name: 'OpenAI', type: 'ORGANIZATION', page: 1, confidence: 'match_exact', degree: 10, centrality: 0.52, doc_id: 'd2' },
  { id: 'n15', name: 'ReAct Framework', type: 'CONCEPT', page: 3, confidence: 'match_exact', degree: 9, centrality: 0.48, doc_id: 'd1' },
  { id: 'n16', name: 'MinerU', type: 'TECHNOLOGY', page: 2, confidence: 'match_exact', degree: 7, centrality: 0.40, doc_id: 'd1' },
  { id: 'n17', name: 'NetworkX', type: 'TECHNOLOGY', page: 3, confidence: 'match_greater', degree: 6, centrality: 0.35, doc_id: 'd1' },
  { id: 'n18', name: 'Prompt Engineering', type: 'CONCEPT', page: 2, confidence: 'match_exact', degree: 11, centrality: 0.55, doc_id: 'd2' },
  { id: 'n19', name: 'Semantic Search', type: 'CONCEPT', page: 1, confidence: 'match_exact', degree: 14, centrality: 0.64, doc_id: 'd1' },
  { id: 'n20', name: 'NLP', type: 'CONCEPT', page: 0, confidence: 'match_exact', degree: 25, centrality: 0.83, doc_id: 'd2' },
  { id: 'n21', name: 'Fine-tuning', type: 'CONCEPT', page: 3, confidence: 'match_greater', degree: 10, centrality: 0.50, doc_id: 'd2' },
  { id: 'n22', name: 'Embedding', type: 'CONCEPT', page: 2, confidence: 'match_exact', degree: 17, centrality: 0.71, doc_id: 'd1' },
  { id: 'n23', name: 'Document Parsing', type: 'CONCEPT', page: 1, confidence: 'match_exact', degree: 8, centrality: 0.42, doc_id: 'd1' },
  { id: 'n24', name: 'Google', type: 'ORGANIZATION', page: 2, confidence: 'match_exact', degree: 9, centrality: 0.47, doc_id: 'd2' },
  { id: 'n25', name: 'Beijing', type: 'LOCATION', page: 0, confidence: 'match_fuzzy', degree: 3, centrality: 0.20, doc_id: 'd1' },
  { id: 'n26', name: 'San Francisco', type: 'LOCATION', page: 1, confidence: 'match_fuzzy', degree: 4, centrality: 0.25, doc_id: 'd2' },
  { id: 'n27', name: 'Multi-hop Reasoning', type: 'CONCEPT', page: 3, confidence: 'match_exact', degree: 11, centrality: 0.56, doc_id: 'd1' },
  { id: 'n28', name: 'Graph Neural Network', type: 'TECHNOLOGY', page: 2, confidence: 'match_greater', degree: 8, centrality: 0.44, doc_id: 'd2' },
  { id: 'n29', name: 'Yann LeCun', type: 'PERSON', page: 1, confidence: 'match_exact', degree: 5, centrality: 0.30, doc_id: 'd2' },
  { id: 'n30', name: 'Ilya Sutskever', type: 'PERSON', page: 0, confidence: 'match_exact', degree: 6, centrality: 0.33, doc_id: 'd2' },
  { id: 'n31', name: 'Community Detection', type: 'CONCEPT', page: 3, confidence: 'match_exact', degree: 7, centrality: 0.38, doc_id: 'd1' },
  { id: 'n32', name: 'Summarization', type: 'CONCEPT', page: 2, confidence: 'match_exact', degree: 9, centrality: 0.46, doc_id: 'd1' },
  { id: 'n33', name: 'FAISS', type: 'TECHNOLOGY', page: 1, confidence: 'match_exact', degree: 8, centrality: 0.43, doc_id: 'd1' },
  { id: 'n34', name: 'Chunking', type: 'CONCEPT', page: 2, confidence: 'match_greater', degree: 10, centrality: 0.51, doc_id: 'd1' },
  { id: 'n35', name: 'Token', type: 'CONCEPT', page: 0, confidence: 'match_exact', degree: 13, centrality: 0.61, doc_id: 'd2' },
  { id: 'n36', name: 'Inference', type: 'CONCEPT', page: 3, confidence: 'match_exact', degree: 12, centrality: 0.58, doc_id: 'd2' },
  { id: 'n37', name: 'Co-occurrence', type: 'CONCEPT', page: 1, confidence: 'match_exact', degree: 6, centrality: 0.34, doc_id: 'd1' },
  { id: 'n38', name: 'Pipeline', type: 'CONCEPT', page: 2, confidence: 'match_exact', degree: 11, centrality: 0.54, doc_id: 'd1' },
  { id: 'n39', name: 'API', type: 'TECHNOLOGY', page: 3, confidence: 'match_exact', degree: 9, centrality: 0.49, doc_id: 'd1' },
  { id: 'n40', name: 'Hallucination', type: 'CONCEPT', page: 1, confidence: 'match_exact', degree: 7, centrality: 0.39, doc_id: 'd2' },
];

// Mock KG Edges
export const mockEdges: KGEdge[] = [
  { id: 'e1', source: 'n1', target: 'n2', relation: 'CO_OCCURS_IN', weight: 0.95 },
  { id: 'e2', source: 'n1', target: 'n3', relation: 'CO_OCCURS_IN', weight: 0.92 },
  { id: 'e3', source: 'n1', target: 'n4', relation: 'CO_OCCURS_IN', weight: 0.98 },
  { id: 'e4', source: 'n2', target: 'n5', relation: 'CO_OCCURS_IN', weight: 0.88 },
  { id: 'e5', source: 'n3', target: 'n6', relation: 'CO_OCCURS_IN', weight: 0.85 },
  { id: 'e6', source: 'n3', target: 'n7', relation: 'CO_OCCURS_IN', weight: 0.82 },
  { id: 'e7', source: 'n4', target: 'n8', relation: 'CO_OCCURS_IN', weight: 0.80 },
  { id: 'e8', source: 'n1', target: 'n15', relation: 'CO_OCCURS_IN', weight: 0.78 },
  { id: 'e9', source: 'n1', target: 'n16', relation: 'CO_OCCURS_IN', weight: 0.75 },
  { id: 'e10', source: 'n2', target: 'n17', relation: 'CO_OCCURS_IN', weight: 0.72 },
  { id: 'e11', source: 'n9', target: 'n10', relation: 'CO_OCCURS_IN', weight: 0.94 },
  { id: 'e12', source: 'n9', target: 'n11', relation: 'CO_OCCURS_IN', weight: 0.90 },
  { id: 'e13', source: 'n9', target: 'n12', relation: 'CO_OCCURS_IN', weight: 0.93 },
  { id: 'e14', source: 'n12', target: 'n14', relation: 'CO_OCCURS_IN', weight: 0.88 },
  { id: 'e15', source: 'n1', target: 'n13', relation: 'CO_OCCURS_IN', weight: 0.70 },
  { id: 'e16', source: 'n3', target: 'n9', relation: 'CO_OCCURS_IN', weight: 0.86 },
  { id: 'e17', source: 'n4', target: 'n19', relation: 'CO_OCCURS_IN', weight: 0.84 },
  { id: 'e18', source: 'n3', target: 'n20', relation: 'CO_OCCURS_IN', weight: 0.91 },
  { id: 'e19', source: 'n12', target: 'n18', relation: 'CO_OCCURS_IN', weight: 0.80 },
  { id: 'e20', source: 'n3', target: 'n21', relation: 'CO_OCCURS_IN', weight: 0.77 },
  { id: 'e21', source: 'n4', target: 'n22', relation: 'CO_OCCURS_IN', weight: 0.89 },
  { id: 'e22', source: 'n16', target: 'n23', relation: 'CO_OCCURS_IN', weight: 0.82 },
  { id: 'e23', source: 'n9', target: 'n24', relation: 'CO_OCCURS_IN', weight: 0.70 },
  { id: 'e24', source: 'n6', target: 'n25', relation: 'CO_OCCURS_IN', weight: 0.55 },
  { id: 'e25', source: 'n14', target: 'n26', relation: 'CO_OCCURS_IN', weight: 0.58 },
  { id: 'e26', source: 'n1', target: 'n27', relation: 'CO_OCCURS_IN', weight: 0.85 },
  { id: 'e27', source: 'n2', target: 'n28', relation: 'CO_OCCURS_IN', weight: 0.75 },
  { id: 'e28', source: 'n20', target: 'n29', relation: 'CO_OCCURS_IN', weight: 0.65 },
  { id: 'e29', source: 'n14', target: 'n30', relation: 'CO_OCCURS_IN', weight: 0.68 },
  { id: 'e30', source: 'n2', target: 'n31', relation: 'CO_OCCURS_IN', weight: 0.78 },
  { id: 'e31', source: 'n1', target: 'n32', relation: 'CO_OCCURS_IN', weight: 0.76 },
  { id: 'e32', source: 'n8', target: 'n33', relation: 'CO_OCCURS_IN', weight: 0.88 },
  { id: 'e33', source: 'n23', target: 'n34', relation: 'CO_OCCURS_IN', weight: 0.80 },
  { id: 'e34', source: 'n3', target: 'n35', relation: 'CO_OCCURS_IN', weight: 0.90 },
  { id: 'e35', source: 'n12', target: 'n36', relation: 'CO_OCCURS_IN', weight: 0.87 },
  { id: 'e36', source: 'n5', target: 'n37', relation: 'CO_OCCURS_IN', weight: 0.72 },
  { id: 'e37', source: 'n1', target: 'n38', relation: 'CO_OCCURS_IN', weight: 0.83 },
  { id: 'e38', source: 'n6', target: 'n39', relation: 'CO_OCCURS_IN', weight: 0.79 },
  { id: 'e39', source: 'n3', target: 'n40', relation: 'CO_OCCURS_IN', weight: 0.74 },
  { id: 'e40', source: 'n22', target: 'n8', relation: 'CO_OCCURS_IN', weight: 0.86 },
  { id: 'e41', source: 'n19', target: 'n22', relation: 'CO_OCCURS_IN', weight: 0.84 },
  { id: 'e42', source: 'n7', target: 'n15', relation: 'CO_OCCURS_IN', weight: 0.77 },
  { id: 'e43', source: 'n5', target: 'n7', relation: 'CO_OCCURS_IN', weight: 0.81 },
  { id: 'e44', source: 'n20', target: 'n10', relation: 'CO_OCCURS_IN', weight: 0.88 },
  { id: 'e45', source: 'n11', target: 'n20', relation: 'CO_OCCURS_IN', weight: 0.85 },
  { id: 'e46', source: 'n2', target: 'n19', relation: 'CO_OCCURS_IN', weight: 0.82 },
  { id: 'e47', source: 'n27', target: 'n15', relation: 'CO_OCCURS_IN', weight: 0.79 },
  { id: 'e48', source: 'n34', target: 'n22', relation: 'CO_OCCURS_IN', weight: 0.76 },
  { id: 'e49', source: 'n32', target: 'n3', relation: 'CO_OCCURS_IN', weight: 0.80 },
  { id: 'e50', source: 'n38', target: 'n16', relation: 'CO_OCCURS_IN', weight: 0.74 },
];

// Mock Documents
export const mockDocuments: Document[] = [
  {
    id: 'd1',
    filename: 'graphrag_paper.pdf',
    format: 'PDF',
    pages: 4,
    status: 'indexed',
    upload_date: '2026-03-04T10:23:00Z',
    job_id: 'j1',
    result: { nodes: 25, edges: 38, pages: 4, extractions: 45, duration: 42.1 },
  },
  {
    id: 'd2',
    filename: 'transformer_survey.pdf',
    format: 'PDF',
    pages: 8,
    status: 'indexed',
    upload_date: '2026-03-03T14:15:00Z',
    job_id: 'j2',
    result: { nodes: 15, edges: 12, pages: 8, extractions: 32, duration: 68.5 },
  },
  {
    id: 'd3',
    filename: 'rag_techniques.docx',
    format: 'DOCX',
    pages: 12,
    status: 'indexing',
    upload_date: '2026-03-05T08:45:00Z',
    job_id: 'j3',
    index_stage: 'extracting',
    progress: 52,
  },
  {
    id: 'd4',
    filename: 'llm_benchmark.pptx',
    format: 'PPTX',
    pages: 24,
    status: 'uploaded',
    upload_date: '2026-03-05T09:10:00Z',
  },
  {
    id: 'd5',
    filename: 'kg_construction_guide.pdf',
    format: 'PDF',
    pages: 6,
    status: 'failed',
    upload_date: '2026-03-02T16:30:00Z',
    job_id: 'j5',
    error: 'MinerU failed: timeout after 600s',
  },
];

// Mock Chat History
export const mockChatHistory: HistoryItem[] = [
  { id: 'h1', question: '给我一个知识图谱的概览', timestamp: '2026-03-05T09:30:00Z', group: '今天' },
  { id: 'h2', question: 'GraphRAG 与知识图谱的关系？', timestamp: '2026-03-05T08:15:00Z', group: '今天' },
  { id: 'h3', question: '列出所有 TECHNOLOGY 实体', timestamp: '2026-03-04T14:20:00Z', group: '昨天' },
  { id: 'h4', question: '什么是检索增强生成？', timestamp: '2026-03-04T10:00:00Z', group: '昨天' },
  { id: 'h5', question: '对比 BERT 和 GPT 架构', timestamp: '2026-03-02T16:45:00Z', group: '更早' },
];

// Mock Chat Messages
export const mockMessages: ChatMessage[] = [
  {
    id: 'm1',
    role: 'human',
    content: '给我一个知识图谱的概览',
    timestamp: '2026-03-05T09:30:00Z',
  },
  {
    id: 'm2',
    role: 'ai',
    content: `## 知识图谱概览\n\n当前知识图谱包含 **40 个节点**和 **50 条边**，从 2 份文档中提取。\n\n### 关键统计\n- **实体类型：** TECHNOLOGY (10), CONCEPT (18), PERSON (2), ORGANIZATION (3), LOCATION (2)\n- **最高连接度节点：** GraphRAG（度数：39）\n- **已索引文档：** graphrag_paper.pdf, transformer_survey.pdf\n\n### 核心主题\n知识图谱揭示了 **GraphRAG**、**知识图谱**和 **LLM** 技术之间的强关联。中心簇聚焦于检索增强生成技术，卫星簇围绕 Transformer 架构和 NLP 概念展开。\n\n### 主要关系\n1. GraphRAG 与 RAG、知识图谱和多跳推理紧密相连\n2. LLM 作为 GraphRAG 簇和 Transformer 簇之间的桥梁\n3. 实体提取将文档处理（MinerU、文档解析）与知识表示连接起来`,
    timestamp: '2026-03-05T09:30:08Z',
    toolCalls: [
      { step: 1, tool: 'search_entities', input: '{"query": "knowledge graph", "limit": 10}', output: '{"entities": [{"name": "Knowledge Graph", "type": "CONCEPT", "degree": 35}, ...]}' },
      { step: 2, tool: 'get_kg_stats', input: '{}', output: '{"nodes": 40, "edges": 50, "types": {"TECHNOLOGY": 10, "CONCEPT": 18, "PERSON": 2, "ORGANIZATION": 3, "LOCATION": 2}}' },
      { step: 3, tool: 'get_neighbors', input: '{"node_id": "n1", "hops": 1}', output: '{"neighbors": [{"name": "Knowledge Graph"}, {"name": "LLM"}, {"name": "RAG"}, ...]}' },
    ],
    citedNodes: [
      { id: 'n1', name: 'GraphRAG', type: 'TECHNOLOGY' },
      { id: 'n2', name: 'Knowledge Graph', type: 'CONCEPT' },
      { id: 'n3', name: 'LLM', type: 'TECHNOLOGY' },
      { id: 'n4', name: 'RAG', type: 'TECHNOLOGY' },
    ],
    duration: 8.4,
  },
];

// Suggested prompts
export const suggestedPrompts = [
  '给我一个知识图谱的概览',
  '列出所有 TECHNOLOGY 实体',
  'GraphRAG 与知识图谱有什么关系？',
  '什么是检索增强生成？',
];

// Health status
export const mockHealth = {
  mineru: 'ok' as const,
  langextract: 'ok' as const,
  deepseek: 'ok' as const,
  storage: 'ok' as const,
};

// System stats
export const mockStats = {
  kg_nodes: 40,
  kg_edges: 50,
  documents: 5,
  queries: 12,
};
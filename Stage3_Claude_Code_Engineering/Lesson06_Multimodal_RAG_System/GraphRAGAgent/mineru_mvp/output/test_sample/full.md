# GraphRAG: Knowledge Graph Enhanced RAG System

# 1. Introduction

GraphRAG is an advanced retrieval-augmented generation technique developed by Microsoft Research. It combines knowledge graphs with large language models to enable more accurate and contextually rich question answering over complex document collections. Unlike traditional RAG systems that rely solely on vector similarity search, GraphRAG constructs a hierarchical knowledge graph from source documents, enabling multi-hop reasoning and global summarization capabilities.

# 2. Architecture Overview

The GraphRAG pipeline consists of several key stages: (1) Document Parsing - raw documents are converted into structured text using tools like MinerU; (2) Entity Extraction - named entities and relationships are extracted using LLMs or specialized NLP models such as LangExtract; (3) Graph Construction - entities and relationships are organized into a knowledge graph with community detection; (4) Indexing - both vector embeddings and graph indices are built for hybrid retrieval; (5) Query Processing - user queries are decomposed and answered using graph traversal combined with LLM generation.

# 3. Performance Comparison

The following table compares GraphRAG with traditional RAG approaches across several evaluation metrics on the NarrativeQA benchmark dataset:

<table><tr><td rowspan=1 colspan=2>Method              Comprehensiveness</td><td rowspan=1 colspan=1>Diversity</td><td rowspan=1 colspan=1>Empowerment</td><td rowspan=1 colspan=1>Overall</td></tr><tr><td rowspan=1 colspan=1>Naive RAG</td><td rowspan=1 colspan=1>32.4%</td><td rowspan=1 colspan=1>15.8%</td><td rowspan=1 colspan=1>28.6%</td><td rowspan=1 colspan=1>25.6%</td></tr><tr><td rowspan=1 colspan=1>HyDE RAG</td><td rowspan=1 colspan=1>41.2%</td><td rowspan=1 colspan=1>22.1%</td><td rowspan=1 colspan=1>35.7%</td><td rowspan=1 colspan=1>33.0%</td></tr><tr><td rowspan=1 colspan=1>GraphRAG (Local)</td><td rowspan=1 colspan=1>58.7%</td><td rowspan=1 colspan=1>45.3%</td><td rowspan=1 colspan=1>52.1%</td><td rowspan=1 colspan=1>52.0%</td></tr><tr><td rowspan=1 colspan=1>GraphRAG (Global)</td><td rowspan=1 colspan=1>72.0%</td><td rowspan=1 colspan=1>62.4%</td><td rowspan=1 colspan=1>68.5%</td><td rowspan=1 colspan=1>67.6%</td></tr></table>

# 4. Conclusion

GraphRAG represents a significant advancement over traditional RAG approaches by leveraging the structural properties of knowledge graphs. The combination of entity extraction, community detection, and hierarchical summarization enables both local and global question answering capabilities. Our experiments demonstrate that GraphRAG achieves substantial improvements in comprehensiveness $7 2 . 0 \%$ vs $3 2 . 4 \%$ ) and overall quality $( 6 7 . 6 \%$ vs $2 5 . 6 \%$ ) compared to naive RAG baselines.
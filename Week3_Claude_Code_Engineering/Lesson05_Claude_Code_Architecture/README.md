# Lesson 05: Claude Code Architecture — Industrial-Grade Practice

<div align="center">

English | [中文](./README_CN.md)

</div>

This lesson covers Claude Code architecture and engineering workflows, and now includes a GraphRAG-oriented practice project and supporting research materials.

## Topics

- Claude Code architecture overview and CLI deep dive
- Context engineering and prompt strategies
- Industrial-grade development workflows and project organization
- GraphRAG pipeline prototyping (extraction, assembly, and serving)

## Course Materials

- **01_课件/**
  - [04_ClaudeCode工业级实战.pdf](./Courseware/01_课件/04_ClaudeCode工业级实战.pdf)
  - [04_ClaudeCode工业级实战.excalidraw](./Courseware/01_课件/04_ClaudeCode工业级实战.excalidraw)
  - [20260304-直播协作链接.excalidraw](./Courseware/01_课件/20260304-直播协作链接.excalidraw)
- **02_课件资料/**
  - [paper.pdf](./Courseware/02_课件资料/paper.pdf)
  - [short_paper.pdf](./Courseware/02_课件资料/short_paper.pdf)
  - [sample_graphrag_overview.pdf](./Courseware/02_课件资料/sample_graphrag_overview.pdf)
  - [settings.json](./Courseware/02_课件资料/settings.json)

## Project Assets

- **[GraphRAGAgent](./GraphRAGAgent/)**: lesson practice workspace
- Key modules:
  - [graphrag_pipeline](./GraphRAGAgent/graphrag_pipeline/) (entry: [web_server.py](./GraphRAGAgent/graphrag_pipeline/web_server.py))
  - [mineru_mvp](./GraphRAGAgent/mineru_mvp/) (entry: [pipeline.py](./GraphRAGAgent/mineru_mvp/pipeline.py))
  - [langextract_src](./GraphRAGAgent/langextract_src/) (entry: [README.md](./GraphRAGAgent/langextract_src/README.md))
- Specs and design docs:
  - [bridge_pipeline_specification-v1.0.md](./GraphRAGAgent/docs/bridge_pipeline_specification-v1.0.md)
  - [langextract_specification-v1.0.md](./GraphRAGAgent/docs/langextract_specification-v1.0.md)
  - [mineru_specification-v1.0.md](./GraphRAGAgent/docs/mineru_specification-v1.0.md)

## Related

- [← Back to Week 3](../README.md)

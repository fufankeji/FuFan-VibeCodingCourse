# Lesson 05: Claude Code 架构拆解 · 工业级实战

<div align="center">

[English](./README.md) | 中文

</div>

本课聚焦 Claude Code 的架构与核心能力，覆盖工业级工程实践，并新增 GraphRAG 方向的实战项目与配套资料。

## 主题

- Claude Code 架构概览与 CLI 深入讲解
- 上下文工程与提示词策略
- 工业级开发流程与项目组织方式
- GraphRAG 流水线原型实践（抽取、组装与服务）

## 课程资料

- **01_课件/**
  - [04_ClaudeCode工业级实战.pdf](./Courseware/01_课件/04_ClaudeCode工业级实战.pdf)
  - [04_ClaudeCode工业级实战.excalidraw](./Courseware/01_课件/04_ClaudeCode工业级实战.excalidraw)
  - [20260304-直播协作链接.excalidraw](./Courseware/01_课件/20260304-直播协作链接.excalidraw)
- **02_课件资料/**
  - [paper.pdf](./Courseware/02_课件资料/paper.pdf)
  - [short_paper.pdf](./Courseware/02_课件资料/short_paper.pdf)
  - [sample_graphrag_overview.pdf](./Courseware/02_课件资料/sample_graphrag_overview.pdf)
  - [settings.json](./Courseware/02_课件资料/settings.json)

## 实战项目

- **[GraphRAGAgent](./GraphRAGAgent/)**：本课配套实战工作区
- 核心模块：
  - [graphrag_pipeline](./GraphRAGAgent/graphrag_pipeline/)（入口：[web_server.py](./GraphRAGAgent/graphrag_pipeline/web_server.py)）
  - [mineru_mvp](./GraphRAGAgent/mineru_mvp/)（入口：[pipeline.py](./GraphRAGAgent/mineru_mvp/pipeline.py)）
  - [langextract_src](./GraphRAGAgent/langextract_src/)（入口：[README.md](./GraphRAGAgent/langextract_src/README.md)）
- 规范与设计文档：
  - [bridge_pipeline_specification-v1.0.md](./GraphRAGAgent/docs/bridge_pipeline_specification-v1.0.md)
  - [langextract_specification-v1.0.md](./GraphRAGAgent/docs/langextract_specification-v1.0.md)
  - [mineru_specification-v1.0.md](./GraphRAGAgent/docs/mineru_specification-v1.0.md)

## 相关

- [← 返回 Week 3 目录](../README_CN.md)

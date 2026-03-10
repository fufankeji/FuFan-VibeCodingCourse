# GraphRAG Bridge Pipeline — 开发规范

## 虚拟环境

本组件 **复用 LangExtract 的虚拟环境**，不单独创建 venv。

**所有 Python 命令必须使用 LangExtract 子虚拟环境运行，禁止使用全局 Python 或其他组件的 venv。**

### 环境信息

- 虚拟环境路径：`F:\GraphRAGAgent\langextract_src\.venv\`
- Python 版本：3.12
- 核心依赖：langextract[all]、beautifulsoup4、python-dotenv、flask

### 运行方式

```bash
# Bridge Pipeline（命令行）
F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe F:/GraphRAGAgent/graphrag_pipeline/bridge.py

# 指定输入路径
F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe F:/GraphRAGAgent/graphrag_pipeline/bridge.py path/to/content_list.json

# Web 可视化服务器（浏览器访问 http://localhost:5000）
F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe F:/GraphRAGAgent/graphrag_pipeline/web_server.py
```

### 安装新依赖

```bash
uv pip install <package> --python F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe
```

## 配置文件

- `.env` — 存放 `DEEPSEEK_API_KEY` 和 `DEEPSEEK_BASE_URL`

## 数据流

```
MinerU content_list.json → text_assembler → entity_extractor → kg_builder → kg_nodes.json + kg_edges.json
```

## 目录结构

```
graphrag_pipeline/
├── .env                     # DeepSeek API 配置
├── CLAUDE.md                # 本文件
├── bridge.py                # 主入口（命令行）
├── web_server.py            # Flask Web 服务器
├── text_assembler.py        # MinerU JSON → 按页纯文本
├── entity_extractor.py      # LangExtract + DeepSeek 封装
├── kg_builder.py            # KG 节点去重 + 边生成
├── static/
│   └── index.html           # 单页前端（D3.js 知识图谱可视化）
├── uploads/                 # PDF 上传临时目录
└── output/
    ├── kg_nodes.json        # 知识图谱节点
    └── kg_edges.json        # 知识图谱边
```

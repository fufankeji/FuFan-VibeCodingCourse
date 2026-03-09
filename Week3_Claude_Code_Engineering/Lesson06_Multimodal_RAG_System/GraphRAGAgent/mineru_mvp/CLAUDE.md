# MinerU MVP 组件 — 开发规范

## 虚拟环境

本组件使用独立的 Python 虚拟环境，与项目其他组件（LangExtract、GraphRAG Pipeline 等）完全隔离。

**所有 Python 命令必须在子虚拟环境中运行，禁止使用全局 Python 或其他组件的 venv。**

### 环境信息

- 虚拟环境路径：`F:\GraphRAGAgent\mineru_mvp\.venv\`
- Python 版本：3.12
- 创建工具：uv

### 运行方式

**方式一：直接使用 venv 内的 Python 解释器（推荐）**

```bash
F:/GraphRAGAgent/mineru_mvp/.venv/Scripts/python.exe pipeline.py
F:/GraphRAGAgent/mineru_mvp/.venv/Scripts/python.exe create_test_pdf.py
```

**方式二：先激活环境再运行**

```bash
cd F:/GraphRAGAgent/mineru_mvp
source .venv/Scripts/activate
python pipeline.py
```

### 安装新依赖

```bash
uv pip install <package> --python F:/GraphRAGAgent/mineru_mvp/.venv/Scripts/python.exe
```

### 已安装依赖

- requests — HTTP 客户端
- python-dotenv — .env 配置加载
- reportlab — 测试 PDF 生成

## 配置文件

- `.env` — 存放 `MINERU_API_TOKEN` 和 `MINERU_API_BASE`

## 目录结构

```
mineru_mvp/
├── .env                    # API 配置（Token）
├── .venv/                  # 独立虚拟环境
├── CLAUDE.md               # 本文件
├── create_test_pdf.py      # 测试 PDF 生成
├── pipeline.py             # 完整 Pipeline（5 步）
├── test_sample.pdf         # 生成的测试 PDF
└── output/                 # 解析输出
    └── test_sample/
```

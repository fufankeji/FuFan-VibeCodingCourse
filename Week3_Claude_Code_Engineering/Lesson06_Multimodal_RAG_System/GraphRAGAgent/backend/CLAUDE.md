# Backend — GraphRAG Studio API

## 路径

```
F:\GraphRAGAgent\backend\
```

## 启动命令

```bash
cd F:/GraphRAGAgent/backend
.venv/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## 接口测试

服务启动后，运行：

```bash
.venv/Scripts/python.exe tests/test_api.py
```

## API 文档

- Swagger UI：http://localhost:8000/docs
- ReDoc：http://localhost:8000/redoc
- 健康检查：http://localhost:8000/api/v1/health

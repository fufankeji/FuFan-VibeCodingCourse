# Frontend — 开发说明

## 路径

```
F:\GraphRAGAgent\frontend\
```

## 启动开发服务器

```bash
cd F:/GraphRAGAgent/frontend
pnpm dev
```

启动后访问：http://localhost:5173

## 依赖安装

```bash
cd F:/GraphRAGAgent/frontend
pnpm install
pnpm rebuild @tailwindcss/oxide esbuild
```

> 注意：首次安装后需执行 `pnpm rebuild @tailwindcss/oxide esbuild`，否则 Vite 构建会因原生包未编译而失败。

## 构建生产包

```bash
cd F:/GraphRAGAgent/frontend
pnpm build
```

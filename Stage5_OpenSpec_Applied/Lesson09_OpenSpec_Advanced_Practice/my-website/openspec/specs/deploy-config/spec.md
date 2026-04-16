# deploy-config Specification

## Purpose
TBD - created by archiving change analytics-deploy. Update Purpose after archive.
## Requirements
### Requirement: 前端可通过 GitHub Pages 部署
前端构建产物 SHALL 可直接通过 `npm run deploy` 部署到 GitHub Pages。

#### Scenario: 部署成功
- **WHEN** 执行 `npm run deploy`
- **THEN** `dist/` 目录推送到 `gh-pages` 分支，包含 `404.html` 支持 SPA 路由

#### Scenario: 生产环境 API 地址可配置
- **WHEN** 设置环境变量 `VITE_API_BASE`
- **THEN** 前端所有 API 请求使用该 base URL 前缀

### Requirement: 后端部署配置文档化
项目 SHALL 包含后端部署到云平台的配置文件和文档。

#### Scenario: Dockerfile 可构建
- **WHEN** 在 `backend/` 下执行 `docker build`
- **THEN** 成功构建包含 FastAPI 应用的 Docker 镜像


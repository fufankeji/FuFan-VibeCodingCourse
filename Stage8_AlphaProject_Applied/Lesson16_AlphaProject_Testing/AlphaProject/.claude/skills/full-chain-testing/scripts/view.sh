#!/usr/bin/env bash
# 一键打开「用户旅程」酷炫视图：起本地服务 + 浏览器自动打开（已带数据）。
# 用法：
#   bash view.sh            # 默认看 demo
#   bash view.sh alpha      # 看 AlphaProject 推导出的旅程
#   bash view.sh out/任意-path-inventory.json   # 看指定的清单
#   bash view.sh demo 8900  # 自定端口（默认 8731）
DIR="$(cd "$(dirname "$0")" && pwd)"; cd "$DIR"
SRC="${1:-demo}"; PORT="${2:-8731}"
case "$SRC" in
  demo)  REL="out/demo-path-inventory.json" ;;
  alpha) REL="out/alpha-path-inventory.json" ;;
  *)     REL="$SRC" ;;
esac
if [ ! -f "$REL" ]; then echo "找不到数据文件：$DIR/$REL"; echo "先跑 run_pipeline.sh 生成 out/*.json"; exit 1; fi
# 端口没起服务就后台起一个（已起则复用）
if ! curl -s "http://localhost:$PORT/" >/dev/null 2>&1; then
  ( python3 -m http.server "$PORT" >/tmp/jv_server_$PORT.log 2>&1 & )
fi
URL="http://localhost:$PORT/knife6_viewer.html?src=$REL"
echo "→ 打开：$URL"
open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || echo "请手动在浏览器打开上面这个 URL"

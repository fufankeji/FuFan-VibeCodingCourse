#!/usr/bin/env bash
# 用法：scripts/screenshot.sh <name>
# macOS Cmd+Shift+4 → 框选 → 保存到 docs/screenshots/<name>.png
# 此脚本只负责提示 + 校验文件落地（headless Chrome 在新版 macOS 上不稳定，用 GUI 截图更快）
set -e
NAME="${1:?usage: scripts/screenshot.sh <name-without-ext>}"
DEST="docs/screenshots/${NAME}.png"
mkdir -p docs/screenshots
echo "→ 在浏览器调好画面（http://localhost:5173/）"
echo "→ macOS 按 Cmd+Shift+4 → 框选 Dashboard → 文件会落到桌面"
echo "→ 拖到本仓库 ${DEST}（或拷贝命令在下面）"
echo
echo "  mv ~/Desktop/截屏*.png ${DEST}"
echo
echo "完成后回车继续…"
read -r _
test -f "${DEST}" || { echo "未发现 ${DEST}，请确认拷贝路径"; exit 1; }
echo "✓ ${DEST} 已就位（$(du -h "${DEST}" | cut -f1)）"

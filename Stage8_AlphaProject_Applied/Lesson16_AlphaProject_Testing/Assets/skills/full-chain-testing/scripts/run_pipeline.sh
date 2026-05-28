#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 path-inventory toolkit authors.
#
# run_pipeline.sh — end-to-end demo: boot demo-app, drive one journey with a
# correlation id, run knife2(static)+knife3(trace), merge with knife4, generate a
# RED E2E skeleton (knife5), and emit a viewable path-inventory.json for knife6.
#
# Usage:  bash run_pipeline.sh [PORT] [CID]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DEMO="$HERE/../demo-app"
OUT="$HERE/out"
PORT="${1:-8799}"
CID="${2:-cid-pipeline}"
mkdir -p "$OUT"
export DEMO_TRACE_LOG="$OUT/demo-trace.log"
rm -f "$DEMO_TRACE_LOG"

echo "[1/6] booting demo-app on :$PORT"
python3 "$DEMO/server.py" --port "$PORT" >"$OUT/demo-server.log" 2>&1 &
SVPID=$!
trap 'kill $SVPID 2>/dev/null || true' EXIT
# condition-based wait for server readiness (no fixed sleep)
for _ in $(seq 1 50); do
  if curl -s "http://127.0.0.1:$PORT/api/deliveries" >/dev/null 2>&1; then break; fi
  sleep 0.1
done

echo "[2/6] driving journey cid=$CID"
python3 "$DEMO/run_journey.py" "$PORT" "$CID"

echo "[3/6] knife2 static scan of demo-app"
python3 "$HERE/knife2_static.py" "$DEMO" -f demo -o "$OUT/demo-static.json"

echo "[4/6] knife3 trace collect (cid=$CID)"
python3 "$HERE/knife3_trace.py" "$DEMO_TRACE_LOG" --cid "$CID" -f demo -o "$OUT/demo-trace.json"

echo "[5/6] knife4 merge -> path-inventory.json"
python3 "$HERE/knife4_merge.py" "$OUT/demo-static.json" "$OUT/demo-trace.json" \
        -o "$OUT/demo-path-inventory.json"

echo "[5b/6] knife4b narrate journeys (human-readable steps + summary)"
python3 "$HERE/knife4b_narrate.py" "$OUT/demo-path-inventory.json"

echo "[6/6] knife5 RED E2E skeleton (top journey)"
python3 "$HERE/knife5_e2e.py" "$OUT/demo-path-inventory.json" --stack python \
        -o "$OUT/test_top_journey.py"

echo
echo "DONE. Open the viewer:"
echo "  open '$HERE/knife6_viewer.html'   then drag in  $OUT/demo-path-inventory.json"
echo "  (or serve dir and visit knife6_viewer.html?src=out/demo-path-inventory.json)"

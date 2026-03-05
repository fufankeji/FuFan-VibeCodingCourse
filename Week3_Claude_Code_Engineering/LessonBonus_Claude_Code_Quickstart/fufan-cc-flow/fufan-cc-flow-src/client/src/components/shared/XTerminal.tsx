/**
 * XTerminal — xterm.js terminal, PTY-backed via WebSocket.
 *
 * Usage: render inside a `position: relative` container that already has
 * proper pixel dimensions. XTerminal fills it with `width/height: 100%`.
 *
 * The CALLER is responsible for sizing (e.g. wrapping in `position:absolute; inset:0`).
 * This component never sets its own position — it simply fills its parent.
 *
 * Copy / Paste:
 *   • Select text  → automatically copied to clipboard (copyOnSelect)
 *   • Ctrl+V / Ctrl+Shift+V → paste from clipboard into terminal
 *   • Right-click  → browser context-menu Paste also works
 */

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface XTerminalProps {
  termId: string;
  cwd?: string;
}

export default function XTerminal({ termId, cwd }: XTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    /* ── Create terminal ── */
    const term = new Terminal({
      theme: {
        background:          "#0f0e13",
        foreground:          "#cbd5e1",
        cursor:              "#d97757",
        cursorAccent:        "#0f0e13",
        selectionBackground: "rgba(124,58,237,0.35)",
        black:         "#13111C", red:           "#f43f5e",
        green:         "#10b981", yellow:        "#d97757",
        blue:          "#6d28d9", magenta:       "#8b5cf6",
        cyan:          "#22d3ee", white:         "#e2e8f0",
        brightBlack:   "#475569", brightRed:     "#fb7185",
        brightGreen:   "#34d399", brightYellow:  "#fbbf24",
        brightBlue:    "#818cf8", brightMagenta: "#a78bfa",
        brightCyan:    "#67e8f9", brightWhite:   "#f8fafc",
      },
      fontFamily:   '"Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, monospace',
      fontSize:     13,
      lineHeight:   1.4,
      cursorBlink:  true,
      scrollback:   2000,
      copyOnSelect: true,   // auto-copy selected text to clipboard
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(el);

    // Use rAF so layout is fully painted before we measure
    const rafId = requestAnimationFrame(() => {
      try { fitAddon.fit(); } catch { /* container may not be ready */ }
    });

    /* ── WebSocket ── */
    const host   = window.location.hostname;
    const params = new URLSearchParams({ id: termId, cwd: cwd ?? "" });
    const ws     = new WebSocket(`ws://${host}:3001/ws/terminal?${params}`);

    // Send current terminal dimensions once WS opens so PTY stays in sync.
    // fitAddon.fit() also fires term.onResize → sends resize if WS is already open;
    // this covers the case where fit runs before the WS connects.
    ws.onopen = () => {
      ws.send(JSON.stringify({ action: "resize", cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.event === "output") term.write(msg.data as string);
        else if (msg.event === "exit")
          term.write(`\r\n\x1b[90m[进程已退出，退出码: ${msg.code}]\x1b[0m\r\n`);
      } catch {
        term.write(e.data as string);
      }
    };
    ws.onerror = () => term.write("\r\n\x1b[31m[WebSocket 连接错误]\x1b[0m\r\n");
    ws.onclose = () => term.write("\r\n\x1b[90m[连接已关闭]\x1b[0m\r\n");

    /* ── Keystrokes → PTY ── */
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ action: "input", data }));
    });

    /* ── Resize → PTY ── */
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ action: "resize", cols, rows }));
    });

    /* ── Ctrl+(Shift+)V → paste via native paste event (no permission prompt) ── */
    term.attachCustomKeyEventHandler((e) => {
      if (e.type === "keydown" && e.ctrlKey && e.code === "KeyV") {
        // Return false to prevent xterm from sending ^V to PTY.
        // The browser will fire a native "paste" event instead,
        // which we handle below — no navigator.clipboard.readText() needed.
        return false;
      }
      return true;
    });

    // Listen for native paste event — clipboardData is provided by the browser
    // without requiring clipboard-read permission, so no popup prompt.
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text/plain");
      if (text && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "input", data: text }));
      }
      e.preventDefault();
    };
    el.addEventListener("paste", handlePaste);

    /* ── Auto-fit on container resize ── */
    const observer = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch { /* disposed */ }
    });
    observer.observe(el);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      el.removeEventListener("paste", handlePaste);
      try { ws.send(JSON.stringify({ action: "close" })); } catch { /* ignore */ }
      ws.close();
      term.dispose();
    };
  // termId and cwd are passed only at creation; WS is tied to the session ID
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId]);

  /*
   * The outer wrapper fills 100% of whatever the parent gives it.
   * The PARENT is responsible for `position: absolute; inset: 0` sizing.
   */
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: "hidden" }}
      />
      <div style={{ background: "rgba(0,0,0,0.30)" }} className="text-[10px] text-slate-500 px-2 py-0.5 flex-shrink-0">
        选中即复制 | Ctrl+V 粘贴
      </div>
    </div>
  );
}

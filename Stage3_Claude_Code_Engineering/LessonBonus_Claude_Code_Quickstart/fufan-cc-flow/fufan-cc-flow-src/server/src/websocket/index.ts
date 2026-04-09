import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "http";
import { handleChatConnection } from "./chatHandler.js";
import { handleTerminalConnection } from "./terminalHandler.js";
import { logger } from "../utils/logger.js";
import url from "url";

// Track liveness per socket without mutating the WebSocket object
const aliveMap = new WeakMap<WebSocket, boolean>();

const PING_INTERVAL = 30_000; // 30 s — keeps idle connections alive

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server });

  // ── Heartbeat: ping every 30 s, terminate if no pong received ──
  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (aliveMap.get(ws) === false) {
        ws.terminate();
        return;
      }
      aliveMap.set(ws, false);
      ws.ping();
    });
  }, PING_INTERVAL);

  wss.on("close", () => clearInterval(heartbeatTimer));

  // Prevent unhandled 'error' event from crashing the process when the HTTP
  // server fails to bind (e.g. EADDRINUSE). The real error is handled in index.ts.
  wss.on("error", (err) => {
    logger.error(`WebSocket server error: ${err.message}`);
  });

  wss.on("connection", (ws: WebSocket, req) => {
    // Mark as alive; pong handler refreshes it
    aliveMap.set(ws, true);
    ws.on("pong", () => aliveMap.set(ws, true));

    const parsed = url.parse(req.url || "", true);
    const pathname = parsed.pathname || "";
    const query = parsed.query;

    logger.info(`WS connection: ${pathname}`);

    if (pathname === "/ws/chat") {
      const project = (query.project as string) || "";
      handleChatConnection(ws, project);
    } else if (pathname === "/ws/terminal") {
      const id = (query.id as string) || `term_${Date.now()}`;
      const cwd = (query.cwd as string) || process.cwd();
      handleTerminalConnection(ws, id, cwd);
    } else {
      ws.close(4004, "Unknown endpoint");
    }
  });

  logger.info("WebSocket server ready");
  return wss;
}

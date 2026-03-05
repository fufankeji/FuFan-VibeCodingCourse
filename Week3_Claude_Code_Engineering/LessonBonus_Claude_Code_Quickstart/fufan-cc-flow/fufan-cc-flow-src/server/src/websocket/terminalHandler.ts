import type { WebSocket } from "ws";
import { PtyService } from "../services/ptyService.js";
import { logger } from "../utils/logger.js";

const ptyService = new PtyService();

export function handleTerminalConnection(
  ws: WebSocket,
  termId: string,
  cwd?: string
) {
  logger.info(`Terminal WS connected: ${termId}`);

  // create() handles stale session cleanup internally with proper ordering
  ptyService.create(termId, cwd);

  // Forward PTY output to WebSocket client
  const onData = (id: string, data: string) => {
    if (id === termId && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ event: "output", data }));
    }
  };

  const onExit = (id: string, code: number) => {
    if (id === termId && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ event: "exit", code }));
      ws.close();
    }
  };

  ptyService.on("data", onData);
  ptyService.on("exit", onExit);

  // Handle messages from client
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      switch (msg.action) {
        case "input":
          ptyService.write(termId, msg.data);
          break;
        case "resize":
          if (typeof msg.cols === "number" && typeof msg.rows === "number") {
            ptyService.resize(termId, msg.cols, msg.rows);
          }
          break;
        case "close":
          ptyService.close(termId);
          break;
      }
    } catch (err) {
      logger.error("Terminal message parse error:", err);
    }
  });

  ws.on("close", () => {
    logger.info(`Terminal WS disconnected: ${termId}`);
    ptyService.removeListener("data", onData);
    ptyService.removeListener("exit", onExit);
    ptyService.close(termId);
  });
}

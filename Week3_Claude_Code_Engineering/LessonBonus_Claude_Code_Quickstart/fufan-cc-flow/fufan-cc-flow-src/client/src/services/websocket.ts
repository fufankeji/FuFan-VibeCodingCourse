type Handler = (event: string, payload: Record<string, unknown>) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentProject = "";
  private reconnectDelay = 3000;
  private readonly MAX_RECONNECT_DELAY = 30000;

  connect(projectPath: string) {
    this.currentProject = projectPath;
    this.cleanup();

    // Use same origin — Vite dev server proxies /ws → ws://localhost:3001
    // This avoids cross-origin, firewall, and system proxy issues.
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const query = projectPath ? `?project=${encodeURIComponent(projectPath)}` : "";
    const wsUrl = `${protocol}//${host}/ws/chat${query}`;

    console.debug("[WS] Connecting to", wsUrl);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.debug("[WS] Connected");
      this.reconnectDelay = 3000;
      this.notify("_connected", {});
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        this.notify(msg.event, msg.payload);
      } catch (err) {
        console.error("[WS] Failed to parse message:", err, "raw:", ev.data);
      }
    };

    this.ws.onclose = (ev) => {
      console.debug("[WS] Closed", ev.code, ev.reason);
      this.notify("_disconnected", {});
      const delay = this.reconnectDelay;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.MAX_RECONNECT_DELAY);
      console.debug(`[WS] Reconnecting in ${delay}ms`);
      this.reconnectTimer = setTimeout(() => {
        this.connect(this.currentProject);
      }, delay);
    };

    this.ws.onerror = (ev) => {
      console.error("[WS] Error:", ev);
    };
  }

  send(action: string, payload: Record<string, unknown> = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, payload }));
    }
  }

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  disconnect() {
    this.cleanup();
    this.ws?.close();
    this.ws = null;
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private notify(event: string, payload: Record<string, unknown>) {
    for (const h of this.handlers) {
      h(event, payload);
    }
  }

  private cleanup() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const wsService = new WebSocketService();

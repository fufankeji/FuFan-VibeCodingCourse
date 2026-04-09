import { useEffect, useRef } from "react";
import { useChatStore } from "../stores/chatStore";
import { wsService } from "../services/websocket";

/**
 * Global double-ESC hook — press ESC twice within 500ms to abort streaming.
 * Only active when isStreaming is true; does not conflict with slash-command
 * menu ESC (the menu only opens when not streaming).
 */
export function useDoubleEsc() {
  const lastEscRef = useRef<number>(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!useChatStore.getState().isStreaming) return;

      const now = Date.now();
      if (now - lastEscRef.current < 500) {
        wsService.send("abort", {});
        lastEscRef.current = 0;
      } else {
        lastEscRef.current = now;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}

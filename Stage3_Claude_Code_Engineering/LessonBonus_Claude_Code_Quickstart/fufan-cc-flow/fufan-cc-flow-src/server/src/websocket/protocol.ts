import type { ServerMessage } from "../types/api.js";

export function serverMsg(
  event: string,
  payload: Record<string, unknown>,
  requestId?: string
): string {
  const msg: ServerMessage = {
    event,
    payload,
    timestamp: Date.now(),
    ...(requestId ? { requestId } : {}),
  };
  return JSON.stringify(msg);
}

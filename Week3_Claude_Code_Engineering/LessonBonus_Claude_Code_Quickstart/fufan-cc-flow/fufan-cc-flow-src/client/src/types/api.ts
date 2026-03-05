export interface ClientMessage {
  action: string;
  payload: Record<string, unknown>;
  requestId?: string;
}

export interface ServerMessage {
  event: string;
  payload: Record<string, unknown>;
  timestamp: number;
  requestId?: string;
}

export interface SessionInfo {
  id: string;
  name: string | null;
  model: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface ConfigData {
  model: string;
  effort: string;
  thinking: boolean;
  autoCompactThreshold: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: string;
}

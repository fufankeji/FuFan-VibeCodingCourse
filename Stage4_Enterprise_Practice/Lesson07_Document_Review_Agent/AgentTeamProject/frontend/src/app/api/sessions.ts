import { apiClient } from './client';

export interface ProgressSummary {
  total_high_risk: number;
  decided_high_risk: number;
  total_medium_risk: number;
  total_low_risk: number;
  pending_high_risk: number;
  completion_percent: number;
}

export interface SessionResponse {
  id: string;
  contract_id: string;
  state: string;
  hitl_subtype: string | null;
  is_scanned_document: boolean;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  progress_summary: ProgressSummary;
}

export interface SessionRecoveryResponse {
  session_id: string;
  state: string;
  last_updated: string;
  pending_high_risk_count: number;
  resumable: boolean;
  message: string;
}

export function getSession(sessionId: string): Promise<SessionResponse> {
  return apiClient.get<SessionResponse>(`/sessions/${sessionId}`);
}

export function getSessionRecovery(sessionId: string): Promise<SessionRecoveryResponse> {
  return apiClient.get<SessionRecoveryResponse>(`/sessions/${sessionId}/recovery`);
}

export function retryParse(sessionId: string) {
  return apiClient.post<{ session_id: string; state: string; message: string }>(`/sessions/${sessionId}/retry-parse`);
}

export function abortSession(sessionId: string, reason?: string) {
  return apiClient.post<{ session_id: string; state: string; message: string }>(
    `/sessions/${sessionId}/abort`,
    reason ? { reason } : undefined
  );
}

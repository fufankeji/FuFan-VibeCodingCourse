import { apiClient } from './client';
import type { ExtractedField } from '../types';

export interface FieldListResponse {
  items: ExtractedField[];
  total: number;
}

export interface FieldVerifyResponse {
  id: string;
  field_name: string;
  verified_value: string;
  verification_status: string;
  verified_by: string;
  verified_at: string;
  message: string;
}

export function listFields(sessionId: string): Promise<FieldListResponse> {
  return apiClient.get<FieldListResponse>(`/sessions/${sessionId}/fields`);
}

export function verifyField(sessionId: string, fieldId: string, body: { action: string; verified_value: string }): Promise<FieldVerifyResponse> {
  return apiClient.patch<FieldVerifyResponse>(`/sessions/${sessionId}/fields/${fieldId}`, body);
}

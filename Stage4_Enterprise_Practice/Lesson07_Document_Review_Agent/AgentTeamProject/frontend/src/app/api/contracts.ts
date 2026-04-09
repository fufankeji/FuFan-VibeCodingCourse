import { apiClient } from './client';

export interface UploadResponse {
  contract_id: string;
  session_id: string;
  state: string;
  is_scanned_document: boolean;
  message: string;
}

/** Backend contract shape — flat, no session sub-object */
export interface ContractItem {
  id: string;
  title: string;
  original_filename: string;
  contract_status: string;
  file_type: string;
  is_scanned_document: boolean;
  file_path: string;
  uploaded_by: string;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
  // These are NOT returned by backend — added by frontend join
  session_id?: string | null;
  session_state?: string | null;
}

export interface ContractListResponse {
  items: ContractItem[];
  total: number;
  next_cursor: string | null;
}

export function uploadContract(file: File, contractTitle?: string): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (contractTitle) {
    formData.append('contract_title', contractTitle);
  }
  return apiClient.post<UploadResponse>('/contracts/upload', formData);
}

export function listContracts(params?: { cursor?: string; limit?: number; state?: string }): Promise<ContractListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.state) searchParams.set('state', params.state);
  const qs = searchParams.toString();
  return apiClient.get<ContractListResponse>(`/contracts${qs ? `?${qs}` : ''}`);
}

export function getContract(contractId: string) {
  return apiClient.get<ContractItem>(`/contracts/${contractId}`);
}

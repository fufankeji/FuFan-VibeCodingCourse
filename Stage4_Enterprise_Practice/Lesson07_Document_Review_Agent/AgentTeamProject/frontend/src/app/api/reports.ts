import { apiClient, API_BASE_URL } from './client';
import type { ReportData } from '../types';

/** Backend report shape — slightly different field names */
interface BackendReport {
  id: string;
  session_id: string;
  report_status: string;
  generated_at: string | null;
  summary: Record<string, any> | null;
  item_stats: Record<string, any> | null;
  coverage_statement: Record<string, any> | null;
  disclaimer: string;
  pdf_path: string | null;
  json_path: string | null;
  created_at: string;
}

function transformReport(raw: BackendReport): ReportData {
  return {
    id: raw.id,
    session_id: raw.session_id,
    report_status: raw.report_status as any,
    generated_at: raw.generated_at ?? raw.created_at,
    summary: {
      contract_parties: raw.summary?.contract_parties ?? [],
      contract_amount: raw.summary?.contract_amount ?? '',
      effective_date: raw.summary?.effective_date ?? '',
      overall_risk_level: raw.summary?.overall_risk_level ?? 'medium',
      conclusion: raw.summary?.conclusion ?? '',
    },
    item_stats: {
      total: raw.item_stats?.total ?? 0,
      approved: raw.item_stats?.approved ?? 0,
      edited: raw.item_stats?.edited ?? 0,
      rejected: raw.item_stats?.rejected ?? 0,
      auto_passed: raw.item_stats?.auto_passed ?? 0,
    },
    coverage_statement: {
      covered_clause_types: raw.coverage_statement?.covered_clause_types ?? [],
      not_covered_clause_types: raw.coverage_statement?.not_covered_clause_types ?? [],
    },
    disclaimer: raw.disclaimer || 'AI 分析结论仅供参考，不构成法律意见。',
  };
}

export async function getReport(sessionId: string): Promise<ReportData> {
  const raw = await apiClient.get<BackendReport>(`/sessions/${sessionId}/report`);
  return transformReport(raw);
}

export function getReportDownloadUrl(sessionId: string, format: 'pdf' | 'json'): string {
  return `${API_BASE_URL}/sessions/${sessionId}/report/download?format=${format}`;
}

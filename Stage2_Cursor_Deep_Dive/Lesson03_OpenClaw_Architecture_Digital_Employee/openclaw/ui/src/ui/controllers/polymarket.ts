import type { GatewayBrowserClient } from "../gateway.ts";
import type { CronJob, CronRunLogEntry, CronJobsListResult, CronRunsResult } from "../types.ts";

export const POLYMARKET_SCAN_JOB_NAME = "polymarket-scan";
export const POLYMARKET_REPORT_JOB_NAME = "polymarket-daily-report";

export type PolymarketControllerState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  polymarketLoading: boolean;
  polymarketRunning: string | null;
  polymarketScanJob: CronJob | null;
  polymarketReportJob: CronJob | null;
  polymarketScanRuns: CronRunLogEntry[];
  polymarketReportRuns: CronRunLogEntry[];
  polymarketLastError: string | null;
  polymarketLastSuccess: string | null;
};

export async function loadPolymarketStatus(state: PolymarketControllerState): Promise<void> {
  if (!state.client || !state.connected) return;
  if (state.polymarketLoading) return;
  state.polymarketLoading = true;
  state.polymarketLastError = null;
  try {
    const res = await state.client.request<CronJobsListResult>("cron.list", { limit: 50 });
    const jobs = res?.jobs ?? [];
    state.polymarketScanJob =
      jobs.find((j) => j.name === POLYMARKET_SCAN_JOB_NAME) ?? null;
    state.polymarketReportJob =
      jobs.find((j) => j.name === POLYMARKET_REPORT_JOB_NAME) ?? null;

    // Load recent runs for each job
    if (state.polymarketScanJob) {
      const scanRuns = await state.client.request<CronRunsResult>("cron.runs", {
        id: state.polymarketScanJob.id,
        limit: 5,
      });
      state.polymarketScanRuns = scanRuns?.entries ?? [];
    }
    if (state.polymarketReportJob) {
      const reportRuns = await state.client.request<CronRunsResult>("cron.runs", {
        id: state.polymarketReportJob.id,
        limit: 5,
      });
      state.polymarketReportRuns = reportRuns?.entries ?? [];
    }
  } catch (err) {
    state.polymarketLastError = String(err);
  } finally {
    state.polymarketLoading = false;
  }
}

export async function runPolymarketJob(
  state: PolymarketControllerState,
  job: CronJob,
): Promise<void> {
  if (!state.client || !state.connected) return;
  if (state.polymarketRunning) return;
  state.polymarketRunning = job.id;
  state.polymarketLastError = null;
  state.polymarketLastSuccess = null;
  try {
    await state.client.request("cron.run", { id: job.id, mode: "force" });
    state.polymarketLastSuccess = `Job "${job.name}" triggered.`;
    // Reload after a short delay to pick up updated state
    await new Promise((r) => setTimeout(r, 2000));
    await loadPolymarketStatus(state);
  } catch (err) {
    state.polymarketLastError = String(err);
  } finally {
    state.polymarketRunning = null;
  }
}

export async function togglePolymarketJob(
  state: PolymarketControllerState,
  job: CronJob,
): Promise<void> {
  if (!state.client || !state.connected) return;
  state.polymarketLastError = null;
  try {
    await state.client.request("cron.update", {
      id: job.id,
      job: { enabled: !job.enabled },
    });
    await loadPolymarketStatus(state);
  } catch (err) {
    state.polymarketLastError = String(err);
  }
}

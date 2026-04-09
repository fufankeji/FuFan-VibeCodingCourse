import { html, nothing } from "lit";
import { formatRelativeTimestamp, formatMs } from "../format.ts";
import { formatCronSchedule, formatNextRun } from "../presenter.ts";
import type { CronJob, CronRunLogEntry, CronStatus } from "../types.ts";

const POLYMARKET_JOB_IDS = ["polymarket-scan", "polymarket-daily-report"];

export type PolymarketProps = {
  loading: boolean;
  error: string | null;
  busy: boolean;
  status: CronStatus | null;
  jobs: CronJob[];
  runs: CronRunLogEntry[];
  runsTotal: number;
  runsHasMore: boolean;
  runsLoadingMore: boolean;
  onRefresh: () => void;
  onToggle: (job: CronJob, enabled: boolean) => void;
  onRun: (job: CronJob) => void;
  onLoadMoreRuns: () => void;
};

function filterPolymarketJobs(jobs: CronJob[]): CronJob[] {
  return jobs.filter((job) => POLYMARKET_JOB_IDS.includes(job.id));
}

function filterPolymarketRuns(runs: CronRunLogEntry[]): CronRunLogEntry[] {
  return runs.filter((run) => POLYMARKET_JOB_IDS.includes(run.jobId));
}

function renderStatusPill(status?: string) {
  if (!status) {
    return html`<span class="chip chip-muted">—</span>`;
  }
  const cls =
    status === "ok"
      ? "chip chip-green"
      : status === "error"
        ? "chip chip-red"
        : "chip chip-muted";
  return html`<span class=${cls}>${status}</span>`;
}

function renderJobCard(
  job: CronJob,
  busy: boolean,
  onToggle: (job: CronJob, enabled: boolean) => void,
  onRun: (job: CronJob) => void,
) {
  const schedule = formatCronSchedule(job);
  const nextRun = formatNextRun(job.state?.nextRunAtMs);
  const lastStatus = job.state?.lastStatus;
  const lastRunAt = job.state?.lastRunAtMs ? formatRelativeTimestamp(job.state.lastRunAtMs) : "—";

  return html`
    <div class="card" style="margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span class="card-title" style="flex: 1;">${job.name}</span>
        <span class=${job.enabled ? "chip chip-green" : "chip chip-red"}>
          ${job.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>
      ${job.description ? html`<div class="card-sub" style="margin-bottom: 8px;">${job.description}</div>` : nothing}
      <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
        <span>Schedule: <strong>${schedule}</strong></span>
        <span>Next run: <strong>${nextRun}</strong></span>
        <span>Last run: <strong>${lastRunAt}</strong></span>
        <span>Last status: ${renderStatusPill(lastStatus)}</span>
      </div>
      ${job.delivery?.mode === "announce"
        ? html`<div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">
            Delivers to: <strong>${job.delivery.channel ?? "—"}</strong>
            ${job.delivery.to ? html` → <code>${job.delivery.to}</code>` : nothing}
          </div>`
        : nothing}
      <div style="display: flex; gap: 8px;">
        <button
          class="btn btn-sm"
          ?disabled=${busy}
          @click=${() => onRun(job)}
        >
          Run Now
        </button>
        <button
          class="btn btn-sm btn-outline"
          ?disabled=${busy}
          @click=${() => onToggle(job, !job.enabled)}
        >
          ${job.enabled ? "Disable" : "Enable"}
        </button>
      </div>
    </div>
  `;
}

function renderRunRow(run: CronRunLogEntry) {
  const ts = run.runAtMs ?? run.ts;
  const time = ts ? formatMs(ts) : "—";
  const relative = ts ? formatRelativeTimestamp(ts) : "";
  const duration =
    typeof run.durationMs === "number" ? `${(run.durationMs / 1000).toFixed(1)}s` : "—";

  return html`
    <tr>
      <td style="white-space: nowrap;">
        <span title=${time}>${relative}</span>
      </td>
      <td>${run.jobName ?? run.jobId}</td>
      <td>${renderStatusPill(run.status)}</td>
      <td>${duration}</td>
      <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${run.error ? html`<span style="color: var(--color-error);">${run.error}</span>` : (run.summary ?? "—")}
      </td>
      <td>
        ${run.deliveryStatus
          ? html`<span class=${run.deliveryStatus === "delivered" ? "chip chip-green" : "chip chip-muted"}>
              ${run.deliveryStatus}
            </span>`
          : "—"}
      </td>
    </tr>
  `;
}

export function renderPolymarket(props: PolymarketProps) {
  const pmJobs = filterPolymarketJobs(props.jobs);
  const pmRuns = filterPolymarketRuns(props.runs);

  return html`
    <div class="tab-content">
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div>
          <h2 style="margin: 0;">Polymarket Paper Trading Autopilot</h2>
          <p style="margin: 4px 0 0; color: var(--text-secondary); font-size: 13px;">
            Monitors prediction markets and simulates trades using TAIL, BONDING, and SPREAD strategies.
          </p>
        </div>
        <button class="btn btn-sm" @click=${props.onRefresh} ?disabled=${props.loading}>
          Refresh
        </button>
      </div>

      ${props.error ? html`<div class="alert alert-error" style="margin-bottom: 16px;">${props.error}</div>` : nothing}
      ${props.loading ? html`<div class="loading-indicator">Loading…</div>` : nothing}

      <!-- Overview Card -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-title">Overview</div>
        <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-top: 8px; font-size: 13px;">
          <span>Starting capital: <strong>$10,000</strong></span>
          <span>Database: <code>~/.openclaw/workspace/polymarket/trades.db</code></span>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;">
          <span class="chip">TAIL — Trend &gt;60%</span>
          <span class="chip">BONDING — Dip &gt;10%</span>
          <span class="chip">SPREAD — Arb &gt;1.05</span>
        </div>
      </div>

      <!-- Cron Jobs -->
      <div style="margin-bottom: 16px;">
        <h3 style="margin: 0 0 12px;">Cron Jobs</h3>
        ${pmJobs.length === 0 && !props.loading
          ? html`<div class="card" style="color: var(--text-secondary); font-size: 13px;">
              No Polymarket cron jobs found. Create jobs with IDs
              <code>polymarket-scan</code> and <code>polymarket-daily-report</code> in the Cron tab.
            </div>`
          : pmJobs.map((job) => renderJobCard(job, props.busy, props.onToggle, props.onRun))}
      </div>

      <!-- Execution History -->
      <div>
        <h3 style="margin: 0 0 12px;">Execution History</h3>
        ${pmRuns.length === 0 && !props.loading
          ? html`<div style="color: var(--text-secondary); font-size: 13px;">No execution history yet.</div>`
          : html`
              <div style="overflow-x: auto;">
                <table class="data-table" style="width: 100%; font-size: 13px;">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Job</th>
                      <th>Status</th>
                      <th>Duration</th>
                      <th>Summary</th>
                      <th>Delivery</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pmRuns.map(renderRunRow)}
                  </tbody>
                </table>
              </div>
              ${props.runsHasMore
                ? html`<div style="text-align: center; margin-top: 12px;">
                    <button
                      class="btn btn-sm btn-outline"
                      ?disabled=${props.runsLoadingMore}
                      @click=${props.onLoadMoreRuns}
                    >
                      ${props.runsLoadingMore ? "Loading…" : "Load More"}
                    </button>
                  </div>`
                : nothing}
            `}
      </div>
    </div>
  `;
}

import { html, nothing } from "lit";
import { formatRelativeTimestamp } from "../format.ts";
import type { ChannelAccountSnapshot } from "../types.ts";
import { renderChannelAccountCount } from "./channels.shared.ts";
import type { ChannelsProps } from "./channels.types.ts";

// ---------------------------------------------------------------------------
// Helpers — read from nested config safely
// ---------------------------------------------------------------------------

function cfgStr(cfg: Record<string, unknown>, key: string): string {
  const v = cfg[key];
  return typeof v === "string" ? v : "";
}

function cfgBool(cfg: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = cfg[key];
  return typeof v === "boolean" ? v : fallback;
}

function cfgNum(cfg: Record<string, unknown>, key: string): string {
  const v = cfg[key];
  return typeof v === "number" ? String(v) : "";
}

function resolveFeishuCfg(props: ChannelsProps): Record<string, unknown> {
  const channels = props.configForm?.channels;
  if (channels && typeof channels === "object") {
    const ch = channels as Record<string, unknown>;
    const f = ch.feishu;
    if (f && typeof f === "object") return f as Record<string, unknown>;
  }
  return {};
}

function patch(props: ChannelsProps, key: string, value: unknown) {
  props.onConfigPatch(["channels", "feishu", key], value);
}

// ---------------------------------------------------------------------------
// Account sub-card (multi-account mode)
// ---------------------------------------------------------------------------

function renderFeishuAccount(account: ChannelAccountSnapshot) {
  return html`
    <div class="account-card">
      <div class="account-card-header">
        <div class="account-card-title">${account.name || account.accountId}</div>
        <div class="account-card-id">${account.accountId}</div>
      </div>
      <div class="status-list account-card-status">
        <div>
          <span class="label">Running</span>
          <span>${account.running ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Configured</span>
          <span>${account.configured ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Connected</span>
          <span>${account.connected == null ? "n/a" : account.connected ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Last inbound</span>
          <span>${account.lastInboundAt ? formatRelativeTimestamp(account.lastInboundAt) : "n/a"}</span>
        </div>
        ${account.lastError ? html`<div class="account-card-error">${account.lastError}</div>` : nothing}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

export function renderFeishuCard(params: {
  props: ChannelsProps;
  feishu?: Record<string, unknown> | null;
  feishuAccounts?: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
}) {
  const { props, feishu, feishuAccounts = [], accountCountLabel } = params;

  // Runtime status (from gateway snapshot)
  const configured = feishu?.configured === true;
  const running = feishu?.running === true;
  const connected = feishu?.connected === true;
  const runtimeMode = typeof feishu?.connectionMode === "string" ? feishu.connectionMode : "—";
  const runtimeDomain = typeof feishu?.domain === "string" ? feishu.domain : "—";
  const lastError = typeof feishu?.lastError === "string" ? feishu.lastError : null;

  // Config form values (from local editable config)
  const cfg = resolveFeishuCfg(props);
  const appId            = cfgStr(cfg, "appId");
  const appSecret        = cfgStr(cfg, "appSecret");
  const encryptKey       = cfgStr(cfg, "encryptKey");
  const verificationToken= cfgStr(cfg, "verificationToken");
  const domain           = cfgStr(cfg, "domain") || "feishu";
  const connectionMode   = cfgStr(cfg, "connectionMode") || "websocket";
  const webhookPath      = cfgStr(cfg, "webhookPath") || "/feishu/events";
  const dmPolicy         = cfgStr(cfg, "dmPolicy") || "pairing";
  const groupPolicy      = cfgStr(cfg, "groupPolicy") || "allowlist";
  const requireMention   = cfgBool(cfg, "requireMention", true);
  const renderMode       = cfgStr(cfg, "renderMode") || "auto";
  const streaming        = cfgBool(cfg, "streaming", false);
  const topicSessionMode = cfgStr(cfg, "topicSessionMode") || "disabled";
  const historyLimit     = cfgNum(cfg, "historyLimit");
  const dmHistoryLimit   = cfgNum(cfg, "dmHistoryLimit");
  const mediaMaxMb       = cfgNum(cfg, "mediaMaxMb");

  const disabled = props.configSaving || !props.connected;
  const isWebhook = connectionMode === "webhook";

  return html`
    <div class="card" style="grid-column: 1 / -1;">
      <!-- Header -->
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">Feishu / Lark</div>
          <div class="card-sub">
            Connect your Feishu (Lark) enterprise bot for direct messages and group chats.
          </div>
        </div>
        <button class="btn btn--sm" @click=${() => props.onRefresh(true)}>Refresh</button>
      </div>

      ${accountCountLabel}

      <!-- Runtime status -->
      ${
        feishuAccounts.length > 0
          ? html`
            <div class="account-card-list" style="margin-top: 16px;">
              ${feishuAccounts.map(renderFeishuAccount)}
            </div>
          `
          : html`
            <div class="status-list" style="margin-top: 16px;">
              <div><span class="label">Configured</span><span>${configured ? "Yes" : "No"}</span></div>
              <div><span class="label">Running</span><span>${running ? "Yes" : "No"}</span></div>
              <div><span class="label">Connected</span><span>${connected ? "Yes" : "No"}</span></div>
              <div><span class="label">Mode</span><span>${runtimeMode}</span></div>
              <div><span class="label">Domain</span><span>${runtimeDomain}</span></div>
            </div>
          `
      }

      ${lastError ? html`<div class="callout danger" style="margin-top: 12px;">${lastError}</div>` : nothing}

      <!-- ================================================================
           Configuration form
           ================================================================ -->
      <div style="margin-top: 24px; border-top: 1px solid var(--border); padding-top: 20px;">
        <div class="card-title" style="font-size: 13px; margin-bottom: 2px;">Configuration</div>
        <div class="card-sub" style="margin-bottom: 16px;">
          Credentials from
          <a href="https://open.feishu.cn/app" target="_blank" rel="noopener">Feishu Open Platform</a>
          /
          <a href="https://open.larksuite.com/app" target="_blank" rel="noopener">Lark Open Platform</a>.
          Restart the gateway after saving.
        </div>

        <!-- ── Section 1: App credentials ── -->
        <div class="card-sub" style="font-weight: 600; margin-bottom: 8px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">App Credentials</div>
        <div class="form-grid" style="margin-bottom: 20px;">

          <label class="field">
            <span>App ID <span style="color:var(--danger)">*</span></span>
            <input
              .value=${appId}
              ?disabled=${disabled}
              @input=${(e: Event) => patch(props, "appId", (e.target as HTMLInputElement).value)}
              placeholder="cli_xxxxxxxxxxxxxxxx"
              autocomplete="off"
            />
          </label>

          <label class="field">
            <span>App Secret <span style="color:var(--danger)">*</span></span>
            <input
              type="password"
              .value=${appSecret}
              ?disabled=${disabled}
              @input=${(e: Event) => patch(props, "appSecret", (e.target as HTMLInputElement).value)}
              placeholder="App Secret"
              autocomplete="new-password"
            />
          </label>

          <label class="field">
            <span>Encrypt Key
              <span class="muted" style="font-weight:400"> — optional, for event payload encryption</span>
            </span>
            <input
              type="password"
              .value=${encryptKey}
              ?disabled=${disabled}
              @input=${(e: Event) => patch(props, "encryptKey", (e.target as HTMLInputElement).value)}
              placeholder="Leave blank if not configured"
              autocomplete="new-password"
            />
          </label>

          <label class="field">
            <span>Verification Token
              <span class="muted" style="font-weight:400"> — required for webhook mode</span>
            </span>
            <input
              type="password"
              .value=${verificationToken}
              ?disabled=${disabled}
              @input=${(e: Event) => patch(props, "verificationToken", (e.target as HTMLInputElement).value)}
              placeholder="Leave blank if using WebSocket"
              autocomplete="new-password"
            />
          </label>

        </div>

        <!-- ── Section 2: Connection ── -->
        <div class="card-sub" style="font-weight: 600; margin-bottom: 8px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Connection</div>
        <div class="form-grid" style="margin-bottom: 20px;">

          <label class="field">
            <span>Domain</span>
            <select
              ?disabled=${disabled}
              @change=${(e: Event) => patch(props, "domain", (e.target as HTMLSelectElement).value)}
            >
              <option value="feishu" ?selected=${domain === "feishu"}>Feishu（中国大陆）</option>
              <option value="lark"   ?selected=${domain === "lark"}>Lark（International）</option>
            </select>
          </label>

          <label class="field">
            <span>Connection Mode</span>
            <select
              ?disabled=${disabled}
              @change=${(e: Event) => patch(props, "connectionMode", (e.target as HTMLSelectElement).value)}
            >
              <option value="websocket" ?selected=${connectionMode === "websocket"}>WebSocket — recommended, no public URL needed</option>
              <option value="webhook"   ?selected=${connectionMode === "webhook"}>Webhook — requires public HTTPS endpoint</option>
            </select>
          </label>

          ${
            isWebhook
              ? html`
                <label class="field">
                  <span>Webhook Path</span>
                  <input
                    .value=${webhookPath}
                    ?disabled=${disabled}
                    @input=${(e: Event) => patch(props, "webhookPath", (e.target as HTMLInputElement).value)}
                    placeholder="/feishu/events"
                  />
                </label>
              `
              : nothing
          }

        </div>

        <!-- ── Section 3: Access policies ── -->
        <div class="card-sub" style="font-weight: 600; margin-bottom: 8px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Access Policies</div>
        <div class="form-grid" style="margin-bottom: 20px;">

          <label class="field">
            <span>DM Policy
              <span class="muted" style="font-weight:400"> — who can start a private chat</span>
            </span>
            <select
              ?disabled=${disabled}
              @change=${(e: Event) => patch(props, "dmPolicy", (e.target as HTMLSelectElement).value)}
            >
              <option value="pairing"   ?selected=${dmPolicy === "pairing"}>pairing — user must pair first (default)</option>
              <option value="open"      ?selected=${dmPolicy === "open"}>open — anyone can DM (requires allowFrom: ["*"])</option>
              <option value="allowlist" ?selected=${dmPolicy === "allowlist"}>allowlist — only listed user IDs</option>
            </select>
          </label>

          <label class="field">
            <span>Group Policy
              <span class="muted" style="font-weight:400"> — which groups the bot responds in</span>
            </span>
            <select
              ?disabled=${disabled}
              @change=${(e: Event) => patch(props, "groupPolicy", (e.target as HTMLSelectElement).value)}
            >
              <option value="allowlist" ?selected=${groupPolicy === "allowlist"}>allowlist — only listed chat IDs (default)</option>
              <option value="open"      ?selected=${groupPolicy === "open"}>open — all groups</option>
              <option value="disabled"  ?selected=${groupPolicy === "disabled"}>disabled — no group chats</option>
            </select>
          </label>

          <label class="field" style="flex-direction: row; align-items: center; gap: 10px;">
            <input
              type="checkbox"
              .checked=${requireMention}
              ?disabled=${disabled}
              @change=${(e: Event) => patch(props, "requireMention", (e.target as HTMLInputElement).checked)}
              style="width: auto; margin: 0;"
            />
            <span>Require @mention in groups
              <span class="muted" style="font-weight:400"> (default: on)</span>
            </span>
          </label>

        </div>

        <!-- ── Section 4: Advanced ── -->
        <details>
          <summary style="cursor: pointer; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px;">
            Advanced
          </summary>
          <div class="form-grid" style="margin-top: 12px; margin-bottom: 20px;">

            <label class="field">
              <span>Render Mode
                <span class="muted" style="font-weight:400"> — how replies are formatted</span>
              </span>
              <select
                ?disabled=${disabled}
                @change=${(e: Event) => patch(props, "renderMode", (e.target as HTMLSelectElement).value)}
              >
                <option value="auto" ?selected=${renderMode === "auto"}>auto — detect markdown (default)</option>
                <option value="card" ?selected=${renderMode === "card"}>card — always use Feishu card</option>
                <option value="raw"  ?selected=${renderMode === "raw"}>raw — plain text</option>
              </select>
            </label>

            <label class="field">
              <span>Topic Session Mode
                <span class="muted" style="font-weight:400"> — session isolation per thread</span>
              </span>
              <select
                ?disabled=${disabled}
                @change=${(e: Event) => patch(props, "topicSessionMode", (e.target as HTMLSelectElement).value)}
              >
                <option value="disabled" ?selected=${topicSessionMode === "disabled"}>disabled — shared session per group (default)</option>
                <option value="enabled"  ?selected=${topicSessionMode === "enabled"}>enabled — isolated session per topic thread</option>
              </select>
            </label>

            <label class="field" style="flex-direction: row; align-items: center; gap: 10px;">
              <input
                type="checkbox"
                .checked=${streaming}
                ?disabled=${disabled}
                @change=${(e: Event) => patch(props, "streaming", (e.target as HTMLInputElement).checked)}
                style="width: auto; margin: 0;"
              />
              <span>Streaming card mode
                <span class="muted" style="font-weight:400"> — incremental card updates (Feishu Card Kit)</span>
              </span>
            </label>

            <label class="field">
              <span>History Limit
                <span class="muted" style="font-weight:400"> — max messages loaded into context (0 = unlimited)</span>
              </span>
              <input
                type="number"
                min="0"
                .value=${historyLimit}
                ?disabled=${disabled}
                @input=${(e: Event) => {
                  const v = parseInt((e.target as HTMLInputElement).value, 10);
                  patch(props, "historyLimit", isNaN(v) ? undefined : v);
                }}
                placeholder="default"
              />
            </label>

            <label class="field">
              <span>DM History Limit
                <span class="muted" style="font-weight:400"> — override for direct messages</span>
              </span>
              <input
                type="number"
                min="0"
                .value=${dmHistoryLimit}
                ?disabled=${disabled}
                @input=${(e: Event) => {
                  const v = parseInt((e.target as HTMLInputElement).value, 10);
                  patch(props, "dmHistoryLimit", isNaN(v) ? undefined : v);
                }}
                placeholder="default"
              />
            </label>

            <label class="field">
              <span>Media Max MB
                <span class="muted" style="font-weight:400"> — max file size accepted from Feishu</span>
              </span>
              <input
                type="number"
                min="0"
                step="0.1"
                .value=${mediaMaxMb}
                ?disabled=${disabled}
                @input=${(e: Event) => {
                  const v = parseFloat((e.target as HTMLInputElement).value);
                  patch(props, "mediaMaxMb", isNaN(v) ? undefined : v);
                }}
                placeholder="default"
              />
            </label>

          </div>
        </details>

        <!-- Save / Reload -->
        <div class="row" style="margin-top: 16px; gap: 8px;">
          <button
            class="btn primary"
            ?disabled=${disabled || !props.configFormDirty}
            @click=${() => props.onConfigSave()}
          >
            ${props.configSaving ? "Saving…" : "Save"}
          </button>
          <button
            class="btn"
            ?disabled=${props.configSaving}
            @click=${() => props.onConfigReload()}
          >
            Reload
          </button>
        </div>

      </div>
    </div>
  `;
}

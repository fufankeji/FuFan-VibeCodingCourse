import { html, nothing } from "lit";
import { formatRelativeTimestamp } from "../format.ts";
import type { ChannelAccountSnapshot } from "../types.ts";
import type { ChannelsProps } from "./channels.types.ts";

function getFeishuConfig(props: ChannelsProps): Record<string, unknown> {
  const config = props.configForm ?? {};
  const channels = (config.channels ?? {}) as Record<string, unknown>;
  const feishu = channels.feishu;
  if (feishu && typeof feishu === "object") {
    return feishu as Record<string, unknown>;
  }
  return {};
}

function feishuVal(cfg: Record<string, unknown>, key: string): string {
  const v = cfg[key];
  return typeof v === "string" ? v : "";
}

function feishuBool(cfg: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = cfg[key];
  return typeof v === "boolean" ? v : fallback;
}

export function renderFeishuCard(params: {
  props: ChannelsProps;
  feishuAccounts: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
}) {
  const { props, feishuAccounts, accountCountLabel } = params;
  const hasMultipleAccounts = feishuAccounts.length > 1;
  const cfg = getFeishuConfig(props);
  const disabled = props.configSaving || props.configSchemaLoading;
  const patch = props.onConfigPatch;

  const renderAccountCard = (account: ChannelAccountSnapshot) => {
    const label = account.name || account.accountId;
    return html`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">${label}</div>
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
            <span class="label">Last inbound</span>
            <span>${account.lastInboundAt ? formatRelativeTimestamp(account.lastInboundAt) : "n/a"}</span>
          </div>
          ${
            account.lastError
              ? html`
                <div class="account-card-error">
                  ${account.lastError}
                </div>
              `
              : nothing
          }
        </div>
      </div>
    `;
  };

  const status = props.snapshot?.channels?.feishu as
    | { configured?: boolean; running?: boolean; connected?: boolean }
    | undefined;

  return html`
    <div class="card">
      <div class="card-title">Feishu / Lark</div>
      <div class="card-sub">Configure Feishu/Lark channel connection and policies.</div>
      ${accountCountLabel}

      ${
        hasMultipleAccounts
          ? html`
            <div class="account-card-list">
              ${feishuAccounts.map((account) => renderAccountCard(account))}
            </div>
          `
          : html`
            <div class="status-list" style="margin-top: 16px;">
              <div>
                <span class="label">Configured</span>
                <span>${status?.configured == null ? "n/a" : status.configured ? "Yes" : "No"}</span>
              </div>
              <div>
                <span class="label">Running</span>
                <span>${status?.running == null ? "n/a" : status.running ? "Yes" : "No"}</span>
              </div>
              <div>
                <span class="label">Connected</span>
                <span>${status?.connected == null ? "n/a" : status.connected ? "Yes" : "No"}</span>
              </div>
            </div>
          `
      }

      <!-- Feishu Configuration Form -->
      <div style="margin-top: 16px;">
        <div class="card-sub" style="font-weight: 600; margin-bottom: 12px;">Connection</div>
        <div class="form-grid">
          <label class="field">
            <span>App ID *</span>
            <input
              type="text"
              placeholder="cli_xxxxxxxxxxxxxxxx"
              .value=${feishuVal(cfg, "appId")}
              ?disabled=${disabled}
              @input=${(e: Event) =>
                patch(["channels", "feishu", "appId"], (e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="field">
            <span>App Secret *</span>
            <input
              type="password"
              placeholder="App Secret from Feishu Open Platform"
              .value=${feishuVal(cfg, "appSecret")}
              ?disabled=${disabled}
              @input=${(e: Event) =>
                patch(["channels", "feishu", "appSecret"], (e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="field">
            <span>Domain</span>
            <select
              ?disabled=${disabled}
              @change=${(e: Event) =>
                patch(["channels", "feishu", "domain"], (e.target as HTMLSelectElement).value)}
            >
              <option value="feishu" ?selected=${feishuVal(cfg, "domain") !== "lark"}>feishu</option>
              <option value="lark" ?selected=${feishuVal(cfg, "domain") === "lark"}>lark</option>
            </select>
          </label>
          <label class="field">
            <span>Connection Mode</span>
            <select
              ?disabled=${disabled}
              @change=${(e: Event) =>
                patch(["channels", "feishu", "connectionMode"], (e.target as HTMLSelectElement).value)}
            >
              <option value="websocket" ?selected=${feishuVal(cfg, "connectionMode") !== "webhook"}>websocket</option>
              <option value="webhook" ?selected=${feishuVal(cfg, "connectionMode") === "webhook"}>webhook</option>
            </select>
          </label>
        </div>

        <!-- Security (Webhook mode) -->
        <div class="card-sub" style="font-weight: 600; margin-top: 16px; margin-bottom: 12px;">Security</div>
        <div class="form-grid">
          <label class="field">
            <span>Encrypt Key</span>
            <input
              type="password"
              placeholder="Optional encrypt key"
              .value=${feishuVal(cfg, "encryptKey")}
              ?disabled=${disabled}
              @input=${(e: Event) =>
                patch(["channels", "feishu", "encryptKey"], (e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="field">
            <span>Verification Token</span>
            <input
              type="text"
              placeholder="Required for webhook mode"
              .value=${feishuVal(cfg, "verificationToken")}
              ?disabled=${disabled}
              @input=${(e: Event) =>
                patch(["channels", "feishu", "verificationToken"], (e.target as HTMLInputElement).value)}
            />
          </label>
        </div>

        <!-- Access Control -->
        <div class="card-sub" style="font-weight: 600; margin-top: 16px; margin-bottom: 12px;">Access Control</div>
        <div class="form-grid">
          <label class="field">
            <span>DM Policy</span>
            <select
              ?disabled=${disabled}
              @change=${(e: Event) =>
                patch(["channels", "feishu", "dmPolicy"], (e.target as HTMLSelectElement).value)}
            >
              ${["pairing", "open", "allowlist"].map(
                (v) => html`<option value=${v} ?selected=${feishuVal(cfg, "dmPolicy") === v || (!cfg.dmPolicy && v === "pairing")}>${v}</option>`,
              )}
            </select>
          </label>
          <label class="field">
            <span>Group Policy</span>
            <select
              ?disabled=${disabled}
              @change=${(e: Event) =>
                patch(["channels", "feishu", "groupPolicy"], (e.target as HTMLSelectElement).value)}
            >
              ${["allowlist", "open", "disabled"].map(
                (v) => html`<option value=${v} ?selected=${feishuVal(cfg, "groupPolicy") === v || (!cfg.groupPolicy && v === "allowlist")}>${v}</option>`,
              )}
            </select>
          </label>
          <label class="field">
            <span>Require @mention in groups</span>
            <select
              ?disabled=${disabled}
              @change=${(e: Event) =>
                patch(["channels", "feishu", "requireMention"], (e.target as HTMLSelectElement).value === "true")}
            >
              <option value="true" ?selected=${feishuBool(cfg, "requireMention", true)}>Yes</option>
              <option value="false" ?selected=${!feishuBool(cfg, "requireMention", true)}>No</option>
            </select>
          </label>
          <label class="field">
            <span>DM Allow From</span>
            <input
              type="text"
              placeholder="Comma-separated user IDs or *"
              .value=${Array.isArray(cfg.allowFrom) ? cfg.allowFrom.join(", ") : ""}
              ?disabled=${disabled}
              @input=${(e: Event) => {
                const raw = (e.target as HTMLInputElement).value;
                const arr = raw.split(",").map((s) => s.trim()).filter(Boolean);
                patch(["channels", "feishu", "allowFrom"], arr);
              }}
            />
          </label>
          <label class="field">
            <span>Group Allow From</span>
            <input
              type="text"
              placeholder="Comma-separated group chat IDs"
              .value=${Array.isArray(cfg.groupAllowFrom) ? cfg.groupAllowFrom.join(", ") : ""}
              ?disabled=${disabled}
              @input=${(e: Event) => {
                const raw = (e.target as HTMLInputElement).value;
                const arr = raw.split(",").map((s) => s.trim()).filter(Boolean);
                patch(["channels", "feishu", "groupAllowFrom"], arr);
              }}
            />
          </label>
        </div>

        <!-- Tools -->
        <div class="card-sub" style="font-weight: 600; margin-top: 16px; margin-bottom: 12px;">Tools</div>
        <div class="form-grid">
          ${(["doc", "wiki", "drive", "scopes", "perm", "search"] as const).map((tool) => {
            const toolsCfg = (cfg.tools && typeof cfg.tools === "object" ? cfg.tools : {}) as Record<string, unknown>;
            const defaultOn = tool !== "perm"; // perm defaults to false, others to true
            const isOn = typeof toolsCfg[tool] === "boolean" ? (toolsCfg[tool] as boolean) : defaultOn;
            const labels: Record<string, string> = {
              doc: "Documents (doc)",
              wiki: "Knowledge Base (wiki)",
              drive: "Cloud Storage (drive)",
              scopes: "App Scopes Diagnostic",
              perm: "Permission Mgmt (sensitive)",
              search: "Web Search (Tavily)",
            };
            return html`
              <label class="field">
                <span>${labels[tool]}</span>
                <select
                  ?disabled=${disabled}
                  @change=${(e: Event) =>
                    patch(["channels", "feishu", "tools", tool], (e.target as HTMLSelectElement).value === "true")}
                >
                  <option value="true" ?selected=${isOn}>Enabled</option>
                  <option value="false" ?selected=${!isOn}>Disabled</option>
                </select>
              </label>
            `;
          })}
        </div>

        <!-- Message Settings -->
        <div class="card-sub" style="font-weight: 600; margin-top: 16px; margin-bottom: 12px;">Message</div>
        <div class="form-grid">
          <label class="field">
            <span>Render Mode</span>
            <select
              ?disabled=${disabled}
              @change=${(e: Event) =>
                patch(["channels", "feishu", "renderMode"], (e.target as HTMLSelectElement).value)}
            >
              ${["auto", "raw", "card"].map(
                (v) => html`<option value=${v} ?selected=${feishuVal(cfg, "renderMode") === v || (!cfg.renderMode && v === "auto")}>${v}</option>`,
              )}
            </select>
          </label>
          <label class="field">
            <span>Streaming</span>
            <select
              ?disabled=${disabled}
              @change=${(e: Event) =>
                patch(["channels", "feishu", "streaming"], (e.target as HTMLSelectElement).value === "true")}
            >
              <option value="true" ?selected=${feishuBool(cfg, "streaming", true)}>Enabled</option>
              <option value="false" ?selected=${!feishuBool(cfg, "streaming", true)}>Disabled</option>
            </select>
          </label>
          <label class="field">
            <span>Text Chunk Limit</span>
            <input
              type="number"
              placeholder="2000"
              .value=${cfg.textChunkLimit != null ? String(cfg.textChunkLimit) : ""}
              ?disabled=${disabled}
              @input=${(e: Event) => {
                const val = parseInt((e.target as HTMLInputElement).value, 10);
                if (!isNaN(val) && val > 0) {
                  patch(["channels", "feishu", "textChunkLimit"], val);
                }
              }}
            />
          </label>
          <label class="field">
            <span>Media Max MB</span>
            <input
              type="number"
              placeholder="30"
              .value=${cfg.mediaMaxMb != null ? String(cfg.mediaMaxMb) : ""}
              ?disabled=${disabled}
              @input=${(e: Event) => {
                const val = parseInt((e.target as HTMLInputElement).value, 10);
                if (!isNaN(val) && val > 0) {
                  patch(["channels", "feishu", "mediaMaxMb"], val);
                }
              }}
            />
          </label>
        </div>

        <!-- Enabled -->
        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>Channel Enabled</span>
            <select
              ?disabled=${disabled}
              @change=${(e: Event) =>
                patch(["channels", "feishu", "enabled"], (e.target as HTMLSelectElement).value === "true")}
            >
              <option value="true" ?selected=${feishuBool(cfg, "enabled", false)}>Yes</option>
              <option value="false" ?selected=${!feishuBool(cfg, "enabled", false)}>No</option>
            </select>
          </label>
        </div>

        <!-- Save / Reload -->
        <div class="row" style="margin-top: 12px;">
          <button
            class="btn primary"
            ?disabled=${disabled || !props.configFormDirty}
            @click=${() => props.onConfigSave()}
          >
            ${props.configSaving ? "Saving…" : "Save"}
          </button>
          <button
            class="btn"
            ?disabled=${disabled}
            @click=${() => props.onConfigReload()}
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  `;
}

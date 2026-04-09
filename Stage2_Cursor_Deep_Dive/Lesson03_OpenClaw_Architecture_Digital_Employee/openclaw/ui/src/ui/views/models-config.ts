import { html, nothing } from "lit";

export type ModelsConfigProps = {
  connected: boolean;
  loading: boolean;
  saving: boolean;
  providers: Record<string, unknown> | null;
  defaultModel: string | null;
  formProviderName: string;
  formBaseUrl: string;
  formApiKey: string;
  formModelId: string;
  lastError: string | null;
  lastSuccess: string | null;
  onFormChange: (field: string, value: string) => void;
  onSave: () => void;
  onDelete: (name: string) => void;
  onSetDefault: (modelRef: string) => void;
  onRefresh: () => void;
};

function resolveProviderModels(
  providerConfig: unknown,
): Array<{ id: string; name: string }> {
  if (!providerConfig || typeof providerConfig !== "object") {
    return [];
  }
  const cfg = providerConfig as Record<string, unknown>;
  if (!Array.isArray(cfg.models)) {
    return [];
  }
  return cfg.models
    .filter((m) => m && typeof m === "object")
    .map((m) => {
      const model = m as Record<string, unknown>;
      return {
        id: typeof model.id === "string" ? model.id : "",
        name: typeof model.name === "string" ? model.name : (typeof model.id === "string" ? model.id : ""),
      };
    })
    .filter((m) => m.id);
}

function resolveProviderMeta(providerConfig: unknown): { baseUrl: string; modelCount: number } {
  if (!providerConfig || typeof providerConfig !== "object") {
    return { baseUrl: "", modelCount: 0 };
  }
  const cfg = providerConfig as Record<string, unknown>;
  const baseUrl = typeof cfg.baseUrl === "string" ? cfg.baseUrl : "";
  const models = Array.isArray(cfg.models) ? cfg.models : [];
  return { baseUrl, modelCount: models.length };
}

export function renderModelsConfig(props: ModelsConfigProps) {
  const providerEntries = props.providers ? Object.entries(props.providers) : [];

  return html`
    ${
      props.defaultModel
        ? html`
          <div class="callout ok" style="margin-bottom: 16px;">
            <strong>Default model:</strong>
            <span class="mono">${props.defaultModel}</span>
            — agents will use this model unless overridden.
          </div>
        `
        : html`
          <div class="callout warn" style="margin-bottom: 16px;">
            <strong>No default model configured.</strong>
            Agents will fall back to <span class="mono">anthropic/claude-opus-4-6</span> and fail
            if no Anthropic API key is present.
            Use <strong>Set as Default</strong> below to activate your custom provider.
          </div>
        `
    }

    <section class="grid grid-cols-2">
      <div class="card">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">Configured Providers</div>
            <div class="card-sub">Custom model providers loaded from openclaw.json.</div>
          </div>
          <button
            class="btn"
            ?disabled=${props.loading || !props.connected}
            @click=${props.onRefresh}
          >
            ${props.loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        ${
          !props.connected
            ? html`<div class="callout warn" style="margin-top: 12px;">Not connected to gateway.</div>`
            : nothing
        }

        ${
          providerEntries.length === 0
            ? html`<div class="muted" style="margin-top: 12px;">No providers configured yet.</div>`
            : html`
              <div class="list" style="margin-top: 12px;">
                ${providerEntries.map(([providerName, cfg]) => {
                  const { baseUrl, modelCount } = resolveProviderMeta(cfg);
                  const models = resolveProviderModels(cfg);
                  return html`
                    <div class="list-item" style="flex-direction: column; align-items: stretch; gap: 8px;">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                          <div class="list-title">${providerName}</div>
                          <div class="list-sub">${baseUrl || "—"}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <span class="muted">${modelCount} model${modelCount !== 1 ? "s" : ""}</span>
                          <button
                            class="btn btn--sm"
                            ?disabled=${props.saving}
                            @click=${() => props.onDelete(providerName)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      ${
                        models.length > 0
                          ? html`
                            <div style="display: flex; flex-wrap: wrap; gap: 6px; padding-left: 4px;">
                              ${models.map((model) => {
                                const ref = `${providerName}/${model.id}`;
                                const isDefault = props.defaultModel === ref;
                                return html`
                                  <div style="display: flex; align-items: center; gap: 4px;">
                                    <span class="pill ${isDefault ? "ok" : ""}" style="font-size: 11px;">
                                      ${isDefault ? "✓ default · " : ""}${model.id}
                                    </span>
                                    ${
                                      !isDefault
                                        ? html`
                                          <button
                                            class="btn btn--sm"
                                            ?disabled=${props.saving || !props.connected}
                                            @click=${() => props.onSetDefault(ref)}
                                            title="Set ${ref} as the default model"
                                          >
                                            Set as Default
                                          </button>
                                        `
                                        : nothing
                                    }
                                  </div>
                                `;
                              })}
                            </div>
                          `
                          : nothing
                      }
                    </div>
                  `;
                })}
              </div>
            `
        }
      </div>

      <div class="card">
        <div class="card-title">Add / Update Provider</div>
        <div class="card-sub">Configure a custom OpenAI-compatible model provider.</div>

        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>Provider Name</span>
            <input
              .value=${props.formProviderName}
              @input=${(e: Event) =>
                props.onFormChange("ProviderName", (e.target as HTMLInputElement).value)}
              placeholder="dashscope"
            />
          </label>

          <label class="field">
            <span>Base URL</span>
            <input
              .value=${props.formBaseUrl}
              @input=${(e: Event) =>
                props.onFormChange("BaseUrl", (e.target as HTMLInputElement).value)}
              placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
            />
          </label>

          <label class="field">
            <span>API Key</span>
            <input
              type="password"
              .value=${props.formApiKey}
              @input=${(e: Event) =>
                props.onFormChange("ApiKey", (e.target as HTMLInputElement).value)}
              placeholder="sk-…"
              autocomplete="off"
            />
          </label>

          <label class="field">
            <span>Model ID</span>
            <input
              .value=${props.formModelId}
              @input=${(e: Event) =>
                props.onFormChange("ModelId", (e.target as HTMLInputElement).value)}
              placeholder="qwen3-vl-plus"
            />
          </label>
        </div>

        <div class="row" style="margin-top: 12px; gap: 8px;">
          <button
            class="btn primary"
            ?disabled=${props.saving || !props.connected}
            @click=${props.onSave}
          >
            ${props.saving ? "Saving…" : "Save Provider"}
          </button>
          <button
            class="btn"
            ?disabled=${props.saving || !props.connected || !props.formProviderName.trim() || !props.formModelId.trim()}
            @click=${() => {
              const ref = `${props.formProviderName.trim()}/${props.formModelId.trim()}`;
              props.onSetDefault(ref);
            }}
            title="Save current provider/model as the default for all agents"
          >
            ${props.saving ? "Saving…" : "Save & Set as Default"}
          </button>
        </div>

        ${
          props.lastError
            ? html`<div class="callout danger" style="margin-top: 12px;">${props.lastError}</div>`
            : nothing
        }
        ${
          props.lastSuccess
            ? html`<div class="callout success" style="margin-top: 12px;">${props.lastSuccess}</div>`
            : nothing
        }
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">How to activate a custom model</div>
      <div class="card-sub">Two steps are required after adding a provider.</div>
      <div class="stack" style="margin-top: 12px;">
        <div>
          <strong>Step 1 — Save Provider</strong>
          <p class="muted">
            Fill in the form above and click <strong>Save Provider</strong>. This writes
            <span class="mono">models.providers.&lt;name&gt;</span> into
            <span class="mono">~/.openclaw/openclaw.json</span>.
          </p>
        </div>
        <div>
          <strong>Step 2 — Set as Default</strong>
          <p class="muted">
            Click <strong>Set as Default</strong> next to a model (or use <strong>Save &amp; Set as Default</strong>).
            This writes <span class="mono">agents.defaults.model: "provider/model-id"</span>
            into the config so all agents use it unless overridden.
            Then <strong>restart the gateway</strong> for the change to take effect.
          </p>
        </div>
      </div>
    </section>
  `;
}

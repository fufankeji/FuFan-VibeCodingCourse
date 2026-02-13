import { html, nothing } from "lit";
import { icons } from "../icons.ts";

const CUSTOM_PREFIX = "custom-";
const DEFAULT_CONTEXT_WINDOW = 128000;
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "model";
}

export function customProviderId(modelName: string): string {
  return CUSTOM_PREFIX + slugify(modelName);
}

export function buildCustomProviderConfig(modelName: string, baseUrl: string, apiKey: string): CustomModelProvider {
  const id = slugify(modelName);
  return {
    baseUrl: baseUrl.trim(),
    api: "openai-completions",
    ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    models: [
      {
        id,
        name: modelName.trim(),
        reasoning: false,
        input: ["text"],
        cost: DEFAULT_COST,
        contextWindow: DEFAULT_CONTEXT_WINDOW,
        maxTokens: DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

export type CustomModelProvider = {
  baseUrl: string;
  api?: string;
  apiKey?: string;
  models: Array<{
    id: string;
    name: string;
    reasoning?: boolean;
    input?: string[];
    cost?: { input: number; output: number; cacheRead: number; cacheWrite: number };
    contextWindow?: number;
    maxTokens?: number;
  }>;
};

export type ModelsProps = {
  connected: boolean;
  configLoading: boolean;
  configSaving: boolean;
  configFormDirty: boolean;
  configForm: Record<string, unknown> | null;
  lastError: string | null;
  onLoad: () => void;
  onAdd: (modelName: string, baseUrl: string, apiKey: string) => void;
  onRemove: (providerId: string) => void;
  onSave: () => void;
};

function getCustomProviders(configForm: Record<string, unknown> | null): Array<{ id: string; provider: CustomModelProvider }> {
  if (!configForm || typeof configForm !== "object") {
    return [];
  }
  const models = configForm.models as Record<string, unknown> | undefined;
  const providers = (models?.providers as Record<string, CustomModelProvider>) ?? {};
  return Object.entries(providers)
    .filter(([id]) => id.startsWith(CUSTOM_PREFIX))
    .map(([id, provider]) => ({ id, provider }));
}

export function renderModels(props: ModelsProps) {
  const customList = getCustomProviders(props.configForm);
  const canEdit = props.connected && !props.configSaving;

  return html`
    <div class="models-page">
      ${!props.connected
        ? html`
            <div class="muted">Connect to the gateway to manage custom models.</div>
          `
        : html`
            <div class="models-section">
              <h3 class="section-title">Add custom model</h3>
              <p class="muted">
                Add a model by name and base URL (OpenAI-compatible API). Example: Qwen3 with
                <span class="mono">https://dashscope.aliyuncs.com/compatible-mode/v1</span>
              </p>
              <div class="models-form">
                <label class="label">
                  <span>Model name</span>
                  <input
                    type="text"
                    id="models-input-name"
                    placeholder="e.g. qwen3-72b"
                    class="input"
                    ?disabled=${!canEdit}
                  />
                </label>
                <label class="label">
                  <span>Base URL</span>
                  <input
                    type="url"
                    id="models-input-baseurl"
                    placeholder="https://..."
                    class="input mono"
                    ?disabled=${!canEdit}
                  />
                </label>
                <label class="label">
                  <span>API key (optional)</span>
                  <input
                    type="password"
                    id="models-input-apikey"
                    placeholder="Leave empty if not required"
                    class="input mono"
                    ?disabled=${!canEdit}
                  />
                </label>
                <button
                  class="btn btn-primary"
                  ?disabled=${!canEdit || props.configLoading}
                  @click=${() => {
                    const nameEl = document.getElementById("models-input-name") as HTMLInputElement | null;
                    const urlEl = document.getElementById("models-input-baseurl") as HTMLInputElement | null;
                    const keyEl = document.getElementById("models-input-apikey") as HTMLInputElement | null;
                    const name = nameEl?.value?.trim();
                    const baseUrl = urlEl?.value?.trim();
                    const apiKey = keyEl?.value?.trim() ?? "";
                    if (name && baseUrl) {
                      props.onAdd(name, baseUrl, apiKey);
                      nameEl!.value = "";
                      urlEl!.value = "";
                      if (keyEl) keyEl.value = "";
                    }
                  }}
                >
                  Add model
                </button>
              </div>
            </div>

            <div class="models-section">
              <h3 class="section-title">Saved custom models</h3>
              ${props.configLoading
                ? html`<div class="muted">Loading config…</div>`
                : customList.length === 0
                  ? html`<div class="muted">No custom models yet. Add one above.</div>`
                  : html`
                      <ul class="models-list">
                        ${customList.map(
                          ({ id, provider }) => html`
                            <li class="models-list__item">
                              <div class="models-list__main">
                                <span class="models-list__name">${provider.models?.[0]?.name ?? id}</span>
                                <span class="models-list__ref mono">${id}/${provider.models?.[0]?.id ?? id.replace(CUSTOM_PREFIX, "")}</span>
                                <span class="models-list__url mono muted">${provider.baseUrl}</span>
                              </div>
                              <button
                                class="btn btn--sm btn--danger"
                                ?disabled=${!canEdit}
                                title="Remove this model"
                                @click=${() => props.onRemove(id)}
                              >
                                ${icons.x}
                              </button>
                            </li>
                          `,
                        )}
                      </ul>
                    `}
            </div>

            ${props.configFormDirty
              ? html`
                  <div class="models-actions">
                    <button
                      class="btn btn-primary"
                      ?disabled=${props.configSaving}
                      @click=${() => props.onSave()}
                    >
                      ${props.configSaving ? "Saving…" : "Save to gateway"}
                    </button>
                  </div>
                `
              : nothing}
          `}

      ${props.lastError ? html`<div class="pill danger" style="margin-top: 12px">${props.lastError}</div>` : nothing}
    </div>
  `;
}

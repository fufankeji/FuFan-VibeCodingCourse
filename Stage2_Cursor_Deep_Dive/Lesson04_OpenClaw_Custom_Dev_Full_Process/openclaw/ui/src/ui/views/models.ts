import { html, nothing } from "lit";

export type ModelsProps = {
  loading: boolean;
  saving: boolean;
  connected: boolean;
  lastError: string | null;
  providerKey: string;
  providerBaseURL: string;
  providerApiKey: string;
  providerModels: string;
  defaultModel: string;
  configuredProviders: Array<{
    key: string;
    config: { baseUrl: string; apiKey?: string; api?: string; models: Array<{ id: string; name: string }> };
  }>;
  availableModels: string[];
  onProviderKeyChange: (value: string) => void;
  onProviderBaseURLChange: (value: string) => void;
  onProviderApiKeyChange: (value: string) => void;
  onProviderModelsChange: (value: string) => void;
  onSaveProvider: () => void;
  onSetDefaultModel: (modelId: string) => void;
  onEditProvider: (key: string) => void;
  onRemoveProvider: (key: string) => void;
  onReload: () => void;
};

export function renderModels(props: ModelsProps) {
  const {
    loading,
    saving,
    connected,
    lastError,
    providerKey,
    providerBaseURL,
    providerApiKey,
    providerModels,
    defaultModel,
    configuredProviders,
    availableModels,
    onProviderKeyChange,
    onProviderBaseURLChange,
    onProviderApiKeyChange,
    onProviderModelsChange,
    onSaveProvider,
    onSetDefaultModel,
    onEditProvider,
    onRemoveProvider,
    onReload,
  } = props;

  return html`
    ${lastError
      ? html`<div class="callout danger" style="margin-bottom: 12px;">${lastError}</div>`
      : nothing}

    <!-- Provider Configuration Form -->
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div>
          <div class="card-title">Add / Edit Provider</div>
          <div class="card-sub">
            Configure an OpenAI-compatible model provider (e.g. DashScope, OpenRouter).
          </div>
        </div>
        <button class="btn" ?disabled=${loading || !connected} @click=${onReload}>Reload</button>
      </div>

      <div class="form-grid" style="margin-top: 16px;">
        <label class="field">
          <span>Provider Key</span>
          <input
            type="text"
            placeholder="e.g. dashscope"
            .value=${providerKey}
            @input=${(e: Event) =>
              onProviderKeyChange((e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="field">
          <span>Base URL</span>
          <input
            type="text"
            placeholder="e.g. https://dashscope.aliyuncs.com/compatible-mode/v1"
            .value=${providerBaseURL}
            @input=${(e: Event) =>
              onProviderBaseURLChange((e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="field">
          <span>API Key</span>
          <input
            type="password"
            placeholder="sk-..."
            .value=${providerApiKey}
            @input=${(e: Event) =>
              onProviderApiKeyChange((e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="field">
          <span>Models (comma-separated)</span>
          <input
            type="text"
            placeholder="e.g. qwen3-vl-plus, qwen-turbo"
            .value=${providerModels}
            @input=${(e: Event) =>
              onProviderModelsChange((e.target as HTMLInputElement).value)}
          />
        </label>
      </div>

      <div class="row" style="margin-top: 12px; gap: 8px;">
        <button
          class="btn primary"
          ?disabled=${saving || loading || !connected || !providerKey.trim()}
          @click=${onSaveProvider}
        >
          ${saving ? "Saving..." : "Save Provider"}
        </button>
      </div>
    </section>

    <!-- Default Model Selector -->
    <section class="card" style="margin-top: 16px;">
      <div>
        <div class="card-title">Default Agent Model</div>
        <div class="card-sub">
          Select the default model used by Agent Runtime.
          ${defaultModel
            ? html`Currently: <span class="mono">${defaultModel}</span>`
            : html`<span class="muted">Not set</span>`}
        </div>
      </div>

      ${availableModels.length > 0
        ? html`
            <div class="row" style="margin-top: 12px; gap: 8px; flex-wrap: wrap;">
              ${availableModels.map(
                (modelId) => html`
                  <button
                    class="btn ${modelId === defaultModel ? "primary" : ""}"
                    ?disabled=${saving || !connected}
                    @click=${() => onSetDefaultModel(modelId)}
                  >
                    ${modelId}
                    ${modelId === defaultModel ? html` (current)` : nothing}
                  </button>
                `,
              )}
            </div>
          `
        : html`
            <div class="muted" style="margin-top: 12px;">
              No models configured yet. Add a provider above first.
            </div>
          `}
    </section>

    <!-- Configured Providers List -->
    <section class="card" style="margin-top: 16px;">
      <div>
        <div class="card-title">Configured Providers</div>
        <div class="card-sub">Providers saved in openclaw.json.</div>
      </div>

      ${configuredProviders.length > 0
        ? html`
            <div class="list" style="margin-top: 12px;">
              ${configuredProviders.map(
                (provider) => html`
                  <div class="list-item">
                    <div class="list-main">
                      <div class="list-title">${provider.key}</div>
                      <div class="list-sub">
                        <span class="mono">${provider.config.baseUrl || "(no URL)"}</span>
                        &middot; ${provider.config.models?.length ?? 0} model(s):
                        ${provider.config.models
                          ?.map((m: { id: string }) => m.id)
                          .join(", ") || "none"}
                      </div>
                    </div>
                    <div class="row" style="gap: 6px;">
                      <button
                        class="btn"
                        ?disabled=${saving || !connected}
                        @click=${() => onEditProvider(provider.key)}
                      >
                        Edit
                      </button>
                      <button
                        class="btn"
                        ?disabled=${saving || !connected}
                        @click=${() => onRemoveProvider(provider.key)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                `,
              )}
            </div>
          `
        : html`
            <div class="muted" style="margin-top: 12px;">
              No providers configured yet.
            </div>
          `}
    </section>

    ${loading
      ? html`<div class="muted" style="margin-top: 12px;">Loading configuration...</div>`
      : nothing}
  `;
}

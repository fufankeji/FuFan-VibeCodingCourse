import type { GatewayBrowserClient } from "../gateway.ts";
import type { ConfigSnapshot } from "../types.ts";

export type ModelsConfigControllerState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  modelsConfigLoading: boolean;
  modelsConfigSaving: boolean;
  modelsConfigProviders: Record<string, unknown> | null;
  modelsConfigDefaultModel: string | null;
  modelsConfigFormProviderName: string;
  modelsConfigFormBaseUrl: string;
  modelsConfigFormApiKey: string;
  modelsConfigFormModelId: string;
  modelsConfigLastError: string | null;
  modelsConfigLastSuccess: string | null;
  modelsConfigHash: string | null;
};

export async function loadModelsConfig(state: ModelsConfigControllerState): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.modelsConfigLoading) {
    return;
  }
  state.modelsConfigLoading = true;
  state.modelsConfigLastError = null;
  try {
    const res = await state.client.request<ConfigSnapshot>("config.get", {});
    const config = res?.config as Record<string, unknown> | null | undefined;
    const models = config?.models as Record<string, unknown> | null | undefined;
    const providers = models?.providers as Record<string, unknown> | null | undefined;
    state.modelsConfigProviders = providers ?? null;
    state.modelsConfigHash = res?.hash ?? null;
    const agentsDefaults = (config?.agents as Record<string, unknown> | null | undefined)
      ?.defaults as Record<string, unknown> | null | undefined;
    const defaultModel = agentsDefaults?.model;
    state.modelsConfigDefaultModel =
      typeof defaultModel === "string"
        ? defaultModel
        : defaultModel && typeof defaultModel === "object"
          ? String(
              (defaultModel as Record<string, unknown>).primary ?? "",
            ) || null
          : null;
  } catch (err) {
    state.modelsConfigLastError = String(err);
  } finally {
    state.modelsConfigLoading = false;
  }
}

export async function saveProviderConfig(state: ModelsConfigControllerState): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }
  const providerName = state.modelsConfigFormProviderName.trim();
  if (!providerName) {
    state.modelsConfigLastError = "Provider name is required.";
    return;
  }
  const baseUrl = state.modelsConfigFormBaseUrl.trim();
  if (!baseUrl) {
    state.modelsConfigLastError = "Base URL is required.";
    return;
  }
  const apiKey = state.modelsConfigFormApiKey.trim();
  if (!apiKey) {
    state.modelsConfigLastError = "API key is required.";
    return;
  }
  const modelId = state.modelsConfigFormModelId.trim();
  if (!modelId) {
    state.modelsConfigLastError = "Model ID is required.";
    return;
  }

  if (state.modelsConfigSaving) {
    return;
  }
  state.modelsConfigSaving = true;
  state.modelsConfigLastError = null;
  state.modelsConfigLastSuccess = null;
  try {
    // Re-fetch to get the latest hash and config before patching
    const res = await state.client.request<ConfigSnapshot>("config.get", {});
    const baseHash = res?.hash;
    if (!baseHash) {
      state.modelsConfigLastError = "Config hash missing; reload and retry.";
      return;
    }

    const existingConfig = (res?.config as Record<string, unknown>) ?? {};
    const existingModels = (existingConfig.models as Record<string, unknown>) ?? {};
    const existingProviders = (existingModels.providers as Record<string, unknown>) ?? {};

    const providerConfig = {
      baseUrl,
      apiKey,
      api: "openai-completions",
      models: [
        {
          id: modelId,
          name: modelId,
          reasoning: false,
          input: ["text", "image"],
          contextWindow: 131072,
          maxTokens: 8192,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        },
      ],
    };

    const nextConfig = {
      ...existingConfig,
      models: {
        ...existingModels,
        providers: {
          ...existingProviders,
          [providerName]: providerConfig,
        },
      },
    };

    const raw = JSON.stringify(nextConfig, null, 2);
    await state.client.request("config.set", { raw, baseHash });

    // Reload to get fresh state
    const updated = await state.client.request<ConfigSnapshot>("config.get", {});
    const updatedConfig = updated?.config as Record<string, unknown> | null | undefined;
    const updatedModels = updatedConfig?.models as Record<string, unknown> | null | undefined;
    const updatedProviders = updatedModels?.providers as Record<string, unknown> | null | undefined;
    state.modelsConfigProviders = updatedProviders ?? null;
    state.modelsConfigHash = updated?.hash ?? null;
    state.modelsConfigLastSuccess = `Provider "${providerName}" saved successfully.`;
    state.modelsConfigFormApiKey = "";
  } catch (err) {
    state.modelsConfigLastError = String(err);
  } finally {
    state.modelsConfigSaving = false;
  }
}

export async function setDefaultModel(
  state: ModelsConfigControllerState,
  modelRef: string,
): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.modelsConfigSaving) {
    return;
  }
  state.modelsConfigSaving = true;
  state.modelsConfigLastError = null;
  state.modelsConfigLastSuccess = null;
  try {
    const res = await state.client.request<ConfigSnapshot>("config.get", {});
    const baseHash = res?.hash;
    if (!baseHash) {
      state.modelsConfigLastError = "Config hash missing; reload and retry.";
      return;
    }

    const existingConfig = (res?.config as Record<string, unknown>) ?? {};
    const existingAgents = (existingConfig.agents as Record<string, unknown>) ?? {};
    const existingDefaults = (existingAgents.defaults as Record<string, unknown>) ?? {};

    const nextConfig = {
      ...existingConfig,
      agents: {
        ...existingAgents,
        defaults: {
          ...existingDefaults,
          model: modelRef,
        },
      },
    };

    const raw = JSON.stringify(nextConfig, null, 2);
    await state.client.request("config.set", { raw, baseHash });

    state.modelsConfigDefaultModel = modelRef;
    state.modelsConfigLastSuccess = `Default model set to "${modelRef}". Restart the gateway to apply.`;
  } catch (err) {
    state.modelsConfigLastError = String(err);
  } finally {
    state.modelsConfigSaving = false;
  }
}

export async function deleteProviderConfig(
  state: ModelsConfigControllerState,
  providerName: string,
): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.modelsConfigSaving) {
    return;
  }
  state.modelsConfigSaving = true;
  state.modelsConfigLastError = null;
  state.modelsConfigLastSuccess = null;
  try {
    const res = await state.client.request<ConfigSnapshot>("config.get", {});
    const baseHash = res?.hash;
    if (!baseHash) {
      state.modelsConfigLastError = "Config hash missing; reload and retry.";
      return;
    }

    const existingConfig = (res?.config as Record<string, unknown>) ?? {};
    const existingModels = (existingConfig.models as Record<string, unknown>) ?? {};
    const existingProviders = { ...((existingModels.providers as Record<string, unknown>) ?? {}) };
    delete existingProviders[providerName];

    const nextConfig = {
      ...existingConfig,
      models: {
        ...existingModels,
        providers: existingProviders,
      },
    };

    const raw = JSON.stringify(nextConfig, null, 2);
    await state.client.request("config.set", { raw, baseHash });

    const updated = await state.client.request<ConfigSnapshot>("config.get", {});
    const updatedConfig = updated?.config as Record<string, unknown> | null | undefined;
    const updatedModels = updatedConfig?.models as Record<string, unknown> | null | undefined;
    const updatedProviders = updatedModels?.providers as Record<string, unknown> | null | undefined;
    state.modelsConfigProviders = updatedProviders ?? null;
    state.modelsConfigHash = updated?.hash ?? null;
    state.modelsConfigLastSuccess = `Provider "${providerName}" deleted.`;
  } catch (err) {
    state.modelsConfigLastError = String(err);
  } finally {
    state.modelsConfigSaving = false;
  }
}

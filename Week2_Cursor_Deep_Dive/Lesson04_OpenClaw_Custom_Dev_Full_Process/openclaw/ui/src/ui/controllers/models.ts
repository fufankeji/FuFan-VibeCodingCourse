import type { ConfigState } from "./config.ts";
import {
  loadConfig,
  loadConfigSchema,
  saveConfig,
  updateConfigFormValue,
  removeConfigFormValue,
} from "./config.ts";

export type ModelDefinition = {
  id: string;
  name: string;
  reasoning?: boolean;
  input?: string[];
  contextWindow?: number;
  maxTokens?: number;
};

export type ProviderConfig = {
  baseUrl: string;
  apiKey?: string;
  api?: string;
  auth?: string;
  models: ModelDefinition[];
};

export type ModelsPageState = ConfigState & {
  modelsProviderKey: string;
  modelsProviderBaseURL: string;
  modelsProviderApiKey: string;
  modelsProviderModels: string;
  modelsDefaultModel: string;
  modelsSaving: boolean;
};

export async function loadModelsConfig(state: ModelsPageState) {
  await loadConfigSchema(state);
  await loadConfig(state);
  syncModelsFromConfig(state);
}

function extractModelIds(models: unknown): string {
  if (!Array.isArray(models)) {
    return "";
  }
  return models
    .map((m) => {
      if (typeof m === "string") {
        return m;
      }
      if (m && typeof m === "object" && "id" in m) {
        return (m as { id: string }).id;
      }
      return "";
    })
    .filter(Boolean)
    .join(", ");
}

export function syncModelsFromConfig(state: ModelsPageState) {
  const config = state.configForm ?? state.configSnapshot?.config ?? {};
  const modelsSection = (config as Record<string, unknown>).models as
    | Record<string, unknown>
    | undefined;
  const providerMap = modelsSection?.providers as Record<string, unknown> | undefined;

  // Pre-fill form if a provider already exists
  if (providerMap && !state.modelsProviderKey) {
    const firstKey = Object.keys(providerMap)[0];
    if (firstKey) {
      const p = providerMap[firstKey] as Record<string, unknown> | undefined;
      if (p) {
        state.modelsProviderKey = firstKey;
        state.modelsProviderBaseURL = (p.baseUrl as string) ?? "";
        state.modelsProviderApiKey = (p.apiKey as string) ?? "";
        state.modelsProviderModels = extractModelIds(p.models);
      }
    }
  }

  // Sync default model
  const agents = (config as Record<string, unknown>).agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const model = defaults?.model as Record<string, unknown> | undefined;
  const primary = model?.primary;
  if (typeof primary === "string") {
    state.modelsDefaultModel = primary;
  }
}

export function getConfiguredProviders(
  state: ModelsPageState,
): Array<{ key: string; config: ProviderConfig }> {
  const config = state.configForm ?? state.configSnapshot?.config ?? {};
  const modelsSection = (config as Record<string, unknown>).models as
    | Record<string, unknown>
    | undefined;
  const providerMap = modelsSection?.providers as Record<string, unknown> | undefined;
  if (!providerMap) {
    return [];
  }
  return Object.entries(providerMap).map(([key, value]) => ({
    key,
    config: value as ProviderConfig,
  }));
}

export function getCurrentDefaultModel(state: ModelsPageState): string {
  const config = state.configForm ?? state.configSnapshot?.config ?? {};
  const agents = (config as Record<string, unknown>).agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const model = defaults?.model as Record<string, unknown> | undefined;
  return typeof model?.primary === "string" ? model.primary : "";
}

export function getAvailableModels(state: ModelsPageState): string[] {
  const providers = getConfiguredProviders(state);
  const result: string[] = [];
  for (const { key, config } of providers) {
    if (Array.isArray(config.models)) {
      for (const m of config.models) {
        const id = typeof m === "string" ? m : m.id;
        if (id) {
          result.push(`${key}/${id}`);
        }
      }
    }
  }
  return result;
}

export async function saveProviderConfig(state: ModelsPageState) {
  const key = state.modelsProviderKey.trim();
  if (!key) {
    return;
  }
  state.modelsSaving = true;
  try {
    const modelIds = state.modelsProviderModels
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    const models: ModelDefinition[] = modelIds.map((id) => ({
      id,
      name: id,
      reasoning: false,
      input: ["text", "image"],
    }));

    const provider: Record<string, unknown> = {
      baseUrl: state.modelsProviderBaseURL.trim(),
      api: "openai-completions",
      models,
    };

    const apiKey = state.modelsProviderApiKey.trim();
    if (apiKey) {
      provider.apiKey = apiKey;
    }

    updateConfigFormValue(state, ["models", "providers", key], provider);
    await saveConfig(state);
    syncModelsFromConfig(state);
  } finally {
    state.modelsSaving = false;
  }
}

export async function saveDefaultModel(state: ModelsPageState, modelId: string) {
  state.modelsSaving = true;
  try {
    updateConfigFormValue(state, ["agents", "defaults", "model", "primary"], modelId);
    await saveConfig(state);
    state.modelsDefaultModel = modelId;
  } finally {
    state.modelsSaving = false;
  }
}

export async function removeProvider(state: ModelsPageState, providerKey: string) {
  state.modelsSaving = true;
  try {
    removeConfigFormValue(state, ["models", "providers", providerKey]);

    // If the default model was from this provider, clear it
    const currentDefault = getCurrentDefaultModel(state);
    if (currentDefault.startsWith(`${providerKey}/`)) {
      updateConfigFormValue(state, ["agents", "defaults", "model", "primary"], "");
      state.modelsDefaultModel = "";
    }

    await saveConfig(state);
    // Clear form if the removed provider was the one being edited
    if (state.modelsProviderKey === providerKey) {
      state.modelsProviderKey = "";
      state.modelsProviderBaseURL = "";
      state.modelsProviderApiKey = "";
      state.modelsProviderModels = "";
    }
    syncModelsFromConfig(state);
  } finally {
    state.modelsSaving = false;
  }
}

export function editProvider(state: ModelsPageState, providerKey: string) {
  const providers = getConfiguredProviders(state);
  const found = providers.find((p) => p.key === providerKey);
  if (!found) {
    return;
  }
  state.modelsProviderKey = found.key;
  state.modelsProviderBaseURL = found.config.baseUrl ?? "";
  state.modelsProviderApiKey = found.config.apiKey ?? "";
  state.modelsProviderModels = extractModelIds(found.config.models);
}

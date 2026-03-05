import { create } from "zustand";
import { api } from "../services/api";

export interface AuthStatus {
  installed: boolean;
  authenticated: boolean;
  authMethod: "oauth" | "apikey" | "none";
  version?: string;
}

export interface ClaudeTestResult {
  success: boolean;
  responseText: string;
  latency: number;
  error?: string;
}

export interface ProxyTestResult {
  success: boolean;
  latency: number;
  error?: string;
}

export interface ClaudeInfo {
  installed: boolean;
  version?: string;
  platform: string;
  gitBashAvailable?: boolean;
}

export interface DoctorSection {
  line: string;
  status: "ok" | "error" | "info";
}

export interface ProxySettings {
  httpProxy: string;
  httpsProxy: string;
  socksProxy: string;
}

interface SystemState {
  claudeInfo: ClaudeInfo | null;
  infoLoading: boolean;
  doctorResult: DoctorSection[] | null;
  doctorLoading: boolean;
  updateOutput: string | null;
  updateLoading: boolean;
  proxySettings: ProxySettings;
  proxySaving: boolean;
  proxySaveError: string | null;

  // Auth status
  authStatus: AuthStatus | null;
  authStatusLoading: boolean;

  // Claude test (send "Hi" to verify full chain)
  claudeTestResult: ClaudeTestResult | null;
  claudeTesting: boolean;

  // Proxy port test
  proxyTestResult: ProxyTestResult | null;
  proxyTesting: boolean;

  // ~/.claude/settings.json env section (domestic model config)
  claudeSettingsEnv: Record<string, string>;
  claudeSettingsSaving: boolean;

  loadClaudeInfo: () => Promise<void>;
  runDoctor: () => Promise<void>;
  runUpdate: () => Promise<void>;
  loadProxy: () => Promise<void>;
  saveProxy: (proxy: ProxySettings) => Promise<void>;
  setProxySettings: (proxy: ProxySettings) => void;

  loadAuthStatus: () => Promise<void>;
  testProxy: (host: string, port: number) => Promise<void>;
  testClaude: (opts: { apiKey?: string; baseUrl?: string; model?: string; httpProxy?: string; httpsProxy?: string }) => Promise<ClaudeTestResult>;
  loadClaudeSettings: () => Promise<void>;
  saveClaudeSettings: (env: Record<string, string | undefined>) => Promise<void>;
}

export const useSystemStore = create<SystemState>((set) => ({
  claudeInfo: null,
  infoLoading: false,
  doctorResult: null,
  doctorLoading: false,
  updateOutput: null,
  updateLoading: false,
  proxySettings: { httpProxy: "", httpsProxy: "", socksProxy: "" },
  proxySaving: false,
  proxySaveError: null,
  authStatus: null,
  authStatusLoading: false,
  claudeTestResult: null,
  claudeTesting: false,
  proxyTestResult: null,
  proxyTesting: false,
  claudeSettingsEnv: {},
  claudeSettingsSaving: false,

  loadClaudeInfo: async () => {
    set({ infoLoading: true });
    try {
      const info = await api.systemApi.getClaudeInfo();
      set({ claudeInfo: info });
    } catch {
      set({ claudeInfo: { installed: false, platform: "unknown" } });
    } finally {
      set({ infoLoading: false });
    }
  },

  runDoctor: async () => {
    set({ doctorLoading: true, doctorResult: null });
    try {
      const { sections } = await api.systemApi.runDoctor();
      set({ doctorResult: sections });
    } finally {
      set({ doctorLoading: false });
    }
  },

  runUpdate: async () => {
    set({ updateLoading: true, updateOutput: null });
    try {
      const { output } = await api.systemApi.runUpdate();
      set({ updateOutput: output || "更新完成" });
    } catch (err) {
      set({ updateOutput: String(err) });
    } finally {
      set({ updateLoading: false });
    }
  },

  loadProxy: async () => {
    try {
      const proxy = await api.systemApi.getProxy();
      set({ proxySettings: proxy });
    } catch {
      // ignore
    }
  },

  saveProxy: async (proxy) => {
    set({ proxySaving: true, proxySaveError: null });
    // Race against a 10-second timeout so the UI never hangs indefinitely
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("保存超时，请检查后端服务是否正常")), 30_000)
    );
    try {
      await Promise.race([api.systemApi.saveProxy(proxy), timeout]);
      set({ proxySettings: proxy });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ proxySaveError: msg });
      throw err; // re-throw so callers can react
    } finally {
      set({ proxySaving: false });
    }
  },

  setProxySettings: (proxy) => set({ proxySettings: proxy }),

  loadAuthStatus: async () => {
    set({ authStatusLoading: true });
    try {
      const status = await api.systemApi.getAuthStatus();
      set({ authStatus: status });
    } catch {
      set({ authStatus: { installed: false, authenticated: false, authMethod: "none" } });
    } finally {
      set({ authStatusLoading: false });
    }
  },

  testProxy: async (host, port) => {
    set({ proxyTesting: true, proxyTestResult: null });
    try {
      const result = await api.systemApi.testProxy(host, port);
      set({ proxyTestResult: result });
    } catch (err) {
      set({ proxyTestResult: { success: false, latency: 0, error: String(err) } });
    } finally {
      set({ proxyTesting: false });
    }
  },

  testClaude: async (opts) => {
    set({ claudeTesting: true, claudeTestResult: null });
    try {
      const result = await api.systemApi.testClaude(opts);
      set({ claudeTestResult: result });
      return result;
    } catch (err) {
      const r: ClaudeTestResult = { success: false, responseText: "", latency: 0, error: String(err) };
      set({ claudeTestResult: r });
      return r;
    } finally {
      set({ claudeTesting: false });
    }
  },

  loadClaudeSettings: async () => {
    try {
      const data = await api.systemApi.getClaudeSettings();
      set({ claudeSettingsEnv: data.env ?? {} });
    } catch { /* ignore */ }
  },

  saveClaudeSettings: async (env) => {
    set({ claudeSettingsSaving: true });
    try {
      await api.systemApi.saveClaudeSettings(env);
      // Refresh
      const data = await api.systemApi.getClaudeSettings();
      set({ claudeSettingsEnv: data.env ?? {} });
    } finally {
      set({ claudeSettingsSaving: false });
    }
  },
}));

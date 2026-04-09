import { create } from "zustand";
import type { ModelId, EffortLevel } from "../types/claude";

interface ConfigState {
  model: ModelId;
  effort: EffortLevel;
  thinking: boolean;
  autoCompactThreshold: number;
  // API Key — 仅存内存，不持久化，不写日志
  apiKey: string;

  setModel: (m: ModelId) => void;
  setEffort: (e: EffortLevel) => void;
  setThinking: (t: boolean) => void;
  setAutoCompactThreshold: (v: number) => void;
  setApiKey: (k: string) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  model: "opus",
  effort: "high",
  thinking: true,
  autoCompactThreshold: 95,
  apiKey: "",

  setModel: (model) => set({ model }),
  setEffort: (effort) => set({ effort }),
  setThinking: (thinking) => set({ thinking }),
  setAutoCompactThreshold: (autoCompactThreshold) =>
    set({ autoCompactThreshold }),
  setApiKey: (apiKey) => set({ apiKey }),
}));

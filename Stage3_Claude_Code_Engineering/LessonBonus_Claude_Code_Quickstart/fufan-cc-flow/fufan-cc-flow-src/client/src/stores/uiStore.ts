import { create } from "zustand";

type SidebarTab = "sessions" | "files" | "agents" | "extensions" | "settings";
export type LeftNavPanel = "files" | "search" | "checkpoints";
export type RightSidebarTab = "monitor" | "extensions" | "agent";
export type RunMode = "default" | "plan" | "edit";

interface UIState {
  // Left sidebar
  sidebarOpen: boolean;
  sidebarWidth: number;
  sidebarTab: SidebarTab;
  leftNavPanel: LeftNavPanel;

  // Right panel
  rightPanelOpen: boolean;
  rightPanelWidth: number;
  rightSidebarTab: RightSidebarTab;

  // Right-panel terminal (collapsed by default)
  terminalOpen: boolean;
  terminalHeight: number;

  // Connection + project
  wsConnected: boolean;
  projectPath: string;

  // Input run mode
  runMode: RunMode;

  // Modal visibility
  historyModalOpen: boolean;
  fileViewModalOpen: boolean;
  settingsModalOpen: boolean;
  settingsActiveTab: "model" | "environment";
  folderBrowserOpen: boolean;
  skillBrowserOpen: boolean;
  skillBrowserInitialSelection: { tab: "project" | "user" | "plugin"; name: string } | null;
  createSkillModalOpen: boolean;

  // Settings full page
  settingsPageOpen: boolean;

  // Extensions sub-tab (driven externally by slash commands)
  extensionsSubTab: "mcp" | "skills" | "plugins" | "memory" | "hooks";

  // Agent prefill (set by AgentManager "launch" button, consumed by InputBar)
  prefillInput: string;

  // Actions
  toggleSidebar: () => void;
  setSidebarWidth: (w: number) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setLeftNavPanel: (panel: LeftNavPanel) => void;

  setRightPanelOpen: (open: boolean) => void;
  setRightPanelWidth: (w: number) => void;
  setRightSidebarTab: (tab: RightSidebarTab) => void;

  toggleTerminal: () => void;
  setTerminalOpen: (open: boolean) => void;
  setTerminalHeight: (h: number) => void;

  setWsConnected: (c: boolean) => void;
  setProjectPath: (p: string) => void;

  setRunMode: (mode: RunMode) => void;

  setHistoryModalOpen: (open: boolean) => void;
  setFileViewModalOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setSettingsActiveTab: (tab: "model" | "environment") => void;
  setFolderBrowserOpen: (open: boolean) => void;
  setSkillBrowserOpen: (open: boolean) => void;
  setSkillBrowserInitialSelection: (sel: { tab: "project" | "user" | "plugin"; name: string } | null) => void;
  setCreateSkillModalOpen: (open: boolean) => void;

  setSettingsPageOpen: (open: boolean) => void;

  setExtensionsSubTab: (tab: "mcp" | "skills" | "plugins" | "memory" | "hooks") => void;

  setPrefillInput: (text: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarWidth: 240,
  sidebarTab: "sessions",
  leftNavPanel: "files",

  rightPanelOpen: true,
  rightPanelWidth: 380,
  rightSidebarTab: "monitor",

  terminalOpen: false,
  terminalHeight: 260,

  wsConnected: false,
  projectPath: localStorage.getItem("fufan_projectPath") || "",

  runMode: "default",

  historyModalOpen: false,
  fileViewModalOpen: false,
  settingsModalOpen: false,
  settingsActiveTab: "model",
  settingsPageOpen: false,
  folderBrowserOpen: false,
  skillBrowserOpen: false,
  skillBrowserInitialSelection: null,
  createSkillModalOpen: false,
  extensionsSubTab: "mcp",
  prefillInput: "",

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setLeftNavPanel: (panel) => set({ leftNavPanel: panel }),

  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setRightPanelWidth: (w) => set({ rightPanelWidth: w }),
  setRightSidebarTab: (tab) => set({ rightSidebarTab: tab }),

  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  setTerminalOpen: (open) => set({ terminalOpen: open }),
  setTerminalHeight: (h) => set({ terminalHeight: h }),

  setWsConnected: (c) => set({ wsConnected: c }),
  setProjectPath: (p) => {
    localStorage.setItem("fufan_projectPath", p);
    set({ projectPath: p });
  },

  setRunMode: (mode) => set({ runMode: mode }),

  setHistoryModalOpen: (open) => set({ historyModalOpen: open }),
  setFileViewModalOpen: (open) => set({ fileViewModalOpen: open }),
  setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),
  setSettingsActiveTab: (tab) => set({ settingsActiveTab: tab }),
  setSettingsPageOpen: (open) => set({ settingsPageOpen: open }),
  setFolderBrowserOpen: (open) => set({ folderBrowserOpen: open }),
  setSkillBrowserOpen: (open) => set({ skillBrowserOpen: open }),
  setSkillBrowserInitialSelection: (sel) => set({ skillBrowserInitialSelection: sel }),
  setCreateSkillModalOpen: (open) => set({ createSkillModalOpen: open }),
  setExtensionsSubTab: (tab) => set({ extensionsSubTab: tab }),

  setPrefillInput: (text) => set({ prefillInput: text }),
}));

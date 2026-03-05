import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import {
  Trash2, History, Settings, Cpu, Minimize2, Puzzle, Server, Zap,
  ChevronRight, ArrowLeft, Search, FileText, Brain, Activity,
  HelpCircle, Stethoscope, Shield, ClipboardList, Wand2,
  GitBranch, GitFork, RotateCcw, Copy, Download, Gauge,
  Eye, Bot, ListTodo, Webhook, LogIn, LogOut, MessageSquare,
  Info, ScrollText, ShieldCheck, PenLine, Bolt,
} from "lucide-react";
import { useChatStore } from "../../stores/chatStore";
import { useConfigStore } from "../../stores/configStore";
import { useUIStore } from "../../stores/uiStore";
import { useSkillStore } from "../../stores/skillStore";
import { usePluginStore } from "../../stores/pluginStore";
import type { ModelId } from "../../types/claude";

/* ── Types ── */
export type CommandType = "action" | "prompt" | "insert";

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  type: CommandType;
  action?: () => void;       // For "action" type
  promptText?: string;       // For "prompt" type — sent as message to Claude
  insertText?: string;       // For "insert" type — placed in input for user to edit
  subCommands?: SlashCommand[];
  category?: string;         // Section header for grouping
}

interface SlashCommandMenuProps {
  query: string;
  onSelect: (cmd: SlashCommand) => void;
  onDismiss: () => void;
}

export interface SlashCommandMenuHandle {
  handleKey: (key: string) => boolean;
}

/* ── Helper: copy text to clipboard with fallback ── */
function copyToClipboard(text: string): boolean {
  try {
    navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  }
}

/* ── Helper: export conversation as text download ── */
function exportConversation() {
  const { messages, currentSessionId } = useChatStore.getState();
  const active = messages.filter((m) => !m.rolledBack);
  if (active.length === 0) return;

  const lines: string[] = [];
  lines.push(`# Fufan-CC Flow 对话导出`);
  lines.push(`# Session: ${currentSessionId || "unknown"}`);
  lines.push(`# 时间: ${new Date().toLocaleString()}`);
  lines.push("");

  for (const m of active) {
    if (m.role === "system" && m.compactData) {
      lines.push(`--- 上下文压缩 (${m.compactData.tokensBefore} → ${m.compactData.tokensAfter} tokens) ---`);
      if (m.compactData.summary) lines.push(m.compactData.summary);
      lines.push("");
      continue;
    }
    const label = m.role === "user" ? "👤 User" : m.role === "assistant" ? "🤖 Claude" : "System";
    lines.push(`## ${label}`);
    if (m.content) lines.push(m.content);
    if (m.toolCalls?.length) {
      for (const tc of m.toolCalls) {
        lines.push(`  [Tool: ${tc.toolName}] ${tc.status === "error" ? "❌" : "✅"}`);
      }
    }
    lines.push("");
  }

  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chat-${currentSessionId || "export"}-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Built-in command registry ── */
function getBuiltinCommands(): SlashCommand[] {
  const setModel = useConfigStore.getState().setModel;
  const setEffort = useConfigStore.getState().setEffort;

  return [
    // ═══════════ 对话 ═══════════
    {
      id: "clear", label: "/clear", description: "清空当前对话（新建会话）",
      icon: <Trash2 size={14} />, type: "action", category: "对话",
      action: () => useChatStore.getState().clearMessages(),
    },
    {
      id: "compact", label: "/compact", description: "压缩上下文（可附加指令）",
      icon: <Minimize2 size={14} />, type: "insert", category: "对话",
      insertText: "/compact ",
    },
    {
      id: "model", label: "/model", description: "切换模型",
      icon: <Cpu size={14} />, type: "action", category: "对话",
      action: () => {},
      subCommands: [
        { id: "model-opus",   label: "opus",   description: "Claude Opus — 最强推理",   icon: <Cpu size={14} />, type: "action", action: () => setModel("opus" as ModelId) },
        { id: "model-sonnet", label: "sonnet", description: "Claude Sonnet — 均衡",     icon: <Cpu size={14} />, type: "action", action: () => setModel("sonnet" as ModelId) },
        { id: "model-haiku",  label: "haiku",  description: "Claude Haiku — 轻快",      icon: <Cpu size={14} />, type: "action", action: () => setModel("haiku" as ModelId) },
      ],
    },
    {
      id: "fast", label: "/fast", description: "切换 Fast 模式（低延迟）",
      icon: <Bolt size={14} />, type: "action", category: "对话",
      action: () => {},
      subCommands: [
        { id: "fast-on",  label: "on",  description: "开启 Fast 模式（effort: low）", icon: <Bolt size={14} />, type: "action", action: () => setEffort("low") },
        { id: "fast-off", label: "off", description: "关闭 Fast 模式（effort: high）", icon: <Gauge size={14} />, type: "action", action: () => setEffort("high") },
      ],
    },
    {
      id: "plan", label: "/plan", description: "切换到 Plan 模式",
      icon: <ClipboardList size={14} />, type: "action", category: "对话",
      action: () => useUIStore.getState().setRunMode("plan"),
    },
    {
      id: "fork", label: "/fork", description: "Fork 当前对话（从此处分叉）",
      icon: <GitFork size={14} />, type: "action", category: "对话",
      action: () => {
        const sid = useChatStore.getState().currentSessionId;
        if (sid) useChatStore.getState().setPendingFork({ sessionId: sid });
      },
    },
    {
      id: "rewind", label: "/rewind", description: "回滚到之前的检查点",
      icon: <RotateCcw size={14} />, type: "action", category: "对话",
      action: () => {
        const ui = useUIStore.getState();
        ui.setRightPanelOpen(true);
        ui.setRightSidebarTab("agent");
      },
    },
    {
      id: "history", label: "/history", description: "查看 / 恢复历史会话",
      icon: <History size={14} />, type: "action", category: "对话",
      action: () => useUIStore.getState().setHistoryModalOpen(true),
    },
    {
      id: "resume", label: "/resume", description: "恢复历史会话（同 /history）",
      icon: <History size={14} />, type: "action", category: "对话",
      action: () => useUIStore.getState().setHistoryModalOpen(true),
    },
    {
      id: "copy", label: "/copy", description: "复制最近一条 AI 回复到剪贴板",
      icon: <Copy size={14} />, type: "action", category: "对话",
      action: () => {
        const msgs = useChatStore.getState().messages.filter((m) => !m.rolledBack);
        const last = [...msgs].reverse().find((m) => m.role === "assistant" && m.content);
        if (last?.content) copyToClipboard(last.content);
      },
    },
    {
      id: "export", label: "/export", description: "导出当前对话为文件",
      icon: <Download size={14} />, type: "action", category: "对话",
      action: exportConversation,
    },

    // ═══════════ 项目 ═══════════
    {
      id: "init", label: "/init", description: "初始化项目 CLAUDE.md",
      icon: <FileText size={14} />, type: "insert", category: "项目",
      insertText: "/init ",
    },
    {
      id: "memory", label: "/memory", description: "编辑 CLAUDE.md Memory 文件",
      icon: <Brain size={14} />, type: "insert", category: "项目",
      insertText: "/memory ",
    },
    {
      id: "diff", label: "/diff", description: "查看代码变更 / Git 状态",
      icon: <GitBranch size={14} />, type: "action", category: "项目",
      action: () => {
        const ui = useUIStore.getState();
        if (!ui.sidebarOpen) ui.toggleSidebar();
        ui.setLeftNavPanel("checkpoints");
      },
    },
    {
      id: "rename", label: "/rename", description: "重命名当前会话",
      icon: <PenLine size={14} />, type: "insert", category: "项目",
      insertText: "/rename ",
    },

    // ═══════════ 开发 ═══════════
    {
      id: "review", label: "/review", description: "AI 代码审查（指定 PR 编号）",
      icon: <Eye size={14} />, type: "insert", category: "开发",
      insertText: "/review ",
    },
    {
      id: "pr-comments", label: "/pr-comments", description: "获取 PR 评论",
      icon: <MessageSquare size={14} />, type: "insert", category: "开发",
      insertText: "/pr-comments ",
    },
    {
      id: "security-review", label: "/security-review", description: "安全漏洞分析",
      icon: <ShieldCheck size={14} />, type: "prompt", category: "开发",
      promptText: "/security-review",
    },

    // ═══════════ 信息 ═══════════
    {
      id: "cost", label: "/cost", description: "查看用量统计",
      icon: <Activity size={14} />, type: "action", category: "信息",
      action: () => {
        const ui = useUIStore.getState();
        ui.setRightPanelOpen(true);
        ui.setRightSidebarTab("monitor");
      },
    },
    {
      id: "context", label: "/context", description: "查看上下文用量",
      icon: <Gauge size={14} />, type: "action", category: "信息",
      action: () => {
        const ui = useUIStore.getState();
        ui.setRightPanelOpen(true);
        ui.setRightSidebarTab("monitor");
      },
    },
    {
      id: "help", label: "/help", description: "获取使用帮助",
      icon: <HelpCircle size={14} />, type: "insert", category: "信息",
      insertText: "/help ",
    },
    {
      id: "doctor", label: "/doctor", description: "检查 Claude Code 安装状态",
      icon: <Stethoscope size={14} />, type: "insert", category: "信息",
      insertText: "/doctor ",
    },
    {
      id: "status", label: "/status", description: "查看连接状态和版本信息",
      icon: <Info size={14} />, type: "insert", category: "信息",
      insertText: "/status ",
    },
    {
      id: "permissions", label: "/permissions", description: "查看 / 管理权限",
      icon: <Shield size={14} />, type: "insert", category: "信息",
      insertText: "/permissions ",
    },
    {
      id: "settings", label: "/settings", description: "打开设置",
      icon: <Settings size={14} />, type: "action", category: "信息",
      action: () => useUIStore.getState().setSettingsPageOpen(true),
    },
    {
      id: "release-notes", label: "/release-notes", description: "查看 Claude Code 更新日志",
      icon: <ScrollText size={14} />, type: "prompt", category: "信息",
      promptText: "/release-notes",
    },

    // ═══════════ 管理 ═══════════
    {
      id: "mcp", label: "/mcp", description: "MCP 服务器管理",
      icon: <Server size={14} />, type: "action", category: "管理",
      action: () => {
        const ui = useUIStore.getState();
        ui.setRightPanelOpen(true);
        ui.setRightSidebarTab("extensions");
        ui.setExtensionsSubTab("mcp");
      },
    },
    {
      id: "skills", label: "/skills", description: "Skills 管理",
      icon: <Zap size={14} />, type: "action", category: "管理",
      action: () => {
        const ui = useUIStore.getState();
        ui.setRightPanelOpen(true);
        ui.setRightSidebarTab("extensions");
        ui.setExtensionsSubTab("skills");
      },
    },
    {
      id: "plugin", label: "/plugin", description: "插件管理",
      icon: <Puzzle size={14} />, type: "action", category: "管理",
      action: () => {
        const ui = useUIStore.getState();
        ui.setRightPanelOpen(true);
        ui.setRightSidebarTab("extensions");
        ui.setExtensionsSubTab("plugins");
      },
    },
    {
      id: "agents", label: "/agents", description: "Agent 配置与管理",
      icon: <Bot size={14} />, type: "action", category: "管理",
      action: () => {
        const ui = useUIStore.getState();
        ui.setRightPanelOpen(true);
        ui.setRightSidebarTab("agent");
      },
    },
    {
      id: "tasks", label: "/tasks", description: "查看后台任务",
      icon: <ListTodo size={14} />, type: "action", category: "管理",
      action: () => {
        const ui = useUIStore.getState();
        ui.setRightPanelOpen(true);
        ui.setRightSidebarTab("monitor");
      },
    },
    {
      id: "hooks", label: "/hooks", description: "管理 Hook 配置",
      icon: <Webhook size={14} />, type: "insert", category: "管理",
      insertText: "/hooks ",
    },

    // ═══════════ 账号 ═══════════
    {
      id: "login", label: "/login", description: "登录 Anthropic 账号",
      icon: <LogIn size={14} />, type: "insert", category: "账号",
      insertText: "/login ",
    },
    {
      id: "logout", label: "/logout", description: "注销当前账号",
      icon: <LogOut size={14} />, type: "insert", category: "账号",
      insertText: "/logout ",
    },
    {
      id: "feedback", label: "/feedback", description: "提交反馈或 Bug 报告",
      icon: <MessageSquare size={14} />, type: "insert", category: "账号",
      insertText: "/feedback ",
    },
  ];
}

/* ── Component ── */
const SlashCommandMenu = forwardRef<SlashCommandMenuHandle, SlashCommandMenuProps>(
  ({ query, onSelect, onDismiss }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [activeParent, setActiveParent] = useState<SlashCommand | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Dynamic data from stores
    const projectSkills = useSkillStore((s) => s.projectSkills);
    const userSkills = useSkillStore((s) => s.userSkills);
    const loadSkills = useSkillStore((s) => s.loadSkills);
    const plugins = usePluginStore((s) => s.plugins);
    const loadPlugins = usePluginStore((s) => s.loadPlugins);
    const projectPath = useUIStore((s) => s.projectPath);

    // Refresh dynamic data when menu opens
    useEffect(() => {
      loadSkills(projectPath || undefined);
      loadPlugins();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Build complete command list
    const builtinCommands = getBuiltinCommands();

    // Dynamic Skills → slash commands
    const allSkills = [...projectSkills, ...userSkills];
    const skillCommands: SlashCommand[] = allSkills.map((sk) => ({
      id: `skill-${sk.name}`,
      label: `/${sk.name}`,
      description: sk.description || "自定义 Skill",
      icon: <Wand2 size={14} />,
      type: sk.argumentHint ? "insert" as const : "prompt" as const,
      promptText: sk.argumentHint ? undefined : `/${sk.name}`,
      insertText: sk.argumentHint ? `/${sk.name} ` : undefined,
      category: "Skills",
    }));

    // Plugin-provided skills → slash commands
    const pluginCommands: SlashCommand[] = plugins
      .filter((p) => p.enabled && p.components?.skills?.length)
      .flatMap((p) =>
        (p.components!.skills!).map((skillName) => ({
          id: `plugin-${p.name}-${skillName}`,
          label: skillName.startsWith("/") ? skillName : `/${skillName}`,
          description: `${p.name} 插件提供`,
          icon: <Puzzle size={14} />,
          type: "prompt" as const,
          promptText: skillName.startsWith("/") ? skillName : `/${skillName}`,
          category: "插件命令",
        }))
      );

    const allCommands = [...builtinCommands, ...skillCommands, ...pluginCommands];

    // Determine visible list (sub-menu or top level)
    const visibleCommands = activeParent?.subCommands ?? allCommands;

    // Filter by query (only at top-level; sub-menu shows all)
    const filtered = activeParent
      ? visibleCommands
      : visibleCommands.filter((cmd) =>
          cmd.id.toLowerCase().includes(query.toLowerCase()) ||
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description.toLowerCase().includes(query.toLowerCase())
        );

    // Build items with category headers for rendering
    type RenderItem =
      | { kind: "header"; label: string }
      | { kind: "command"; cmd: SlashCommand; flatIndex: number };

    const renderItems: RenderItem[] = [];
    let flatIndex = 0;

    if (activeParent) {
      // Sub-menu — no category headers
      for (const cmd of filtered) {
        renderItems.push({ kind: "command", cmd, flatIndex });
        flatIndex++;
      }
    } else {
      // Group by category
      let lastCategory = "";
      for (const cmd of filtered) {
        if (cmd.category && cmd.category !== lastCategory) {
          lastCategory = cmd.category;
          renderItems.push({ kind: "header", label: cmd.category });
        }
        renderItems.push({ kind: "command", cmd, flatIndex });
        flatIndex++;
      }
    }

    // Reset selection when query or parent changes
    useEffect(() => {
      setSelectedIndex(0);
    }, [query, activeParent]);

    // Scroll active item into view
    useEffect(() => {
      const container = listRef.current;
      if (!container) return;
      // Find the DOM element for the selected command
      const el = container.querySelector(`[data-cmd-index="${selectedIndex}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex, activeParent]);

    // Click outside → dismiss
    useEffect(() => {
      const handler = (e: MouseEvent) => {
        const el = listRef.current?.parentElement;
        if (el && !el.contains(e.target as Node)) {
          onDismiss();
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [onDismiss]);

    const selectCurrent = () => {
      const cmd = filtered[selectedIndex];
      if (!cmd) return;
      if (cmd.subCommands) {
        setActiveParent(cmd);
        setSelectedIndex(0);
      } else {
        onSelect(cmd);
      }
    };

    const goBack = () => {
      setActiveParent(null);
      setSelectedIndex(0);
    };

    useImperativeHandle(ref, () => ({
      handleKey(key: string): boolean {
        if (key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % Math.max(filtered.length, 1));
          return true;
        }
        if (key === "ArrowUp") {
          setSelectedIndex((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1));
          return true;
        }
        if (key === "Enter" || key === "Tab") {
          // If no matching command, return false so Enter falls through to send
          if (filtered.length === 0) return false;
          selectCurrent();
          return true;
        }
        if (key === "Escape") {
          if (activeParent) {
            goBack();
          } else {
            onDismiss();
          }
          return true;
        }
        if (key === "Backspace" && activeParent && query === "") {
          goBack();
          return true;
        }
        return false;
      },
    }));

    return (
      <div
        className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-white/10 overflow-hidden shadow-lg z-50"
        style={{
          background: "rgba(13,11,24,0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.40)",
          maxHeight: 380,
        }}
      >
        <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 320 }}>
          {/* Breadcrumb for sub-menu */}
          {activeParent && (
            <button
              onClick={goBack}
              className="flex items-center gap-2 w-full px-4 py-2 text-xs text-slate-400 hover:bg-white/5 border-b border-white/5 transition-colors"
            >
              <ArrowLeft size={12} />
              <span className="font-mono">{activeParent.label}</span>
              <span className="text-slate-600">/ 选择子命令</span>
            </button>
          )}

          {filtered.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
              <Search size={13} />
              <span>无匹配命令</span>
            </div>
          ) : (
            renderItems.map((item, ri) => {
              if (item.kind === "header") {
                return (
                  <div
                    key={`hdr-${item.label}`}
                    className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 select-none"
                  >
                    {item.label}
                  </div>
                );
              }

              const { cmd, flatIndex: fi } = item;
              const isSelected = fi === selectedIndex;

              return (
                <button
                  key={cmd.id}
                  data-cmd-index={fi}
                  onClick={() => {
                    if (cmd.subCommands) {
                      setActiveParent(cmd);
                      setSelectedIndex(0);
                    } else {
                      onSelect(cmd);
                    }
                  }}
                  className={`flex items-center gap-3 w-full px-4 py-2 text-left transition-all ${
                    isSelected
                      ? "bg-purple-glow/10 border-l-2 border-purple-bright"
                      : "border-l-2 border-transparent hover:bg-white/5"
                  }`}
                >
                  <span className={`flex-shrink-0 ${isSelected ? "text-purple-bright" : "text-slate-500"}`}>
                    {cmd.icon}
                  </span>
                  <span className={`font-mono text-sm ${isSelected ? "text-white" : "text-slate-300"}`}>
                    {cmd.label}
                  </span>
                  <span className="text-xs text-slate-500 flex-1 truncate">
                    {cmd.description}
                  </span>
                  {cmd.subCommands && (
                    <ChevronRight size={12} className="text-slate-600 flex-shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }
);

SlashCommandMenu.displayName = "SlashCommandMenu";
export default SlashCommandMenu;

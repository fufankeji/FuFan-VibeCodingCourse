import { useEffect } from "react";
import Sidebar from "./Sidebar";
import RightPanel from "./RightPanel";
import ChatPanel from "../chat/ChatPanel";
import HistoryModal from "../modals/HistoryModal";
import FileViewModal from "../modals/FileViewModal";
import SettingsModal from "../modals/SettingsModal";
import FolderBrowserModal from "../modals/FolderBrowserModal";
import SkillBrowserModal from "../modals/SkillBrowserModal";
import CreateSkillModal from "../modals/CreateSkillModal";
import { useSystemStore } from "../../stores/systemStore";
import { useDoubleEsc } from "../../hooks/useDoubleEsc";

export default function AppLayout() {
  const { loadClaudeInfo, loadAuthStatus, loadClaudeSettings } = useSystemStore();

  useEffect(() => {
    loadClaudeInfo();
    loadAuthStatus();
    loadClaudeSettings();
  }, [loadClaudeInfo, loadAuthStatus, loadClaudeSettings]);

  useDoubleEsc();

  return (
    <div className="h-screen flex overflow-hidden bg-obsidian-900">

      {/* ── 左侧栏：纯暗色，无光晕穿透 ── */}
      <Sidebar />

      {/* ── 中+右区域：光晕仅在这里（与参考样式保持一致）── */}
      <div className="relative flex-1 flex overflow-hidden min-w-0">
        {/* Ambient glow — solid color + blur，参考 bg-secondary-900/20 + bg-primary-900/10 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div
            className="absolute rounded-full blur-[120px]"
            style={{
              top: "-10%", left: "-10%", width: "50%", height: "50%",
              background: "rgba(76, 29, 149, 0.20)",
            }}
          />
          <div
            className="absolute rounded-full blur-[100px]"
            style={{
              bottom: "-10%", right: "-10%", width: "40%", height: "40%",
              background: "rgba(112, 49, 35, 0.10)",
            }}
          />
        </div>

        {/* 内容列（z-10 覆盖在光晕之上）*/}
        <div className="relative z-10 flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <ChatPanel />
          </div>
          <RightPanel />
        </div>
      </div>

      {/* Global modals */}
      <HistoryModal />
      <FileViewModal />
      <SettingsModal />
      <FolderBrowserModal />
      <SkillBrowserModal />
      <CreateSkillModal />
    </div>
  );
}

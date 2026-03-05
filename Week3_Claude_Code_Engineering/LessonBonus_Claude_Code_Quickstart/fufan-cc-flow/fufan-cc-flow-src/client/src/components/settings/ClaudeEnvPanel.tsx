import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Info,
  RefreshCw,
  Stethoscope,
  ArrowUpCircle,
  Copy,
  Terminal,
  Shield,
  Save,
} from "lucide-react";
import { useSystemStore } from "../../stores/systemStore";
import { useUIStore } from "../../stores/uiStore";
import { api } from "../../services/api";

type InstallMethod = "powershell" | "winget" | "cmd";

function buildProxyPrefix(
  method: InstallMethod | "curl",
  httpsProxy: string
): string {
  if (!httpsProxy) return "";
  if (method === "powershell") return `$env:HTTPS_PROXY="${httpsProxy}"; `;
  if (method === "curl") return `HTTPS_PROXY=${httpsProxy} `;
  return "";
}

const INSTALL_COMMANDS: Record<InstallMethod, string> = {
  powershell: "irm https://claude.ai/install.ps1 | iex",
  winget: "winget install Anthropic.ClaudeCode",
  cmd: "curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd",
};

// ── Shared: Proxy Settings Block ─────────────────────────────────────────────
function ProxyBlock({
  stepLabel,
}: {
  stepLabel?: string; // e.g. "第 1 步" shown as a badge
}) {
  const { proxySettings, proxySaving, proxySaveError, saveProxy, setProxySettings } =
    useSystemStore();
  const [proxySaveMsg, setProxySaveMsg] = useState<string | null>(null);

  async function handleSaveProxy() {
    try {
      await saveProxy(proxySettings);
      setProxySaveMsg("代理设置已保存 ✓");
    } catch {
      // proxySaveError is already set in the store; show it via the error display below
      setProxySaveMsg(null);
    } finally {
      setTimeout(() => setProxySaveMsg(null), 4000);
    }
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Shield size={14} className="text-sky-link" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          代理设置
        </span>
        {stepLabel && (
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-link/10 text-sky-link border border-sky-link/20">
            {stepLabel}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* HTTP Proxy */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">HTTP Proxy</label>
          <input
            type="text"
            value={proxySettings.httpProxy}
            onChange={(e) =>
              setProxySettings({ ...proxySettings, httpProxy: e.target.value })
            }
            placeholder="http://127.0.0.1:7890"
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-glow/40 transition-colors font-mono"
          />
        </div>

        {/* HTTPS Proxy */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">HTTPS Proxy</label>
          <input
            type="text"
            value={proxySettings.httpsProxy}
            onChange={(e) =>
              setProxySettings({ ...proxySettings, httpsProxy: e.target.value })
            }
            placeholder="http://127.0.0.1:7890"
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-glow/40 transition-colors font-mono"
          />
        </div>

        {/* SOCKS Proxy — optional */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            SOCKS Proxy
            <span className="ml-1.5 text-slate-600 font-normal">（可选，大多数情况不需要填）</span>
          </label>
          <input
            type="text"
            value={proxySettings.socksProxy}
            onChange={(e) =>
              setProxySettings({ ...proxySettings, socksProxy: e.target.value })
            }
            placeholder="socks5://127.0.0.1:1080"
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-glow/40 transition-colors font-mono"
          />
        </div>

        {/* Quick-fill presets */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              setProxySettings({
                httpProxy: "http://127.0.0.1:7890",
                httpsProxy: "http://127.0.0.1:7890",
                socksProxy: "",
              })
            }
            className="px-2.5 py-1 rounded-md text-[11px] border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            Clash 默认 (7890)
          </button>
          <button
            onClick={() =>
              setProxySettings({
                httpProxy: "http://127.0.0.1:10809",
                httpsProxy: "http://127.0.0.1:10809",
                socksProxy: "",
              })
            }
            className="px-2.5 py-1 rounded-md text-[11px] border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            V2Ray 默认 (10809)
          </button>
          <button
            onClick={() =>
              setProxySettings({ httpProxy: "", httpsProxy: "", socksProxy: "" })
            }
            className="px-2.5 py-1 rounded-md text-[11px] border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            清空
          </button>
        </div>

        {/* Save */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSaveProxy}
            disabled={proxySaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#ca5d3d] hover:bg-amber-glow text-white transition-colors shadow-sm disabled:opacity-40"
          >
            <Save size={13} />
            {proxySaving ? "保存中..." : "保存代理设置"}
          </button>
          {proxySaveMsg && (
            <span className="text-xs text-emerald-ok">{proxySaveMsg}</span>
          )}
          {!proxySaving && proxySaveError && (
            <span className="text-xs text-rose-err">{proxySaveError}</span>
          )}
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          只需填 HTTP / HTTPS Proxy 即可（如 <span className="font-mono text-slate-400">http://127.0.0.1:10080</span>）。
          代理对 Claude Code API 请求和安装命令均生效；
          安装命令会在已设 HTTPS Proxy 时自动加入代理前缀。
        </p>
      </div>
    </section>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ClaudeEnvPanel() {
  const {
    claudeInfo,
    infoLoading,
    doctorResult,
    doctorLoading,
    updateOutput,
    updateLoading,
    proxySettings,
    loadClaudeInfo,
    runDoctor,
    runUpdate,
    loadProxy,
  } = useSystemStore();

  const { setSettingsModalOpen, setRightPanelOpen, setTerminalOpen, setRightSidebarTab } =
    useUIStore();

  const [installMethod, setInstallMethod] = useState<InstallMethod>("powershell");
  const [showDoctorOutput, setShowDoctorOutput] = useState(false);
  const [showUpdateOutput, setShowUpdateOutput] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [autoChannel, setAutoChannel] = useState<"latest" | "stable">("latest");

  useEffect(() => {
    loadProxy();
  }, [loadProxy]);

  const isWindows = claudeInfo?.platform === "win32" || claudeInfo === null;

  function getInstallCommand(): string {
    if (!isWindows) {
      const prefix = buildProxyPrefix("curl", proxySettings.httpsProxy);
      return `${prefix}curl -fsSL https://claude.ai/install.sh | bash`;
    }
    const prefix = buildProxyPrefix(installMethod, proxySettings.httpsProxy);
    return `${prefix}${INSTALL_COMMANDS[installMethod]}`;
  }

  async function handleCopyCommand() {
    await navigator.clipboard.writeText(getInstallCommand());
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  }

  function handleOpenTerminal() {
    setRightPanelOpen(true);
    setTerminalOpen(true);
    setRightSidebarTab("monitor");
    setSettingsModalOpen(false);
  }

  async function handleChannelChange(ch: "latest" | "stable") {
    setAutoChannel(ch);
    await api.updateConfig({ autoUpdatesChannel: ch });
  }

  async function handleRunDoctor() {
    setShowDoctorOutput(true);
    await runDoctor();
  }

  async function handleRunUpdate() {
    setShowUpdateOutput(true);
    await runUpdate();
  }

  // ── Not installed: proxy FIRST, then install guide ─────────────────────────
  if (!claudeInfo?.installed) {
    return (
      <div className="space-y-6">
        {/* Status banner */}
        <div className="flex items-center gap-3 p-3 rounded-xl border border-rose-err/20 bg-rose-err/5">
          <XCircle size={16} className="text-rose-err flex-shrink-0" />
          <span className="text-sm text-slate-300">未检测到 Claude Code</span>
          <button
            onClick={loadClaudeInfo}
            disabled={infoLoading}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-white/10 text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={infoLoading ? "animate-spin" : ""} />
            重新检测
          </button>
        </div>

        {/* Step 1: Proxy (国内必须先配置代理) */}
        <ProxyBlock stepLabel="第 1 步" />

        {/* Step 2: Install guide */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} className="text-purple-bright" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              安装 Claude Code
            </span>
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-glow/10 text-purple-bright border border-purple-bright/20">
              第 2 步
            </span>
          </div>

          <div className="space-y-3">
            {/* Windows: Git for Windows prerequisite */}
            {isWindows && (
              <div className="p-3 rounded-xl border border-white/5 bg-white/2 space-y-2">
                <div className="text-xs font-semibold text-slate-400">
                  前置条件：安装 Git for Windows
                </div>
                <a
                  href="https://git-scm.com/download/win"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  下载 Git for Windows ↗
                </a>
                {claudeInfo?.gitBashAvailable === false && (
                  <p className="text-[11px] text-amber-glow">
                    未检测到 Git Bash，请先安装 Git for Windows
                  </p>
                )}
              </div>
            )}

            {/* Method tabs (Windows only) */}
            {isWindows && (
              <div className="flex gap-1">
                {(["powershell", "winget", "cmd"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setInstallMethod(m)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                      installMethod === m
                        ? "border-purple-bright/30 bg-purple-glow/10 text-purple-bright"
                        : "border-white/5 text-slate-500 hover:bg-white/5"
                    }`}
                  >
                    {m === "powershell" ? "PowerShell" : m === "winget" ? "WinGet" : "CMD"}
                  </button>
                ))}
              </div>
            )}

            {/* Command block */}
            <div className="rounded-lg border border-white/5 bg-black/30 p-3">
              <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
                {getInstallCommand()}
              </pre>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleCopyCommand}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Copy size={12} />
                {copiedCmd ? "已复制!" : "复制命令"}
              </button>
              <button
                onClick={handleOpenTerminal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#ca5d3d] hover:bg-amber-glow text-white transition-colors shadow-sm"
              >
                <Terminal size={12} />
                打开终端
              </button>
            </div>

            <p className="text-[11px] text-slate-600">
              保存代理设置后，上方命令已自动加入代理前缀（如已填写 HTTPS Proxy）。
            </p>
          </div>
        </section>
      </div>
    );
  }

  // ── Installed view ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Status card */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Shield size={14} className="text-emerald-ok" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Claude Code 状态
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-ok/20 bg-emerald-ok/5">
            <CheckCircle size={16} className="text-emerald-ok flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-200">已安装 Claude Code</div>
              {claudeInfo.version && (
                <div className="text-xs text-slate-500 font-mono">v{claudeInfo.version}</div>
              )}
            </div>
            <button
              onClick={loadClaudeInfo}
              disabled={infoLoading}
              className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors disabled:opacity-40"
              title="重新检测"
            >
              <RefreshCw size={14} className={infoLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Update channel */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 flex-shrink-0">更新频道</span>
            <div className="flex gap-1">
              {(["latest", "stable"] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => handleChannelChange(ch)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                    autoChannel === ch
                      ? "border-amber-glow/30 bg-amber-glow/10 text-amber-glow"
                      : "border-white/5 text-slate-500 hover:bg-white/5"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleRunUpdate}
              disabled={updateLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-40"
            >
              <ArrowUpCircle size={13} className={updateLoading ? "animate-spin" : ""} />
              {updateLoading ? "更新中..." : "立即更新"}
            </button>
            <button
              onClick={handleRunDoctor}
              disabled={doctorLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-40"
            >
              <Stethoscope size={13} className={doctorLoading ? "animate-pulse" : ""} />
              {doctorLoading ? "检查中..." : "运行 doctor"}
            </button>
          </div>

          {/* Update output */}
          {showUpdateOutput && (
            <div className="rounded-lg border border-white/5 p-3 bg-black/20 max-h-32 overflow-y-auto">
              {updateLoading ? (
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <RefreshCw size={11} className="animate-spin" />
                  正在更新...
                </p>
              ) : (
                <pre className="text-[11px] text-slate-400 whitespace-pre-wrap font-mono">
                  {updateOutput || "完成"}
                </pre>
              )}
            </div>
          )}

          {/* Doctor output — always show box once requested, with spinner during load */}
          {showDoctorOutput && (
            <div className="rounded-lg border border-white/5 p-3 bg-black/20 max-h-48 overflow-y-auto space-y-0.5">
              {doctorLoading ? (
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <RefreshCw size={11} className="animate-spin" />
                  正在运行 claude doctor...
                </p>
              ) : doctorResult === null ? null : doctorResult.length === 0 ? (
                <p className="text-xs text-slate-500">无输出</p>
              ) : (
                doctorResult.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {item.status === "ok" && (
                      <CheckCircle size={12} className="text-emerald-ok flex-shrink-0 mt-0.5" />
                    )}
                    {item.status === "error" && (
                      <XCircle size={12} className="text-rose-err flex-shrink-0 mt-0.5" />
                    )}
                    {item.status === "info" && (
                      <Info size={12} className="text-slate-500 flex-shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`text-[11px] font-mono leading-relaxed ${
                        item.status === "ok"
                          ? "text-emerald-ok"
                          : item.status === "error"
                          ? "text-rose-err"
                          : "text-slate-500"
                      }`}
                    >
                      {item.line}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* Proxy (installed view — at bottom) */}
      <ProxyBlock />
    </div>
  );
}

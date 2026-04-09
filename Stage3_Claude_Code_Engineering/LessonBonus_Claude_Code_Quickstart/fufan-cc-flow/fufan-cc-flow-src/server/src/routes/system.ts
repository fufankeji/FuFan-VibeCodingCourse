import { Router, type Router as RouterType } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { SystemService } from "../services/systemService.js";
import { readProxy, writeProxy } from "../services/proxyConfig.js";
import {
  readClaudeSettings,
  writeClaudeSettingsEnv,
} from "../services/claudeSettingsService.js";
import { testProxyPort, testProxyConnectivity, testClaudeConnection } from "../services/claudeTestService.js";
import { logger } from "../utils/logger.js";
import { getClaudeHome } from "../utils/pathUtils.js";

const execAsync = promisify(exec);

const router: RouterType = Router();
const systemService = new SystemService();

// GET /api/system/claude-info
router.get("/claude-info", async (_req, res) => {
  try {
    const info = await systemService.getClaudeInfo();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/system/claude-doctor
router.post("/claude-doctor", async (_req, res) => {
  try {
    const sections = await systemService.runDoctor();
    res.json({ sections });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/system/claude-update
router.post("/claude-update", async (_req, res) => {
  try {
    const result = await systemService.runUpdate();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/system/proxy — reads from dedicated proxy.json
router.get("/proxy", async (_req, res) => {
  try {
    const proxy = await readProxy();
    res.json(proxy);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/system/proxy-save?http=...&https=...&socks=...
router.get("/proxy-save", async (req, res) => {
  try {
    const httpProxy  = typeof req.query.http  === "string" ? req.query.http  : "";
    const httpsProxy = typeof req.query.https === "string" ? req.query.https : "";
    const socksProxy = typeof req.query.socks === "string" ? req.query.socks : "";
    await writeProxy({ httpProxy, httpsProxy, socksProxy });
    res.json({ success: true });
  } catch (err) {
    logger.error("writeProxy failed: " + String(err));
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/system/proxy — writes to dedicated proxy.json (not ~/.claude/settings.json)
// Using POST instead of PATCH to avoid Windows proxy/firewall PATCH-method blocking
router.post("/proxy", async (req, res) => {
  try {
    // Defensive parsing: req.body may be undefined if body-parser didn't run
    const body = (req.body ?? {}) as Record<string, unknown>;
    const httpProxy  = typeof body.httpProxy  === "string" ? body.httpProxy  : "";
    const httpsProxy = typeof body.httpsProxy === "string" ? body.httpsProxy : "";
    const socksProxy = typeof body.socksProxy === "string" ? body.socksProxy : "";
    await writeProxy({ httpProxy, httpsProxy, socksProxy });
    res.json({ success: true });
  } catch (err) {
    logger.error("writeProxy failed: " + String(err));
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/system/auth-status
router.get("/auth-status", async (_req, res) => {
  try {
    const status = await systemService.getAuthStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/system/proxy-test?host=127.0.0.1&port=7890
// Tests whether the HTTP proxy at host:port can reach api.anthropic.com via CONNECT.
// Falls back to a plain TCP probe for SOCKS proxies (when ?mode=tcp).
router.get("/proxy-test", async (req, res) => {
  const host = typeof req.query.host === "string" ? req.query.host : "127.0.0.1";
  const port = parseInt(typeof req.query.port === "string" ? req.query.port : "0", 10);
  const mode = typeof req.query.mode === "string" ? req.query.mode : "connect";
  if (!port || port < 1 || port > 65535) {
    return res.status(400).json({ error: "无效端口" });
  }
  try {
    const result =
      mode === "tcp"
        ? await testProxyPort(host, port)
        : await testProxyConnectivity(host, port);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/system/claude-test
router.post("/claude-test", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  try {
    const proxy = await readProxy();
    const result = await testClaudeConnection({
      apiKey:      typeof body.apiKey   === "string" ? body.apiKey   : undefined,
      baseUrl:     typeof body.baseUrl  === "string" ? body.baseUrl  : undefined,
      model:       typeof body.model    === "string" ? body.model    : undefined,
      httpProxy:   typeof body.httpProxy  === "string" ? body.httpProxy  : proxy.httpProxy  || undefined,
      httpsProxy:  typeof body.httpsProxy === "string" ? body.httpsProxy : proxy.httpsProxy || undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/system/claude-settings  — read env section
router.get("/claude-settings", async (_req, res) => {
  try {
    const settings = await readClaudeSettings();
    res.json({ env: settings.env ?? {} });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/system/claude-settings  — write/merge env section
router.post("/claude-settings", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const env = (body.env ?? {}) as Record<string, string | undefined>;
  try {
    await writeClaudeSettingsEnv(env);
    res.json({ success: true });
  } catch (err) {
    logger.error("writeClaudeSettingsEnv failed: " + String(err));
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/system/pick-folder — open native OS folder dialog, return selected path
// Server and client run on the same machine (local tool), so the dialog appears on the user's desktop.
router.get("/pick-folder", async (_req, res) => {
  try {
    let selectedPath: string | null = null;

    if (process.platform === "win32") {
      // Use PowerShell with -STA (Single-Threaded Apartment) so WinForms shows
      // the modern IFileDialog-based picker (Windows Vista+) instead of the
      // old SHBrowseForFolder tree dialog.
      // EnableVisualStyles() ensures native visual themes are applied.
      const psScript = [
        "Add-Type -AssemblyName System.Windows.Forms;",
        "[System.Windows.Forms.Application]::EnableVisualStyles();",
        "$d = New-Object System.Windows.Forms.FolderBrowserDialog;",
        "$d.UseDescriptionForTitle = $true;",
        "$d.Description = 'Select Project Folder';",
        "$d.AutoUpgradeEnabled = $true;",
        "$null = $d.ShowDialog();",
        "Write-Output $d.SelectedPath",
      ].join(" ");
      const { stdout } = await execAsync(`powershell -NoProfile -STA -Command "${psScript}"`, {
        timeout: 120_000,
      });
      const p = stdout.trim();
      selectedPath = p || null;
    } else if (process.platform === "darwin") {
      // macOS: AppleScript choose folder
      const { stdout } = await execAsync(
        `osascript -e 'POSIX path of (choose folder with prompt "Select your project folder")'`,
        { timeout: 120_000 }
      );
      const p = stdout.trim().replace(/\/$/, ""); // strip trailing slash
      selectedPath = p || null;
    } else {
      // Linux: zenity (most desktop distros have it)
      const { stdout } = await execAsync(
        `zenity --file-selection --directory --title="Select Project Folder" 2>/dev/null`,
        { timeout: 120_000 }
      );
      const p = stdout.trim();
      selectedPath = p || null;
    }

    res.json({ path: selectedPath });
  } catch {
    // User cancelled the dialog, or the command failed — return null gracefully
    res.json({ path: null });
  }
});

// GET /api/system/debug-claude-home — dev diagnostic endpoint
// Returns Claude home directory info to help diagnose session listing issues
router.get("/debug-claude-home", async (_req, res) => {
  try {
    const claudeHome = getClaudeHome();
    const projectsDir = path.join(claudeHome, "projects");
    const projectsDirExists = await fs.access(projectsDir).then(() => true).catch(() => false);
    let projectDirs: string[] = [];
    let sessionCount = 0;

    if (projectsDirExists) {
      projectDirs = await fs.readdir(projectsDir).catch(() => []);
      for (const dir of projectDirs) {
        const files = await fs.readdir(path.join(projectsDir, dir)).catch(() => []);
        sessionCount += files.filter((f) => f.endsWith(".jsonl")).length;
      }
    }

    res.json({
      claudeHome,
      projectsDir,
      projectsDirExists,
      projectDirs,
      sessionCount,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

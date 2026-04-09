import { Router, type Router as RouterType } from "express";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { FileService } from "../services/fileService.js";
import { isSubPath } from "../utils/pathUtils.js";

const router: RouterType = Router();
const service = new FileService();

// GET /api/files/tree?path=/project&depth=3
router.get("/tree", async (req, res) => {
  const rootPath = (req.query.path as string) || process.cwd();
  const depth = parseInt(req.query.depth as string) || 3;
  const exclude = req.query.exclude
    ? (req.query.exclude as string).split(",")
    : undefined;

  try {
    const tree = await service.getTree(rootPath, depth, exclude);
    res.json(tree);
  } catch (err) {
    res.status(404).json({ error: { code: "FILE_NOT_FOUND", message: String(err) } });
  }
});

// GET /api/files/content?path=/project/src/app.js
router.get("/content", async (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "path required" } });
  }

  try {
    const data = await service.getFileContent(filePath);
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: { code: "FILE_NOT_FOUND", message: String(err) } });
  }
});

// GET /api/files/browse?path=<absolutePath>
// Returns immediate children (dirs first) of the given path.
// Without path, returns logical root entries (drives on Windows, / on Unix).
router.get("/browse", async (req, res) => {
  const reqPath = req.query.path as string | undefined;

  try {
    if (!reqPath) {
      // ── Logical root: platform-specific "top-level" locations ──
      const entries: { name: string; type: "dir"; path: string }[] = [];

      if (process.platform === "win32") {
        // Enumerate existing Windows drives (C–Z)
        const driveLetters = "CDEFGHIJKLMNOPQRSTUVWXYZ".split("");
        for (const letter of driveLetters) {
          const drivePath = `${letter}:\\`;
          const exists = await fs.access(drivePath).then(() => true).catch(() => false);
          if (exists) entries.push({ name: `${letter}:`, type: "dir", path: drivePath });
        }
        // Also expose home dir as a convenient shortcut
        const home = os.homedir();
        entries.push({ name: `🏠 主目录 (${path.basename(home)})`, type: "dir", path: home });
      } else {
        // Mac/Linux: expose home + /
        entries.push({ name: "🏠 主目录", type: "dir", path: os.homedir() });
        entries.push({ name: "/ (根目录)", type: "dir", path: "/" });
      }

      return res.json({ path: null, parent: null, entries });
    }

    // ── Directory listing ──
    const normalized = path.normalize(reqPath);
    const stat = await fs.stat(normalized);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: "指定路径不是目录" });
    }

    const names = await fs.readdir(normalized);
    const rawEntries = await Promise.all(
      names.map(async (name) => {
        const fullPath = path.join(normalized, name);
        const s = await fs.stat(fullPath).catch(() => null);
        if (!s) return null;
        return { name, type: s.isDirectory() ? ("dir" as const) : ("file" as const), path: fullPath };
      })
    );

    // Dirs first, then files; both sorted alphabetically (case-insensitive)
    const entries = rawEntries
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });

    // Compute parent path (null if already at drive root or /)
    const parent = (() => {
      const p = path.dirname(normalized);
      return p === normalized ? null : p; // dirname of root == root
    })();

    return res.json({ path: normalized, parent, entries });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/files/mkdir  body: { path: string, projectRoot?: string }
router.post("/mkdir", async (req, res) => {
  const folderPath = req.body?.path as string | undefined;
  const projectRoot = req.body?.projectRoot as string | undefined;
  if (!folderPath) {
    return res.status(400).json({ error: "path is required" });
  }

  try {
    const normalized = path.normalize(folderPath);
    if (projectRoot && !isSubPath(projectRoot, normalized)) {
      return res.status(403).json({ error: "路径不在项目目录内" });
    }
    await fs.mkdir(normalized, { recursive: true });
    return res.json({ path: normalized });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/files/create  body: { filePath: string, content?: string, projectRoot?: string }
router.post("/create", async (req, res) => {
  const filePath = req.body?.filePath as string | undefined;
  const content = (req.body?.content as string) ?? "";
  const projectRoot = req.body?.projectRoot as string | undefined;
  if (!filePath) {
    return res.status(400).json({ error: "filePath is required" });
  }
  try {
    const normalized = path.normalize(filePath);
    if (projectRoot && !isSubPath(projectRoot, normalized)) {
      return res.status(403).json({ error: "路径不在项目目录内" });
    }
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(normalized), { recursive: true });
    // Fail if file already exists
    const exists = await fs.access(normalized).then(() => true).catch(() => false);
    if (exists) {
      return res.status(409).json({ error: "文件已存在" });
    }
    await fs.writeFile(normalized, content, "utf-8");
    return res.json({ path: normalized });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/files/rename  body: { oldPath: string, newPath: string, projectRoot?: string }
router.post("/rename", async (req, res) => {
  const oldPath = req.body?.oldPath as string | undefined;
  const newPath = req.body?.newPath as string | undefined;
  const projectRoot = req.body?.projectRoot as string | undefined;
  if (!oldPath || !newPath) {
    return res.status(400).json({ error: "oldPath and newPath are required" });
  }
  try {
    const normalizedOld = path.normalize(oldPath);
    const normalizedNew = path.normalize(newPath);
    if (projectRoot && (!isSubPath(projectRoot, normalizedOld) || !isSubPath(projectRoot, normalizedNew))) {
      return res.status(403).json({ error: "路径不在项目目录内" });
    }
    // Check target doesn't already exist
    const exists = await fs.access(normalizedNew).then(() => true).catch(() => false);
    if (exists) {
      return res.status(409).json({ error: "目标路径已存在" });
    }
    await fs.rename(normalizedOld, normalizedNew);
    return res.json({ oldPath: normalizedOld, newPath: normalizedNew });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/files/delete  body: { filePath: string, projectRoot?: string }
router.delete("/delete", async (req, res) => {
  const filePath = req.body?.filePath as string | undefined;
  const projectRoot = req.body?.projectRoot as string | undefined;
  if (!filePath) {
    return res.status(400).json({ error: "filePath is required" });
  }
  try {
    const normalized = path.normalize(filePath);
    if (projectRoot && !isSubPath(projectRoot, normalized)) {
      return res.status(403).json({ error: "路径不在项目目录内" });
    }
    await fs.rm(normalized, { recursive: true });
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/files/search?path=/project&query=auth
router.get("/search", async (req, res) => {
  const rootPath = (req.query.path as string) || process.cwd();
  const query = req.query.query as string;
  if (!query) {
    return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "query required" } });
  }

  const results = await service.searchFiles(rootPath, query);
  res.json({ results });
});

export default router;

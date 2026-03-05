import { Router, type Router as RouterType } from "express";
import { MemoryService } from "../services/memoryService.js";

const router: RouterType = Router();
const service = new MemoryService();

// ── Auto Memory ──

router.get("/auto", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const data = await service.getAutoMemory(project);
  res.json(data);
});

router.get("/auto/:filename", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const file = await service.getMemoryFile(project, req.params.filename);
  if (!file) {
    return res.status(404).json({ error: { code: "FILE_NOT_FOUND", message: "Memory file not found" } });
  }
  res.json(file);
});

router.put("/auto/:filename", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const result = await service.saveMemoryFile(project, req.params.filename, req.body.content);
  res.json({ success: true, ...result });
});

router.post("/auto", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  await service.saveMemoryFile(project, req.body.filename, req.body.content || "");
  res.json({ success: true });
});

router.delete("/auto/:filename", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const ok = await service.deleteMemoryFile(project, req.params.filename);
  res.json({ success: ok });
});

router.delete("/auto", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const count = await service.clearAllMemory(project);
  res.json({ success: true, deletedCount: count });
});

router.patch("/auto/settings", async (req, res) => {
  await service.setAutoMemoryEnabled(req.body.enabled);
  res.json({ success: true });
});

// ── CLAUDE.md ──

router.get("/claudemd", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const levels = await service.getClaudeMdLevels(project);
  res.json({ levels });
});

router.put("/claudemd/:scope", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  try {
    await service.saveClaudeMd(req.params.scope, req.body.content, project);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: { code: "INVALID_REQUEST", message: String(err) } });
  }
});

// ── Rules ──

router.get("/claudemd/rules", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const scope = (req.query.scope as "project" | "user") || "project";
  const rules = await service.getRules(project, scope);
  res.json({ rules });
});

router.post("/claudemd/rules", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const scope = (req.query.scope as "project" | "user") || "project";
  await service.saveRule(project, req.body.name, req.body.content, scope);
  res.json({ success: true });
});

router.put("/claudemd/rules/:name", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const scope = (req.query.scope as "project" | "user") || "project";
  await service.saveRule(project, req.params.name, req.body.content, scope);
  res.json({ success: true });
});

router.delete("/claudemd/rules/:name", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const scope = (req.query.scope as "project" | "user") || "project";
  const ok = await service.deleteRule(project, req.params.name, scope);
  res.json({ success: ok });
});

export default router;

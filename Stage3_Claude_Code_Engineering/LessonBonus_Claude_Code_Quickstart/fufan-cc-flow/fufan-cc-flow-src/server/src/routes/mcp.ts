import { Router, type Router as RouterType } from "express";
import { McpService } from "../services/mcpService.js";

const router: RouterType = Router();
const service = new McpService();

router.get("/servers", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const servers = await service.listServers(project);
  res.json({ servers });
});

router.post("/servers", async (req, res) => {
  try {
    await service.addServer(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: "PROCESS_ERROR", message: String(err) } });
  }
});

router.delete("/servers/:name", async (req, res) => {
  try {
    await service.removeServer(req.params.name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: "PROCESS_ERROR", message: String(err) } });
  }
});

router.get("/servers/:name/config", async (req, res) => {
  const project = req.query.project as string | undefined;
  const result = await service.getServerConfig(req.params.name, project);
  if (!result) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Server not found" } });
  }
  res.json(result);
});

router.patch("/servers/:name/config", async (req, res) => {
  try {
    const { config, scope } = req.body;
    const project = req.query.project as string | undefined;
    await service.updateServerConfig(req.params.name, config, scope, project);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: "PROCESS_ERROR", message: String(err) } });
  }
});

router.post("/servers/json", async (req, res) => {
  try {
    const { name, json, scope } = req.body;
    if (!name || !json) {
      return res.status(400).json({ error: { code: "INVALID_PARAMS", message: "name and json are required" } });
    }
    await service.addServerJson(name, typeof json === "string" ? json : JSON.stringify(json), scope);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: "PROCESS_ERROR", message: String(err) } });
  }
});

router.post("/import-desktop", async (_req, res) => {
  try {
    const imported = await service.importFromDesktop();
    res.json({ imported, count: imported.length });
  } catch (err) {
    res.status(500).json({ error: { code: "PROCESS_ERROR", message: String(err) } });
  }
});

export default router;

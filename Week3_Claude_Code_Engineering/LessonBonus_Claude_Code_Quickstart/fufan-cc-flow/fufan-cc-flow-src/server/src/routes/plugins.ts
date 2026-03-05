import { Router, type Router as RouterType } from "express";
import { PluginService } from "../services/pluginService.js";

const router: RouterType = Router();
const service = new PluginService();

router.get("/", async (_req, res) => {
  const plugins = await service.listPlugins();
  res.json({ plugins });
});

router.post("/install", async (req, res) => {
  try {
    await service.installPlugin(req.body.name, req.body.scope);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: "PROCESS_ERROR", message: String(err) } });
  }
});

router.delete("/:name", async (req, res) => {
  try {
    await service.uninstallPlugin(req.params.name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: "PROCESS_ERROR", message: String(err) } });
  }
});

router.patch("/:name", async (req, res) => {
  try {
    await service.togglePlugin(req.params.name, req.body.enabled);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: "PROCESS_ERROR", message: String(err) } });
  }
});

export default router;

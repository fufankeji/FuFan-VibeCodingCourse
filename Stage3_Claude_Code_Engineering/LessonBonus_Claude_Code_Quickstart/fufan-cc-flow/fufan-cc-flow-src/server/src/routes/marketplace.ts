import { Router, type Router as RouterType } from "express";
import { MarketplaceService } from "../services/marketplaceService.js";

const router: RouterType = Router();
const service = new MarketplaceService();

router.get("/plugins", async (_req, res) => {
  const plugins = await service.listAvailablePlugins();
  res.json({ plugins });
});

router.get("/sources", async (_req, res) => {
  const sources = await service.listMarketplaces();
  res.json({ sources });
});

router.post("/update", async (req, res) => {
  try {
    await service.updateMarketplace(req.body?.name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: "PROCESS_ERROR", message: String(err) } });
  }
});

router.post("/install", async (req, res) => {
  try {
    const { name, scope } = req.body;
    if (!name) {
      return res.status(400).json({ error: { code: "INVALID_PARAMS", message: "name is required" } });
    }
    await service.installPlugin(name, scope);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: "PROCESS_ERROR", message: String(err) } });
  }
});

export default router;

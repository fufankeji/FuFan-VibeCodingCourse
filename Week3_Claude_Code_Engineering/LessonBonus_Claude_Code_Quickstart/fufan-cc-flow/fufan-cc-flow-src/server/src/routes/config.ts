import { Router, type Router as RouterType } from "express";
import { ConfigService } from "../services/configService.js";

const router: RouterType = Router();
const service = new ConfigService();

router.get("/", async (_req, res) => {
  const config = await service.getConfig();
  res.json(config);
});

router.patch("/", async (req, res) => {
  await service.updateConfig(req.body);
  res.json({ success: true });
});

export default router;

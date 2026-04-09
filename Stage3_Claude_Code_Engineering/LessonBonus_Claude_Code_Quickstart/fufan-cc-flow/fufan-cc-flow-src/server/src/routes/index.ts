import { Router, type Router as RouterType } from "express";
import sessionsRouter from "./sessions.js";
import configRouter from "./config.js";
import filesRouter from "./files.js";
import mcpRouter from "./mcp.js";
import skillsRouter from "./skills.js";
import pluginsRouter from "./plugins.js";
import memoryRouter from "./memory.js";
import agentsRouter from "./agents.js";
import workflowsRouter from "./workflows.js";
import systemRouter from "./system.js";
import attachmentsRouter from "./attachments.js";
import hooksRouter from "./hooks.js";
import marketplaceRouter from "./marketplace.js";
import teamsRouter from "./teams.js";

const router: RouterType = Router();

router.use("/sessions", sessionsRouter);
router.use("/config", configRouter);
router.use("/files", filesRouter);
router.use("/mcp", mcpRouter);
router.use("/skills", skillsRouter);
router.use("/plugins", pluginsRouter);
router.use("/memory", memoryRouter);
router.use("/agents", agentsRouter);
router.use("/workflows", workflowsRouter);
router.use("/system", systemRouter);
router.use("/attachments", attachmentsRouter);
router.use("/hooks", hooksRouter);
router.use("/marketplace", marketplaceRouter);
router.use("/teams", teamsRouter);

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

export default router;

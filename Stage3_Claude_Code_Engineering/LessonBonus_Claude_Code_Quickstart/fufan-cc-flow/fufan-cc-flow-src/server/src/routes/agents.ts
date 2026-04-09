import { Router, type Router as RouterType } from "express";
import { AgentService } from "../services/agentService.js";

const router: RouterType = Router();
const service = new AgentService();

router.get("/", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const agents = await service.listAgents(project);
  res.json(agents);
});

router.get("/:scope/:name", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const scope = req.params.scope as "project" | "user";
  const agent = await service.getAgent(scope, req.params.name, project);
  if (!agent) {
    return res.status(404).json({ error: { code: "AGENT_NOT_FOUND", message: "Agent not found" } });
  }
  res.json(agent);
});

router.post("/", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const { scope, name, frontmatter, content } = req.body;
  try {
    const agentPath = await service.saveAgent(scope, name, frontmatter, content, project);
    res.json({ success: true, path: agentPath });
  } catch (err) {
    res.status(500).json({ error: { code: "PROCESS_ERROR", message: String(err) } });
  }
});

router.put("/:scope/:name", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const scope = req.params.scope as "project" | "user";
  const { frontmatter, content } = req.body;
  try {
    await service.saveAgent(scope, req.params.name, frontmatter, content, project);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: "PROCESS_ERROR", message: String(err) } });
  }
});

router.delete("/:scope/:name", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const scope = req.params.scope as "project" | "user";
  const ok = await service.deleteAgent(scope, req.params.name, project);
  res.json({ success: ok });
});

export default router;

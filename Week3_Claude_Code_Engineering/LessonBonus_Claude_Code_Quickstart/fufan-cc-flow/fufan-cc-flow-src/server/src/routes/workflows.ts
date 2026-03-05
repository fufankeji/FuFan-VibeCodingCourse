import { Router, type Router as RouterType } from "express";
import { WorkflowService } from "../services/workflowService.js";

const router: RouterType = Router();
const service = new WorkflowService();

router.get("/", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const workflows = await service.listWorkflows(project);
  res.json({ workflows });
});

router.get("/:id", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const workflow = await service.getWorkflow(project, req.params.id);
  if (!workflow) {
    return res.status(404).json({ error: { code: "FILE_NOT_FOUND", message: "Workflow not found" } });
  }
  res.json(workflow);
});

router.post("/", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  try {
    const id = await service.saveWorkflow(project, req.body);
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: { code: "PROCESS_ERROR", message: String(err) } });
  }
});

router.delete("/:id", async (req, res) => {
  const project = (req.query.project as string) || process.cwd();
  const ok = await service.deleteWorkflow(project, req.params.id);
  res.json({ success: ok });
});

export default router;

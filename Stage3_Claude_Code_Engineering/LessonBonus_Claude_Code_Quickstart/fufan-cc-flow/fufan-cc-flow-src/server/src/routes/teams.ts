import { Router, type Router as RouterType } from "express";
import { TeamService } from "../services/teamService.js";

const router: RouterType = Router();
const service = new TeamService();

// GET /api/teams/enabled — check if Agent Teams feature is enabled
router.get("/enabled", (_req, res) => {
  res.json({ enabled: service.isEnabled() });
});

// GET /api/teams — list all teams
router.get("/", async (_req, res) => {
  try {
    const teams = await service.listTeams();
    res.json({ teams });
  } catch (err) {
    res.status(500).json({ error: { code: "TEAM_LIST_ERROR", message: String(err) } });
  }
});

// GET /api/teams/:name — get specific team detail
router.get("/:name", async (req, res) => {
  try {
    const team = await service.getTeam(req.params.name);
    if (!team) {
      return res.status(404).json({ error: { code: "TEAM_NOT_FOUND", message: "Team not found" } });
    }
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: { code: "TEAM_GET_ERROR", message: String(err) } });
  }
});

// POST /api/teams — create a new team
router.post("/", async (req, res) => {
  const { name, leadDescription } = req.body;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: "Team name is required" } });
  }
  try {
    const team = await service.createTeam(name.trim(), leadDescription);
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: { code: "TEAM_CREATE_ERROR", message: String(err) } });
  }
});

// DELETE /api/teams/:name — delete a team
router.delete("/:name", async (req, res) => {
  try {
    await service.deleteTeam(req.params.name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: "TEAM_DELETE_ERROR", message: String(err) } });
  }
});

// GET /api/teams/:name/tasks — get shared task list
router.get("/:name/tasks", async (req, res) => {
  try {
    const tasks = await service.getTasks(req.params.name);
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ error: { code: "TASK_LIST_ERROR", message: String(err) } });
  }
});

// PATCH /api/teams/:name/tasks/:taskId — update task status
router.patch("/:name/tasks/:taskId", async (req, res) => {
  try {
    const updated = await service.updateTask(req.params.name, req.params.taskId, req.body);
    if (!updated) {
      return res.status(404).json({ error: { code: "TASK_NOT_FOUND", message: "Task not found" } });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: { code: "TASK_UPDATE_ERROR", message: String(err) } });
  }
});

// GET /api/teams/:name/messages — get recent messages (all inboxes)
router.get("/:name/messages", async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const messages = await service.getRecentMessages(req.params.name, limit);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: { code: "MESSAGE_LIST_ERROR", message: String(err) } });
  }
});

// GET /api/teams/:name/messages/:agent — get specific agent's messages
router.get("/:name/messages/:agent", async (req, res) => {
  try {
    const messages = await service.getMessages(req.params.name, req.params.agent);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: { code: "MESSAGE_GET_ERROR", message: String(err) } });
  }
});

export default router;

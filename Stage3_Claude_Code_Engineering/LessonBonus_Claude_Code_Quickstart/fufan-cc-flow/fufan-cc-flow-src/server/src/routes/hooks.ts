import { Router, type Router as RouterType } from "express";
import { listHooks, saveHooks } from "../services/hooksService.js";

const router: RouterType = Router();

type HooksScope = "user" | "project" | "project-local";
const VALID_SCOPES = new Set(["user", "project", "project-local"]);

function parseScope(raw?: string): HooksScope {
  if (raw && VALID_SCOPES.has(raw)) return raw as HooksScope;
  return "user";
}

router.get("/", async (req, res) => {
  try {
    const scope = parseScope(req.query.scope as string);
    const project = req.query.project as string | undefined;
    const hooks = await listHooks(scope, project);
    res.json({ hooks });
  } catch (err) {
    res.status(500).json({ error: { code: "HOOKS_READ_ERROR", message: String(err) } });
  }
});

router.put("/", async (req, res) => {
  try {
    const scope = parseScope(req.query.scope as string);
    const project = req.query.project as string | undefined;
    await saveHooks(req.body.hooks || {}, scope, project);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: "HOOKS_WRITE_ERROR", message: String(err) } });
  }
});

export default router;

import { Router, type Router as RouterType } from "express";
import multer from "multer";
import { saveFile, deleteFile } from "../services/attachmentService.js";

const router: RouterType = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// POST /api/attachments/upload?project=...
router.post("/upload", upload.single("file"), (req, res) => {
  const project = req.query.project as string;
  if (!project) {
    res.status(400).json({ message: "Missing project query parameter" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ message: "No file uploaded" });
    return;
  }
  try {
    // Use originalName from form field (UTF-8 safe) over multer's originalname
    const originalName = (req.body?.originalName as string) || req.file.originalname;
    const meta = saveFile(req.file, project, originalName);
    res.json(meta);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ message });
  }
});

// DELETE /api/attachments/:id?project=...
router.delete("/:id", (req, res) => {
  const project = req.query.project as string;
  if (!project) {
    res.status(400).json({ message: "Missing project query parameter" });
    return;
  }
  try {
    deleteFile(req.params.id, project);
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ message });
  }
});

export default router;

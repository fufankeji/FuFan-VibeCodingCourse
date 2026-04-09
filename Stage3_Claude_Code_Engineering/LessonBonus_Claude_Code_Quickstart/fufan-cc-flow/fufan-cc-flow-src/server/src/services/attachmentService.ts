import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface AttachmentMeta {
  id: string;
  name: string;
  type: string;
  size: number;
  serverPath: string;
}

function getAttachmentsDir(projectPath: string): string {
  const dir = path.join(projectPath, ".claude", "attachments");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveFile(
  file: Express.Multer.File,
  projectPath: string,
  originalName?: string
): AttachmentMeta {
  const id = crypto.randomUUID();
  const displayName = originalName || file.originalname;
  const ext = path.extname(displayName) || path.extname(file.originalname) || "";
  const filename = `${id}${ext}`;
  const dir = getAttachmentsDir(projectPath);
  const destPath = path.join(dir, filename);

  fs.writeFileSync(destPath, file.buffer);

  // Return relative path (relative to projectPath / spawn cwd).
  // UUID filenames contain no spaces, so the path survives cmd.exe quoting.
  const relPath = `.claude/attachments/${filename}`;

  return {
    id,
    name: displayName,
    type: file.mimetype,
    size: file.size,
    serverPath: relPath,
  };
}

export function deleteFile(id: string, projectPath: string): void {
  const dir = getAttachmentsDir(projectPath);
  // Find file starting with the id
  const files = fs.readdirSync(dir);
  const target = files.find((f) => f.startsWith(id));
  if (target) {
    fs.unlinkSync(path.join(dir, target));
  }
}

export function cleanupFiles(ids: string[], projectPath: string): void {
  for (const id of ids) {
    try {
      deleteFile(id, projectPath);
    } catch {
      // best-effort cleanup
    }
  }
}

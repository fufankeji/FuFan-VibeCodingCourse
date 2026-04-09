import path from "path";
import os from "os";

export function normalizePath(p: string): string {
  if (p.startsWith("~")) {
    p = path.join(os.homedir(), p.slice(1));
  }
  return path.normalize(p);
}

export function isSubPath(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function getClaudeHome(): string {
  return path.join(os.homedir(), ".claude");
}

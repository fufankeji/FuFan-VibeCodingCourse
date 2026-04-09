import fs from "fs/promises";
import path from "path";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
  children?: FileNode[];
}

const DEFAULT_EXCLUDE = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".cache",
  ".vscode",
  "__pycache__",
  ".DS_Store",
  "coverage",
];

export class FileService {
  async getTree(
    rootPath: string,
    depth = 3,
    exclude: string[] = DEFAULT_EXCLUDE
  ): Promise<FileNode> {
    const stat = await fs.stat(rootPath);
    const name = path.basename(rootPath);

    if (!stat.isDirectory()) {
      return { name, path: rootPath, type: "file", size: stat.size };
    }

    const children =
      depth > 0 ? await this.readDir(rootPath, depth - 1, exclude) : [];

    return {
      name,
      path: rootPath,
      type: "directory",
      children,
    };
  }

  private async readDir(
    dirPath: string,
    depth: number,
    exclude: string[]
  ): Promise<FileNode[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      if (exclude.includes(entry.name)) continue;
      if (entry.name.startsWith(".") && entry.name !== ".claude") continue;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const children =
          depth > 0 ? await this.readDir(fullPath, depth - 1, exclude) : [];
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: "directory",
          children,
        });
      } else {
        const stat = await fs.stat(fullPath).catch(() => null);
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: "file",
          size: stat?.size,
          modified: stat?.mtime.toISOString(),
        });
      }
    }

    // Directories first, then files, both alphabetical
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return nodes;
  }

  private static IMAGE_EXTS = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".ico",
  ]);

  async getFileContent(filePath: string): Promise<{
    content: string;
    language: string;
    lines: number;
    size: number;
    encoding: string;
  }> {
    const stat = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Image files → return base64 data URI
    if (FileService.IMAGE_EXTS.has(ext)) {
      const buf = await fs.readFile(filePath);
      const mime =
        ext === ".svg" ? "image/svg+xml" :
        ext === ".ico" ? "image/x-icon" :
        `image/${ext.slice(1).replace("jpg", "jpeg")}`;
      const dataUri = `data:${mime};base64,${buf.toString("base64")}`;
      return {
        content: dataUri,
        language: "image",
        lines: 0,
        size: stat.size,
        encoding: "base64",
      };
    }

    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n").length;
    const language = this.detectLanguage(filePath);

    return {
      content,
      language,
      lines,
      size: stat.size,
      encoding: "utf-8",
    };
  }

  async searchFiles(
    rootPath: string,
    query: string
  ): Promise<{ path: string; type: string }[]> {
    const results: { path: string; type: string }[] = [];
    const lowerQuery = query.toLowerCase();

    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (DEFAULT_EXCLUDE.includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootPath, fullPath);

        if (entry.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            path: relativePath,
            type: entry.isDirectory() ? "directory" : "file",
          });
        }

        if (entry.isDirectory() && results.length < 50) {
          await walk(fullPath);
        }
      }
    };

    await walk(rootPath);
    return results.slice(0, 50);
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "tsx",
      ".js": "javascript",
      ".jsx": "jsx",
      ".py": "python",
      ".rs": "rust",
      ".go": "go",
      ".java": "java",
      ".c": "c",
      ".cpp": "cpp",
      ".h": "c",
      ".css": "css",
      ".scss": "scss",
      ".html": "html",
      ".json": "json",
      ".yaml": "yaml",
      ".yml": "yaml",
      ".md": "markdown",
      ".sh": "bash",
      ".sql": "sql",
      ".xml": "xml",
      ".toml": "toml",
      ".env": "dotenv",
      ".gitignore": "gitignore",
      ".dockerfile": "dockerfile",
    };
    return map[ext] || "plaintext";
  }
}

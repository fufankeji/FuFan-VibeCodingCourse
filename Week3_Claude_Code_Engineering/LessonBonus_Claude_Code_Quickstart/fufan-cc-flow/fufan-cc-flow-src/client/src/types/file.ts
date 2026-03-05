export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
  children?: FileNode[];
}

export interface FileContent {
  content: string;
  language: string;
  lines: number;
  size: number;
  encoding: string;
}

export interface FileSearchResult {
  path: string;
  type: string;
}

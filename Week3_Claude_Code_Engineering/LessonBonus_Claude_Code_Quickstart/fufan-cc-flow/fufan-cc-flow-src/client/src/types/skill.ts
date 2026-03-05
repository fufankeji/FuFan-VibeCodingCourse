export interface SkillInfo {
  name: string;
  description: string;
  model?: string;
  argumentHint?: string;
  path: string;
  pluginName?: string;
  source?: "skills" | "commands";
}

export interface SkillDetail {
  name: string;
  frontmatter: Record<string, unknown>;
  content: string;
}

export interface SkillGenerateResult {
  content: string;
  frontmatter: Record<string, unknown>;
}

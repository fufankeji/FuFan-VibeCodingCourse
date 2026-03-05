/**
 * Simple YAML frontmatter parser/serializer for SKILL.md and Agent files.
 * Handles the --- delimited frontmatter block at the top of markdown files.
 */

export function parseFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>;
  content: string;
} {
  const trimmed = raw.trim();

  if (!trimmed.startsWith("---")) {
    return { frontmatter: {}, content: trimmed };
  }

  const endIdx = trimmed.indexOf("---", 3);
  if (endIdx === -1) {
    return { frontmatter: {}, content: trimmed };
  }

  const yamlBlock = trimmed.slice(3, endIdx).trim();
  const content = trimmed.slice(endIdx + 3).trim();

  // Simple YAML parser (key: value pairs only)
  const frontmatter: Record<string, unknown> = {};
  for (const line of yamlBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();

    // Remove surrounding quotes
    if (
      typeof value === "string" &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    // Parse booleans
    if (value === "true") value = true;
    else if (value === "false") value = false;

    // Parse arrays (simple inline format: [a, b, c])
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""));
    }

    frontmatter[key] = value;
  }

  return { frontmatter, content };
}

export function serializeFrontmatter(
  frontmatter: Record<string, unknown>,
  content: string
): string {
  const entries = Object.entries(frontmatter).filter(
    ([, v]) => v !== undefined && v !== null
  );

  if (entries.length === 0) return content;

  const yamlLines = entries.map(([key, value]) => {
    if (Array.isArray(value)) {
      return `${key}: [${value.map((v) => `"${v}"`).join(", ")}]`;
    }
    if (typeof value === "string" && value.includes(":")) {
      return `${key}: "${value}"`;
    }
    return `${key}: ${value}`;
  });

  return `---\n${yamlLines.join("\n")}\n---\n\n${content}`;
}

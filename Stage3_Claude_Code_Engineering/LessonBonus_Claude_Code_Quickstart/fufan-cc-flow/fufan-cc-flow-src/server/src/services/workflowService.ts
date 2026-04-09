import fs from "fs/promises";
import path from "path";

interface WorkflowStep {
  agent: string | null; // null = main session
  prompt: string;
}

interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  variables: string[];
}

export class WorkflowService {
  private getWorkflowsDir(projectPath: string): string {
    return path.join(projectPath, ".claude", "workflows");
  }

  async listWorkflows(projectPath: string): Promise<Workflow[]> {
    const dir = this.getWorkflowsDir(projectPath);
    try {
      const entries = await fs.readdir(dir);
      const workflows: Workflow[] = [];

      for (const entry of entries) {
        if (!entry.endsWith(".json")) continue;
        try {
          const raw = await fs.readFile(path.join(dir, entry), "utf-8");
          workflows.push(JSON.parse(raw));
        } catch {
          // Skip invalid files
        }
      }

      return workflows;
    } catch {
      return [];
    }
  }

  async getWorkflow(
    projectPath: string,
    id: string
  ): Promise<Workflow | null> {
    const filePath = path.join(this.getWorkflowsDir(projectPath), `${id}.json`);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async saveWorkflow(
    projectPath: string,
    workflow: Workflow
  ): Promise<string> {
    const dir = this.getWorkflowsDir(projectPath);
    await fs.mkdir(dir, { recursive: true });

    if (!workflow.id) {
      workflow.id = `wf_${Date.now()}`;
    }

    // Extract variables from prompts (pattern: $VAR_NAME)
    const vars = new Set<string>();
    for (const step of workflow.steps) {
      const matches = step.prompt.match(/\$[A-Z_]+/g);
      if (matches) {
        matches.forEach((v) => vars.add(v.slice(1)));
      }
    }
    workflow.variables = Array.from(vars);

    const filePath = path.join(dir, `${workflow.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(workflow, null, 2), "utf-8");

    return workflow.id;
  }

  async deleteWorkflow(
    projectPath: string,
    id: string
  ): Promise<boolean> {
    try {
      await fs.unlink(
        path.join(this.getWorkflowsDir(projectPath), `${id}.json`)
      );
      return true;
    } catch {
      return false;
    }
  }
}

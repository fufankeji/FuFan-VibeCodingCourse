export interface WorkflowStep {
  agent: string | null;
  prompt: string;
}

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  variables: string[];
}

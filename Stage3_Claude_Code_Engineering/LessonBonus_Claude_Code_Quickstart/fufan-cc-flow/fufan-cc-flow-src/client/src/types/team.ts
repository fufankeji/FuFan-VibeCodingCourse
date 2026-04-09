export interface TeamMember {
  name: string;
  role: "lead" | "teammate";
  status: "idle" | "active" | "completed" | "error";
  description?: string;
  sessionId?: string;
}

export interface TeamTask {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  priority?: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
}

export interface TeamMessage {
  from: string;
  to: string;
  content: string;
  timestamp: string;
}

export interface TeamInfo {
  name: string;
  members: TeamMember[];
  tasks: TeamTask[];
  createdAt: string;
  isActive: boolean;
}

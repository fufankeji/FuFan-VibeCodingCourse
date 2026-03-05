export interface McpServer {
  name: string;
  transport: string;
  url?: string;
  command?: string;
  args?: string[];
  scope: string;
  status?: string;
  toolCount?: number;
}

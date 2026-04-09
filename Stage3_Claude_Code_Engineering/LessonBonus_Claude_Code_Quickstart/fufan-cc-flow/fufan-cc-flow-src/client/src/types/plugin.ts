export interface PluginInfo {
  name: string;
  version?: string;
  author?: string;
  description?: string;
  enabled: boolean;
  scope?: string;
  marketplace?: string;
  installPath?: string;
  gitCommitSha?: string;
  installedAt?: string;
  components?: {
    skills?: string[];
    mcpServers?: string[];
    agents?: string[];
    hooks?: string[];
  };
}

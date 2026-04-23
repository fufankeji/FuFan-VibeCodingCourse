import { z } from "zod";

export const MY_AGENTS_KEY = "agenthub:myAgents" as const;
export const MAX_SAVED_AGENTS = 100 as const;

export const myAgentsSchema = z
  .array(z.string().min(1).max(64))
  .max(MAX_SAVED_AGENTS);

export type MyAgentIds = z.infer<typeof myAgentsSchema>;

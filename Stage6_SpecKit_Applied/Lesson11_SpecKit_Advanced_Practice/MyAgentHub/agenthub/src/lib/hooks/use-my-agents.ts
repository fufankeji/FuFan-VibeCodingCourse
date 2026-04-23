"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MAX_SAVED_AGENTS,
  MY_AGENTS_KEY,
  myAgentsSchema,
} from "@/lib/schemas/my-agents";

export interface UseMyAgentsReturn {
  readonly ids: readonly string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  readonly isHydrated: boolean;
}

export function useMyAgents(): UseMyAgentsReturn {
  const [ids, setIds] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(MY_AGENTS_KEY);
      if (raw) {
        const parsed = myAgentsSchema.safeParse(JSON.parse(raw));
        if (parsed.success) setIds(parsed.data);
      }
    } catch {
      // Treat corrupted/non-JSON value as empty; next successful write overwrites.
    }
    setIsHydrated(true);
  }, []);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_SAVED_AGENTS
        ? prev
        : [...prev, id];
      if (next === prev) return prev;
      try {
        window.localStorage.setItem(MY_AGENTS_KEY, JSON.stringify(next));
        return next;
      } catch {
        // Quota exceeded / storage disabled: silently revert UI to pre-click state.
        return prev;
      }
    });
  }, []);

  return { ids, has, toggle, isHydrated };
}

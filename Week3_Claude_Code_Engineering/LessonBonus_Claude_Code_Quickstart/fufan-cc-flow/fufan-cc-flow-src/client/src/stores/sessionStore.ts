import { create } from "zustand";
import type { Session } from "../types/session";

interface SessionState {
  sessions: Session[];
  loading: boolean;

  setSessions: (s: Session[]) => void;
  setLoading: (l: boolean) => void;
  removeSession: (id: string) => void;
  updateSessionName: (id: string, name: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  loading: false,

  setSessions: (sessions) => set({ sessions, loading: false }),
  setLoading: (loading) => set({ loading }),
  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.id !== id),
    })),
  updateSessionName: (id, name) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, name, summary: name } : sess
      ),
    })),
}));

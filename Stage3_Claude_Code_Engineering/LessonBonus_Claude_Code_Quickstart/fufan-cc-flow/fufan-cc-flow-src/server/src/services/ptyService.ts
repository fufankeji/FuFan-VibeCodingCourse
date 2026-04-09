import * as pty from "node-pty";
import { EventEmitter } from "events";
import os from "os";
import { logger } from "../utils/logger.js";

interface PtySession {
  id: string;
  term: pty.IPty;
  cwd: string;
}

/**
 * PTY-based terminal service using node-pty.
 * Provides a real pseudo-terminal so interactive programs (like Claude Code CLI)
 * work correctly — they detect a TTY and can render their full TUI.
 *
 * Session-identity guard:
 *   onData / onExit only emit when THIS specific PTY instance is still the
 *   active session for its ID. This prevents a killed PTY's async onExit
 *   from poisoning a new connection that reuses the same session ID.
 *
 *   Rule: always call this.sessions.delete(id) BEFORE calling term.kill(),
 *   so that by the time onExit fires the guard check fails.
 */
export class PtyService extends EventEmitter {
  private sessions = new Map<string, PtySession>();

  create(id: string, cwd?: string): PtySession {
    // ── Close any stale session for this ID ──────────────────────────
    // Delete from map FIRST so the old term's onExit guard will fail
    // (preventing it from emitting "exit" and poisoning the new connection).
    const stale = this.sessions.get(id);
    if (stale) {
      this.sessions.delete(id);           // <── must come before kill()
      try { stale.term.kill(); } catch { /* already dead */ }
      logger.info(`PTY stale session cleaned: ${id}`);
    }

    const isWindows   = process.platform === "win32";
    const shell       = isWindows ? "cmd.exe" : (process.env.SHELL ?? "bash");
    const args: string[] = [];
    const resolvedCwd = (cwd && cwd.trim()) ? cwd : os.homedir();

    // Filter out undefined values — node-pty rejects them on some platforms
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => v !== undefined)
    ) as Record<string, string>;

    const term = pty.spawn(shell, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd: resolvedCwd,
      env,
      // useConpty: false — disable Windows ConPTY, use the more stable winpty backend.
      // ConPTY can emit STATUS_CONTROL_C_EXIT (0xC000013A) during shell initialization.
      ...(isWindows ? { useConpty: false } : {}),
    });

    // Store session BEFORE registering callbacks so the identity guard works.
    const session: PtySession = { id, term, cwd: resolvedCwd };
    this.sessions.set(id, session);

    term.onData((data: string) => {
      // Guard: only forward data if this PTY is still the active session.
      if (this.sessions.get(id) === session) {
        this.emit("data", id, data);
      }
    });

    term.onExit(({ exitCode }: { exitCode: number; signal?: number }) => {
      // Guard: only emit "exit" if this specific PTY instance is still active.
      // Without this guard, a killed PTY's async onExit would fire AFTER a new
      // session has been created for the same ID, poisoning the new connection.
      if (this.sessions.get(id) === session) {
        this.emit("exit", id, exitCode);
        this.sessions.delete(id);
      }
      logger.info(`PTY exited: ${id} (code=${exitCode})`);
    });

    logger.info(`PTY created: ${id} (${shell} in ${resolvedCwd})`);
    return session;
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.term.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.term.resize(cols, rows);
  }

  close(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      this.sessions.delete(id);           // <── must come before kill()
      try { session.term.kill(); } catch { /* already dead */ }
      logger.info(`PTY closed: ${id}`);
    }
  }

  closeAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.close(id);
    }
  }
}

"use client";

import { create } from "zustand";
import { TerminalSession, DetectedPort } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Non-reactive log buffer
// Keyed by sessionId. Lives outside Zustand so PTY data chunks never trigger
// React re-renders. Components call getLogBuffer() for replay on mount.
// ─────────────────────────────────────────────────────────────────────────────

const _sessionLogBuffer = new Map<string, string[]>();

/** Append a raw chunk to the non-reactive log buffer for a session. */
export function appendToLogBuffer(sessionId: string, chunk: string): void {
  if (!chunk) return;
  const existing = _sessionLogBuffer.get(sessionId) ?? [];
  // Cap at 5 000 chunks to bound memory (~5 000 * avg 80 bytes ≈ 400 KB)
  const updated =
    existing.length >= 5000
      ? [...existing.slice(-4999), chunk]
      : [...existing, chunk];
  _sessionLogBuffer.set(sessionId, updated);
}

/** Read the buffered chunks for a session (for replay on terminal mount). */
export function getLogBuffer(sessionId: string): string[] {
  return _sessionLogBuffer.get(sessionId) ?? [];
}

/** Delete the log buffer for a session (called on close / clear). */
export function clearLogBuffer(sessionId: string): void {
  _sessionLogBuffer.delete(sessionId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Port extraction helper (used by appendDetectedPorts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts any newly opened HTTP/TCP ports or URLs from raw terminal stdout stream.
 */
function extractPortsFromLog(rawLog: string): DetectedPort[] {
  if (!rawLog) return [];
  const ports: DetectedPort[] = [];
  const portSet = new Set<number>();

  // Matches http://localhost:3000, http://127.0.0.1:8080, :46500, etc.
  const urlRegex = /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0):([0-9]{2,5})/gi;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(rawLog)) !== null) {
    const rawPort = match[1];
    if (!rawPort) continue;
    const port = parseInt(rawPort, 10);
    if (port >= 80 && port <= 65535 && !portSet.has(port)) {
      portSet.add(port);
      ports.push({
        port,
        url: `http://localhost:${port}`,
        detectedAt: Date.now(),
      });
    }
  }

  // Matches "port 3000", "Port: 8080", "listening on 4000"
  const portWordRegex = /(?:port|listening on|ready on port)\s*[:=]?\s*([0-9]{2,5})/gi;
  while ((match = portWordRegex.exec(rawLog)) !== null) {
    const rawPort = match[1];
    if (!rawPort) continue;
    const port = parseInt(rawPort, 10);
    if (port >= 80 && port <= 65535 && !portSet.has(port)) {
      portSet.add(port);
      ports.push({
        port,
        url: `http://localhost:${port}`,
        detectedAt: Date.now(),
      });
    }
  }

  return ports;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zustand store — metadata only, no log arrays
// ─────────────────────────────────────────────────────────────────────────────

interface TerminalStoreState {
  sessionsByProject: Record<string, TerminalSession[]>;
  activeSessionIdByProject: Record<string, string | null>;

  getSessions: (projectId: string) => TerminalSession[];
  getActiveSessionId: (projectId: string) => string | null;
  getActiveSession: (projectId: string) => TerminalSession | null;

  setActiveSession: (projectId: string, sessionId: string | null) => void;
  addSession: (projectId: string, session: TerminalSession) => void;
  updateSession: (
    projectId: string,
    sessionId: string,
    updates: Partial<TerminalSession>,
  ) => void;
  /**
   * appendDetectedPorts — the ONLY Zustand update called on PTY data.
   * Extracts port numbers from the raw chunk and stores them reactively.
   * Does NOT store the raw log chunk (use appendToLogBuffer for that).
   */
  appendDetectedPorts: (
    projectId: string,
    sessionId: string,
    rawChunk: string,
  ) => void;
  removeSession: (projectId: string, sessionId: string) => void;
  clearSessions: (projectId: string) => void;
  renameSession: (projectId: string, sessionId: string, newTitle: string) => void;
}

export const useTerminalSessionStore = create<TerminalStoreState>((set, get) => ({
  sessionsByProject: {},
  activeSessionIdByProject: {},

  getSessions: (projectId: string) => {
    return get().sessionsByProject[projectId] || [];
  },

  getActiveSessionId: (projectId: string) => {
    return get().activeSessionIdByProject[projectId] || null;
  },

  getActiveSession: (projectId: string) => {
    const sessions = get().sessionsByProject[projectId] || [];
    const activeId = get().activeSessionIdByProject[projectId];
    return sessions.find((s) => s.id === activeId) || sessions[0] || null;
  },

  setActiveSession: (projectId: string, sessionId: string | null) => {
    set((state) => ({
      activeSessionIdByProject: {
        ...state.activeSessionIdByProject,
        [projectId]: sessionId,
      },
    }));
  },

  addSession: (projectId: string, session: TerminalSession) => {
    set((state) => {
      const current = state.sessionsByProject[projectId] || [];
      const exists = current.some((s) => s.id === session.id);
      const updated = exists
        ? current.map((s) => (s.id === session.id ? session : s))
        : [...current, session];

      return {
        sessionsByProject: {
          ...state.sessionsByProject,
          [projectId]: updated,
        },
        activeSessionIdByProject: {
          ...state.activeSessionIdByProject,
          [projectId]: session.id,
        },
      };
    });
  },

  updateSession: (
    projectId: string,
    sessionId: string,
    updates: Partial<TerminalSession>,
  ) => {
    set((state) => {
      const current = state.sessionsByProject[projectId] || [];
      return {
        sessionsByProject: {
          ...state.sessionsByProject,
          [projectId]: current.map((s) =>
            s.id === sessionId ? { ...s, ...updates } : s,
          ),
        },
      };
    });
  },

  appendDetectedPorts: (projectId: string, sessionId: string, rawChunk: string) => {
    if (!rawChunk) return;
    const newPorts = extractPortsFromLog(rawChunk);
    // Skip expensive Zustand update if no new ports found
    if (newPorts.length === 0) return;

    set((state) => {
      const current = state.sessionsByProject[projectId] || [];
      return {
        sessionsByProject: {
          ...state.sessionsByProject,
          [projectId]: current.map((s) => {
            if (s.id !== sessionId) return s;
            const existingPortNumbers = new Set(
              (s.detectedPorts || []).map((p) => p.port),
            );
            const additions = newPorts.filter(
              (p) => !existingPortNumbers.has(p.port),
            );
            if (additions.length === 0) return s;
            return {
              ...s,
              detectedPorts: [...(s.detectedPorts || []), ...additions],
              status: "running" as const,
            };
          }),
        },
      };
    });
  },

  removeSession: (projectId: string, sessionId: string) => {
    set((state) => {
      const current = state.sessionsByProject[projectId] || [];
      const updated = current.filter((s) => s.id !== sessionId);
      let nextActive: string | null =
        state.activeSessionIdByProject[projectId] ?? null;

      if (nextActive === sessionId) {
        const last = updated.length > 0 ? updated[updated.length - 1] : null;
        nextActive = last ? last.id : null;
      }

      return {
        sessionsByProject: {
          ...state.sessionsByProject,
          [projectId]: updated,
        },
        activeSessionIdByProject: {
          ...state.activeSessionIdByProject,
          [projectId]: nextActive,
        },
      };
    });
  },

  clearSessions: (projectId: string) => {
    set((state) => ({
      sessionsByProject: {
        ...state.sessionsByProject,
        [projectId]: [],
      },
      activeSessionIdByProject: {
        ...state.activeSessionIdByProject,
        [projectId]: null,
      },
    }));
  },

  renameSession: (projectId: string, sessionId: string, newTitle: string) => {
    set((state) => {
      const current = state.sessionsByProject[projectId] || [];
      return {
        sessionsByProject: {
          ...state.sessionsByProject,
          [projectId]: current.map((s) =>
            s.id === sessionId ? { ...s, title: newTitle.trim() || s.title } : s,
          ),
        },
      };
    });
  },
}));

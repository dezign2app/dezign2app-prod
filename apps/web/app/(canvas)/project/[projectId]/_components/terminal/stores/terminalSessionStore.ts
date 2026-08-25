"use client";

import { create } from "zustand";
import { TerminalSession, DetectedPort } from "../types";

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
  appendLog: (projectId: string, sessionId: string, logChunk: string) => void;
  removeSession: (projectId: string, sessionId: string) => void;
  renameSession: (projectId: string, sessionId: string, newTitle: string) => void;
  clearSessionLogs: (projectId: string, sessionId: string) => void;
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

  appendLog: (projectId: string, sessionId: string, logChunk: string) => {
    if (!logChunk) return;
    const newPorts = extractPortsFromLog(logChunk);

    set((state) => {
      const current = state.sessionsByProject[projectId] || [];
      return {
        sessionsByProject: {
          ...state.sessionsByProject,
          [projectId]: current.map((s) => {
            if (s.id !== sessionId) return s;

            // Merge detected ports without duplicates
            let mergedPorts = s.detectedPorts || [];
            if (newPorts.length > 0) {
              const existingPortNumbers = new Set(mergedPorts.map((p) => p.port));
              const additions = newPorts.filter((p) => !existingPortNumbers.has(p.port));
              mergedPorts = [...mergedPorts, ...additions];
            }

            return {
              ...s,
              logs: [...s.logs, logChunk],
              detectedPorts: mergedPorts,
              status: "running",
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

  clearSessionLogs: (projectId: string, sessionId: string) => {
    set((state) => {
      const current = state.sessionsByProject[projectId] || [];
      return {
        sessionsByProject: {
          ...state.sessionsByProject,
          [projectId]: current.map((s) =>
            s.id === sessionId ? { ...s, logs: [] } : s,
          ),
        },
      };
    });
  },
}));

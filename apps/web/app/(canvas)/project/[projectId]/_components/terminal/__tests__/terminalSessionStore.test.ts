import { describe, it, expect, beforeEach } from "vitest";
import { useTerminalSessionStore } from "../stores/terminalSessionStore";

describe("terminalSessionStore", () => {
  const projectId = "test-project-123";

  beforeEach(() => {
    // Reset store state for the test project
    useTerminalSessionStore.setState({
      sessionsByProject: {},
      activeSessionIdByProject: {},
    });
  });

  it("starts with 0 sessions for a fresh project", () => {
    const store = useTerminalSessionStore.getState();
    expect(store.getSessions(projectId)).toEqual([]);
    expect(store.getActiveSessionId(projectId)).toBeNull();
  });

  it("adds a new terminal session dynamically and sets it as active", () => {
    const store = useTerminalSessionStore.getState();
    const session = {
      id: "term-1",
      title: "PowerShell 1",
      type: "powershell" as const,
      shell: "powershell.exe",
      logs: [],
      status: "running" as const,
      detectedPorts: [],
      createdAt: Date.now(),
    };

    store.addSession(projectId, session);

    const updated = useTerminalSessionStore.getState();
    expect(updated.getSessions(projectId)).toHaveLength(1);
    expect(updated.getActiveSessionId(projectId)).toBe("term-1");
    expect(updated.getActiveSession(projectId)?.title).toBe("PowerShell 1");
  });

  it("appends logs and detects runtime HTTP ports automatically", () => {
    const store = useTerminalSessionStore.getState();
    const session = {
      id: "term-1",
      title: "Server Terminal",
      type: "shell" as const,
      logs: [],
      status: "running" as const,
      detectedPorts: [],
      createdAt: Date.now(),
    };

    store.addSession(projectId, session);
    store.appendLog(
      projectId,
      "term-1",
      "Next.js ready on http://localhost:3000\r\nAPI listening on http://127.0.0.1:8080\r\n",
    );

    const updated = useTerminalSessionStore.getState();
    const active = updated.getActiveSession(projectId);
    expect(active?.logs).toHaveLength(1);
    expect(active?.detectedPorts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ port: 3000, url: "http://localhost:3000" }),
        expect.objectContaining({ port: 8080, url: "http://localhost:8080" }),
      ]),
    );
  });

  it("renames a session correctly", () => {
    const store = useTerminalSessionStore.getState();
    store.addSession(projectId, {
      id: "term-1",
      title: "Terminal 1",
      type: "shell",
      logs: [],
      status: "running",
      createdAt: Date.now(),
    });

    store.renameSession(projectId, "term-1", "Backend API Server");

    const updated = useTerminalSessionStore.getState();
    expect(updated.getActiveSession(projectId)?.title).toBe("Backend API Server");
  });

  it("removes a session and switches active tab to remaining session", () => {
    const store = useTerminalSessionStore.getState();
    store.addSession(projectId, {
      id: "term-1",
      title: "Terminal 1",
      type: "shell",
      logs: [],
      status: "running",
      createdAt: Date.now(),
    });

    store.addSession(projectId, {
      id: "term-2",
      title: "Terminal 2",
      type: "powershell",
      logs: [],
      status: "running",
      createdAt: Date.now(),
    });

    expect(useTerminalSessionStore.getState().getActiveSessionId(projectId)).toBe("term-2");

    // Close term-2
    store.removeSession(projectId, "term-2");

    const updated = useTerminalSessionStore.getState();
    expect(updated.getSessions(projectId)).toHaveLength(1);
    expect(updated.getActiveSessionId(projectId)).toBe("term-1");
  });

  it("clears logs for a session", () => {
    const store = useTerminalSessionStore.getState();
    store.addSession(projectId, {
      id: "term-1",
      title: "Terminal 1",
      type: "shell",
      logs: ["log line 1", "log line 2"],
      status: "running",
      createdAt: Date.now(),
    });

    store.clearSessionLogs(projectId, "term-1");

    const updated = useTerminalSessionStore.getState();
    expect(updated.getActiveSession(projectId)?.logs).toEqual([]);
  });
});

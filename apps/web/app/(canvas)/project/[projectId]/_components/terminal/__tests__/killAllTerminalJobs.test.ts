import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useTerminalSessionStore } from "../stores/terminalSessionStore";
import { killAllTerminalJobs } from "../hooks/useDynamicTerminalSessions";

describe("killAllTerminalJobs", () => {
  const projectId = "proj-test-kill";

  beforeEach(() => {
    useTerminalSessionStore.setState({
      sessionsByProject: {},
      activeSessionIdByProject: {},
    });
  });

  afterEach(() => {
    delete (window as any).electronAPI;
  });

  it("terminates all active terminal sessions and clears the store in browser mode", () => {
    const store = useTerminalSessionStore.getState();
    store.addSession(projectId, {
      id: "session-1",
      title: "Job 1",
      type: "shell",
      status: "running",
      createdAt: Date.now(),
    });
    store.addSession(projectId, {
      id: "session-2",
      title: "Job 2",
      type: "shell",
      status: "running",
      createdAt: Date.now(),
    });

    expect(store.getSessions(projectId)).toHaveLength(2);

    killAllTerminalJobs(projectId);

    const updated = useTerminalSessionStore.getState();
    expect(updated.getSessions(projectId)).toEqual([]);
    expect(updated.getActiveSessionId(projectId)).toBeNull();
  });

  it("calls electron terminal.kill and dev.stop for each active session when in Electron", () => {
    const mockKill = vi.fn();
    const mockDevStop = vi.fn();

    (window as any).electronAPI = {
      terminal: {
        kill: mockKill,
      },
      dev: {
        stop: mockDevStop,
      },
    };

    const store = useTerminalSessionStore.getState();
    store.addSession(projectId, {
      id: "session-pty-1",
      title: "Pty Job 1",
      type: "powershell",
      status: "running",
      createdAt: Date.now(),
    });
    store.addSession(projectId, {
      id: "session-pty-2",
      title: "Pty Job 2",
      type: "bash",
      status: "running",
      createdAt: Date.now(),
    });

    killAllTerminalJobs(projectId, "/workspace/my-app");

    expect(mockKill).toHaveBeenCalledWith("session-pty-1");
    expect(mockKill).toHaveBeenCalledWith("session-pty-2");
    expect(mockKill).toHaveBeenCalledTimes(2);
    expect(mockDevStop).toHaveBeenCalledWith("/workspace/my-app");

    const updated = useTerminalSessionStore.getState();
    expect(updated.getSessions(projectId)).toEqual([]);
  });
});

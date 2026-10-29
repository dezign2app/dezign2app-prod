import net from "net";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

/**
 * Checks if a TCP port is open and reachable on 127.0.0.1.
 */
export function isPortOpen(port: number): Promise<boolean> {
  if (!port || isNaN(port) || port <= 0 || port > 65535) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const cleanup = (isOpen: boolean) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(isOpen);
    };

    socket.setTimeout(600);
    socket.once("connect", () => cleanup(true));
    socket.once("timeout", () => cleanup(false));
    socket.once("error", () => cleanup(false));

    try {
      socket.connect(port, "127.0.0.1");
    } catch {
      cleanup(false);
    }
  });
}

/**
 * Finds all process IDs (PIDs) actively listening on a TCP port.
 */
export async function findPidsForPort(port: number): Promise<number[]> {
  if (!port || isNaN(port) || port <= 0 || port > 65535) return [];

  const pids = new Set<number>();

  if (process.platform === "win32") {
    try {
      const { stdout } = await execAsync("netstat -ano -p tcp");
      const lines = stdout.split(/\r?\n/);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[0] === "TCP") {
          const localAddr = parts[1];
          const state = parts[3];
          const pid = parseInt(parts[4], 10);
          if (
            localAddr.endsWith(`:${port}`) &&
            state.toUpperCase() === "LISTENING" &&
            !isNaN(pid) &&
            pid > 0
          ) {
            pids.add(pid);
          }
        }
      }
    } catch (e) {
      console.warn(`[network] Error finding PIDs for port ${port}:`, e);
    }
  } else {
    // macOS / Linux
    try {
      const { stdout } = await execAsync(`lsof -ti tcp:${port}`);
      const lines = stdout.trim().split(/\r?\n/);
      for (const line of lines) {
        const pid = parseInt(line.trim(), 10);
        if (!isNaN(pid) && pid > 0) {
          pids.add(pid);
        }
      }
    } catch {
      // lsof returns exit code 1 if no process found
    }
  }

  return Array.from(pids);
}

/**
 * Kills the process(es) listening on the specified port to free it up.
 */
export async function killProcessOnPort(
  port: number
): Promise<{ success: boolean; pids: number[]; error?: string }> {
  if (!port || isNaN(port) || port <= 0 || port > 65535) {
    return { success: false, pids: [], error: "Invalid port number" };
  }

  const pids = await findPidsForPort(port);
  if (pids.length === 0) {
    return { success: true, pids: [], error: undefined };
  }

  const killed: number[] = [];
  const errors: string[] = [];

  for (const pid of pids) {
    // Safety check: Never kill the current Electron main process or its direct parent
    if (pid === process.pid || pid === process.ppid) {
      console.warn(`[network] Skipping kill for self process PID ${pid}`);
      continue;
    }

    try {
      if (process.platform === "win32") {
        await execAsync(`taskkill /F /T /PID ${pid}`);
      } else {
        await execAsync(`kill -9 ${pid}`);
      }
      killed.push(pid);
    } catch (err: any) {
      const msg = String(err?.message || "");
      // If the process was already dead / not found, count it as terminated
      if (
        msg.includes("not found") ||
        msg.includes("No such process") ||
        msg.includes("not running")
      ) {
        killed.push(pid);
      } else {
        console.warn(`[network] Failed to kill PID ${pid} on port ${port}:`, err);
        errors.push(`PID ${pid}: ${msg}`);
      }
    }
  }

  if (killed.length > 0) {
    return { success: true, pids: killed };
  }

  return {
    success: false,
    pids: [],
    error: errors.length > 0 ? errors.join("; ") : `Failed to terminate process on port ${port}`,
  };
}

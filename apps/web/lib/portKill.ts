import { isElectron, getElectronAPI } from "@/lib/electron";

export interface KillPortResult {
  success: boolean;
  pids?: number[];
  error?: string;
  message?: string;
}

/**
 * Attempts to terminate the process listening on a given TCP port,
 * freeing the port for immediate reuse.
 *
 * Automatically detects whether running in Electron (via native IPC)
 * or Web browser (via /api/ports/kill endpoint).
 */
export async function killPortProcess(
  port: number | string
): Promise<KillPortResult> {
  const portNum = typeof port === "number" ? port : parseInt(String(port), 10);
  if (isNaN(portNum) || portNum <= 0) {
    return { success: false, error: "Invalid port number" };
  }

  // 1. Electron Desktop shell: use native OS IPC
  if (isElectron()) {
    const api = getElectronAPI();
    if (api?.network?.killPort) {
      try {
        return await api.network.killPort(portNum);
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || "Failed to terminate process via Electron IPC",
        };
      }
    }
  }

  // 2. Web browser: call Next.js backend API
  try {
    const res = await fetch("/api/ports/kill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ port: portNum }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: data?.error || `Failed to free port (${res.status})`,
      };
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Network request failed to free port",
    };
  }
}

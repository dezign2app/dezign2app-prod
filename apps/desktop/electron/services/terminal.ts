import { app } from "electron";
import fs from "fs";
import path from "path";
import type * as NodePty from "node-pty";

// We lazy-import node-pty so the app still starts even if native build fails
const ptyMap = new Map<string, NodePty.IPty>();

async function getPty(): Promise<typeof NodePty> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("node-pty") as typeof NodePty;
}

export async function createTerminal(
  id: string,
  cwd: string,
  cols: number,
  rows: number,
  customShell: string | undefined,
  onData: (data: string) => void,
  onExit: (exitCode: number) => void
): Promise<{ success: boolean }> {
  const pty = await getPty();
  let shell = customShell && customShell.trim() ? customShell.trim() : "";
  if (!shell) {
    shell =
      process.platform === "win32"
        ? "powershell.exe"
        : process.env.SHELL || "/bin/bash";
  }

  // Clean up any existing PTY process with the same ID
  if (ptyMap.has(id)) {
    try {
      ptyMap.get(id)?.kill();
    } catch (e) {
      console.warn(`[terminal] Failed to kill existing pty ${id}:`, e);
    }
    ptyMap.delete(id);
  }

  let targetCwd = process.cwd() || app.getPath("home");
  if (cwd && typeof cwd === "string" && cwd.trim()) {
    try {
      const resolved = path.isAbsolute(cwd.trim())
        ? cwd.trim()
        : path.resolve(process.cwd(), cwd.trim());
      fs.mkdirSync(resolved, { recursive: true });
      targetCwd = resolved;
    } catch (e) {
      console.warn("[main] Failed to prepare terminal cwd:", cwd, e);
    }
  }

  let shellArgs: string[] = [];
  const lowerShell = shell.toLowerCase();
  if (lowerShell.includes("powershell") || lowerShell.includes("pwsh")) {
    shellArgs = ["-NoLogo", "-ExecutionPolicy", "Bypass"];
  } else if (lowerShell.includes("cmd.exe") || lowerShell === "cmd") {
    shellArgs = ["/Q"];
  }

  const ptyProcess = pty.spawn(shell, shellArgs, {
    name: "xterm-color",
    cols: cols || 80,
    rows: rows || 24,
    cwd: targetCwd,
    env: process.env as { [key: string]: string },
  });

  ptyProcess.onData((data: string) => {
    onData(data);
  });

  ptyProcess.onExit(({ exitCode }: { exitCode: number; signal?: number }) => {
    onExit(exitCode);
    ptyMap.delete(id);
  });

  ptyMap.set(id, ptyProcess);
  return { success: true };
}

export function writeTerminal(id: string, data: string): void {
  ptyMap.get(id)?.write(data);
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  ptyMap.get(id)?.resize(cols, rows);
}

export function killTerminal(id: string): void {
  try {
    ptyMap.get(id)?.kill();
  } catch (e) {
    console.warn(`[terminal] Failed to kill pty ${id}:`, e);
  }
  ptyMap.delete(id);
}

export function cleanupAllTerminals(): void {
  for (const [, pty] of ptyMap.entries()) {
    try {
      pty.kill();
    } catch (e) {
      // ignore
    }
  }
  ptyMap.clear();
}

import { spawn, ChildProcess } from "child_process";

let devProcess: ChildProcess | null = null;

/**
 * Runs a command to completion and returns { ok, output }.
 * stdout + stderr are concatenated into output.
 */
export function runToCompletion(
  cmd: string,
  args: string[],
  cwd: string
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    const proc = spawn(cmd, args, { cwd, shell: true });
    proc.stdout?.on("data", (d: Buffer) => chunks.push(d.toString()));
    proc.stderr?.on("data", (d: Buffer) => chunks.push(d.toString()));
    proc.on("close", (code) =>
      resolve({ ok: code === 0, output: chunks.join("") })
    );
    proc.on("error", (err: Error) =>
      resolve({ ok: false, output: err.message })
    );
  });
}

export async function startDev(
  projectDir: string,
  onLog: (line: string) => void
): Promise<{ ok: boolean; reason: string | null }> {
  if (devProcess) {
    onLog("⚠️  Dev server is already running. Stop it first.\n");
    return { ok: false, reason: "already_running" };
  }

  onLog("🚀 Starting Dev Mode (pnpm install && pnpm dev)...\n\n");

  // ── 1. pnpm install ──────────────────────────
  onLog("📦 [1/2] Installing dependencies (pnpm install)...\n");
  const installResult = await runToCompletion("pnpm", ["install"], projectDir);
  if (installResult.output.trim()) onLog(installResult.output);
  if (!installResult.ok) {
    onLog("\n⚠️  pnpm install finished with warnings or errors.\n\n");
  } else {
    onLog("  ✅ Dependencies installed successfully.\n\n");
  }

  // ── 2. pnpm dev (long-running Turbo hot reload) ───────────────
  onLog("🔥 [2/2] Launching all apps with hot reload (pnpm dev)...\n");
  onLog("─".repeat(60) + "\n\n");

  devProcess = spawn("pnpm", ["dev"], { cwd: projectDir, shell: true });

  devProcess.stdout?.on("data", (data: Buffer) => {
    onLog(data.toString());
  });

  devProcess.stderr?.on("data", (data: Buffer) => {
    onLog(data.toString());
  });

  devProcess.on("close", (code: number | null) => {
    onLog(`\n🛑 Dev server exited (code ${code})\n`);
    devProcess = null;
  });

  devProcess.on("error", (err: Error) => {
    onLog(`\n❌ Failed to start dev: ${err.message}\n`);
    devProcess = null;
  });

  return { ok: true, reason: null };
}

export function stopDev(onLog: (line: string) => void): void {
  if (devProcess) {
    devProcess.kill("SIGTERM");
    devProcess = null;
    onLog("\n🛑 Stopped dev server (pnpm dev).\n");
  } else {
    onLog("\nℹ️  No running dev server found.\n");
  }
}

export function writeDevStdin(data: string): void {
  if (devProcess?.stdin?.writable) {
    devProcess.stdin.write(data);
  }
}

export function stopDevProcess(): void {
  if (devProcess) {
    try {
      devProcess.kill("SIGTERM");
    } catch (e) {
      console.warn("[dev] Failed to kill devProcess:", e);
    }
    devProcess = null;
  }
}

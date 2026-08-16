import { spawn, execFile, ChildProcess } from "child_process";

let dockerProcess: ChildProcess | null = null;

/**
 * Runs a command and resolves with { ok, output }.
 * Never rejects — errors are returned as { ok: false, output: errorMessage }.
 */
export function checkCommand(
  cmd: string,
  args: string[]
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { shell: true, timeout: 10_000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, output: stderr.trim() || err.message });
      } else {
        resolve({ ok: true, output: (stdout + stderr).trim() });
      }
    });
  });
}

/**
 * docker:preflight — runs environment checks and streams results.
 * Returns { ok: boolean, reason: string | null } — if false, the caller must NOT proceed with docker:up.
 */
export async function runDockerPreflight(
  onLog: (line: string) => void
): Promise<{ ok: boolean; reason: string | null }> {
  onLog("🔍 Running pre-flight checks...\n");

  // ── 1. Node.js ──────────────────────────────
  onLog("  [1/3] Checking Node.js...\n");
  const nodeCheck = await checkCommand("node", ["--version"]);
  if (nodeCheck.ok) {
    onLog(`  ✅ Node.js: ${nodeCheck.output}\n`);
  } else {
    onLog(`  ❌ Node.js not found: ${nodeCheck.output}\n`);
    onLog("\n❌ Pre-flight failed: Node.js is required. Install it from https://nodejs.org\n");
    return { ok: false, reason: "node_missing" };
  }

  // ── 2. Docker CLI ───────────────────────────
  onLog("  [2/3] Checking Docker CLI...\n");
  const dockerVersionCheck = await checkCommand("docker", ["--version"]);
  if (dockerVersionCheck.ok) {
    onLog(`  ✅ Docker CLI: ${dockerVersionCheck.output}\n`);
  } else {
    onLog(`  ❌ Docker CLI not found: ${dockerVersionCheck.output}\n`);
    onLog("\n❌ Pre-flight failed: Docker is not installed or not in PATH.\n");
    onLog("   → Install Docker Desktop: https://www.docker.com/products/docker-desktop\n");
    return { ok: false, reason: "docker_missing" };
  }

  // ── 3. Docker Daemon ────────────────────────
  onLog("  [3/3] Checking Docker daemon...\n");
  const dockerInfoCheck = await checkCommand("docker", [
    "info",
    "--format",
    "{{.ServerVersion}}",
  ]);
  if (dockerInfoCheck.ok) {
    onLog(`  ✅ Docker daemon running (server v${dockerInfoCheck.output})\n`);
  } else {
    onLog(`  ❌ Docker daemon not reachable: ${dockerInfoCheck.output}\n`);
    onLog("\n❌ Pre-flight failed: Docker daemon is not running.\n");
    onLog("   → Open Docker Desktop and wait until the whale icon stops animating.\n");
    return { ok: false, reason: "docker_daemon_down" };
  }

  onLog("\n✅ All pre-flight checks passed. Launching containers...\n\n");
  return { ok: true, reason: null };
}

export function startDocker(
  projectDir: string,
  onLog: (line: string) => void
): void {
  if (dockerProcess) {
    onLog("⚠️  Docker is already running. Stop it first.\n");
    return;
  }

  onLog(`🚀 Starting: docker compose up --build in ${projectDir}\n`);

  dockerProcess = spawn("docker", ["compose", "up", "--build"], {
    cwd: projectDir,
    shell: true,
  });

  dockerProcess.stdout?.on("data", (data: Buffer) => {
    onLog(data.toString());
  });

  dockerProcess.stderr?.on("data", (data: Buffer) => {
    onLog(data.toString());
  });

  dockerProcess.on("close", (code: number | null) => {
    onLog(`\n✅ docker compose exited with code ${code}\n`);
    dockerProcess = null;
  });

  dockerProcess.on("error", (err: Error) => {
    onLog(`\n❌ Failed to start Docker: ${err.message}\n`);
    dockerProcess = null;
  });
}

export function stopDocker(
  projectDir: string,
  onLog: (line: string) => void
): void {
  if (!dockerProcess) {
    onLog("ℹ️  No running Docker process found.\n");
    return;
  }
  // First try graceful docker compose down
  spawn("docker", ["compose", "down"], { cwd: projectDir, shell: true });
  dockerProcess.kill("SIGTERM");
  dockerProcess = null;
  onLog("🛑 Stopped Docker Compose.\n");
}

export function writeDockerStdin(data: string): void {
  if (dockerProcess?.stdin?.writable) {
    dockerProcess.stdin.write(data);
  }
}

export function stopDockerProcess(): void {
  if (dockerProcess) {
    try {
      dockerProcess.kill("SIGTERM");
    } catch (e) {
      console.warn("[docker] Failed to kill dockerProcess:", e);
    }
    dockerProcess = null;
  }
}

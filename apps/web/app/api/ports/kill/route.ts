import { NextResponse } from "next/server";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const port =
      typeof body.port === "number" ? body.port : parseInt(String(body.port), 10);

    if (isNaN(port) || port <= 0 || port > 65535) {
      return NextResponse.json(
        { success: false, error: "Invalid port number" },
        { status: 400 }
      );
    }

    const pids = new Set<number>();

    if (process.platform === "win32") {
      try {
        const { stdout } = await execAsync("netstat -ano -p tcp");
        for (const line of stdout.split(/\r?\n/)) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5 && parts[0] === "TCP") {
            const localAddr = parts[1] ?? "";
            const state = parts[3] ?? "";
            const pidStr = parts[4] ?? "";
            const pid = parseInt(pidStr, 10);
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
      } catch (e: any) {
        console.warn("[api/ports/kill] Error finding PIDs:", e);
      }
    } else {
      try {
        const { stdout } = await execAsync(`lsof -ti tcp:${port}`);
        for (const line of stdout.trim().split(/\r?\n/)) {
          const trimmed = line.trim();
          if (trimmed) {
            const pid = parseInt(trimmed, 10);
            if (!isNaN(pid) && pid > 0) {
              pids.add(pid);
            }
          }
        }
      } catch {
        // no process found
      }
    }

    const pidList = Array.from(pids);
    if (pidList.length === 0) {
      return NextResponse.json({
        success: true,
        pids: [],
        message: `No active process found listening on port ${port}`,
      });
    }

    const killed: number[] = [];
    const errors: string[] = [];

    for (const pid of pidList) {
      if (pid === process.pid || pid === process.ppid) {
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
        if (
          msg.includes("not found") ||
          msg.includes("No such process") ||
          msg.includes("not running")
        ) {
          killed.push(pid);
        } else {
          errors.push(`PID ${pid}: ${msg}`);
        }
      }
    }

    if (killed.length > 0) {
      return NextResponse.json({ success: true, pids: killed });
    }

    return NextResponse.json(
      {
        success: false,
        pids: [],
        error:
          errors.length > 0
            ? errors.join("; ")
            : `Failed to terminate process on port ${port}`,
      },
      { status: 500 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

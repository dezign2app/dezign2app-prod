import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

// ─────────────────────────────────────────────
//  Next.js Server Runner (utilityProcess)
//  Runs inside Electron's embedded Node runtime
// ─────────────────────────────────────────────

function loadEnvFile(envPath: string) {
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, "utf8");
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
    console.log("[server-runner] Loaded environment from:", envPath);
  } catch (e) {
    console.warn("[server-runner] Warning: Failed to parse .env at", envPath, e);
  }
}

async function start() {
  const webDir =
    process.env.NEXT_WEB_DIR || path.join(process.resourcesPath || __dirname, "web");
  const port = process.env.PORT || "46500";

  console.log("[server-runner] Working directory:", webDir);
  console.log("[server-runner] Target port:", port);

  try {
    process.env.PORT = String(port);
    process.env.HOSTNAME = "127.0.0.1";
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    // Load environment variables from web directory
    loadEnvFile(path.join(webDir, ".env"));
    loadEnvFile(path.join(webDir, "apps", "web", ".env"));
    if (process.resourcesPath) {
      loadEnvFile(path.join(process.resourcesPath, "web", ".env"));
      loadEnvFile(path.join(process.resourcesPath, "web", "apps", "web", ".env"));
    }

    // Ensure fallback NEXT_PUBLIC_APP_URL is bound to 127.0.0.1
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${port}`;
    }

    // Check for Next.js standalone server entry points
    const candidateServerPaths = [
      path.join(webDir, "apps", "web", "server.js"),
      path.join(webDir, "server.js"),
      path.join(webDir, ".next", "standalone", "apps", "web", "server.js"),
      path.join(webDir, ".next", "standalone", "server.js"),
    ];

    let standaloneServerPath: string | null = null;
    for (const candidate of candidateServerPaths) {
      if (fs.existsSync(candidate)) {
        standaloneServerPath = candidate;
        break;
      }
    }

    if (standaloneServerPath) {
      console.log(
        "[server-runner] Starting standalone Next.js server from:",
        standaloneServerPath
      );
      process.chdir(path.dirname(standaloneServerPath));

      const fileUrl = pathToFileURL(standaloneServerPath).href;
      // Dynamic import supports ESM modules in Node.js runtime
      const dynamicImport = new Function(
        "specifier",
        "return import(specifier)"
      );
      await dynamicImport(fileUrl);
    } else {
      // Fallback: start via next CLI
      process.chdir(webDir);
      const nextBin = path.join(
        webDir,
        "node_modules",
        "next",
        "dist",
        "bin",
        "next"
      );
      console.log(
        "[server-runner] Starting Next.js via next CLI binary:",
        nextBin
      );
      process.argv = ["node", nextBin, "start", "--port", String(port)];
      require(nextBin);
    }
  } catch (err) {
    console.error("[server-runner] Fatal error:", err);
    process.exit(1);
  }
}

start();


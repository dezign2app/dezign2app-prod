import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

// ─────────────────────────────────────────────
//  Next.js Server Runner (utilityProcess)
//  Runs inside Electron's embedded Node runtime
// ─────────────────────────────────────────────

function loadEnvFile(envPath: string, override = false) {
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
        // When override=true (e.g. .env.production), always overwrite so prod
        // values take precedence over dev .env values loaded earlier.
        if (override || !process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (e) {
    // Silently ignore parse errors
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

    // Load environment variables from web directory.
    // Load base .env first, then .env.production with override=true so that
    // production values always win over dev defaults in the packaged app.
    loadEnvFile(path.join(webDir, ".env"));
    loadEnvFile(path.join(webDir, ".env.production"), true);
    loadEnvFile(path.join(webDir, "apps", "web", ".env"));
    loadEnvFile(path.join(webDir, "apps", "web", ".env.production"), true);
    if (process.resourcesPath) {
      loadEnvFile(path.join(process.resourcesPath, "web", ".env"));
      loadEnvFile(path.join(process.resourcesPath, "web", ".env.production"), true);
      loadEnvFile(path.join(process.resourcesPath, "web", "apps", "web", ".env"));
      loadEnvFile(path.join(process.resourcesPath, "web", "apps", "web", ".env.production"), true);
    }

    // Ensure fallback NEXT_PUBLIC_APP_URL if still unset after loading env files.
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${port}`;
    }

    // ── Auth env debug ────────────────────────────────────────────────────────
    console.log("[server-runner] ── Resolved auth env vars ──────────────────");
    console.log("[server-runner]  BETTER_AUTH_URL            :", process.env.BETTER_AUTH_URL ?? "(unset)");
    console.log("[server-runner]  NEXT_PUBLIC_APP_URL        :", process.env.NEXT_PUBLIC_APP_URL ?? "(unset)");
    console.log("[server-runner]  NEXT_PUBLIC_DESKTOP_AUTH_URL:", process.env.NEXT_PUBLIC_DESKTOP_AUTH_URL ?? "(unset)");
    console.log("[server-runner]  BETTER_AUTH_TRUSTED_ORIGINS:", process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "(unset)");
    console.log("[server-runner]  NEXT_PUBLIC_CONVEX_URL     :", process.env.NEXT_PUBLIC_CONVEX_URL ?? "(unset)");
    console.log("[server-runner]  NEXT_PUBLIC_CONVEX_SITE_URL:", process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "(unset)");
    console.log("[server-runner]  CONVEX_URL                 :", process.env.CONVEX_URL ?? "(unset)");
    console.log("[server-runner]  CONVEX_SITE_URL            :", process.env.CONVEX_SITE_URL ?? "(unset)");
    console.log("[server-runner]  BETTER_AUTH_SECRET set?    :", process.env.BETTER_AUTH_SECRET ? "YES" : "NO (using dev fallback)");
    console.log("[server-runner]  NODE_ENV                   :", process.env.NODE_ENV ?? "(unset)");
    console.log("[server-runner]  PORT / HOSTNAME            :", `${process.env.PORT} / ${process.env.HOSTNAME}`);
    console.log("[server-runner] ─────────────────────────────────────────────");

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


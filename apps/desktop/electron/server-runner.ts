import path from "path";

// ─────────────────────────────────────────────
//  Next.js Server Runner (utilityProcess)
//  Runs inside Electron's embedded Node runtime
// ─────────────────────────────────────────────

const webDir =
  process.env.NEXT_WEB_DIR || path.join(process.resourcesPath || __dirname, "web");
const port = process.env.PORT || "3100";

console.log("[server-runner] Working directory:", webDir);
console.log("[server-runner] Target port:", port);

try {
  process.chdir(webDir);

  const nextBin = path.join(
    webDir,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next"
  );

  process.argv = ["node", nextBin, "start", "--port", String(port)];

  require(nextBin);
} catch (err) {
  console.error("[server-runner] Fatal error:", err);
  process.exit(1);
}

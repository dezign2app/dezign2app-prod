#!/usr/bin/env node
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const webDir = path.join(__dirname, "..");
const args = process.argv.slice(2);

const isDev =
  args.includes("--dev") ||
  args.includes("--development") ||
  process.env.BUILD_ENV === "development" ||
  process.env.APP_ENV === "development";

const targetEnv = isDev ? "development" : "production";

function parseEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const result = {};
  try {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
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
        result[key] = val;
      }
    }
  } catch (e) {
    console.warn(`[build-runner] Warning reading ${envPath}:`, e.message);
  }
  return result;
}

// 1. Gather env files based on target environment
const baseEnv = parseEnvFile(path.join(webDir, ".env"));
const prodEnv = parseEnvFile(path.join(webDir, ".env.production"));

// Real process.env takes highest precedence over .env files
const resolvedEnv = isDev
  ? { ...prodEnv, ...baseEnv, ...process.env }
  : { ...baseEnv, ...prodEnv, ...process.env };

// Auto-derive site URL from cloud URL if not explicitly specified
if (resolvedEnv.NEXT_PUBLIC_CONVEX_URL && !resolvedEnv.NEXT_PUBLIC_CONVEX_SITE_URL) {
  resolvedEnv.NEXT_PUBLIC_CONVEX_SITE_URL = resolvedEnv.NEXT_PUBLIC_CONVEX_URL.replace(".convex.cloud", ".convex.site");
}
if (resolvedEnv.CONVEX_URL && !resolvedEnv.CONVEX_SITE_URL) {
  resolvedEnv.CONVEX_SITE_URL = resolvedEnv.CONVEX_URL.replace(".convex.cloud", ".convex.site");
}

resolvedEnv.CONVEX_URL = resolvedEnv.CONVEX_URL || resolvedEnv.NEXT_PUBLIC_CONVEX_URL;
resolvedEnv.CONVEX_SITE_URL = resolvedEnv.CONVEX_SITE_URL || resolvedEnv.NEXT_PUBLIC_CONVEX_SITE_URL;

// Fail fast if required Convex configuration is missing
if (!resolvedEnv.NEXT_PUBLIC_CONVEX_URL) {
  console.error(`\n❌ Error: Missing NEXT_PUBLIC_CONVEX_URL for ${targetEnv.toUpperCase()} build.`);
  console.error(`Please provide NEXT_PUBLIC_CONVEX_URL in your environment or ${isDev ? ".env" : ".env.production"}.\n`);
  process.exit(1);
}

if (!resolvedEnv.NEXT_PUBLIC_CONVEX_SITE_URL) {
  console.error(`\n❌ Error: Missing NEXT_PUBLIC_CONVEX_SITE_URL for ${targetEnv.toUpperCase()} build.`);
  console.error(`Please provide NEXT_PUBLIC_CONVEX_SITE_URL in your environment or ${isDev ? ".env" : ".env.production"}.\n`);
  process.exit(1);
}

resolvedEnv.NODE_ENV = "production"; // Next.js requires NODE_ENV=production during `next build`
resolvedEnv.BUILD_ENV = targetEnv;
resolvedEnv.APP_ENV = targetEnv;

console.log("\n======================================================================");
console.log(`==> [Next.js Build] Target Environment: ${targetEnv.toUpperCase()}`);
console.log(`    Convex Cloud:      ${resolvedEnv.NEXT_PUBLIC_CONVEX_URL}`);
console.log(`    Convex Site URL:   ${resolvedEnv.NEXT_PUBLIC_CONVEX_SITE_URL}`);
console.log(`    Auth / Portal URL: ${resolvedEnv.NEXT_PUBLIC_DESKTOP_AUTH_URL}`);
console.log("======================================================================\n");

// Execute Next.js build
const nextBin = path.join(webDir, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
const cmd = fs.existsSync(nextBin) ? nextBin : "next";

const result = spawnSync(cmd, ["build"], {
  cwd: webDir,
  stdio: "inherit",
  env: resolvedEnv,
  shell: true,
});

if (result.status !== 0) {
  console.error(`\n❌ Next.js build failed with exit code ${result.status}`);
  process.exit(result.status || 1);
}

// Record build stamp for downstream consumers (e.g. electron builder)
try {
  const stamp = {
    env: targetEnv,
    convexUrl: resolvedEnv.NEXT_PUBLIC_CONVEX_URL,
    convexSiteUrl: resolvedEnv.NEXT_PUBLIC_CONVEX_SITE_URL,
    authUrl: resolvedEnv.NEXT_PUBLIC_DESKTOP_AUTH_URL,
    builtAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(webDir, ".next-build-env.json"),
    JSON.stringify(stamp, null, 2),
    "utf8"
  );
  const dotNextDir = path.join(webDir, ".next");
  if (fs.existsSync(dotNextDir)) {
    fs.writeFileSync(
      path.join(dotNextDir, "build-env.json"),
      JSON.stringify(stamp, null, 2),
      "utf8"
    );
  }
} catch (e) {
  console.warn("[build-runner] Warning saving build-env.json stamp:", e.message);
}

console.log(`\n✓ Next.js ${targetEnv.toUpperCase()} build completed successfully!\n`);

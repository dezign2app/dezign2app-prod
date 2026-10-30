import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * Handles reading and writing secret environment variables directly to the local .env files.
 * Automatically keeps the web app, project root, and all generated service .env files in sync
 * and updates process.env in memory so developers never have to manually edit .env files.
 */

function applyEnvUpdate(envPath: string, key: string, value: string): boolean {
  try {
    const dir = path.dirname(envPath);
    if (!fs.existsSync(dir)) return false;

    let content = "";
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, "utf-8");
    }

    const lines = content ? content.split(/\r?\n/) : [];
    let keyFound = false;

    const newLines = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || !trimmed.includes("=")) {
        return line;
      }
      const lineKey = trimmed.substring(0, trimmed.indexOf("=")).trim();
      if (lineKey === key) {
        keyFound = true;
        return `${key}=${value}`;
      }
      return line;
    });

    if (!keyFound) {
      const lastLine = newLines[newLines.length - 1];
      if (lastLine !== undefined && lastLine.trim() === "") {
        newLines.splice(newLines.length - 1, 0, `${key}=${value}`);
      } else {
        newLines.push(`${key}=${value}`);
      }
    }

    fs.writeFileSync(envPath, newLines.join("\n"), "utf-8");
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { key, value, outputDir } = await req.json();
    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Variable key is required" }, { status: 400 });
    }

    const cleanKey = key.trim().replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
    const cleanValue = value !== undefined && value !== null ? String(value) : "";

    // 1. Immediately update in-memory process.env so live server routes see the change
    process.env[cleanKey] = cleanValue;
    if (cleanKey === "GROQ_API_KEY") {
      process.env.NEXT_PUBLIC_GROQ_API_KEY = cleanValue;
    }

    const updatedPaths: string[] = [];

    // 2. Always update apps/web/.env
    const webEnvPath = path.join(process.cwd(), ".env");
    if (applyEnvUpdate(webEnvPath, cleanKey, cleanValue)) {
      updatedPaths.push(webEnvPath);
      if (cleanKey === "GROQ_API_KEY") {
        applyEnvUpdate(webEnvPath, "NEXT_PUBLIC_GROQ_API_KEY", cleanValue);
      }
    }

    // 3. Update root repo .env if running from monorepo
    const repoRootEnv = path.resolve(process.cwd(), "..", "..", ".env");
    if (fs.existsSync(repoRootEnv)) {
      if (applyEnvUpdate(repoRootEnv, cleanKey, cleanValue)) {
        updatedPaths.push(repoRootEnv);
      }
    }

    // 4. Update project outputDir .env and any generated service .env files
    if (outputDir && typeof outputDir === "string" && fs.existsSync(outputDir)) {
      const projectEnvPath = path.join(outputDir, ".env");
      if (applyEnvUpdate(projectEnvPath, cleanKey, cleanValue)) {
        updatedPaths.push(projectEnvPath);
      }

      // Check subdirectories in outputDir/apps (e.g. apps/conversations/.env)
      const appsDir = path.join(outputDir, "apps");
      if (fs.existsSync(appsDir)) {
        try {
          const appEntries = fs.readdirSync(appsDir, { withFileTypes: true });
          for (const entry of appEntries) {
            if (entry.isDirectory()) {
              const appEnvPath = path.join(appsDir, entry.name, ".env");
              if (fs.existsSync(appEnvPath)) {
                if (applyEnvUpdate(appEnvPath, cleanKey, cleanValue)) {
                  updatedPaths.push(appEnvPath);
                }
              }
            }
          }
        } catch {}
      }
    }

    return NextResponse.json({
      success: true,
      key: cleanKey,
      paths: updatedPaths,
      path: updatedPaths[0] || webEnvPath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to write local .env" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const outputDir = searchParams.get("outputDir");

    if (!key) {
      return NextResponse.json({ value: "" });
    }

    const cleanKey = key.trim().replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();

    // Check targetDir if provided
    if (outputDir && typeof outputDir === "string" && fs.existsSync(outputDir)) {
      const envPath = path.join(outputDir, ".env");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
          const lineKey = trimmed.substring(0, trimmed.indexOf("=")).trim();
          if (lineKey === cleanKey) {
            return NextResponse.json({ value: trimmed.substring(trimmed.indexOf("=") + 1).trim() });
          }
        }
      }

      // Check outputDir/apps/*/.env
      const appsDir = path.join(outputDir, "apps");
      if (fs.existsSync(appsDir)) {
        try {
          const appEntries = fs.readdirSync(appsDir, { withFileTypes: true });
          for (const entry of appEntries) {
            if (entry.isDirectory()) {
              const subEnv = path.join(appsDir, entry.name, ".env");
              if (fs.existsSync(subEnv)) {
                const content = fs.readFileSync(subEnv, "utf-8");
                for (const line of content.split(/\r?\n/)) {
                  const trimmed = line.trim();
                  if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
                  const lineKey = trimmed.substring(0, trimmed.indexOf("=")).trim();
                  if (lineKey === cleanKey) {
                    return NextResponse.json({ value: trimmed.substring(trimmed.indexOf("=") + 1).trim() });
                  }
                }
              }
            }
          }
        } catch {}
      }
    }

    // Check apps/web/.env
    const webEnvPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(webEnvPath)) {
      const content = fs.readFileSync(webEnvPath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const lineKey = trimmed.substring(0, trimmed.indexOf("=")).trim();
        if (lineKey === cleanKey) {
          return NextResponse.json({ value: trimmed.substring(trimmed.indexOf("=") + 1).trim() });
        }
      }
    }

    // Fallback to process.env in memory
    if (process.env[cleanKey]) {
      return NextResponse.json({ value: process.env[cleanKey] });
    }

    return NextResponse.json({ value: "" });
  } catch {
    return NextResponse.json({ value: "" });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { key, outputDir } = await req.json();
    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Variable key is required" }, { status: 400 });
    }

    const cleanKey = key.trim().replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
    delete process.env[cleanKey];

    const removeFromFile = (envPath: string) => {
      if (!fs.existsSync(envPath)) return;
      const content = fs.readFileSync(envPath, "utf-8");
      const lines = content.split(/\r?\n/);
      const newLines = lines.filter((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("#") || !trimmed.includes("=")) return true;
        const lineKey = trimmed.substring(0, trimmed.indexOf("=")).trim();
        return lineKey !== cleanKey;
      });
      fs.writeFileSync(envPath, newLines.join("\n"), "utf-8");
    };

    removeFromFile(path.join(process.cwd(), ".env"));
    if (outputDir && typeof outputDir === "string" && fs.existsSync(outputDir)) {
      removeFromFile(path.join(outputDir, ".env"));
      const appsDir = path.join(outputDir, "apps");
      if (fs.existsSync(appsDir)) {
        try {
          const appEntries = fs.readdirSync(appsDir, { withFileTypes: true });
          for (const entry of appEntries) {
            if (entry.isDirectory()) {
              removeFromFile(path.join(appsDir, entry.name, ".env"));
            }
          }
        } catch {}
      }
    }

    return NextResponse.json({ success: true, key: cleanKey });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete from local .env" },
      { status: 500 },
    );
  }
}

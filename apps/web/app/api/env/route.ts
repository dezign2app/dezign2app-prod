import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * Handles reading and writing secret environment variables directly to the local .env file.
 * This guarantees secrets are saved on the developer's machine and never stored in the database.
 */

export async function POST(req: NextRequest) {
  try {
    const { key, value, outputDir } = await req.json();
    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Variable key is required" }, { status: 400 });
    }

    const cleanKey = key.trim().replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
    const cleanValue = value !== undefined && value !== null ? String(value) : "";

    // Determine target directory: prefer outputDir if it exists on disk, otherwise project root
    let targetDir = process.cwd();
    if (outputDir && typeof outputDir === "string") {
      try {
        if (fs.existsSync(outputDir)) {
          targetDir = outputDir;
        }
      } catch {}
    }

    const envPath = path.join(targetDir, ".env");

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
      if (lineKey === cleanKey) {
        keyFound = true;
        return `${cleanKey}=${cleanValue}`;
      }
      return line;
    });

    if (!keyFound) {
      const lastLine = newLines[newLines.length - 1];
      if (lastLine !== undefined && lastLine.trim() === "") {
        newLines.splice(newLines.length - 1, 0, `${cleanKey}=${cleanValue}`);
      } else {
        newLines.push(`${cleanKey}=${cleanValue}`);
      }
    }

    fs.writeFileSync(envPath, newLines.join("\n"), "utf-8");

    return NextResponse.json({
      success: true,
      key: cleanKey,
      path: envPath,
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

    let targetDir = process.cwd();
    if (outputDir && typeof outputDir === "string") {
      try {
        if (fs.existsSync(outputDir)) {
          targetDir = outputDir;
        }
      } catch {}
    }

    const envPath = path.join(targetDir, ".env");
    if (!fs.existsSync(envPath)) {
      return NextResponse.json({ value: "" });
    }

    const content = fs.readFileSync(envPath, "utf-8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const lineKey = trimmed.substring(0, trimmed.indexOf("=")).trim();
      if (lineKey === cleanKey) {
        const val = trimmed.substring(trimmed.indexOf("=") + 1).trim();
        return NextResponse.json({ value: val });
      }
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

    let targetDir = process.cwd();
    if (outputDir && typeof outputDir === "string") {
      try {
        if (fs.existsSync(outputDir)) {
          targetDir = outputDir;
        }
      } catch {}
    }

    const envPath = path.join(targetDir, ".env");
    if (!fs.existsSync(envPath)) {
      return NextResponse.json({ success: true });
    }

    const content = fs.readFileSync(envPath, "utf-8");
    const lines = content.split(/\r?\n/);
    const newLines = lines.filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || !trimmed.includes("=")) return true;
      const lineKey = trimmed.substring(0, trimmed.indexOf("=")).trim();
      return lineKey !== cleanKey;
    });

    fs.writeFileSync(envPath, newLines.join("\n"), "utf-8");
    return NextResponse.json({ success: true, key: cleanKey });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete from local .env" },
      { status: 500 },
    );
  }
}

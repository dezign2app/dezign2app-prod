import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export interface SyncPackageJsonRequestBody {
  action: "add" | "update" | "remove";
  name: string;
  version?: string;
  isDev?: boolean;
  nodeType?: "service" | "webApp" | "webPage";
  outputDir?: string;
}

export interface SyncPackageJsonResponse {
  success: boolean;
  action: "add" | "update" | "remove";
  name: string;
  version?: string;
  updatedFile?: string;
  error?: string;
}

interface PackageJsonShape {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

function findTargetPackageJson(nodeType?: string, outputDir?: string): string | null {
  if (outputDir && fs.existsSync(outputDir)) {
    if (nodeType === "service") {
      const appsDir = path.join(outputDir, "apps");
      if (fs.existsSync(appsDir)) {
        try {
          const subs = fs.readdirSync(appsDir, { withFileTypes: true });
          for (const s of subs) {
            if (s.isDirectory()) {
              const p = path.join(appsDir, s.name, "package.json");
              if (fs.existsSync(p)) return p;
            }
          }
        } catch {}
      }
      const packagesDir = path.join(outputDir, "packages");
      if (fs.existsSync(packagesDir)) {
        try {
          const subs = fs.readdirSync(packagesDir, { withFileTypes: true });
          for (const s of subs) {
            if (s.isDirectory()) {
              const p = path.join(packagesDir, s.name, "package.json");
              if (fs.existsSync(p)) return p;
            }
          }
        } catch {}
      }
    }
    const rootPkg = path.join(outputDir, "package.json");
    if (fs.existsSync(rootPkg)) return rootPkg;
  }

  const cwd = process.cwd();

  if (nodeType === "service") {
    const backendCandidates = [
      path.join(cwd, "packages/backend/package.json"),
      path.resolve(cwd, "../packages/backend/package.json"),
      path.resolve(cwd, "../../packages/backend/package.json"),
    ];
    for (const cand of backendCandidates) {
      if (fs.existsSync(cand)) return cand;
    }
  }

  const candidatePaths = [
    path.join(cwd, "apps/web/package.json"),
    path.resolve(cwd, "../apps/web/package.json"),
    path.resolve(cwd, "../../apps/web/package.json"),
    path.join(cwd, "package.json"),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      try {
        const raw = fs.readFileSync(candidate, "utf-8");
        const parsed = JSON.parse(raw) as PackageJsonShape;
        if (parsed.name === "web") {
          return candidate;
        }
      } catch {
        // Continue
      }
    }
  }

  // Fallback to first existing package.json
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function sortObjectKeys(obj: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {};
  const keys = Object.keys(obj).sort();
  for (const k of keys) {
    const val = obj[k];
    if (val !== undefined) {
      sorted[k] = val;
    }
  }
  return sorted;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SyncPackageJsonRequestBody;
    const { action, name, isDev, nodeType, outputDir } = body;
    let { version } = body;

    const trimmedName = name?.trim();
    if (!trimmedName) {
      return NextResponse.json<SyncPackageJsonResponse>(
        {
          success: false,
          action: action || "add",
          name: "",
          error: "Package name is required.",
        },
        { status: 400 },
      );
    }

    const pkgPath = findTargetPackageJson(nodeType, outputDir);
    if (!pkgPath) {
      return NextResponse.json<SyncPackageJsonResponse>(
        {
          success: false,
          action,
          name: trimmedName,
          error: "Could not find target package.json in workspace.",
        },
        { status: 500 },
      );
    }

    const raw = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as PackageJsonShape;

    // Normalize version
    if (!version || version.trim() === "" || version.trim() === "latest") {
      version = "*";
    } else {
      version = version.trim();
    }

    if (action === "add" || action === "update") {
      if (isDev) {
        pkg.devDependencies = pkg.devDependencies || {};
        pkg.devDependencies[trimmedName] = version;
        if (pkg.dependencies && pkg.dependencies[trimmedName] !== undefined) {
          delete pkg.dependencies[trimmedName];
        }
        pkg.devDependencies = sortObjectKeys(pkg.devDependencies);
      } else {
        pkg.dependencies = pkg.dependencies || {};
        pkg.dependencies[trimmedName] = version;
        if (pkg.devDependencies && pkg.devDependencies[trimmedName] !== undefined) {
          delete pkg.devDependencies[trimmedName];
        }
        pkg.dependencies = sortObjectKeys(pkg.dependencies);
      }
    } else if (action === "remove") {
      if (pkg.dependencies && pkg.dependencies[trimmedName] !== undefined) {
        delete pkg.dependencies[trimmedName];
      }
      if (pkg.devDependencies && pkg.devDependencies[trimmedName] !== undefined) {
        delete pkg.devDependencies[trimmedName];
      }
    }

    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");

    return NextResponse.json<SyncPackageJsonResponse>({
      success: true,
      action,
      name: trimmedName,
      version,
      updatedFile: pkgPath,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update package.json";
    return NextResponse.json<SyncPackageJsonResponse>(
      {
        success: false,
        action: "add",
        name: "",
        error: errorMsg,
      },
      { status: 500 },
    );
  }
}

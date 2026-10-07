import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export interface SyncPackageJsonRequestBody {
  action: "add" | "update" | "remove";
  name: string;
  version?: string;
  isDev?: boolean;
  nodeType?: "service" | "webApp" | "webPage" | "transformer";
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

/**
 * Resolves the target package.json strictly within the selected project outputDir.
 * NEVER falls back to process.cwd() or internal workspace repository files.
 */
function findTargetPackageJson(
  nodeType: string | undefined,
  cleanOutputDir: string,
): string | null {
  if (nodeType === "transformer") {
    const transformerDir = path.join(cleanOutputDir, "packages", "transformers");
    const transformerPkg = path.join(transformerDir, "package.json");

    // Auto-scaffold packages/transformers if not yet created in the generated app
    if (!fs.existsSync(transformerDir)) {
      fs.mkdirSync(path.join(transformerDir, "src"), { recursive: true });
    }

    if (!fs.existsSync(transformerPkg)) {
      const initialPkg: PackageJsonShape = {
        name: "@workspace/transformers",
        version: "0.0.0",
        private: true,
        description: "Shared pure data-transformation functions",
        main: "src/index.ts",
        types: "src/index.ts",
        exports: {
          ".": "./src/index.ts",
          "./*": "./src/*.ts",
        },
        scripts: {
          build: "tsc",
          "check-types": "tsc --noEmit",
        },
        dependencies: {},
        devDependencies: {
          "@workspace/typescript-config": "workspace:*",
          typescript: "^5.3.3",
        },
      };
      fs.writeFileSync(transformerPkg, JSON.stringify(initialPkg, null, 2) + "\n", "utf-8");
    }

    const transformerTsconfig = path.join(transformerDir, "tsconfig.json");
    if (!fs.existsSync(transformerTsconfig)) {
      const initialTsconfig = {
        extends: "@workspace/typescript-config/base.json",
        compilerOptions: {
          outDir: "./dist",
          rootDir: "./src",
        },
        include: ["src/**/*"],
      };
      fs.writeFileSync(transformerTsconfig, JSON.stringify(initialTsconfig, null, 2) + "\n", "utf-8");
    }

    const transformerIndex = path.join(transformerDir, "src", "index.ts");
    if (!fs.existsSync(transformerIndex)) {
      fs.mkdirSync(path.join(transformerDir, "src"), { recursive: true });
      fs.writeFileSync(transformerIndex, "export {};\n", "utf-8");
    }

    return transformerPkg;
  }

  if (nodeType === "service") {
    // 1. Direct candidate: packages/backend/package.json
    const backendCandidates = [
      path.join(cleanOutputDir, "packages", "backend", "package.json"),
    ];
    for (const cand of backendCandidates) {
      if (fs.existsSync(cand)) return cand;
    }

    // 2. apps/* services
    const appsDir = path.join(cleanOutputDir, "apps");
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

    // 3. packages/* packages (excluding transformers)
    const packagesDir = path.join(cleanOutputDir, "packages");
    if (fs.existsSync(packagesDir)) {
      try {
        const subs = fs.readdirSync(packagesDir, { withFileTypes: true });
        for (const s of subs) {
          if (s.isDirectory() && s.name !== "transformers") {
            const p = path.join(packagesDir, s.name, "package.json");
            if (fs.existsSync(p)) return p;
          }
        }
      } catch {}
    }

    // 4. Root package.json
    const rootPkg = path.join(cleanOutputDir, "package.json");
    if (fs.existsSync(rootPkg)) return rootPkg;
    return null;
  }

  // WebApp / WebPage / default client target
  const webPkg = path.join(cleanOutputDir, "apps", "web", "package.json");
  if (fs.existsSync(webPkg)) return webPkg;

  const appsDir = path.join(cleanOutputDir, "apps");
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

  const rootPkg = path.join(cleanOutputDir, "package.json");
  if (fs.existsSync(rootPkg)) return rootPkg;

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

    // Ensure outputDir is provided and exists on disk
    const cleanOutputDir = outputDir ? outputDir.trim().replace(/^["']|["']$/g, "") : "";
    if (!cleanOutputDir) {
      return NextResponse.json<SyncPackageJsonResponse>(
        {
          success: false,
          action: action || "add",
          name: trimmedName,
          error: "Target project directory (outputDir) is required. Please select a workspace folder first.",
        },
        { status: 400 },
      );
    }

    if (!fs.existsSync(cleanOutputDir)) {
      return NextResponse.json<SyncPackageJsonResponse>(
        {
          success: false,
          action: action || "add",
          name: trimmedName,
          error: `Target project directory "${cleanOutputDir}" does not exist on disk.`,
        },
        { status: 400 },
      );
    }

    const pkgPath = findTargetPackageJson(nodeType, cleanOutputDir);
    if (!pkgPath) {
      return NextResponse.json<SyncPackageJsonResponse>(
        {
          success: false,
          action,
          name: trimmedName,
          error: `Could not find target package.json in selected project directory: ${cleanOutputDir}`,
        },
        { status: 404 },
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

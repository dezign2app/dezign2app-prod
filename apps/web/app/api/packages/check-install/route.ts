import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export interface CheckInstallResponse {
  installed: boolean;
  pkg: string;
  version?: string;
  error?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pkg = searchParams.get("pkg")?.trim();

  if (!pkg) {
    return NextResponse.json<CheckInstallResponse>(
      { installed: false, pkg: "", error: "Package name is required" },
      { status: 400 },
    );
  }

  const outputDir = searchParams.get("outputDir")?.trim() || searchParams.get("projectDir")?.trim();

  try {
    const cwd = process.cwd();
    const pkgParts = pkg.split("/");
    const possiblePaths: string[] = [];

    if (outputDir && fs.existsSync(outputDir)) {
      possiblePaths.push(
        path.join(outputDir, "node_modules", pkg),
        path.join(outputDir, "node_modules", ...pkgParts),
        path.join(outputDir, "node_modules", ".pnpm", "node_modules", pkg),
        path.join(outputDir, "node_modules", ".pnpm", "node_modules", ...pkgParts),
      );
      // Check subdirectories in apps/ and packages/
      for (const folder of ["apps", "packages"]) {
        const folderPath = path.join(outputDir, folder);
        if (fs.existsSync(folderPath)) {
          try {
            const subs = fs.readdirSync(folderPath, { withFileTypes: true });
            for (const s of subs) {
              if (s.isDirectory()) {
                possiblePaths.push(path.join(folderPath, s.name, "node_modules", ...pkgParts));
              }
            }
          } catch {}
        }
      }
    }

    possiblePaths.push(
      path.join(cwd, "node_modules", pkg),
      path.join(cwd, "node_modules", ...pkgParts),
      path.join(cwd, "apps/web/node_modules", pkg),
      path.join(cwd, "apps/web/node_modules", ...pkgParts),
      path.resolve(cwd, "../../node_modules", pkg),
      path.resolve(cwd, "../../node_modules", ...pkgParts),
      path.resolve(cwd, "../apps/web/node_modules", pkg),
    );

    const exists = possiblePaths.some((p) => fs.existsSync(p));

    if (exists) {
      let version: string | undefined;
      for (const p of possiblePaths) {
        const pkgJsonPath = path.join(p, "package.json");
        if (fs.existsSync(pkgJsonPath)) {
          try {
            const raw = fs.readFileSync(pkgJsonPath, "utf-8");
            const parsed = JSON.parse(raw);
            if (typeof parsed.version === "string") {
              version = parsed.version;
              break;
            }
          } catch {
            // Ignore parse errors and keep version undefined
          }
        }
      }

      return NextResponse.json<CheckInstallResponse>({
        installed: true,
        pkg,
        version: version || "installed",
      });
    }

    // Secondary fallback using node module resolution
    try {
      require.resolve(pkg, {
        paths: [cwd, path.join(cwd, "apps/web"), path.resolve(cwd, "../..")],
      });
      return NextResponse.json<CheckInstallResponse>({
        installed: true,
        pkg,
        version: "installed",
      });
    } catch {
      // Package not found
    }

    return NextResponse.json<CheckInstallResponse>({
      installed: false,
      pkg,
      error: `Package "${pkg}" is not installed in node_modules.`,
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to check package installation";
    return NextResponse.json<CheckInstallResponse>({
      installed: false,
      pkg,
      error: errorMessage,
    });
  }
}

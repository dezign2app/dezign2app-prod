import { dialog, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";

export interface CompiledFile {
  filename: string;
  content: string;
}

export interface WriteProjectResult {
  success: boolean;
  path: string;
  writtenCount: number;
  totalCount: number;
}

/**
 * Shows directory picker dialog to select project export folder.
 */
export async function pickDirectory(
  window?: BrowserWindow | null
): Promise<string | null> {
  const result = window
    ? await dialog.showOpenDialog(window, {
        title: "Choose output folder for your project",
        properties: ["openDirectory", "createDirectory"],
      })
    : await dialog.showOpenDialog({
        title: "Choose output folder for your project",
        properties: ["openDirectory", "createDirectory"],
      });

  return result.canceled ? null : (result.filePaths[0] ?? null);
}

/**
 * Writes compiled project files to target directory with file diff checking
 * and optional stale folder cleanup.
 */
export async function writeProject(
  outputDir: string,
  files: CompiledFile[],
  options?: { cleanStale?: boolean }
): Promise<WriteProjectResult> {
  if (!outputDir) {
    return { success: false, path: outputDir, writtenCount: 0, totalCount: 0 };
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let writtenCount = 0;
  const currentFileSet = new Set<string>();

  for (const file of files) {
    const relativePath = file.filename.replace(/\\/g, "/");
    currentFileSet.add(relativePath);

    const fullPath = path.join(outputDir, relativePath);
    const targetDir = path.dirname(fullPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Check if file content changed before rewriting to minimize disk I/O and hot-reload watcher churn
    let needsWrite = true;
    if (fs.existsSync(fullPath)) {
      try {
        const existingContent = fs.readFileSync(fullPath, "utf-8");
        if (existingContent === file.content) {
          needsWrite = false;
        }
      } catch (e) {
        needsWrite = true;
      }
    }

    if (needsWrite) {
      fs.writeFileSync(fullPath, file.content, "utf-8");
      writtenCount++;
    }
  }

  // Optional safe cleanup of stale app folders if services were renamed/deleted on canvas
  if (options?.cleanStale) {
    try {
      const appsDir = path.join(outputDir, "apps");
      if (fs.existsSync(appsDir)) {
        const existingAppFolders = fs.readdirSync(appsDir, {
          withFileTypes: true,
        });
        for (const item of existingAppFolders) {
          if (item.isDirectory() && !item.name.startsWith(".")) {
            const appPrefix = `apps/${item.name}/`;
            const hasMatchingFile = Array.from(currentFileSet).some((f) =>
              f.startsWith(appPrefix)
            );
            if (!hasMatchingFile) {
              // Stale app directory that is no longer in canvas project
              const staleFolderPath = path.join(appsDir, item.name);
              fs.rmSync(staleFolderPath, { recursive: true, force: true });
            }
          }
        }
      }
    } catch (err) {
      console.warn("[main] Stale folder cleanup warning:", err);
    }
  }

  return {
    success: true,
    path: outputDir,
    writtenCount,
    totalCount: files.length,
  };
}

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

export interface ReadFileResult {
  success: boolean;
  content: string | null;
  path: string;
}

/**
 * Reads a single file from the project directory.
 */
export async function readProjectFile(
  outputDir: string,
  relativePath: string
): Promise<ReadFileResult> {
  if (!outputDir || !relativePath) {
    return { success: false, content: null, path: "" };
  }

  const fullPath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(outputDir, relativePath);

  try {
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      return { success: true, content, path: fullPath };
    }
  } catch (err) {
    console.warn(`[fileWriter] Failed to read ${fullPath}:`, err);
  }

  return { success: false, content: null, path: fullPath };
}

export interface DiskTreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children?: DiskTreeNode[];
}

export interface ListDirectoryResult {
  success: boolean;
  tree: DiskTreeNode[];
  totalFiles: number;
  path: string;
}

const NEVER_SHOW = new Set([
  ".git",
  ".DS_Store",
  "Thumbs.db",
]);

function scanDirectoryRecursive(
  rootDir: string,
  subDir: string = "",
  depth: number = 0,
  maxDepth: number = 8
): { nodes: DiskTreeNode[]; fileCount: number } {
  if (!rootDir || !fs.existsSync(rootDir) || depth > maxDepth) {
    return { nodes: [], fileCount: 0 };
  }

  const currentDir = subDir ? path.join(rootDir, subDir) : rootDir;
  if (!fs.existsSync(currentDir)) {
    return { nodes: [], fileCount: 0 };
  }

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch (e) {
    return { nodes: [], fileCount: 0 };
  }

  const nodes: DiskTreeNode[] = [];
  let totalFiles = 0;

  // Limit depth inside heavy vendor folders like node_modules so directory scanning is instant
  const isHeavyFolder =
    subDir === "node_modules" ||
    subDir.endsWith("/node_modules") ||
    subDir.includes("node_modules/") ||
    subDir === ".pnpm-store" ||
    subDir.includes(".pnpm-store/");
  const effectiveMaxDepth = isHeavyFolder ? Math.min(maxDepth, depth + 1) : maxDepth;

  for (const entry of entries) {
    if (NEVER_SHOW.has(entry.name)) {
      continue;
    }

    const relPath = subDir
      ? `${subDir}/${entry.name}`.replace(/\\/g, "/")
      : entry.name;

    if (entry.isDirectory()) {
      const sub =
        depth < effectiveMaxDepth
          ? scanDirectoryRecursive(rootDir, relPath, depth + 1, effectiveMaxDepth)
          : { nodes: [], fileCount: 0 };
      totalFiles += sub.fileCount;
      nodes.push({
        name: entry.name,
        path: relPath,
        isFolder: true,
        children: sub.nodes,
      });
    } else {
      totalFiles += 1;
      nodes.push({
        name: entry.name,
        path: relPath,
        isFolder: false,
      });
    }
  }

  nodes.sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name);
  });

  return { nodes, fileCount: totalFiles };
}

/**
 * Scans and returns the tree structure of files directly on the local filesystem.
 */
export async function listProjectDirectory(
  outputDir: string
): Promise<ListDirectoryResult> {
  if (!outputDir || !fs.existsSync(outputDir)) {
    return { success: false, tree: [], totalFiles: 0, path: outputDir || "" };
  }

  try {
    const { nodes, fileCount } = scanDirectoryRecursive(outputDir);
    return {
      success: true,
      tree: nodes,
      totalFiles: fileCount,
      path: outputDir,
    };
  } catch (err) {
    console.warn(`[fileWriter] Failed to list directory ${outputDir}:`, err);
    return { success: false, tree: [], totalFiles: 0, path: outputDir };
  }
}


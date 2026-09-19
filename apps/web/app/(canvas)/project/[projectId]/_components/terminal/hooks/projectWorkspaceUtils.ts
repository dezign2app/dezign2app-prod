"use client";

/**
 * Normalizes a folder path for reliable cross-platform comparison (case, slashes, trailing slashes).
 */
export function normalizeFolderPath(dirPath: string): string {
  if (!dirPath) return "";
  return dirPath
    .trim()
    .replace(/[\\/]+$/, "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

export interface FolderConflict {
  projectId: string;
  projectName: string;
  path: string;
}

/**
 * Checks whether the given targetPath is already assigned to another project in localStorage.
 * Ensures the project folder remains unique to each project.
 */
export function findProjectFolderConflict(
  currentProjectId: string,
  targetPath: string
): FolderConflict | null {
  if (typeof window === "undefined" || !targetPath) return null;
  const targetNorm = normalizeFolderPath(targetPath);
  if (!targetNorm) return null;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("workspace_dir_")) continue;

      const otherProjectId = key.replace("workspace_dir_", "");
      if (otherProjectId === currentProjectId) continue;

      const existingPath = localStorage.getItem(key);
      if (existingPath && normalizeFolderPath(existingPath) === targetNorm) {
        const otherName =
          localStorage.getItem(`workspace_project_name_${otherProjectId}`) ||
          "Another Project";
        return {
          projectId: otherProjectId,
          projectName: otherName,
          path: existingPath,
        };
      }
    }
  } catch (e) {
    console.warn("[projectWorkspaceUtils] Error checking folder conflict:", e);
  }

  return null;
}

/**
 * Removes the legacy global workspace directory key from localStorage
 * so that projects never inherit a shared fallback directory.
 */
export function cleanLegacyGlobalWorkspaceDir(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("dezign2app_workspace_dir");
  } catch {}
}

/**
 * Retrieves the project workspace directory strictly scoped to the given projectId.
 */
export function getProjectWorkspaceDir(projectId: string): string {
  if (!projectId || typeof window === "undefined") return "";
  try {
    cleanLegacyGlobalWorkspaceDir();
    return (
      localStorage.getItem(`workspace_dir_${projectId}`) ||
      localStorage.getItem(`docker_dir_${projectId}`) ||
      ""
    );
  } catch {
    return "";
  }
}

/**
 * Saves a project workspace directory strictly scoped to the given projectId.
 */
export function setProjectWorkspaceDir(
  projectId: string,
  dir: string,
  projectName?: string
): void {
  if (!projectId || typeof window === "undefined") return;
  try {
    cleanLegacyGlobalWorkspaceDir();
    if (dir) {
      localStorage.setItem(`workspace_dir_${projectId}`, dir);
      localStorage.setItem(`docker_dir_${projectId}`, dir);
      if (projectName) {
        localStorage.setItem(`workspace_project_name_${projectId}`, projectName);
      }
    } else {
      localStorage.removeItem(`workspace_dir_${projectId}`);
      localStorage.removeItem(`docker_dir_${projectId}`);
    }
  } catch (e) {
    console.warn("[projectWorkspaceUtils] Error saving project directory:", e);
  }
}

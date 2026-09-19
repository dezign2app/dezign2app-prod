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
 * Clears any other project's assignment to the targetPath in localStorage
 * so that the directory can be reassigned to the current project cleanly.
 */
export function clearProjectFolderConflict(
  currentProjectId: string,
  targetPath: string
): void {
  if (typeof window === "undefined" || !targetPath) return;
  const targetNorm = normalizeFolderPath(targetPath);
  if (!targetNorm) return;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("workspace_dir_")) continue;

      const otherProjectId = key.replace("workspace_dir_", "");
      if (otherProjectId === currentProjectId) continue;

      const existingPath = localStorage.getItem(key);
      if (existingPath && normalizeFolderPath(existingPath) === targetNorm) {
        keysToRemove.push(otherProjectId);
      }
    }

    keysToRemove.forEach((otherProjectId) => {
      localStorage.removeItem(`workspace_dir_${otherProjectId}`);
      localStorage.removeItem(`docker_dir_${otherProjectId}`);
      localStorage.removeItem(`workspace_project_name_${otherProjectId}`);
    });
  } catch (e) {
    console.warn("[projectWorkspaceUtils] Error clearing folder conflict:", e);
  }
}

/**
 * Deletes the local workspace folder link for a project.
 * Cleans up localStorage mapping without touching any files on disk.
 */
export function deleteProjectWorkspaceDir(projectId: string): void {
  if (!projectId || typeof window === "undefined") return;
  try {
    localStorage.removeItem(`workspace_dir_${projectId}`);
    localStorage.removeItem(`docker_dir_${projectId}`);
    localStorage.removeItem(`workspace_project_name_${projectId}`);
    localStorage.removeItem(`canvas_terminal_tab_${projectId}`);
    localStorage.removeItem(`compiler_terminal_tab_${projectId}`);
    localStorage.removeItem(`compiler_terminal_height_${projectId}`);
    localStorage.removeItem(`compiler_terminal_maximized_${projectId}`);
  } catch (e) {
    console.warn("[projectWorkspaceUtils] Error deleting project workspace link:", e);
  }
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
      clearProjectFolderConflict(projectId, dir);
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

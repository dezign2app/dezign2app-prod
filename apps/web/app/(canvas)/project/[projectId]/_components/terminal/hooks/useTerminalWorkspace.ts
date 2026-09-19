"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { getElectronAPI } from "@/lib/electron";
import {
  getProjectWorkspaceDir,
  setProjectWorkspaceDir,
  findProjectFolderConflict,
  FolderConflict,
} from "./projectWorkspaceUtils";

export function useTerminalWorkspace(projectId: string, projectName?: string) {
  // Target directory strictly scoped to current project
  const [outputDir, setOutputDir] = useState<string>(() => {
    return getProjectWorkspaceDir(projectId);
  });

  // Re-sync outputDir whenever projectId changes
  useEffect(() => {
    if (!projectId || typeof window === "undefined") {
      setOutputDir("");
      return;
    }
    const saved = getProjectWorkspaceDir(projectId);
    setOutputDir(saved);
  }, [projectId]);

  const saveWorkspaceDir = useCallback(
    (dir: string): boolean => {
      if (!projectId) return false;

      // Ensure uniqueness: check if another project is already using this directory
      if (dir) {
        const conflict = findProjectFolderConflict(projectId, dir);
        if (conflict) {
          toast.error(
            `This folder is already assigned to "${conflict.projectName}". Each project must have a unique local folder.`
          );
          return false;
        }
      }

      setProjectWorkspaceDir(projectId, dir, projectName);
      setOutputDir(dir);
      return true;
    },
    [projectId, projectName],
  );

  const handlePickDirectory = useCallback(async (): Promise<string | null> => {
    // 1. Desktop native Electron folder picker
    const api = getElectronAPI();
    if (api?.fs?.pickDirectory) {
      try {
        const selected = await api.fs.pickDirectory();
        if (selected) {
          const ok = saveWorkspaceDir(selected);
          if (ok) {
            toast.success(`Target folder: ${selected}`);
            return selected;
          }
        }
      } catch (err) {
        toast.error("Failed to select directory");
      }
      return null;
    }

    // 2. Browser File System Access API
    if (
      typeof window !== "undefined" &&
      "showDirectoryPicker" in window &&
      window.showDirectoryPicker
    ) {
      try {
        const handle = await window.showDirectoryPicker();
        if (handle && handle.name) {
          const ok = saveWorkspaceDir(handle.name);
          if (ok) {
            toast.success(`Connected to local folder: ${handle.name}`);
            return handle.name;
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          toast.error("Failed to select folder");
        }
      }
      return null;
    }

    // 3. Fallback prompt if no native API is supported
    if (typeof window !== "undefined") {
      const input = window.prompt(
        "Enter the local folder path for this project:",
        outputDir || ""
      );
      if (input && input.trim()) {
        const trimmed = input.trim();
        const ok = saveWorkspaceDir(trimmed);
        if (ok) {
          toast.success(`Target folder set to: ${trimmed}`);
          return trimmed;
        }
      }
    }

    return null;
  }, [saveWorkspaceDir, outputDir]);

  return {
    outputDir,
    setOutputDir,
    saveWorkspaceDir,
    handlePickDirectory,
  };
}


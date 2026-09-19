import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeFolderPath,
  findProjectFolderConflict,
  cleanLegacyGlobalWorkspaceDir,
  getProjectWorkspaceDir,
  setProjectWorkspaceDir,
} from "../hooks/projectWorkspaceUtils";

describe("projectWorkspaceUtils", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("normalizeFolderPath", () => {
    it("normalizes slashes, trailing slashes, and casing", () => {
      expect(normalizeFolderPath("C:\\Users\\dev\\Project1\\")).toBe(
        "c:/users/dev/project1"
      );
      expect(normalizeFolderPath("/var/www/html///")).toBe("/var/www/html");
      expect(normalizeFolderPath("  D:\\Code\\App  ")).toBe("d:/code/app");
      expect(normalizeFolderPath("")).toBe("");
    });
  });

  describe("cleanLegacyGlobalWorkspaceDir", () => {
    it("removes legacy dezign2app_workspace_dir key from localStorage", () => {
      localStorage.setItem("dezign2app_workspace_dir", "C:\\old_shared_dir");
      cleanLegacyGlobalWorkspaceDir();
      expect(localStorage.getItem("dezign2app_workspace_dir")).toBeNull();
    });
  });

  describe("getProjectWorkspaceDir & setProjectWorkspaceDir", () => {
    it("stores and retrieves directories strictly per projectId", () => {
      setProjectWorkspaceDir("proj_A", "C:\\projects\\appA", "Project A");
      setProjectWorkspaceDir("proj_B", "C:\\projects\\appB", "Project B");

      expect(getProjectWorkspaceDir("proj_A")).toBe("C:\\projects\\appA");
      expect(getProjectWorkspaceDir("proj_B")).toBe("C:\\projects\\appB");
      expect(getProjectWorkspaceDir("proj_C")).toBe("");
    });

    it("clears directory when empty string is passed", () => {
      setProjectWorkspaceDir("proj_A", "C:\\projects\\appA", "Project A");
      expect(getProjectWorkspaceDir("proj_A")).toBe("C:\\projects\\appA");

      setProjectWorkspaceDir("proj_A", "");
      expect(getProjectWorkspaceDir("proj_A")).toBe("");
    });
  });

  describe("findProjectFolderConflict", () => {
    it("returns null when directory is not used by any other project", () => {
      setProjectWorkspaceDir("proj_A", "C:\\projects\\appA", "Project A");

      const conflict = findProjectFolderConflict("proj_B", "C:\\projects\\appB");
      expect(conflict).toBeNull();
    });

    it("returns null when current project re-picks its own directory", () => {
      setProjectWorkspaceDir("proj_A", "C:\\projects\\appA", "Project A");

      const conflict = findProjectFolderConflict("proj_A", "C:\\projects\\appA");
      expect(conflict).toBeNull();
    });

    it("detects conflict when another project has already claimed the directory", () => {
      setProjectWorkspaceDir("proj_A", "C:\\projects\\appA", "Project Alpha");

      const conflict = findProjectFolderConflict(
        "proj_B",
        "c:/projects/appa/" // different casing & slash formatting
      );

      expect(conflict).not.toBeNull();
      expect(conflict?.projectId).toBe("proj_A");
      expect(conflict?.projectName).toBe("Project Alpha");
    });
  });
});

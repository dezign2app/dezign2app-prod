import { describe, it, expect } from "vitest";
import { compileMonorepo } from "../compileMonorepo";
import { BackendNode, BackendEdge } from "@/types/canvas";

describe("Real-time Monorepo Disk Sync Verification", () => {
  it("should generate clean file list with distinct package paths for disk sync", () => {
    const authServiceNode: BackendNode = {
      id: "node-auth",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Auth Service",
        port: "8080",
      },
    };

    const edgeList: BackendEdge[] = [];
    const result = compileMonorepo([authServiceNode], [], [], edgeList, [], "Store App Monorepo");

    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files.some((f) => f.filename === "package.json")).toBe(true);
    expect(result.files.some((f) => f.filename === "pnpm-workspace.yaml")).toBe(true);
    expect(result.files.some((f) => f.filename.startsWith("apps/auth-service/"))).toBe(true);

    // Verify all filenames are valid relative paths without leading slashes or Windows backslashes
    result.files.forEach((f) => {
      expect(f.filename.startsWith("/")).toBe(false);
      expect(f.filename.startsWith("\\")).toBe(false);
      expect(f.content).toBeDefined();
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { POST } from "../sync-package-json/route";
import { NextRequest } from "next/server";

describe("sync-package-json route", () => {
  let tempOutputDir: string;

  beforeEach(() => {
    tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "dezign2app-test-output-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempOutputDir)) {
      fs.rmSync(tempOutputDir, { recursive: true, force: true });
    }
  });

  it("fails with 400 when outputDir is missing or empty", async () => {
    const req = new NextRequest("http://localhost:3000/api/packages/sync-package-json", {
      method: "POST",
      body: JSON.stringify({
        action: "add",
        name: "lodash-es",
        nodeType: "transformer",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("outputDir");
  });

  it("fails with 400 when outputDir does not exist on disk", async () => {
    const nonExistentDir = path.join(tempOutputDir, "does-not-exist");
    const req = new NextRequest("http://localhost:3000/api/packages/sync-package-json", {
      method: "POST",
      body: JSON.stringify({
        action: "add",
        name: "lodash-es",
        nodeType: "transformer",
        outputDir: nonExistentDir,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("does not exist on disk");
  });

  it("strictly updates packages/transformers/package.json in outputDir for transformer nodes", async () => {
    const req = new NextRequest("http://localhost:3000/api/packages/sync-package-json", {
      method: "POST",
      body: JSON.stringify({
        action: "add",
        name: "lodash-es",
        version: "^4.17.21",
        nodeType: "transformer",
        outputDir: tempOutputDir,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    const targetPkgPath = path.join(tempOutputDir, "packages", "transformers", "package.json");
    expect(fs.existsSync(targetPkgPath)).toBe(true);
    expect(data.updatedFile).toBe(targetPkgPath);

    const parsed = JSON.parse(fs.readFileSync(targetPkgPath, "utf-8"));
    expect(parsed.name).toBe("@workspace/transformers");
    expect(parsed.dependencies["lodash-es"]).toBe("^4.17.21");

    // Also verify tsconfig.json and index.ts scaffolded in outputDir
    expect(fs.existsSync(path.join(tempOutputDir, "packages", "transformers", "tsconfig.json"))).toBe(true);
    expect(fs.existsSync(path.join(tempOutputDir, "packages", "transformers", "src", "index.ts"))).toBe(true);
  });

  it("updates and removes packages strictly in outputDir packages/transformers", async () => {
    // 1. Add package
    const addReq = new NextRequest("http://localhost:3000/api/packages/sync-package-json", {
      method: "POST",
      body: JSON.stringify({
        action: "add",
        name: "validator",
        version: "^13.11.0",
        nodeType: "transformer",
        outputDir: tempOutputDir,
      }),
    });
    await POST(addReq);

    // 2. Update version
    const updateReq = new NextRequest("http://localhost:3000/api/packages/sync-package-json", {
      method: "POST",
      body: JSON.stringify({
        action: "update",
        name: "validator",
        version: "^13.12.0",
        nodeType: "transformer",
        outputDir: tempOutputDir,
      }),
    });
    const updateRes = await POST(updateReq);
    expect(updateRes.status).toBe(200);

    const targetPkgPath = path.join(tempOutputDir, "packages", "transformers", "package.json");
    let parsed = JSON.parse(fs.readFileSync(targetPkgPath, "utf-8"));
    expect(parsed.dependencies["validator"]).toBe("^13.12.0");

    // 3. Remove package
    const removeReq = new NextRequest("http://localhost:3000/api/packages/sync-package-json", {
      method: "POST",
      body: JSON.stringify({
        action: "remove",
        name: "validator",
        nodeType: "transformer",
        outputDir: tempOutputDir,
      }),
    });
    const removeRes = await POST(removeReq);
    expect(removeRes.status).toBe(200);

    parsed = JSON.parse(fs.readFileSync(targetPkgPath, "utf-8"));
    expect(parsed.dependencies["validator"]).toBeUndefined();
  });
});

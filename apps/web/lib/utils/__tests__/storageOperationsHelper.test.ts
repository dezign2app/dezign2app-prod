import { describe, it, expect } from "vitest";
import {
  getStorageOperations,
  computeStorageOpBindings,
  syncOperationsWithAccessControl,
  getOperationAccessRestrictedReason,
  BASE_STORAGE_OPERATIONS,
  getStorageOperationExpectedArgs,
} from "../storageOperationsHelper";

describe("storageOperationsHelper", () => {
  it("returns base storage operations list", () => {
    const ops = getStorageOperations();
    expect(ops.length).toBeGreaterThanOrEqual(8);
    expect(ops.some((op) => op.name === "getUploadPresignedUrl")).toBe(true);
    expect(ops.some((op) => op.name === "getDownloadPresignedUrl")).toBe(true);
    expect(ops.some((op) => op.name === "uploadObject")).toBe(true);
    expect(ops.some((op) => op.name === "downloadObject")).toBe(true);
    expect(ops.some((op) => op.name === "deleteObject")).toBe(true);
    expect(ops.some((op) => op.name === "deleteObjects")).toBe(true);
    expect(ops.some((op) => op.name === "listObjects")).toBe(true);
    expect(ops.some((op) => op.name === "objectExists")).toBe(true);
    expect(ops.some((op) => op.name === "copyObject")).toBe(true);
  });

  it("links operations to allowedOperations in access control", () => {
    // When bucket only allows 'read'
    const readOnlyOps = getStorageOperations(null, {
      id: "b1",
      name: "public-docs",
      allowedOperations: ["read"],
    });

    const deleteOp = readOnlyOps.find((o) => o.name === "deleteObject");
    const uploadOp = readOnlyOps.find((o) => o.name === "uploadObject");
    const downloadOp = readOnlyOps.find((o) => o.name === "downloadObject");

    expect(deleteOp?.enabled).toBe(false);
    expect(uploadOp?.enabled).toBe(false);
    expect(downloadOp?.enabled).toBe(true);
  });

  it("links operations to presigned-only access policy", () => {
    const presignedOps = getStorageOperations(null, {
      id: "b2",
      name: "staging",
      accessPolicy: "presigned-only",
      allowedOperations: ["read", "write"],
    });

    const uploadPresigned = presignedOps.find((o) => o.name === "getUploadPresignedUrl");
    const directUpload = presignedOps.find((o) => o.name === "uploadObject");

    expect(uploadPresigned?.enabled).toBe(true);
    expect(directUpload?.enabled).toBe(false);
  });

  it("syncOperationsWithAccessControl synchronizes operation status", () => {
    const synced = syncOperationsWithAccessControl(
      [],
      ["read"],
      "private",
      false,
    );

    const deleteOp = synced.find((o) => o.name === "deleteObject");
    const downloadOp = synced.find((o) => o.name === "downloadObject");
    const presignedUpload = synced.find((o) => o.name === "getUploadPresignedUrl");

    expect(deleteOp?.enabled).toBe(false);
    expect(downloadOp?.enabled).toBe(true);
    expect(presignedUpload?.enabled).toBe(false);
  });

  it("computes default bindings for getUploadPresignedUrl with bucket", () => {
    const op = BASE_STORAGE_OPERATIONS.find((o) => o.name === "getUploadPresignedUrl");
    expect(op).toBeDefined();

    const bindings = computeStorageOpBindings(op, [], "my-bucket");
    expect(bindings).toHaveLength(4);

    const bucketBinding = bindings.find((b) => b.argName === "bucketName");
    expect(bucketBinding).toBeDefined();
    expect(bucketBinding?.source).toEqual({ kind: "inline", value: "my-bucket" });

    const filenameBinding = bindings.find((b) => b.argName === "filename");
    expect(filenameBinding).toBeDefined();
    expect(filenameBinding?.source).toEqual({ kind: "req_body", field: "filename" });

    const keyBinding = bindings.find((b) => b.argName === "key");
    expect(keyBinding).toBeDefined();
    expect(keyBinding?.source).toEqual({ kind: "inline", value: "" });
  });

  it("preserves existing bindings when re-computing", () => {
    const op = BASE_STORAGE_OPERATIONS.find((o) => o.name === "uploadObject");
    expect(op).toBeDefined();

    const existing = [
      {
        argName: "key",
        source: { kind: "req_params" as const, field: "customKey" },
      },
    ];

    const bindings = computeStorageOpBindings(op, existing, "avatars");
    const keyBinding = bindings.find((b) => b.argName === "key");
    expect(keyBinding?.source).toEqual({ kind: "req_params", field: "customKey" });
  });

  it("unpacks fixed options types and filename into expectedArgs for getUploadPresignedUrl", () => {
    const op = BASE_STORAGE_OPERATIONS.find((o) => o.name === "getUploadPresignedUrl");
    expect(op).toBeDefined();

    const expectedArgs = getStorageOperationExpectedArgs(op);
    const argNames = expectedArgs.map((a: any) => a.name);

    // Shows bucketName, key, filename, unpacked option fields (contentType, expiresInSeconds, acl) and options
    expect(argNames).toContain("bucketName");
    expect(argNames).toContain("key");
    expect(argNames).toContain("filename");
    expect(argNames).toContain("contentType");
    expect(argNames).toContain("expiresInSeconds");
    expect(argNames).toContain("acl");
    expect(argNames).toContain("options");
  });
});

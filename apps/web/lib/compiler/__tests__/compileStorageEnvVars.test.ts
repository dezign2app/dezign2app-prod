import { describe, it, expect } from "vitest";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { compileMonorepo } from "../compileMonorepo";
import { compileNextjsV16WebClient } from "../webClients/nextjs/v16";
import {
  generateEnvFilesForNode,
  collectEnvSections,
  getDetectedPackageEnvVars,
} from "../generators/generateEnvFile";

describe("Storage Node .env Variable Selective Import & Anti-Exposure", () => {
  const storageNode: BackendNode = {
    id: "storage-node-1",
    type: "storage",
    position: { x: 500, y: 100 },
    fractionalIndex: "a0",
    data: {
      label: "Media Storage",
      storageProvider: "s3",
      defaultRegion: "eu-west-1",
      endpointUrl: "https://s3.eu-west-1.amazonaws.com",
      accessKeyId: "AKIA_CUSTOM_KEY_123",
      secretAccessKey: "SECRET_CUSTOM_KEY_456",
      buckets: [
        { id: "bucket-avatars", name: "user-avatars" },
        { id: "bucket-docs", name: "invoices-docs" },
      ],
      envVars: [
        { id: "env-1", name: "AWS_ACCESS_KEY_ID", description: "S3 Access Key ID" },
        { id: "env-2", name: "AWS_SECRET_ACCESS_KEY", description: "S3 Secret Access Key" },
        { id: "env-3", name: "AWS_REGION", description: "S3 Region" },
        { id: "env-4", name: "S3_ENDPOINT_URL", description: "S3 Endpoint" },
      ],
    },
  };

  const storageBucketRefNode: BackendNode = {
    id: "storage-ref-1",
    type: "StorageBucketRefNode",
    position: { x: 300, y: 200 },
    fractionalIndex: "a1",
    data: {
      label: "Avatars Bucket Ref",
      storageNodeId: "storage-node-1",
      bucketId: "bucket-avatars",
      bucketName: "user-avatars",
      storageOperations: [
        { id: "upload-op", name: "uploadObject", kind: "upload" },
      ],
    },
  };

  it("detects package env variables through connected StorageBucketRefNode", () => {
    const serviceNode: BackendNode = {
      id: "srv-upload",
      type: "service",
      position: { x: 100, y: 200 },
      fractionalIndex: "a2",
      data: {
        label: "Upload Service",
        envVars: [{ id: "srv-port", name: "PORT" }],
      },
    };

    const allNodes: BackendNode[] = [serviceNode, storageBucketRefNode, storageNode];
    const allEdges: BackendEdge[] = [
      {
        id: "edge-srv-to-ref",
        source: "srv-upload",
        target: "storage-ref-1",
        type: "connection",
        fractionalIndex: "a0",
      },
      {
        id: "edge-storage-to-ref",
        source: "storage-node-1",
        target: "storage-ref-1",
        type: "storage-reference",
        fractionalIndex: "a1",
      },
    ];

    const detected = getDetectedPackageEnvVars(serviceNode, allNodes, allEdges);
    const detectedNames = detected.map((d) => d.name);

    expect(detectedNames).toContain("AWS_ACCESS_KEY_ID");
    expect(detectedNames).toContain("AWS_SECRET_ACCESS_KEY");
    expect(detectedNames).toContain("AWS_REGION");
    expect(detectedNames).toContain("S3_ENDPOINT_URL");
    expect(detectedNames).toContain("STORAGE_BUCKET_USER_AVATARS");
    expect(detectedNames).toContain("STORAGE_BUCKET_INVOICES_DOCS");

    // All detected items should cite Media Storage as the source
    expect(detected.every((d) => d.sourceNodeLabel === "Media Storage")).toBe(true);
  });

  it("does NOT expose storage keys in client .env if not explicitly imported", () => {
    const webAppNode: BackendNode = {
      id: "webapp-profile",
      type: "webApp",
      position: { x: 50, y: 50 },
      fractionalIndex: "a0",
      data: {
        label: "Profile",
        appSlug: "profile",
        envVars: [
          { id: "web-url", name: "NEXT_PUBLIC_APP_URL" },
        ],
      },
    };

    const webPageNode: BackendNode = {
      id: "page-profile",
      type: "webPage",
      position: { x: 100, y: 200 },
      fractionalIndex: "a1",
      data: {
        label: "Profile Page",
        appSlug: "profile",
      },
    };

    const allNodes: BackendNode[] = [webAppNode, webPageNode, storageBucketRefNode, storageNode];
    const allEdges: BackendEdge[] = [
      {
        id: "edge-page-to-ref",
        source: "page-profile",
        target: "storage-ref-1",
        type: "connection",
        fractionalIndex: "a0",
      },
      {
        id: "edge-storage-to-ref",
        source: "storage-node-1",
        target: "storage-ref-1",
        type: "storage-reference",
        fractionalIndex: "a1",
      },
    ];

    const result = compileNextjsV16WebClient(
      [webPageNode],
      [],
      [],
      allNodes,
      allEdges,
      "Profile Monorepo",
      [],
      "profile",
      webAppNode,
    );

    const envFile = result.files.find((f) => f.filename === ".env");
    expect(envFile).toBeDefined();

    // Sensitive keys must NOT be leaked into the web client .env
    expect(envFile!.content).not.toContain("AWS_SECRET_ACCESS_KEY");
    expect(envFile!.content).not.toContain("AWS_ACCESS_KEY_ID");
    expect(envFile!.content).not.toContain("SECRET_CUSTOM_KEY_456");
  });

  it("selectively emits ONLY imported storage variables (e.g. public bucket and region) into WebApp .env", () => {
    const webAppNode: BackendNode = {
      id: "webapp-profile",
      type: "webApp",
      position: { x: 50, y: 50 },
      fractionalIndex: "a0",
      data: {
        label: "Profile",
        appSlug: "profile",
        // User imported only bucket name and region into this web app
        envVars: [
          { id: "imp-bucket", name: "STORAGE_BUCKET_USER_AVATARS" },
          { id: "imp-reg", name: "AWS_REGION" },
        ],
      },
    };

    const webPageNode: BackendNode = {
      id: "page-profile",
      type: "webPage",
      position: { x: 100, y: 200 },
      fractionalIndex: "a1",
      data: {
        label: "Profile Page",
        appSlug: "profile",
      },
    };

    const allNodes: BackendNode[] = [webAppNode, webPageNode, storageBucketRefNode, storageNode];
    const allEdges: BackendEdge[] = [
      {
        id: "edge-page-to-ref",
        source: "page-profile",
        target: "storage-ref-1",
        type: "connection",
        fractionalIndex: "a0",
      },
      {
        id: "edge-storage-to-ref",
        source: "storage-node-1",
        target: "storage-ref-1",
        type: "storage-reference",
        fractionalIndex: "a1",
      },
    ];

    const monorepo = compileMonorepo(allNodes, [], [], allEdges, [], "ProfileProject");

    const profileEnv = monorepo.files.find((f) => f.filename === "apps/profile/.env");
    expect(profileEnv).toBeDefined();

    // Imported variables are present and resolved
    expect(profileEnv!.content).toContain("STORAGE_BUCKET_USER_AVATARS=user-avatars");
    expect(profileEnv!.content).toContain("AWS_REGION=eu-west-1");

    // Unimported secrets remain strictly omitted
    expect(profileEnv!.content).not.toContain("AWS_SECRET_ACCESS_KEY");
    expect(profileEnv!.content).not.toContain("AWS_ACCESS_KEY_ID");
    expect(profileEnv!.content).not.toContain("SECRET_CUSTOM_KEY_456");
  });

  it("emits all imported package env variables for a backend service when the user imports them", () => {
    const serviceNode: BackendNode = {
      id: "srv-upload",
      type: "service",
      position: { x: 100, y: 200 },
      fractionalIndex: "a2",
      data: {
        label: "Upload Service",
        // User imported storage credentials into this backend service
        envVars: [
          { id: "srv-port", name: "PORT" },
          { id: "srv-key", name: "AWS_ACCESS_KEY_ID" },
          { id: "srv-sec", name: "AWS_SECRET_ACCESS_KEY" },
          { id: "srv-reg", name: "AWS_REGION" },
          { id: "srv-ep", name: "S3_ENDPOINT_URL" },
          { id: "srv-bk", name: "STORAGE_BUCKET_USER_AVATARS" },
        ],
      },
    };

    const allNodes: BackendNode[] = [serviceNode, storageBucketRefNode, storageNode];
    const allEdges: BackendEdge[] = [
      {
        id: "edge-srv-to-ref",
        source: "srv-upload",
        target: "storage-ref-1",
        type: "connection",
        fractionalIndex: "a0",
      },
      {
        id: "edge-storage-to-ref",
        source: "storage-node-1",
        target: "storage-ref-1",
        type: "storage-reference",
        fractionalIndex: "a1",
      },
    ];

    const sections = collectEnvSections(serviceNode, allNodes, allEdges);
    const storageSection = sections.find((s) => s.heading.includes("Storage"));
    expect(storageSection).toBeDefined();

    const { env, envExample } = generateEnvFilesForNode(serviceNode, allNodes, allEdges);

    expect(env).toContain("AWS_ACCESS_KEY_ID=AKIA_CUSTOM_KEY_123");
    expect(env).toContain("AWS_SECRET_ACCESS_KEY=SECRET_CUSTOM_KEY_456");
    expect(env).toContain("AWS_REGION=eu-west-1");
    expect(env).toContain("S3_ENDPOINT_URL=https://s3.eu-west-1.amazonaws.com");
    expect(env).toContain("STORAGE_BUCKET_USER_AVATARS=user-avatars");

    // Unimported bucket is NOT included
    expect(env).not.toContain("STORAGE_BUCKET_INVOICES_DOCS");

    // Example file uses placeholders
    expect(envExample).toContain("AWS_ACCESS_KEY_ID=<AKIA_CUSTOM_KEY_123>");
    expect(envExample).toContain("AWS_SECRET_ACCESS_KEY=<SECRET_CUSTOM_KEY_456>");
  });
});

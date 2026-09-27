import { describe, it, expect } from "vitest";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { compileMonorepo } from "../compileMonorepo";
import { compileNextjsV16WebClient } from "../webClients/nextjs/v16";
import { generateEnvFilesForNode, collectEnvSections } from "../generators/generateEnvFile";

describe("Storage Node .env Variable Propagation via StorageBucketRefNode", () => {
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
        { name: "AWS_ACCESS_KEY_ID", description: "S3 Access Key ID" },
        { name: "AWS_SECRET_ACCESS_KEY", description: "S3 Secret Access Key" },
        { name: "AWS_REGION", description: "S3 Region" },
        { name: "S3_ENDPOINT_URL", description: "S3 Endpoint" },
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
        { id: "upload-op", name: "uploadObject", kind: "write" },
      ],
    },
  };

  it("resolves storage env variables for a ServiceNode connected via StorageBucketRefNode", () => {
    const serviceNode: BackendNode = {
      id: "srv-upload",
      type: "service",
      position: { x: 100, y: 200 },
      fractionalIndex: "a2",
      data: {
        label: "Upload Service",
        envVars: [
          { name: "PORT", exampleValue: "3000" },
        ],
      },
    };

    const allNodes: BackendNode[] = [serviceNode, storageBucketRefNode, storageNode];
    const allEdges: BackendEdge[] = [
      // Service is connected to StorageBucketRefNode (NOT directly to storageNode!)
      {
        id: "edge-srv-to-ref",
        source: "srv-upload",
        target: "storage-ref-1",
        type: "connection",
        fractionalIndex: "a0",
      },
      // Invisible reference edge between StorageNode and StorageBucketRefNode
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

    // Verify .env content
    expect(env).toContain("AWS_ACCESS_KEY_ID=AKIA_CUSTOM_KEY_123");
    expect(env).toContain("AWS_SECRET_ACCESS_KEY=SECRET_CUSTOM_KEY_456");
    expect(env).toContain("AWS_REGION=eu-west-1");
    expect(env).toContain("S3_ENDPOINT_URL=https://s3.eu-west-1.amazonaws.com");
    expect(env).toContain("STORAGE_BUCKET_USER_AVATARS=user-avatars");
    expect(env).toContain("STORAGE_BUCKET_INVOICES_DOCS=invoices-docs");

    // Verify .env.example content
    expect(envExample).toContain("AWS_ACCESS_KEY_ID=<AKIA_CUSTOM_KEY_123>");
    expect(envExample).toContain("AWS_SECRET_ACCESS_KEY=<SECRET_CUSTOM_KEY_456>");
    expect(envExample).toContain("STORAGE_BUCKET_USER_AVATARS=<user-avatars>");
  });

  it("generates storage env variables in compileNextjsV16WebClient for a WebApp with WebPage connected to StorageBucketRefNode", () => {
    const webAppNode: BackendNode = {
      id: "webapp-profile",
      type: "webApp",
      position: { x: 50, y: 50 },
      fractionalIndex: "a0",
      data: {
        label: "Profile",
        appSlug: "profile",
      },
    };

    const webPageNode: BackendNode = {
      id: "page-profile",
      type: "webPage",
      position: { x: 100, y: 200 },
      fractionalIndex: "a1",
      data: {
        label: "Profile Page",
        routePath: "/profile",
        connectedStorageNodeId: "storage-node-1",
        uploadBucketId: "user-avatars",
      },
    };

    const allNodes: BackendNode[] = [webAppNode, webPageNode, storageBucketRefNode, storageNode];
    const allEdges: BackendEdge[] = [
      // WebPage connected to StorageBucketRefNode
      {
        id: "edge-page-to-ref",
        source: "page-profile",
        target: "storage-ref-1",
        type: "connection",
        fractionalIndex: "a0",
      },
      // Invisible reference edge between StorageNode and StorageBucketRefNode
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
    expect(envFile!.content).toContain("AWS_ACCESS_KEY_ID=AKIA_CUSTOM_KEY_123");
    expect(envFile!.content).toContain("AWS_SECRET_ACCESS_KEY=SECRET_CUSTOM_KEY_456");
    expect(envFile!.content).toContain("AWS_REGION=eu-west-1");
    expect(envFile!.content).toContain("S3_ENDPOINT_URL=https://s3.eu-west-1.amazonaws.com");
    expect(envFile!.content).toContain("STORAGE_BUCKET_USER_AVATARS=user-avatars");
    expect(envFile!.content).toContain("STORAGE_BUCKET_INVOICES_DOCS=invoices-docs");

    const envExFile = result.files.find((f) => f.filename === ".env.example");
    expect(envExFile).toBeDefined();
    expect(envExFile!.content).toContain("AWS_ACCESS_KEY_ID=<AKIA_CUSTOM_KEY_123>");
    expect(envExFile!.content).toContain("AWS_SECRET_ACCESS_KEY=<SECRET_CUSTOM_KEY_456>");
  });

  it("includes storage .env in full compileMonorepo output for apps/profile", () => {
    const webAppNode: BackendNode = {
      id: "webapp-profile",
      type: "webApp",
      position: { x: 50, y: 50 },
      fractionalIndex: "a0",
      data: {
        label: "Profile",
        appSlug: "profile",
      },
    };

    const webPageNode: BackendNode = {
      id: "page-profile",
      type: "webPage",
      position: { x: 100, y: 200 },
      fractionalIndex: "a1",
      data: {
        label: "Profile Page",
        routePath: "/",
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
    expect(profileEnv!.content).toContain("AWS_ACCESS_KEY_ID=AKIA_CUSTOM_KEY_123");
    expect(profileEnv!.content).toContain("AWS_SECRET_ACCESS_KEY=SECRET_CUSTOM_KEY_456");
    expect(profileEnv!.content).toContain("AWS_REGION=eu-west-1");
    expect(profileEnv!.content).toContain("STORAGE_BUCKET_USER_AVATARS=user-avatars");
  });
});

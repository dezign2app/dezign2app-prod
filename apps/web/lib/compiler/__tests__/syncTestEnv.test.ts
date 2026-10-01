import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { generateStorageOperationsFile } from "../storage/generators/operations";
import { generateStorageConfigFile } from "../storage/generators/config";
import { generateStorageClientFile } from "../storage/generators/client";
import { generateStoragePackageJson, generateStorageTsConfig } from "../storage/generators/packageFiles";
import { generateStorageUploadEventTemplate } from "../webClients/nextjs/v16/event-generators/templates/storageUploadEventTemplate";
import { generateNavigationEventTemplate } from "../webClients/nextjs/v16/event-generators/templates/navigationEventTemplate";
import { generateTypeDefinitions } from "../webClients/nextjs/v16/event-generators/generateTypeDefinitions";
import { resolveEventParameters } from "../webClients/nextjs/v16/event-generators/resolveEventParameters";
import { generateSectionComponent } from "../webClients/nextjs/v16/sectionGenerators";
import { generatePageCode } from "../webClients/nextjs/v16/pageGenerators";
import { generateEndpointRouteHandler } from "../generators/routeGenerator";
import { generateServiceRouteTypes } from "../generators/typesGenerator/serviceRoutesGenerator";
import { generateConfigFiles } from "../generators/configGenerator";
import { BackendNode, Endpoint } from "@workspace/canvas/types";
import { compilePostgresDatabase } from "../databases/postgres";
import { LANGGRAPH_POSTGRES_TABLE_DEFINITIONS } from "../../../app/(canvas)/project/[projectId]/_components/backend-nodes/graph-nodes/langgraph/langgraph-canvas/utils/checkpointerTables";
import { generateEventComponent } from "../webClients/nextjs/v16/eventGenerators";

const TEST_ENV_DIR = "C:/Users/subha/Downloads/test env";

describe("syncTestEnv via Compiler", () => {
  it("compiles and verifies storage operations, express service, and nextjs web client", () => {
    // 1. Generate Storage Package Files
    const dummyStorageNode: BackendNode = {
      id: "storage-node",
      type: "storage",
      position: { x: 300, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "aws s3",
        storageProvider: "s3",
        defaultRegion: "us-east-1",
        endpointUrl: "S3_ENDPOINT_URL",
        forcePathStyle: true,
      },
    };
    const opsCompiled = generateStorageOperationsFile(dummyStorageNode);
    expect(opsCompiled.content).not.toContain("as any");
    expect(opsCompiled.content).not.toContain("catch (err: any)");
    expect(opsCompiled.content).not.toContain("replace(/^/+/,");
    expect(opsCompiled.content).not.toContain("replace(//+$,");

    const targetOpsPath = path.join(TEST_ENV_DIR, "packages/storage/aws-s3/src/operations.ts");
    if (fs.existsSync(path.dirname(targetOpsPath))) {
      fs.writeFileSync(targetOpsPath, opsCompiled.content, "utf-8");
      console.log("Updated via compiler:", targetOpsPath);
    }

    const configCompiled = generateStorageConfigFile(dummyStorageNode);
    expect(configCompiled.content).toContain("resolveStorageEndpoint");
    const targetConfigPath = path.join(TEST_ENV_DIR, "packages/storage/aws-s3/src/config.ts");
    if (fs.existsSync(path.dirname(targetConfigPath))) {
      fs.writeFileSync(targetConfigPath, configCompiled.content, "utf-8");
      console.log("Updated via compiler:", targetConfigPath);
    }

    const clientCompiled = generateStorageClientFile(dummyStorageNode);
    expect(clientCompiled.content).toContain("new S3Client");
    const targetClientPath = path.join(TEST_ENV_DIR, "packages/storage/aws-s3/src/client.ts");
    if (fs.existsSync(path.dirname(targetClientPath))) {
      fs.writeFileSync(targetClientPath, clientCompiled.content, "utf-8");
      console.log("Updated via compiler:", targetClientPath);
    }

    const pkgJsonCompiled = generateStoragePackageJson("@workspace/storage", "aws s3");
    const targetPkgJsonPath = path.join(TEST_ENV_DIR, "packages/storage/aws-s3/package.json");
    if (fs.existsSync(path.dirname(targetPkgJsonPath))) {
      fs.writeFileSync(targetPkgJsonPath, pkgJsonCompiled.content, "utf-8");
      console.log("Updated via compiler:", targetPkgJsonPath);
    }

    const tsConfigCompiled = generateStorageTsConfig();
    const targetTsConfigPath = path.join(TEST_ENV_DIR, "packages/storage/aws-s3/tsconfig.json");
    if (fs.existsSync(path.dirname(targetTsConfigPath))) {
      fs.writeFileSync(targetTsConfigPath, tsConfigCompiled.content, "utf-8");
      console.log("Updated via compiler:", targetTsConfigPath);
    }

    // 2. Generate Express Profile Route Handler for POST /upload-image
    const ep: Endpoint & { nodeId: string } = {
      id: "ep-upload-image",
      nodeId: "service-profile",
      name: "/upload-image",
      type: "POST",
      pipelineSteps: [
        {
          id: "step-storage-1",
          name: "Get Upload Presigned URL",
          type: "storage_operation",
          enabled: true,
          outputVariable: "uploadUrl",
          functionRef: {
            name: "getUploadPresignedUrl",
            importPath: "@workspace/aws-s3/operations",
            signature: "getUploadPresignedUrl(bucketName: string, key: string, options?: PresignedUrlOptions): Promise<string>",
          },
          inputBindings: [
            { argName: "bucketName", source: { kind: "env", field: "STORAGE_BUCKET_TEST" } },
            { argName: "key", source: { kind: "req_body", field: "filename" } },
            { argName: "options", source: { kind: "inline", value: "{}" } },
          ],
        },
        {
          id: "step-ret",
          name: "Return Response",
          type: "return_response",
          enabled: true,
          statusCode: 201,
          inputBindings: [
            {
              argName: "field_1",
              source: { kind: "step_output", stepId: "step-storage-1", field: "uploadUrl" },
            },
          ],
        },
      ],
    };

    const dummyServiceNode: BackendNode = {
      id: "service-profile",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: { label: "profile" },
    };

    const routeCompiled = generateEndpointRouteHandler({
      ep,
      index: 0,
      serviceName: "profile",
      pascalServiceName: "Profile",
      serviceFolderName: "profile",
      serviceNode: dummyServiceNode,
      allNodes: [dummyServiceNode, dummyStorageNode],
      allEdges: [],
      allEndpoints: [ep],
      dbFunctions: [],
      kafkaFunctions: [],
      redisFunctions: [],
      storageFunctions: [],
      nodePublishedEvents: [],
      usedFileNames: new Set(),
    });

    expect(routeCompiled.file.content).toContain('import { getUploadPresignedUrl } from "@workspace/storage/operations";');
    expect(routeCompiled.file.content).not.toContain("@workspace/aws-s3");
    expect(routeCompiled.file.content).toContain("if (!process.env.STORAGE_BUCKET_TEST) {");
    expect(routeCompiled.file.content).not.toContain("AWS_SECRET_ACCESS_KEY");
    expect(routeCompiled.file.content).toContain('await getUploadPresignedUrl(process.env.STORAGE_BUCKET_TEST, String(body.filename || ""), {});');
    expect(routeCompiled.file.content).not.toContain("uploadUrl.uploadUrl");
    expect(routeCompiled.file.content).toContain("field_1: uploadUrl");

    const targetRoutePath = path.join(TEST_ENV_DIR, "apps/profile/src/routes/postUploadImage.ts");
    if (fs.existsSync(path.dirname(targetRoutePath))) {
      fs.writeFileSync(targetRoutePath, routeCompiled.file.content, "utf-8");
      console.log("Updated via compiler:", targetRoutePath);
    }

    const healthEp: Endpoint & { nodeId: string } = {
      id: "ep-health",
      nodeId: "service-profile",
      name: "/health",
      type: "GET",
      summary: "Health check",
    };

    const simpleChatEp: Endpoint & { nodeId: string } = {
      id: "ep-simple-chat",
      nodeId: "service-profile",
      name: "/simple-chat",
      type: "POST",
      requestBody: {
        id: "schema-simple-chat",
        fields: [{ id: "field-message", name: "message", type: "string", required: true }],
      },
      pipelineSteps: [
        {
          id: "step-chat-1",
          name: "chat",
          type: "langgraph_invoke",
          enabled: true,
          outputVariable: "chatResult",
        },
        {
          id: "step-ret",
          name: "Return Response",
          type: "return_response",
          enabled: true,
          statusCode: 201,
        },
      ],
    };

    const typesRes = generateServiceRouteTypes([dummyServiceNode], [ep, healthEp, simpleChatEp]);
    for (const f of typesRes.files) {
      const targetTypePath = path.join(TEST_ENV_DIR, "packages/types", f.filename);
      if (fs.existsSync(path.dirname(targetTypePath))) {
        fs.writeFileSync(targetTypePath, f.content, "utf-8");
        console.log("Updated via compiler:", targetTypePath);
      }
    }

    const profileConfigs = generateConfigFiles(
      dummyServiceNode,
      "profile",
      "Profile",
      "8080",
      true,
      [ep, healthEp, simpleChatEp],
      [],
      [dummyServiceNode, dummyStorageNode],
      [{ id: "e-srv-storage", source: dummyServiceNode.id, target: dummyStorageNode.id } as any],
    );
    const pkgFile = profileConfigs.find((f) => f.filename === "package.json");
    if (pkgFile) {
      const targetPkg = path.join(TEST_ENV_DIR, "apps/profile/package.json");
      if (fs.existsSync(path.dirname(targetPkg))) {
        const existing = JSON.parse(fs.readFileSync(targetPkg, "utf-8"));
        const generated = JSON.parse(pkgFile.content);
        const mergedDeps = {
          ...existing.dependencies,
          ...generated.dependencies,
          "@workspace/storage": "workspace:*",
        };
        fs.writeFileSync(targetPkg, JSON.stringify({ ...existing, dependencies: mergedDeps }, null, 2), "utf-8");
        console.log("Updated via compiler:", targetPkg);
      }
    }

    // 3. Generate Next.js UploadImageAction component
    const resolvedParams = resolveEventParameters({
      url: "",
      method: "POST",
    });
    const typeDefs = generateTypeDefinitions("UploadImageAction", resolvedParams);

    const uploadActionCode = generateStorageUploadEventTemplate({
      componentName: "UploadImageAction",
      eventName: "upload image",
      eventType: "click",
      url: "",
      upperMethod: "POST",
      requireAuth: false,
      typeDefs,
      storageConfig: {
        maxSizeMb: 10,
        acceptedMimeTypes: "",
        showPreview: false,
      },
    });

    expect(uploadActionCode).toContain('const ACCEPTED_TYPES: string = "";');
    expect(uploadActionCode).not.toContain("as any");
    expect(uploadActionCode).not.toContain("requestBody?: never");
    expect(uploadActionCode).not.toContain("Promise<any>");

    const targetActionPath = path.join(TEST_ENV_DIR, "apps/web/app/(public)/not-found/_components/navigation/UploadImageAction.tsx");
    if (fs.existsSync(path.dirname(targetActionPath))) {
      fs.writeFileSync(targetActionPath, uploadActionCode, "utf-8");
      console.log("Updated via compiler:", targetActionPath);
    }

    // 4. Generate Next.js NavigationSection component
    const navSectionCode = generateSectionComponent(
      {
        id: "sec-nav",
        name: "Navigation",
        actions: [],
      },
      "NavigationSection",
      [
        {
          componentName: "BackToHomeAction",
          eventName: "Back to Home",
          eventType: "navigateToPage",
          url: "/",
          method: "GET",
          targetRoute: "/",
        },
        {
          componentName: "UploadImageAction",
          eventName: "upload image",
          eventType: "custom",
          url: "/upload-image",
          method: "POST",
        },
      ],
    );

    expect(navSectionCode).not.toContain("requestBody?: unknown");

    const targetNavPath = path.join(TEST_ENV_DIR, "apps/web/app/(public)/not-found/_components/navigation/NavigationSection.tsx");
    if (fs.existsSync(path.dirname(targetNavPath))) {
      fs.writeFileSync(targetNavPath, navSectionCode, "utf-8");
      console.log("Updated via compiler:", targetNavPath);
    }

    // 5. Generate Next.js BackToHomeAction component
    const backToHomeCode = generateNavigationEventTemplate("BackToHomeAction", "Back to Home", "/");
    expect(backToHomeCode).not.toContain("requestBody?: unknown");

    const targetBackPath = path.join(TEST_ENV_DIR, "apps/web/app/(public)/not-found/_components/navigation/BackToHomeAction.tsx");
    if (fs.existsSync(path.dirname(targetBackPath))) {
      fs.writeFileSync(targetBackPath, backToHomeCode, "utf-8");
      console.log("Updated via compiler:", targetBackPath);
    }

    // 6. Generate Next.js NotFound page component
    const notFoundPageCode = generatePageCode(
      {
        nodeId: "page-not-found",
        label: "/not-found",
        slug: "not-found",
        routePath: "/not-found",
        componentName: "NotFoundPage",
        isRoot: false,
      },
      "",
      [
        {
          id: "sec-nav",
          name: "Navigation",
          folderName: "navigation",
          componentName: "NavigationSection",
          actions: [
            {
              componentName: "BackToHomeAction",
              eventName: "Back to Home",
              eventType: "navigateToPage",
              url: "/",
              method: "GET",
              targetRoute: "/",
            },
            {
              componentName: "UploadImageAction",
              eventName: "upload image",
              eventType: "custom",
              url: "/upload-image",
              method: "POST",
            },
          ],
        },
      ],
    );

    expect(notFoundPageCode).toContain("handleTriggerAction");
    expect(notFoundPageCode).toContain("executeApiAction");
    expect(notFoundPageCode).toContain("onTrigger={handleTriggerAction}");

    const targetNotFoundPagePath = path.join(TEST_ENV_DIR, "apps/web/app/(public)/not-found/page.tsx");
    if (fs.existsSync(path.dirname(targetNotFoundPagePath))) {
      fs.writeFileSync(targetNotFoundPagePath, notFoundPageCode, "utf-8");
      console.log("Updated via compiler:", targetNotFoundPagePath);
    }

    // 7. Generate and Sync Database Package (packages/db/primary-sqlite-db)
    const userEntity: BackendNode = {
      id: "ent-user",
      type: "entity",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "user",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "name", type: "string" },
          { name: "test", type: "string" },
        ],
      },
    };

    const lgEntities: BackendNode[] = LANGGRAPH_POSTGRES_TABLE_DEFINITIONS.map(
      (def, idx) => ({
        id: `ent-lg-${idx}`,
        type: "entity",
        position: { x: 100 * idx, y: 100 * idx },
        fractionalIndex: `b${idx}`,
        data: {
          label: def.name,
          columns: def.columns.map((c) => ({
            name: c.name,
            type: c.type,
            isPrimaryKey: Boolean(c.isPrimaryKey),
            isNotNull: Boolean(c.isNotNull),
          })),
          indexes: def.indexes || [],
        },
      }),
    );

    const compiledDb = compilePostgresDatabase([userEntity, ...lgEntities], [], {
      packageName: "@workspace/db-primary-sqlite-db",
    });

    for (const f of compiledDb.files) {
      const targetPath = path.join(TEST_ENV_DIR, "packages/db/primary-sqlite-db", f.filename);
      if (fs.existsSync(path.dirname(targetPath))) {
        fs.writeFileSync(targetPath, f.content, "utf-8");
        console.log("Updated via compiler:", targetPath);
      }
    }

    // 8. Generate and Sync SendMessageAction and MainSection for profile

    const sendMsgActionCode = generateEventComponent(
      "send message",
      "click",
      "http://localhost:8080/simple-chat",
      "POST",
      "SendMessageAction",
      undefined,
      undefined,
      false,
      undefined,
      undefined,
      { fields: [{ name: "message", type: "string", required: true }] },
      { id: "act-send-message", name: "send message", event: "click" },
      simpleChatEp,
      "profile",
      undefined,
    );

    const targetSendMsgPath = path.join(
      TEST_ENV_DIR,
      "apps/web/app/(public)/profile/_components/main-section/SendMessageAction.tsx",
    );
    if (fs.existsSync(path.dirname(targetSendMsgPath))) {
      fs.writeFileSync(targetSendMsgPath, sendMsgActionCode, "utf-8");
      console.log("Updated via compiler:", targetSendMsgPath);
    }

    const mainSecCode = generateSectionComponent(
      {
        id: "sec-main",
        name: "Main Section",
        actions: [],
      },
      "MainSection",
      [
        {
          componentName: "SendMessageAction",
          eventName: "send message",
          eventType: "click",
          url: "http://localhost:8080/simple-chat",
          method: "POST",
          endpoint: simpleChatEp,
        },
      ],
    );

    const targetMainSecPath = path.join(
      TEST_ENV_DIR,
      "apps/web/app/(public)/profile/_components/main-section/MainSection.tsx",
    );
    if (fs.existsSync(path.dirname(targetMainSecPath))) {
      fs.writeFileSync(targetMainSecPath, mainSecCode, "utf-8");
      console.log("Updated via compiler:", targetMainSecPath);
    }
  });
});

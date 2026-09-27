import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { generateStorageOperationsFile } from "../storage/generators/operations";
import { generateStoragePackageJson, generateStorageTsConfig } from "../storage/generators/packageFiles";
import { generateStorageUploadEventTemplate } from "../webClients/nextjs/v16/event-generators/templates/storageUploadEventTemplate";
import { generateNavigationEventTemplate } from "../webClients/nextjs/v16/event-generators/templates/navigationEventTemplate";
import { generateTypeDefinitions } from "../webClients/nextjs/v16/event-generators/generateTypeDefinitions";
import { resolveEventParameters } from "../webClients/nextjs/v16/event-generators/resolveEventParameters";
import { generateSectionComponent } from "../webClients/nextjs/v16/sectionGenerators";
import { generateEndpointRouteHandler } from "../generators/routeGenerator";
import { BackendNode, Endpoint } from "@workspace/canvas/types";

const TEST_ENV_DIR = "C:/Users/subha/Downloads/test env";

describe("syncTestEnv via Compiler", () => {
  it("compiles and verifies storage operations, express service, and nextjs web client", () => {
    // 1. Generate Storage Package Files
    const dummyStorageNode = { id: "storage-node", type: "storage", data: { label: "aws s3" } } as BackendNode;
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
            { argName: "bucketName", source: { kind: "inline", value: "test" } },
            { argName: "key", source: { kind: "req_body", field: "filename" } },
            { argName: "options", source: { kind: "inline", value: "{}" } },
          ],
        },
      ],
    };

    const dummyServiceNode = {
      id: "service-profile",
      type: "service",
      data: { label: "profile" },
    } as BackendNode;

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
    expect(routeCompiled.file.content).toContain('await getUploadPresignedUrl("test", String(body.filename || ""), {});');
    expect(routeCompiled.file.content).toContain('return res.status(201).json({ data: { signedUrl: uploadUrl } });');

    const targetRoutePath = path.join(TEST_ENV_DIR, "apps/profile/src/routes/postUploadImage.ts");
    if (fs.existsSync(path.dirname(targetRoutePath))) {
      fs.writeFileSync(targetRoutePath, routeCompiled.file.content, "utf-8");
      console.log("Updated via compiler:", targetRoutePath);
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
  });
});

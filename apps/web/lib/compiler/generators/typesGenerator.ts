import { BackendNode } from "@/types/canvas";
import { Endpoint, AnyMessagingResource } from "@workspace/canvas/types";
import { CompiledFile } from "@workspace/canvas/types";
import { toVarName, toPascalCase, deriveRouteFileName } from "../utils";
import {
  ParameterItem,
  SchemaItem,
  parametersToTsInterface,
  parametersToZodSchema,
  schemaToTsInterface,
  schemaToZodSchema,
} from "./schemaToTypeScript";

export interface ResponseFieldItem extends ParameterItem {
  selectedColumns?: string[];
}

function generateResponseInterface(
  interfaceName: string,
  responseFields: ResponseFieldItem[] = [],
  legacyResponseBody?: SchemaItem,
  nodes: BackendNode[] = [],
  ep?: Endpoint,
): { code: string; dbImports: Set<string> } {
  const dbImports = new Set<string>();

  // Resolve target DB entity type if endpoint is associated with database operations
  let dbEntityName: string | null = null;
  if (ep) {
    const targetDbIds = [
      ...(ep.databaseNodeIds || []),
      ...(ep.databaseNodeId && ep.databaseNodeId !== "none" ? [ep.databaseNodeId] : []),
      ...Object.keys(ep.crudOperations || {}),
    ];
    if (targetDbIds.length > 0) {
      const targetTable = nodes.find((n) => targetDbIds.includes(n.id));
      if (targetTable) {
        const rawTableName = targetTable.data?.label || targetTable.data?.tableRef || "Entity";
        const pascal = toPascalCase(rawTableName);
        if (pascal) {
          dbEntityName = pascal;
          dbImports.add(pascal);
        }
      }
    }
  }

  const defaultDataType = dbEntityName
    ? (ep?.type === "POST" ? dbEntityName : `${dbEntityName} | ${dbEntityName}[]`)
    : "Record<string, string | number | boolean | null>";

  if (!responseFields || responseFields.length === 0) {
    const legacy = schemaToTsInterface(interfaceName, legacyResponseBody);
    if (legacy.hasContent) {
      if (
        legacy.code.includes(`export interface ${interfaceName}`) &&
        !legacy.code.includes("data:") &&
        !legacy.code.includes("data?:")
      ) {
        const lastBraceIndex = legacy.code.lastIndexOf("}");
        if (lastBraceIndex !== -1) {
          const augmentedCode =
            legacy.code.slice(0, lastBraceIndex) +
            `  data?: ${defaultDataType};\n` +
            legacy.code.slice(lastBraceIndex);
          return { code: augmentedCode, dbImports };
        }
      }
      return { code: legacy.code, dbImports };
    }
    return {
      code: `export interface ${interfaceName} {\n  status: number;\n  message: string;\n  data?: ${defaultDataType};\n}\n`,
      dbImports,
    };
  }

  const props: string[] = [];

  for (const field of responseFields) {
    const isRequired = field.required !== false;
    const propName = field.name || "field";
    let tsType = "string";

    if (field.type && field.type.startsWith("db:")) {
      const parts = field.type.split(":");
      const tableNodeId = parts[1];
      const category = parts[2] || "single";
      const tableNode = nodes.find((n) => n.id === tableNodeId);
      const rawTableName =
        tableNode?.data?.label || tableNode?.data?.tableRef || "Entity";
      const pascalEntity = toPascalCase(rawTableName);

      dbImports.add(pascalEntity);

      const cols: string[] = field.selectedColumns || [];
      const hasPick = category.startsWith("partial") && cols.length > 0;
      const pickUnion = hasPick ? cols.map((c) => `"${c}"`).join(" | ") : "";

      if (category === "single") {
        tsType = pascalEntity;
      } else if (category === "array") {
        tsType = `${pascalEntity}[]`;
      } else if (category === "partial_single") {
        tsType = hasPick ? `Pick<${pascalEntity}, ${pickUnion}>` : pascalEntity;
      } else if (category === "partial_array") {
        tsType = hasPick ? `Pick<${pascalEntity}, ${pickUnion}>[]` : `${pascalEntity}[]`;
      }
    } else {
      switch (field.type) {
        case "string":
        case "UUID":
        case "timestamp":
          tsType = "string";
          break;
        case "number":
          tsType = "number";
          break;
        case "boolean":
          tsType = "boolean";
          break;
        case "object":
          tsType = "Record<string, string | number | boolean | null>";
          break;
        case "array":
          tsType = "string[]";
          break;
        default:
          tsType = "string";
      }
    }

    props.push(`  ${propName}${isRequired ? "" : "?"}: ${tsType};`);
  }

  const code = `export interface ${interfaceName} {\n${props.join("\n")}\n}\n`;
  return { code, dbImports };
}

export function generateTypesPackage(
  nodes: BackendNode[],
  endpoints: (Endpoint & { nodeId: string })[] = [],
  events: (AnyMessagingResource & {
    nodeId: string;
    variant: "publish" | "consume";
  })[] = [],
  servicesInfo?: { id: string; name: string; folderName: string }[],
): CompiledFile[] {
  const files: CompiledFile[] = [];
  const barrelExports: string[] = [];

  const hasDb = nodes.some(
    (n) => n.type === "database" || n.type === "entity" || n.type === "db_ref" || n.type === "auth",
  );

  // 1. package.json
  const packageJson = JSON.stringify(
    {
      name: "@workspace/types",
      version: "0.0.0",
      private: true,
      description:
        "Shared TypeScript interfaces and Zod schemas across microservices and frontend clients",
      main: "src/index.ts",
      types: "src/index.ts",
      scripts: {
        build: "tsc",
        "check-types": "tsc --noEmit",
      },
      dependencies: {
        zod: "^3.24.2",
      },
      devDependencies: {
        ...(hasDb ? { "@workspace/db": "workspace:*" } : {}),
        "@workspace/typescript-config": "workspace:*",
        typescript: "^5.3.3",
      },
    },
    null,
    2,
  );
  files.push({
    filename: "package.json",
    language: "json",
    content: packageJson,
  });

  // 2. tsconfig.json
  const tsconfig = JSON.stringify(
    {
      extends: "@workspace/typescript-config/base.json",
      compilerOptions: {
        outDir: "./dist",
        rootDir: "./src",
      },
      include: ["src/**/*"],
    },
    null,
    2,
  );
  files.push({
    filename: "tsconfig.json",
    language: "json",
    content: tsconfig,
  });

  // 3. Service Folders: src/<serviceFolderName>/<routeFileName>.ts
  const endpointNodes = nodes.filter(
    (n) =>
      n.type === "service" ||
      n.type === "api_gateway" ||
      n.type === "serverless" ||
      Boolean(n.data && (n.data.endpoints || n.data.routeGroups)),
  );

  const processedServiceFolders = new Set<string>();

  endpointNodes.forEach((serviceNode) => {
    const srvInfo = servicesInfo?.find((s) => s.id === serviceNode.id);
    const rawServiceName =
      srvInfo?.name || serviceNode.data?.label || serviceNode.id || "Service";
    const folderBase = srvInfo?.folderName || rawServiceName;
    let serviceFolderName = toVarName(folderBase) || "service";
    let pascalServiceName = toPascalCase(folderBase);

    let dupCount = 1;
    const baseFolderName = serviceFolderName;
    const basePascalName = pascalServiceName;
    while (processedServiceFolders.has(serviceFolderName)) {
      dupCount += 1;
      serviceFolderName = `${baseFolderName}_${dupCount}`;
      pascalServiceName = `${basePascalName}${dupCount}`;
    }
    processedServiceFolders.add(serviceFolderName);

    // Gather all endpoints for this node
    let nodeEndpoints = endpoints.filter(
      (e) =>
        e.nodeId === serviceNode.id ||
        (e.nodeId &&
          ((serviceNode.data?.label && e.nodeId === serviceNode.data.label) ||
            (serviceNode.data?.label && e.nodeId === serviceNode.data.label.toLowerCase()))),
    );
    if (nodeEndpoints.length === 0 && serviceNode.data?.endpoints) {
      nodeEndpoints = serviceNode.data.endpoints.map((ep) => ({
        ...ep,
        nodeId: serviceNode.id,
      }));
    }
    if (serviceNode.data?.routeGroups) {
      for (const group of serviceNode.data.routeGroups) {
        if (group.endpoints) {
          const groupEndpoints = group.endpoints.map((ep) => ({
            ...ep,
            nodeId: serviceNode.id,
          }));
          nodeEndpoints = [...nodeEndpoints, ...groupEndpoints];
        }
      }
    }

    if (nodeEndpoints.length > 0) {
      const routeFileExports: string[] = [];
      const usedFileNames = new Set<string>();

      nodeEndpoints.forEach((ep, index) => {
        const method = (ep.type || "GET").toLowerCase();
        let routeFileName = deriveRouteFileName(ep, index, rawServiceName);

        if (usedFileNames.has(routeFileName)) {
          routeFileName = `${routeFileName}_${index + 1}`;
        }
        usedFileNames.add(routeFileName);

        // Disambiguate type names with PascalCase Service Name to prevent TS2308 collisions across modules
        const pascalName = `${pascalServiceName}${toPascalCase(routeFileName)}`;
        const schemaVarPrefix = `${serviceFolderName}${toPascalCase(routeFileName)}`;
        const isBodyMethod = ["post", "put", "patch"].includes(method);

        const paramsTypeRes = parametersToTsInterface(
          `${pascalName}Params`,
          ep.pathParams,
          true,
        );
        const queryTypeRes = parametersToTsInterface(
          `${pascalName}Query`,
          ep.queryParams,
          false,
        );
        const bodyTypeRes = schemaToTsInterface(
          `${pascalName}Body`,
          ep.requestBody,
        );
        const responseResInfo = generateResponseInterface(
          `${pascalName}Response`,
          ep.responseFields,
          ep.responseBody,
          nodes,
          ep,
        );

        const queryZodRes = parametersToZodSchema(
          `${schemaVarPrefix}QuerySchema`,
          ep.queryParams,
          false,
        );
        const bodyZodRes = schemaToZodSchema(
          `${schemaVarPrefix}BodySchema`,
          ep.requestBody,
        );

        const dbImportStatement =
          responseResInfo.dbImports.size > 0
            ? `import type { ${Array.from(responseResInfo.dbImports).join(", ")} } from "@workspace/db";\n`
            : "";

        let singleRouteCode = `import { z } from "zod";\n${dbImportStatement}\n`;
        singleRouteCode += `/**\n * ${ep.type || "GET"} ${ep.name || "/"}\n * Service: ${rawServiceName}\n * ${ep.summary || "Route Schema"}\n */\n`;
        singleRouteCode += `// --- Input Schemas ---\n`;
        singleRouteCode += paramsTypeRes.code + "\n";
        singleRouteCode += queryTypeRes.code + "\n";
        if (isBodyMethod) {
          singleRouteCode += bodyTypeRes.code + "\n";
        } else {
          singleRouteCode += `export type ${pascalName}Body = never;\n\n`;
        }

        singleRouteCode += `// --- Output Schema ---\n`;
        singleRouteCode += responseResInfo.code + "\n";

        singleRouteCode += `// --- Zod Validation Schemas ---\n`;
        if (queryTypeRes.hasContent) {
          singleRouteCode += queryZodRes.code + "\n";
        }
        if (isBodyMethod && bodyTypeRes.hasContent) {
          singleRouteCode += bodyZodRes.code + "\n";
        }

        // File per route: src/<serviceFolderName>/<routeFileName>.ts
        files.push({
          filename: `src/${serviceFolderName}/${routeFileName}.ts`,
          language: "typescript",
          content: singleRouteCode,
        });

        routeFileExports.push(`export * from "./${routeFileName}";`);
      });

      // Service barrel file: src/<serviceFolderName>/index.ts
      files.push({
        filename: `src/${serviceFolderName}/index.ts`,
        language: "typescript",
        content: `/**\n * Schemas for ${rawServiceName}\n */\n${routeFileExports.join("\n")}\n`,
      });

      barrelExports.push(`export * from "./${serviceFolderName}";`);
      barrelExports.push(
        `export * as ${pascalServiceName} from "./${serviceFolderName}";`,
      );
    }
  });

  // 4. Events Types: src/events/index.ts
  // Always collect node-local events and merge them (de-duped by event ID) so that
  // consumers importing types from @workspace/types never reference a missing export.
  const seenEventIds = new Set<string>(events.map((e) => e.id));
  const allEvents: (AnyMessagingResource & {
    nodeId: string;
    variant: "publish" | "consume";
  })[] = [...events];

  nodes.forEach((n) => {
    if (n.data?.publishedEvents) {
      n.data.publishedEvents.forEach((e) => {
        if (!seenEventIds.has(e.id)) {
          seenEventIds.add(e.id);
          allEvents.push({ ...e, nodeId: n.id, variant: "publish" as const });
        }
      });
    }
    if (n.data?.consumedEvents) {
      n.data.consumedEvents.forEach((e) => {
        if (!seenEventIds.has(e.id)) {
          seenEventIds.add(e.id);
          allEvents.push({ ...e, nodeId: n.id, variant: "consume" as const });
        }
      });
    }
  });

  let eventsCode = `import { z } from "zod";\n\n`;
  if (allEvents.length === 0) {
    eventsCode += `// No messaging events configured\nexport type GenericEventPayload = Record<string, string | number | boolean | null>;\n`;
  } else {
    const processedEventNames = new Set<string>();

    allEvents.forEach((ev) => {
      const eventName = ev.name || "event";
      const eventPascalName = toPascalCase(eventName);
      if (processedEventNames.has(eventPascalName)) return;
      processedEventNames.add(eventPascalName);

      const payloadInterfaceName = `${eventPascalName}EventPayload`;
      const schemaName = `${toVarName(eventName)}PayloadSchema`;

      let payloadSchema = ev.payloadSchema;
      if (ev.brokerNodeId && ev.messagingResourceId) {
        const brokerNode = nodes.find((n) => n.id === ev.brokerNodeId);
        const brokerResources = [
          ...(brokerNode?.data?.topics || []),
          ...(brokerNode?.data?.streams || []),
          ...(brokerNode?.data?.queues || []),
          ...(brokerNode?.data?.channels || []),
        ];
        const brokerResource = brokerResources.find((r) => r.id === ev.messagingResourceId);
        if (brokerResource?.payloadSchema) {
          payloadSchema = brokerResource.payloadSchema;
        }
      }

      const schemaObj = {
        rawJson: payloadSchema?.rawJson,
        fields: payloadSchema?.fields,
        mode: payloadSchema?.mode,
        requestBodyMode: payloadSchema?.requestBodyMode,
      };

      const interfaceRes = schemaToTsInterface(payloadInterfaceName, schemaObj);
      const zodRes = schemaToZodSchema(schemaName, schemaObj);

      eventsCode += `// --- Event Contract: "${eventName}" ---\n`;
      eventsCode += interfaceRes.code + "\n";
      if (zodRes.hasContent) {
        eventsCode += zodRes.code + "\n";
      }
    });
  }

  files.push({
    filename: "src/events/index.ts",
    language: "typescript",
    content: eventsCode,
  });

  barrelExports.push(`export * from "./events";`);

  // 5. Root Index barrel: src/index.ts
  const indexContent = `/**
 * Shared Type Definitions & Zod Validation Schemas
 * Reused across all microservices (@workspace/*) and frontend web clients
 */
${barrelExports.join("\n")}
`;

  files.push({
    filename: "src/index.ts",
    language: "typescript",
    content: indexContent,
  });

  return files;
}

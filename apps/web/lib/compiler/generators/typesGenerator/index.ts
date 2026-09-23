import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint, AnyMessagingResource, CompiledFile, ServiceInfo } from "@workspace/canvas/types";
import { generateTypesPackageConfigs } from "./packageConfigs";
import { generateEntitiesModule } from "./entitiesGenerator";
import { generateServiceRouteTypes } from "./serviceRoutesGenerator";
import { generateEventsModule } from "./eventsGenerator";
import { generateCustomTypesModule } from "./customTypesGenerator";
import { generateResponseInterface } from "./responseInference";

export * from "./types";
export * from "./entitiesGenerator";
export * from "./responseInference";
export * from "./serviceRoutesGenerator";
export * from "./eventsGenerator";
export * from "./customTypesGenerator";
export * from "./packageConfigs";

export function generateTypesPackage(
  nodes: BackendNode[],
  endpoints: (Endpoint & { nodeId: string })[] = [],
  events: (AnyMessagingResource & {
    nodeId: string;
    variant: "publish" | "consume";
  })[] = [],
  servicesInfo?: ServiceInfo[],
  edges: BackendEdge[] = [],
): CompiledFile[] {
  const files: CompiledFile[] = [];
  const barrelExports: string[] = [];

  // 1. package.json & tsconfig.json - Zero internal workspace dependencies to prevent cyclic dependencies
  files.push(...generateTypesPackageConfigs());

  // 2. Custom Reusable Types (defined on canvas via Types nodes)
  const customTypes = generateCustomTypesModule(nodes);
  const allCustomTypeNames = new Set<string>([
    ...(customTypes.exportedTypes || []),
    ...(customTypes.exportedValues || []),
  ]);

  // 3. Scan all endpoints to discover all referenced entities before generating entities module
  const referencedEntities = new Set<string>();
  const endpointNodes = nodes.filter(
    (n) =>
      n.type === "service" ||
      n.type === "api_gateway" ||
      n.type === "serverless" ||
      Boolean(n.data && (n.data.endpoints || n.data.routeGroups)),
  );

  endpointNodes.forEach((serviceNode) => {
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
    nodeEndpoints.forEach((ep) => {
      const res = generateResponseInterface("Temp", ep.responseFields, ep.responseBody, nodes, ep, serviceNode, edges);
      res.entityImports.forEach((ent) => referencedEntities.add(ent));
    });
  });

  // 3.5 Entities & Schemas: src/entities/index.ts
  const entitiesExportedNames = new Set<string>();
  const entitiesModuleCode = generateEntitiesModule(
    nodes,
    referencedEntities,
    allCustomTypeNames,
    entitiesExportedNames,
  );
  files.push({
    filename: "src/entities/index.ts",
    language: "typescript",
    content: entitiesModuleCode,
  });
  barrelExports.push(`export * from "./entities";`);

  // 4. Service Folders: src/<serviceFolderName>/<routeFileName>.ts
  const serviceRoutes = generateServiceRouteTypes(nodes, endpoints, servicesInfo, edges);
  files.push(...serviceRoutes.files);
  barrelExports.push(...serviceRoutes.barrelExports);

  // 5. Events Types: src/events/index.ts
  const eventsModule = generateEventsModule(nodes, events);
  files.push(eventsModule.file);
  barrelExports.push(eventsModule.exportStatement);

  // 6. Custom Reusable Types File & Disambiguated Barrel Exports
  if (customTypes.file && customTypes.exportStatement) {
    files.push(customTypes.file);
    barrelExports.push(customTypes.exportStatement);

    // Disambiguate duplicate exports between custom types and entity modules (TS2308)
    const conflictingTypes: string[] = [];
    const conflictingValues: string[] = [];

    customTypes.exportedTypes?.forEach((typeName) => {
      if (entitiesExportedNames.has(typeName)) {
        conflictingTypes.push(typeName);
      }
    });

    customTypes.exportedValues?.forEach((valName) => {
      if (entitiesExportedNames.has(valName)) {
        conflictingValues.push(valName);
      }
    });

    if (conflictingTypes.length > 0) {
      barrelExports.push(
        `export type { ${conflictingTypes.sort().join(", ")} } from "./custom";`,
      );
    }
    if (conflictingValues.length > 0) {
      barrelExports.push(
        `export { ${conflictingValues.sort().join(", ")} } from "./custom";`,
      );
    }
  }

  // 5. Root Index barrel: src/index.ts
  const indexContent = `/**
 * Shared Type Definitions & Zod Validation Schemas
 * Reused across all microservices (@workspace/*) and frontend web pages
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

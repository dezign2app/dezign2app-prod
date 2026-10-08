import { BackendNode, BackendEdge, SimulationTestCase } from "@/types/canvas";
import { Endpoint, AnyMessagingResource, CompiledServiceResult, ReusableFunction } from "@workspace/canvas/types";
import { compileExpressV4Service } from "./services/express/v4";
import { compileFastAPIService } from "./services/fastapi/v0";
import { compileNextjsV16Service } from "./services/nextjs/v16";
import { compileDatabaseNodes } from "./compileDatabaseNodes";
import { compileKafkaNodes, isServiceConnectedToKafka } from "./compileKafkaNodes";
import { compileRedisNodes, isServiceConnectedToRedis } from "./compileRedisNodes";
import { cleanUnusedImports, toTableName, toSingular, toPlural } from "./utils";

/**
 * Compiles a single Service Node into its modular microservice directory structure based on selected tech and version
 */
export function compileServiceNode(
  node: BackendNode,
  endpoints: (Endpoint & { nodeId: string })[] = [],
  events: (AnyMessagingResource & {
    nodeId: string;
    variant: "publish" | "consume";
  })[] = [],
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
  testCases: SimulationTestCase[] = [],
  dbFunctions: ReusableFunction[] = [],
  kafkaFunctions: ReusableFunction[] = [],
  folderName?: string,
  redisFunctions: ReusableFunction[] = [],
  storageFunctions: ReusableFunction[] = [],
): CompiledServiceResult {
  const techStack = node.data?.techStack || "express";

  if (dbFunctions.length === 0 && allNodes.length > 0) {
    const compiledDb = compileDatabaseNodes(allNodes, allEdges);
    dbFunctions = compiledDb.reusableFunctions || [];
  }

  const isConnectedToKafka = isServiceConnectedToKafka(node, allNodes, allEdges, endpoints, events);
  if (!isConnectedToKafka) {
    kafkaFunctions = [];
  } else if (kafkaFunctions.length === 0 && allNodes.length > 0) {
    const compiledKafka = compileKafkaNodes(allNodes, allEdges);
    kafkaFunctions = compiledKafka.reusableFunctions || [];
  }

  const isConnectedToRedis = isServiceConnectedToRedis(node, allNodes, allEdges, endpoints);
  if (!isConnectedToRedis) {
    redisFunctions = [];
  } else if (redisFunctions.length === 0 && allNodes.length > 0) {
    const compiledRedis = compileRedisNodes(allNodes, allEdges);
    redisFunctions = compiledRedis.reusableFunctions || [];
  }

  // Filter endpoints for this specific node
  let nodeEndpoints = endpoints.filter(
    (e) =>
      e.nodeId === node.id ||
      (e.nodeId &&
        ((node.data?.label && e.nodeId === node.data.label) ||
          (node.data?.label && e.nodeId === node.data.label.toLowerCase()))),
  );

  // If endpoints are passed and pre-filtered to this single node, preserve them
  if (nodeEndpoints.length === 0 && endpoints.length > 0 && endpoints.every((e) => !e.nodeId || e.nodeId === node.id)) {
    nodeEndpoints = endpoints;
  }

  // Fall back to node.data.endpoints ONLY if global endpoints array is empty
  if (nodeEndpoints.length === 0 && endpoints.length === 0 && node.data?.endpoints) {
    nodeEndpoints = node.data.endpoints.map((ep) => ({
      ...ep,
      nodeId: node.id,
    }));
  }

  if (node.data?.routeGroups) {
    for (const group of node.data.routeGroups) {
      if (group.endpoints) {
        const groupEndpoints = group.endpoints.map((ep) => ({
          ...ep,
          nodeId: node.id,
        }));
        nodeEndpoints = [...nodeEndpoints, ...groupEndpoints];
      }
    }
  }

  // Sanitize nodeEndpoints against allNodes if provided (clean up deleted nodes, edges, operations)
  if (allNodes.length > 0) {
    const existingNodeIds = new Set(allNodes.map((n) => n.id));
    const entityAndDbNodes = allNodes.filter(
      (n) => n.type === "entity" || n.type === "db_ref" || n.type === "database",
    );
    const existingDbNodeIds = new Set(entityAndDbNodes.map((n) => n.id));
    const existingEntityNames = new Set(
      entityAndDbNodes.flatMap((n) => {
        const raw = n.data?.label || n.data?.tableRef || "";
        const clean = toTableName(raw).toLowerCase();
        return [raw.toLowerCase(), clean, toSingular(clean), toPlural(clean)].filter(Boolean);
      }),
    );

    nodeEndpoints = nodeEndpoints.map((ep) => {
      let changed = false;
      let databaseNodeId = ep.databaseNodeId;
      let databaseNodeIds = ep.databaseNodeIds;
      let crudOperations = ep.crudOperations;
      let crudExplanations = ep.crudExplanations;
      let pipelineSteps = ep.pipelineSteps;

      if (databaseNodeId && databaseNodeId !== "none" && !existingNodeIds.has(databaseNodeId)) {
        databaseNodeId = "none";
        changed = true;
      }

      if (databaseNodeIds && databaseNodeIds.length > 0) {
        const filtered = databaseNodeIds.filter((id) => existingNodeIds.has(id));
        if (filtered.length !== databaseNodeIds.length) {
          databaseNodeIds = filtered;
          changed = true;
        }
      }

      if (crudOperations && Object.keys(crudOperations).length > 0) {
        const cleanedOps: Record<string, string[]> = {};
        for (const [key, ops] of Object.entries(crudOperations)) {
          if (existingDbNodeIds.has(key) || existingEntityNames.has(key.toLowerCase())) {
            cleanedOps[key] = ops;
          } else {
            changed = true;
          }
        }
        if (changed) {
          crudOperations = cleanedOps;
        }
      }

      if (crudExplanations && Object.keys(crudExplanations).length > 0) {
        const cleanedExp: Record<string, Record<string, string>> = {};
        for (const [key, exp] of Object.entries(crudExplanations)) {
          if (existingDbNodeIds.has(key) || existingEntityNames.has(key.toLowerCase())) {
            cleanedExp[key] = exp;
          } else {
            changed = true;
          }
        }
        if (changed) {
          crudExplanations = cleanedExp;
        }
      }

      if (pipelineSteps && pipelineSteps.length > 0) {
        const cleanedSteps = pipelineSteps.filter((step) => {
          if (step.type === "db_operation") {
            if (step.tableNodeId && !existingNodeIds.has(step.tableNodeId)) {
              return false;
            }
            if (step.databaseId && !existingNodeIds.has(step.databaseId)) {
              return false;
            }
            if (step.functionRef?.importPath?.includes("/helpers/")) {
              const helperMatch = step.functionRef.importPath.match(/\/helpers\/([^/]+)$/);
              if (helperMatch) {
                const helperName = helperMatch[1].toLowerCase();
                if (
                  !existingEntityNames.has(helperName) &&
                  !existingEntityNames.has(toSingular(helperName)) &&
                  !existingEntityNames.has(toPlural(helperName))
                ) {
                  return false;
                }
              }
            }
          }
          return true;
        });
        if (cleanedSteps.length !== pipelineSteps.length) {
          pipelineSteps = cleanedSteps;
          changed = true;
        }
      }

      return changed
        ? {
            ...ep,
            databaseNodeId,
            databaseNodeIds,
            crudOperations,
            crudExplanations,
            pipelineSteps,
          }
        : ep;
    });
  }

  // Filter events for this specific node
  let nodeEvents = events.filter(
    (e) =>
      e.nodeId === node.id ||
      (e.nodeId &&
        ((node.data?.label && e.nodeId === node.data.label) ||
          (node.data?.label && e.nodeId === node.data.label.toLowerCase()))),
  );

  if (nodeEvents.length === 0) {
    if (node.data?.consumedEvents) {
      nodeEvents.push(
        ...node.data.consumedEvents.map((e) => ({
          ...e,
          nodeId: node.id,
          variant: "consume" as const,
        })),
      );
    }
    if (node.data?.publishedEvents) {
      nodeEvents.push(
        ...node.data.publishedEvents.map((e) => ({
          ...e,
          nodeId: node.id,
          variant: "publish" as const,
        })),
      );
    }
  }

  let result: CompiledServiceResult;

  switch (techStack) {
    case "nextjs":
      result = compileNextjsV16Service(
        node,
        nodeEndpoints,
        nodeEvents,
        allNodes,
        allEdges,
        testCases,
        dbFunctions,
        kafkaFunctions,
        folderName,
        redisFunctions,
      );
      break;
    case "fastapi":
      result = compileFastAPIService(
        node,
        nodeEndpoints,
        nodeEvents,
        allNodes,
        allEdges,
        testCases,
        dbFunctions,
        kafkaFunctions,
      );
      break;
    case "express":
    default:
      result = compileExpressV4Service(
        node,
        nodeEndpoints,
        nodeEvents,
        allNodes,
        allEdges,
        testCases,
        dbFunctions,
        kafkaFunctions,
        folderName,
        endpoints.length > 0 ? endpoints : nodeEndpoints,
        redisFunctions,
        storageFunctions,
      );
      break;
  }

  return {
    ...result,
    files: result.files.map((f) => {
      if (f.filename.endsWith(".ts") || f.filename.endsWith(".tsx")) {
        return {
          ...f,
          content: cleanUnusedImports(f.content),
        };
      }
      return f;
    }),
  };
}

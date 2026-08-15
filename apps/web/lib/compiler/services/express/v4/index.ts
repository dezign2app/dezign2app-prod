import { BackendNode, BackendEdge, SimulationTestCase } from "@/types/canvas";
import { Endpoint, AnyMessagingResource, CompiledFile, CompiledServiceResult, ReusableFunction } from "@workspace/canvas/types";
import { generateRoutes } from "../../../generators/routeGenerator";
import { generateConsumers } from "../../../generators/consumerGenerator";
import { generateProducers } from "../../../generators/producerGenerator";
import {
  generateLibFiles,
  generateServerFile,
  generateConfigFiles,
} from "../../../generators/configGenerator";
import { generateServiceUnitTests } from "../../../generators/testGenerator";

/**
 * Compiles a Service Node into an Express.js 4.x microservice application
 */
export function compileExpressV4Service(
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
  allEndpoints: (Endpoint & { nodeId: string })[] = [],
): CompiledServiceResult {
  const serviceName = node.data?.label || node.id || "Service";
  const sanitizedName =
    folderName ||
    serviceName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/^-+|-+$/g, "") ||
    "service";
  const port = node.data?.port || "8080";
  const cors = node.data?.cors || false;
  const corsOrigins = node.data?.corsOrigins || "*";

  let nodeEndpoints = endpoints.filter(
    (e) =>
      e.nodeId === node.id ||
      (e.nodeId &&
        ((node.data?.label && e.nodeId === node.data.label) ||
          (node.data?.label && e.nodeId === node.data.label.toLowerCase()))),
  );
  if (nodeEndpoints.length === 0 && endpoints.length > 0 && endpoints.every((e) => !e.nodeId || e.nodeId === node.id)) {
    nodeEndpoints = endpoints;
  }
  const totalEndpointsCount = allEndpoints.length > 0 ? allEndpoints.length : endpoints.length;
  if (nodeEndpoints.length === 0 && totalEndpointsCount === 0 && node.data?.endpoints) {
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

  let nodeConsumedEvents = events.filter(
    (e) =>
      (e.nodeId === node.id ||
        (node.data?.label && e.nodeId === node.data.label) ||
        (node.data?.label && e.nodeId === node.data.label.toLowerCase())) &&
      e.variant === "consume",
  );
  if (nodeConsumedEvents.length === 0 && events.length === 0 && node.data?.consumedEvents) {
    nodeConsumedEvents = node.data.consumedEvents.map((e) => ({
      ...e,
      nodeId: node.id,
      variant: "consume",
    }));
  }

  let nodePublishedEvents = events.filter(
    (e) =>
      (e.nodeId === node.id ||
        (node.data?.label && e.nodeId === node.data.label) ||
        (node.data?.label && e.nodeId === node.data.label.toLowerCase())) &&
      e.variant === "publish",
  );
  if (nodePublishedEvents.length === 0 && events.length === 0 && node.data?.publishedEvents) {
    nodePublishedEvents = node.data.publishedEvents.map((e) => ({
      ...e,
      nodeId: node.id,
      variant: "publish",
    }));
  }

  const files: CompiledFile[] = [
    ...generateRoutes(
      serviceName,
      nodeEndpoints,
      node,
      allNodes,
      allEdges,
      endpoints,
      dbFunctions,
      kafkaFunctions,
      nodePublishedEvents,
      sanitizedName,
    ),
    ...generateConsumers(
      serviceName,
      nodeConsumedEvents,
      node,
      allNodes,
      allEdges,
    ),
    ...generateProducers(
      serviceName,
      nodePublishedEvents,
      node,
      allNodes,
      allEdges,
    ),
    ...generateLibFiles(),
    generateServerFile(serviceName, port, cors, corsOrigins, node, allNodes, allEdges),

    ...generateConfigFiles(
      node,
      sanitizedName,
      serviceName,
      port,
      cors,
      endpoints,
      events,
      allNodes,
      allEdges,
    ),
    ...generateServiceUnitTests(serviceName, nodeEndpoints, testCases),
  ];

  return {
    serviceId: node.id,
    serviceName,
    files,
  };
}

import { v } from "convex/values";
import { zodToConvex } from "convex-helpers/server/zod";
import {
  serviceDataSchema,
  dbRefDataSchema,
  webPageDataSchema,
  pageRefDataSchema,
  externalDataSchema,
  simpleDataSchema,
  entityDataSchema,
  databaseDataSchema,
  kafkaDataSchema,
  sqsDataSchema,
  redisPubSubDataSchema,
  redisStreamsDataSchema,
  redisCacheDataSchema,
  storageDataSchema,
  edgeDataSchema,
  simulationTestCaseSchema,
  // New nodes
  workerDataSchema,
  serverlessDataSchema,
  searchIndexDataSchema,
  apiGatewayDataSchema,
  loadBalancerDataSchema,
  webhookDataSchema,
  llmDataSchema,
  mcpServerDataSchema,
  vectorDbRefDataSchema,
  endpointSchema,
  identityProviderDataSchema,
  authDataSchema,
  paymentsDataSchema,
  webAppDataSchema,
  langgraphDataSchema,
  langgraphStepDataSchema,
  transformerNodeDataSchema,
  transformerRefDataSchema,
  identityProviderSchema,
  publishedEventSchema,
  consumedEventSchema,
} from "@workspace/canvas/schemas";

// Test Case Data Validator
export const backendTestCaseDataValidator = zodToConvex(
  simulationTestCaseSchema,
);

// Edge Data Validator
export const backendEdgeDataValidator = zodToConvex(edgeDataSchema);

// Parameter Validator (Headers, Query Params, Path Params, Field Builder)
export const backendParameterValidator = v.object({
  id: v.optional(v.string()),
  name: v.optional(v.string()),
  type: v.optional(v.string()),
  required: v.optional(v.boolean()),
  description: v.optional(v.string()),
  defaultValue: v.optional(v.string()),
  key: v.optional(v.string()),
  value: v.optional(v.string()),
});

// Request Body / Schema Model Validator
export const backendRequestBodyValidator = v.object({
  id: v.optional(v.string()),
  fields: v.optional(v.array(backendParameterValidator)),
  rawJson: v.optional(v.string()),
});

// Simulation Case Validator
export const webPageSimulationCaseValidator = v.object({
  id: v.optional(v.string()),
  name: v.string(),
  request: v.optional(
    v.object({
      headers: v.optional(v.record(v.string(), v.string())),
      params: v.optional(v.record(v.string(), v.string())),
      body: v.optional(
        v.union(v.string(), v.number(), v.boolean(), v.null(), v.record(v.string(), v.string())),
      ),
    }),
  ),
  expectedStatus: v.optional(v.number()),
  expectedBody: v.optional(
    v.union(v.string(), v.number(), v.boolean(), v.null(), v.record(v.string(), v.string())),
  ),
  enabled: v.optional(v.boolean()),
});

// UI Event Item Validator
export const webPageEventConvexValidator = v.object({
  id: v.optional(v.string()),
  name: v.string(),
  event: v.optional(v.string()),
  schema: v.optional(v.string()),
  navigationType: v.optional(v.union(v.literal("link"), v.literal("router"))),
  navigationCondition: v.optional(
    v.union(
      v.literal("direct"),
      v.literal("on_success"),
      v.literal("on_condition"),
      v.literal("on_error"),
    ),
  ),
  targetRoute: v.optional(v.string()),
  targetPageId: v.optional(v.string()),
  conditionCode: v.optional(v.string()),
  targetNodeId: v.optional(v.string()),
  targetEndpointId: v.optional(v.string()),
  headers: v.optional(v.array(backendParameterValidator)),
  pathParams: v.optional(v.array(backendParameterValidator)),
  queryParams: v.optional(v.array(backendParameterValidator)),
  requestBody: v.optional(backendRequestBodyValidator),
  requestBodyMode: v.optional(
    v.union(v.literal("field_builder"), v.literal("raw_json")),
  ),
  simulationCases: v.optional(v.array(webPageSimulationCaseValidator)),
});

// Protection Rule Validator
export const protectionRuleConvexValidator = v.object({
  id: v.optional(v.string()),
  scope: v.optional(v.union(v.literal("zone"), v.literal("page"))),
  conditions: v.optional(
    v.record(
      v.string(),
      v.union(v.string(), v.number(), v.boolean(), v.null()),
    ),
  ),
  redirects: v.optional(v.record(v.string(), v.string())),
  customLogic: v.optional(
    v.object({
      mode: v.union(v.literal("naturalLanguage"), v.literal("code")),
      prompt: v.optional(v.string()),
      code: v.optional(v.string()),
    }),
  ),
});

// Web Page Node Data Validator
export const webPageConvexDataValidator = v.object({
  label: v.optional(v.string()),
  description: v.optional(v.string()),
  summary: v.optional(v.string()),
  appName: v.optional(v.string()),
  appSlug: v.optional(v.string()),
  accessType: v.optional(
    v.union(
      v.literal("public"),
      v.literal("private"),
      v.literal("role-gated"),
      v.literal("payment-gated"),
      v.literal("org-gated"),
    ),
  ),
  allowedRoles: v.optional(v.array(v.string())),
  requiredPlans: v.optional(v.array(v.string())),
  allowedOrgRoles: v.optional(v.array(v.string())),
  redirectTo: v.optional(v.string()),
  isAuthPage: v.optional(v.boolean()),
  authNodeId: v.optional(v.string()),
  zoneId: v.optional(v.string()),
  useZoneDefault: v.optional(v.boolean()),
  requireAuth: v.optional(v.boolean()),
  color: v.optional(v.string()),
  parentId: v.optional(v.string()),
  position: v.optional(v.object({ x: v.number(), y: v.number() })),
  style: v.optional(
    v.record(
      v.string(),
      v.union(v.string(), v.number(), v.boolean(), v.null()),
    ),
  ),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  techStack: v.optional(v.string()),
  techVersion: v.optional(v.string()),
  isWebPage: v.optional(v.boolean()),
  isRoot: v.optional(v.boolean()),
  pageSlug: v.optional(v.string()),
  path: v.optional(v.string()),
  route: v.optional(v.string()),
  targetServerId: v.optional(v.string()),
  targetRouteId: v.optional(v.string()),
  pageSourceCode: v.optional(v.string()),
  aiEditing: v.optional(v.boolean()),
  headers: v.optional(v.array(backendParameterValidator)),
  pathParams: v.optional(v.array(backendParameterValidator)),
  queryParams: v.optional(v.array(backendParameterValidator)),
  requestBody: v.optional(backendRequestBodyValidator),
  requestBodyMode: v.optional(
    v.union(v.literal("field_builder"), v.literal("raw_json")),
  ),
  events: v.optional(v.array(webPageEventConvexValidator)),
  protectionOverride: v.optional(protectionRuleConvexValidator),
});

export const backendWebPageDataValidator = webPageConvexDataValidator;

export const langgraphConvexDataValidator = v.object({
  label: v.optional(v.string()),
  description: v.optional(v.string()),
  parentId: v.optional(v.string()),
  position: v.optional(v.object({ x: v.number(), y: v.number() })),
  style: v.optional(
    v.record(
      v.string(),
      v.union(v.string(), v.number(), v.boolean(), v.null()),
    ),
  ),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  version: v.optional(v.number()),
  recursionLimit: v.optional(v.number()),
  stepTimeoutMs: v.optional(v.number()),
  inputChannels: v.optional(v.array(v.any())),
  outputChannels: v.optional(v.array(v.any())),
  stateChannels: v.optional(v.array(v.any())),
  outputPorts: v.optional(v.array(v.any())),
  tools: v.optional(v.array(v.any())),
  customLlmNodes: v.optional(v.array(v.any())),
  toolDefinitions: v.optional(v.array(v.any())),
  middlewareDefinitions: v.optional(v.array(v.any())),
  agentDefinitions: v.optional(v.array(v.any())),
  memoryDefinitions: v.optional(v.array(v.any())),
  graphSteps: v.optional(v.array(v.any())),
  graphEdges: v.optional(v.array(v.any())),
  memoryConfig: v.optional(v.any()),
  startNodePosition: v.optional(v.object({ x: v.number(), y: v.number() })),
  stateNodePosition: v.optional(v.object({ x: v.number(), y: v.number() })),
  endNodePosition: v.optional(v.object({ x: v.number(), y: v.number() })),
  endNodes: v.optional(v.array(v.any())),
});

// Node Data Validator
// Using zodToConvex & explicit validators to keep database schemas in sync
export const backendNodeDataValidator = v.union(
  zodToConvex(serviceDataSchema),
  zodToConvex(dbRefDataSchema),
  webPageConvexDataValidator,
  zodToConvex(pageRefDataSchema),
  zodToConvex(webAppDataSchema),
  zodToConvex(externalDataSchema),
  zodToConvex(simpleDataSchema),
  zodToConvex(entityDataSchema),
  zodToConvex(databaseDataSchema),
  zodToConvex(kafkaDataSchema),
  zodToConvex(sqsDataSchema),
  zodToConvex(redisPubSubDataSchema),
  zodToConvex(redisStreamsDataSchema),
  zodToConvex(redisCacheDataSchema),
  zodToConvex(storageDataSchema),
  zodToConvex(workerDataSchema),
  zodToConvex(serverlessDataSchema),
  zodToConvex(searchIndexDataSchema),
  zodToConvex(apiGatewayDataSchema),
  zodToConvex(loadBalancerDataSchema),
  zodToConvex(webhookDataSchema),
  zodToConvex(llmDataSchema),
  zodToConvex(mcpServerDataSchema),
  zodToConvex(vectorDbRefDataSchema),
  zodToConvex(identityProviderDataSchema),
  zodToConvex(authDataSchema),
  zodToConvex(paymentsDataSchema),
  langgraphConvexDataValidator,
  zodToConvex(langgraphStepDataSchema),
  zodToConvex(transformerNodeDataSchema),
  zodToConvex(transformerRefDataSchema),
  // Fallback for partial updates (label is always present on real nodes)
  v.object({
    label: v.string(),
    color: v.optional(v.string()),
    parentId: v.optional(v.string()),
    position: v.optional(v.object({ x: v.number(), y: v.number() })),
    style: v.optional(
      v.record(
        v.string(),
        v.union(v.string(), v.number(), v.boolean(), v.null()),
      ),
    ),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    pageSourceCode: v.optional(v.string()),
    aiEditing: v.optional(v.boolean()),
  }),
);

import { z } from "zod";

export const backendEndpointDataValidator = zodToConvex(endpointSchema);
export const backendIdentityProviderDataValidator = zodToConvex(
  identityProviderSchema,
);

// Use z.string() for retryPolicy in the DB validator — the app-layer Zod schema
// (consumedEventSchema) enforces the strict enum on user input, but the DB should
// accept any string to stay compatible with AnyMessagingResource (retryPolicy?: RetryPolicy | string).
export const backendEventDataValidator = zodToConvex(
  z.union([
    publishedEventSchema,
    consumedEventSchema.extend({ retryPolicy: z.string().default("NONE") }),
  ]),
);

import type { BackendNode, BackendEdge } from "@/types/canvas";
import type {
  EndpointWithNode,
  EventWithNode,
  IdentityProviderWithNode,
  CanvasEntityColumn,
  DbOperationFunction,
  PipelineStep,
  PipelineStepInputBinding,
} from "@workspace/canvas/types";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import type { TestUserPersona } from "@/app/(canvas)/project/[projectId]/_components/test-users/types";

export interface ProjectMetadata {
  id?: string;
  name?: string;
}

export interface ProjectSystemContextInput {
  project?: ProjectMetadata;
  nodes: BackendNode[];
  edges: BackendEdge[];
  endpoints?: EndpointWithNode[];
  events?: EventWithNode[];
  identityProviders?: IdentityProviderWithNode[];
  testUsers?: TestUserPersona[];
}

interface NodeLookup {
  getLabel: (id: string) => string;
  getNode: (id: string) => BackendNode | undefined;
  getEndpoint: (id: string) => EndpointWithNode | undefined;
}

function formatBindingSource(source: PipelineStepInputBinding["source"]): string {
  if (!source) return "";
  if (source.kind === "inline") return `"${source.value}"`;
  if (source.kind === "step_output") return `step_output(${source.stepId || ""})`;
  if (source.kind === "auth") return "auth_user";
  if (source.kind === "req_body") return `body.${source.field || ""}`;
  if (source.kind === "req_params") return `params.${source.field || ""}`;
  if (source.kind === "req_query") return `query.${source.field || ""}`;
  return source.kind;
}

function formatColumn(col: CanvasEntityColumn): string {
  const tags: string[] = [];
  if (col.isPrimaryKey || col.isPrimary || col.primaryKey) tags.push("PK");
  if (col.isForeignKey) {
    if (col.references) {
      tags.push(`FK -> ${col.references.table}.${col.references.column}`);
    } else {
      tags.push("FK");
    }
  }
  if (col.isNotNull) tags.push("NOT NULL");
  if (col.isUnique) tags.push("UNIQUE");
  if (col.defaultValue !== undefined && col.defaultValue !== "") {
    tags.push(`DEFAULT: ${col.defaultValue}`);
  }
  const tagStr = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
  return `  - ${col.name}: ${col.type}${tagStr}`;
}

function formatDbOperation(op: DbOperationFunction): string {
  const isEnabled = op.enabled !== false;
  const isPaginated = op.pagination?.enabled;

  let sig = op.signature;
  if (!sig) {
    const paramParts: string[] = [];
    if (op.params && op.params.length > 0) {
      for (const p of op.params) {
        if (p.name) {
          const opt = p.required === false ? "?" : "";
          const def = p.defaultValue !== undefined && p.defaultValue !== "" ? ` = ${p.defaultValue}` : "";
          const pType = p.type || "string";
          paramParts.push(`${p.name}${opt}: ${pType}${def}`);
        }
      }
    }
    const ret = op.returnType ? `: ${op.returnType}` : "";
    sig = `${op.name}(${paramParts.join(", ")})${ret}`;
  }

  const tags: string[] = [];
  if (!isEnabled) {
    tags.push("DISABLED");
  }

  if (op.kind === "fetchByIndex" && op.indexName) {
    tags.push(`fetchByIndex on ${op.indexName}`);
  } else {
    tags.push(op.kind);
  }

  if (isPaginated) {
    const mode = op.pagination?.mode || "offset";
    const limit = op.pagination?.defaultLimit || 20;
    tags.push(`paginated: ${mode}, limit: ${limit}`);
  }

  if (op.logicMode === "natural_language" && op.prompt) {
    tags.push(`prompt: "${op.prompt}"`);
  } else if (op.query && op.query.trim()) {
    const cleanQuery = op.query.replace(/\s+/g, " ").trim();
    const shortQuery = cleanQuery.length > 70 ? `${cleanQuery.slice(0, 67)}...` : cleanQuery;
    tags.push(`query: "${shortQuery}"`);
  }

  const tagStr = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
  const descStr = op.description ? ` - ${op.description}` : "";

  return `    - \`${sig}\`${tagStr}${descStr}`;
}

function isGrpcEnabled(service: BackendNode, allNodes: BackendNode[], allEdges: BackendEdge[]): boolean {
  if (
    service.data.interServiceProtocol === "grpc" ||
    service.data.server?.interServiceProtocol === "grpc" ||
    service.data.serverConfig?.interServiceProtocol === "grpc"
  ) {
    return true;
  }
  return allEdges.some((edge) => {
    if (edge.target === service.id) {
      const sourceNode = allNodes.find((n) => n.id === edge.source && n.type === "service");
      return (
        sourceNode?.data.interServiceProtocol === "grpc" ||
        sourceNode?.data.server?.interServiceProtocol === "grpc" ||
        sourceNode?.data.serverConfig?.interServiceProtocol === "grpc"
      );
    }
    return false;
  });
}

function formatEnvVars(envVars?: Array<{ id?: string; name: string; description?: string }>): string {
  if (!envVars || envVars.length === 0) return "";
  return envVars.map((e) => `\`${e.name}\`${e.description ? ` (${e.description})` : ""}`).join(", ");
}

export function formatSystemContext(input: ProjectSystemContextInput): string {
  const nodeMap = new Map<string, BackendNode>();
  const endpointMap = new Map<string, EndpointWithNode>();

  for (const node of input.nodes) {
    nodeMap.set(node.id, node);
  }

  if (input.endpoints) {
    for (const ep of input.endpoints) {
      endpointMap.set(ep.id, ep);
    }
  }

  const lookup: NodeLookup = {
    getLabel: (id: string): string => {
      const node = nodeMap.get(id);
      if (!node) return id;
      return node.data.label || node.data.tableName || node.data.appSlug || id;
    },
    getNode: (id: string): BackendNode | undefined => nodeMap.get(id),
    getEndpoint: (id: string): EndpointWithNode | undefined => endpointMap.get(id),
  };

  const webAppNodes: BackendNode[] = [];
  const webPageNodes: BackendNode[] = [];
  const serviceNodes: BackendNode[] = [];
  const databaseNodes: BackendNode[] = [];
  const entityNodes: BackendNode[] = [];
  const langGraphNodes: BackendNode[] = [];
  const authNodes: BackendNode[] = [];
  const groupNodes: BackendNode[] = [];
  const typesNodes: BackendNode[] = [];
  const transformerNodes: BackendNode[] = [];
  const messagingNodes: BackendNode[] = [];
  const storageNodes: BackendNode[] = [];
  const workerNodes: BackendNode[] = [];
  const networkingNodes: BackendNode[] = [];
  const aiNodes: BackendNode[] = [];
  const paymentsNodes: BackendNode[] = [];
  const stateStoreNodes: BackendNode[] = [];
  const referenceNodes: BackendNode[] = [];
  const externalNodes: BackendNode[] = [];
  const otherNodes: BackendNode[] = [];

  for (const node of input.nodes) {
    if (node.type === "webApp") {
      webAppNodes.push(node);
    } else if (node.type === "webPage") {
      webPageNodes.push(node);
    } else if (node.type === "service") {
      serviceNodes.push(node);
    } else if (node.type === "database" || node.type === "redis_instance") {
      databaseNodes.push(node);
    } else if (node.type === "entity" || node.type === "redis_schema") {
      entityNodes.push(node);
    } else if (node.type === "langgraph" || node.type === "langgraph_step") {
      langGraphNodes.push(node);
    } else if (node.type === "auth" || node.type === "identity_provider") {
      authNodes.push(node);
    } else if (node.type === "group") {
      groupNodes.push(node);
    } else if (node.type === "types") {
      typesNodes.push(node);
    } else if (node.type === "transformer") {
      transformerNodes.push(node);
    } else if (
      node.type === "kafka" ||
      node.type === "sqs" ||
      node.type === "redis-pubsub" ||
      node.type === "redis-streams" ||
      node.type === "queue" ||
      node.type === "eventstream" ||
      node.type === "pubsub"
    ) {
      messagingNodes.push(node);
    } else if (
      node.type === "storage" ||
      node.type === "storage_ref" ||
      node.type === "storage_operation_ref" ||
      node.type === "storage_bucket_ref" ||
      node.type === "StorageBucketRefNode" ||
      node.type === "StorageOperationRefNode"
    ) {
      storageNodes.push(node);
    } else if (node.type === "worker" || node.type === "serverless") {
      workerNodes.push(node);
    } else if (
      node.type === "api_gateway" ||
      node.type === "load_balancer" ||
      node.type === "webhook" ||
      node.type === "search_index"
    ) {
      networkingNodes.push(node);
    } else if (node.type === "llm" || node.type === "mcp_server") {
      aiNodes.push(node);
    } else if (node.type === "payments") {
      paymentsNodes.push(node);
    } else if (node.type === "state_store" || node.type === "hook" || node.type === "hook_ref") {
      stateStoreNodes.push(node);
    } else if (
      node.type === "db_ref" ||
      node.type === "page_ref" ||
      node.type === "transformer_ref" ||
      node.type === "vector_db_ref"
    ) {
      referenceNodes.push(node);
    } else if (node.type === "external") {
      externalNodes.push(node);
    } else {
      otherNodes.push(node);
    }
  }

  const endpoints = input.endpoints || [];
  const lines: string[] = [];

  // Header & Overview
  const projectName = input.project?.name || "Untitled Project";
  const projectId = input.project?.id || "";
  lines.push(`# System Architecture: ${projectName}${projectId ? ` (ID: ${projectId})` : ""}`);
  lines.push("");
  lines.push("## 1. System Overview");
  lines.push(`- **Web Applications**: ${webAppNodes.length}`);
  lines.push(`- **Web Pages & Routes**: ${webPageNodes.length}`);
  lines.push(`- **Backend Services**: ${serviceNodes.length}`);
  lines.push(`- **API Endpoints**: ${endpoints.length}`);
  if (transformerNodes.length > 0) lines.push(`- **Compute Transformers**: ${transformerNodes.length}`);
  if (messagingNodes.length > 0) lines.push(`- **Messaging & Event Streams**: ${messagingNodes.length}`);
  if (storageNodes.length > 0) lines.push(`- **Storage & Bucket Nodes**: ${storageNodes.length}`);
  if (workerNodes.length > 0) lines.push(`- **Workers & Serverless**: ${workerNodes.length}`);
  if (paymentsNodes.length > 0) lines.push(`- **Payments Integrations**: ${paymentsNodes.length}`);
  if (stateStoreNodes.length > 0) lines.push(`- **Client State Stores**: ${stateStoreNodes.length}`);
  if (externalNodes.length > 0) lines.push(`- **External APIs**: ${externalNodes.length}`);
  if (aiNodes.length > 0) lines.push(`- **AI & MCP Servers**: ${aiNodes.length}`);
  let totalActiveDbOps = 0;
  for (const ent of entityNodes) {
    const parentDb = input.nodes.find(
      (n) => n.id === ent.data.databaseId || n.id === ent.parentId,
    );
    const engine = parentDb?.data?.dbEngine || ent.data.dbEngine || "postgres";
    const entClone = { type: ent.type, data: { ...ent.data } };
    const ops = getEntityDbOperations(entClone, input.nodes, engine);
    totalActiveDbOps += ops.filter((o) => o.enabled !== false).length;
  }

  lines.push(`- **Databases**: ${databaseNodes.length}`);
  lines.push(`- **Schema Entities (Tables)**: ${entityNodes.length}`);
  if (totalActiveDbOps > 0) {
    lines.push(`- **Database Operations (Active)**: ${totalActiveDbOps}`);
  }
  lines.push(`- **AI Agent Workflows (LangGraph)**: ${langGraphNodes.length}`);
  lines.push(`- **Active Topology Connections (Edges)**: ${input.edges.length}`);
  lines.push("");

  // 2. Web Applications (Frontend)
  if (webAppNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## 2. Web Applications (Frontend)");

    for (const app of webAppNodes) {
      const appName = app.data.appSlug || app.data.label;
      const port = app.data.port || "3000";
      lines.push(`### WebApp: \`${appName}\` (Port: ${port})`);

      if (app.data.authNodeId) {
        lines.push(`- **Authentication**: Bound to \`${lookup.getLabel(app.data.authNodeId)}\``);
      }

      if (app.data.zones && app.data.zones.length > 0) {
        lines.push(`- **Zones & Security Scopes**:`);
        for (const zone of app.data.zones) {
          const conditions = zone.rule?.conditions;
          let ruleCond = "";
          if (conditions && conditions.kind === "leaf") {
            if ("op" in conditions.condition) {
              ruleCond = ` [Rule: ${conditions.condition.op}]`;
            } else {
              ruleCond = ` [Rule: ${conditions.condition.type}]`;
            }
          } else if (conditions && conditions.kind === "group") {
            ruleCond = ` [Rule: ${conditions.op}]`;
          }
          const redirects = zone.rule?.redirects?.default ? ` -> Redirects to ${zone.rule.redirects.default}` : "";
          lines.push(`  - \`${zone.name}\` (${zone.accessType})${ruleCond}: ${zone.layoutDescription || ""}${redirects}`);
        }
      }

      const appPages = webPageNodes.filter(
        (p) => p.data.appSlug === app.data.appSlug || p.data.appSlug === app.data.label || p.data.appSlug === "web"
      );

      if (appPages.length > 0) {
        lines.push(`- **Pages & Routes**:`);
        for (const page of appPages) {
          const route = page.data.label || page.data.path || "/";
          const isRoot = page.data.isRoot ? " [Root]" : "";
          const desc = page.data.description ? ` - ${page.data.description}` : "";
          lines.push(`  - \`${route}\`${isRoot}${desc}`);

          if (page.data.sections && page.data.sections.length > 0) {
            for (const section of page.data.sections) {
              if (section.actions && section.actions.length > 0) {
                for (const act of section.actions) {
                  lines.push(`    - Action "${act.name}" (Trigger: \`${act.event}\`)`);
                  if (act.actionSteps && act.actionSteps.length > 0) {
                    for (const step of act.actionSteps) {
                      if (step.type === "api_call") {
                        const targetService = step.serviceNodeId ? lookup.getLabel(step.serviceNodeId) : "Backend";
                        const bindings = step.requestBindings && step.requestBindings.length > 0
                          ? ` [Bindings: ${step.requestBindings.map((b) => `${b.slot} ${b.targetField} <- ${b.source.kind}`).join(", ")}]`
                          : "";
                        lines.push(`      - Calls API: \`${step.name}\` on \`${targetService}\`${bindings}`);
                      } else if (step.type === "navigation") {
                        lines.push(`      - Navigates to: \`${step.targetRoute || "/"}\``);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      if (app.data.envVars && app.data.envVars.length > 0) {
        const envStr = formatEnvVars(app.data.envVars);
        if (envStr) lines.push(`- **Environment Variables**: ${envStr}`);
      }
      if (app.data.corsOrigins) {
        lines.push(`- **CORS Allowed Origins**: \`${app.data.corsOrigins}\``);
      }

      lines.push("");
    }
  }

  // 3. Backend Services & API Endpoints
  if (serviceNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## 3. Backend Services & API Endpoints");

    for (const service of serviceNodes) {
      const port = service.data.port || "8080";
      const grpcPort = service.data.grpcPort || "50051";
      const grpcActive = isGrpcEnabled(service, input.nodes, input.edges);
      const grpcStatus = grpcActive
        ? `**Enabled** (Port: \`${grpcPort}\`)`
        : `**Disabled** (Allocated Port: \`${grpcPort}\`)`;
      const techStackStr = service.data.techStack
        ? ` [${service.data.techStack}${service.data.techVersion ? ` v${service.data.techVersion}` : ""}]`
        : "";

      lines.push(`### Service: \`${service.data.label}\`${techStackStr}`);
      lines.push(`- **Network Protocols**: HTTP Port: \`${port}\` | gRPC: ${grpcStatus}`);

      if (service.data.interServiceProtocol) {
        lines.push(`- **Inter-Service Protocol**: \`${service.data.interServiceProtocol.toUpperCase()}\``);
      }
      if (service.data.rateLimit) {
        lines.push(`- **Rate Limit**: \`${service.data.rateLimit}\``);
      }
      if (service.data.timeout !== undefined) {
        lines.push(`- **Timeout**: ${service.data.timeout}ms`);
      }
      if (service.data.cors) {
        lines.push(`- **CORS**: Enabled${service.data.corsOrigins ? ` (Origins: \`${service.data.corsOrigins}\`)` : ""}`);
      }

      const realtimeFeatures: string[] = [];
      if (service.data.enableWebSocket) realtimeFeatures.push("WebSocket");
      if (service.data.enableSse) realtimeFeatures.push("Server-Sent Events (SSE)");
      if (service.data.enableRealtime) realtimeFeatures.push("Realtime Sync");
      if (realtimeFeatures.length > 0) {
        lines.push(`- **Realtime Features**: ${realtimeFeatures.join(", ")}`);
      }

      if (service.data.envVars && service.data.envVars.length > 0) {
        const envStr = formatEnvVars(service.data.envVars);
        if (envStr) lines.push(`- **Environment Variables**: ${envStr}`);
      }

      if (service.data.publishedEvents && service.data.publishedEvents.length > 0) {
        const pubStr = service.data.publishedEvents.map((e) => `\`${e.name}\``).join(", ");
        lines.push(`- **Published Events**: ${pubStr}`);
      }
      if (service.data.consumedEvents && service.data.consumedEvents.length > 0) {
        const conStr = service.data.consumedEvents.map((e) => `\`${e.name}\``).join(", ");
        lines.push(`- **Consumed Events**: ${conStr}`);
      }

      const serviceEndpoints = endpoints.filter((ep) => ep.nodeId === service.id);

      if (serviceEndpoints.length === 0) {
        lines.push("- *No endpoints defined yet*");
      } else {
        lines.push("- **Endpoints**: ");
        for (const ep of serviceEndpoints) {
          const method = ep.type || "GET";
          const route = ep.name.startsWith("/") ? ep.name : `/${ep.name}`;
          const authBadge = ep.requireAuth === false ? " [Public]" : ep.requireAuth === true ? " [Protected]" : "";
          lines.push(`  - \`${method} ${route}\`${authBadge}`);

          if (ep.summary) lines.push(`    - Summary: ${ep.summary}`);
          if (ep.businessLogic) lines.push(`    - Business Logic: ${ep.businessLogic}`);

          if (ep.headers && ep.headers.length > 0) {
            const hStr = ep.headers.map((h) => `${h.name}: ${h.type}${h.required ? " (required)" : ""}`).join(", ");
            lines.push(`    - Request Headers: ${hStr}`);
          }

          if (ep.pathParams && ep.pathParams.length > 0) {
            const pStr = ep.pathParams.map((p) => `${p.name}: ${p.type}${p.required ? " (required)" : ""}`).join(", ");
            lines.push(`    - Path Parameters: ${pStr}`);
          }

          if (ep.queryParams && ep.queryParams.length > 0) {
            const qStr = ep.queryParams.map((q) => `${q.name}: ${q.type}${q.defaultValue ? ` (default: "${q.defaultValue}")` : ""}`).join(", ");
            lines.push(`    - Query Parameters: ${qStr}`);
          }

          if (ep.requestBody && ep.requestBody.fields && ep.requestBody.fields.length > 0) {
            const fStr = ep.requestBody.fields.map((f) => `${f.name}: ${f.type}${f.required ? " (required)" : ""}`).join(", ");
            lines.push(`    - Request Body: { ${fStr} }`);
          }

          if (ep.responseBody && ep.responseBody.fields && ep.responseBody.fields.length > 0) {
            const rStr = ep.responseBody.fields.map((f) => `${f.name}: ${f.type}`).join(", ");
            lines.push(`    - Response Body: { ${rStr} }`);
          }

          if (ep.pipelineSteps && ep.pipelineSteps.length > 0) {
            lines.push(`    - Pipeline Execution Steps:`);
            let stepIdx = 1;
            for (const step of ep.pipelineSteps) {
              if (step.type === "langgraph_invoke") {
                const targetName = step.langGraphTargetNodeId ? lookup.getLabel(step.langGraphTargetNodeId) : "LangGraph Agent";
                const mapping = step.langGraphStateMapping ? JSON.stringify(step.langGraphStateMapping) : "{}";
                const threadSrc = step.langGraphThreadIdSource ? `threadId from ${step.langGraphThreadIdSource}` : "";
                lines.push(`      ${stepIdx}. \`langgraph_invoke\`: Invokes "${targetName}" (${threadSrc}, stateMapping: ${mapping})`);
              } else if (step.type === "db_operation") {
                const tblName = step.tableNodeId ? lookup.getLabel(step.tableNodeId) : "Database Table";
                const opName = step.functionRef?.name || step.operationId || step.name;
                const outStr = step.outputVariable ? ` -> ${step.outputVariable}` : "";
                const bStr = step.inputBindings && step.inputBindings.length > 0
                  ? step.inputBindings.map((b) => `${b.argName} <- ${formatBindingSource(b.source)}`).join(", ")
                  : "";
                lines.push(`      ${stepIdx}. \`db_operation\`: Calls \`${opName}\` on "${tblName}"${bStr ? ` ({ ${bStr} })` : ""}${outStr}`);
              } else if (step.type === "return_response") {
                const code = step.statusCode ? `status ${step.statusCode}` : "status 200";
                const bStr = step.inputBindings && step.inputBindings.length > 0
                  ? step.inputBindings.map((b) => `${b.argName} <- ${formatBindingSource(b.source)}`).join(", ")
                  : "";
                lines.push(`      ${stepIdx}. \`return_response\`: ${code}${bStr ? ` ({ ${bStr} })` : ""}`);
              } else {
                lines.push(`      ${stepIdx}. \`${step.type}\`: ${step.name}`);
              }
              stepIdx++;
            }
          }
        }
      }
      lines.push("");
    }
  }

  // 4. AI & Agent Workflows (LangGraph)
  if (langGraphNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## 4. AI & Agent Workflows (LangGraph)");

    for (const lg of langGraphNodes) {
      lines.push(`### Graph: \`${lg.data.label}\``);

      if (lg.data.stateChannels && lg.data.stateChannels.length > 0) {
        lines.push("- **State Channels**:");
        for (const sc of lg.data.stateChannels) {
          const redStr = sc.reducer ? `, reducer: \`${sc.reducer}\`` : "";
          lines.push(`  - \`${sc.key}\`: type \`${sc.type}\`${redStr}`);
        }
      }

      if (lg.data.inputChannels && lg.data.inputChannels.length > 0) {
        lines.push("- **Input Channels**:");
        for (const ic of lg.data.inputChannels) {
          const req = ic.required ? "required" : "optional";
          lines.push(`  - \`${ic.key}\`: \`${ic.type}\` (${req}) -> maps to state channel \`${ic.stateChannelKey || ic.key}\``);
        }
      }

      if (lg.data.memoryDefinitions && lg.data.memoryDefinitions.length > 0) {
        lines.push("- **Memory & Checkpointing**:");
        for (const mem of lg.data.memoryDefinitions) {
          lines.push(`  - Checkpointer: \`${mem.checkpointer}\` (scope: \`${mem.threadScope}\`, threadIdKey: \`${mem.threadIdKey || "thread_id"}\`)`);
        }
      }

      if (lg.data.agentDefinitions && lg.data.agentDefinitions.length > 0) {
        lines.push("- **Agent Nodes**:");
        for (const ag of lg.data.agentDefinitions) {
          const llm = ag.llmConfig;
          const llmStr = llm ? `${llm.provider} / ${llm.model} (temperature: ${llm.temperature})` : "Manual Logic";
          lines.push(`  - **${ag.name}** (\`${ag.agentId}\`): LLM: ${llmStr}`);
          if (ag.stateUpdates && ag.stateUpdates.length > 0) {
            for (const su of ag.stateUpdates) {
              lines.push(`    - State Update: channel=\`${su.channelKey}\`, reducer=\`${su.reducer}\`, value="${su.value || ""}"`);
            }
          }
          if (ag.pipelineSteps && ag.pipelineSteps.length > 0) {
            lines.push(`    - Agent Execution Steps:`);
            let agStepIdx = 1;
            for (const step of ag.pipelineSteps) {
              if (step.type === "db_operation") {
                const tblName = step.tableNodeId ? lookup.getLabel(step.tableNodeId) : "Database Table";
                const opName = step.functionRef?.name || step.operationId || step.name;
                const outStr = step.outputVariable ? ` -> ${step.outputVariable}` : "";
                lines.push(`      ${agStepIdx}. \`db_operation\`: Calls \`${opName}\` on "${tblName}"${outStr}`);
              } else {
                lines.push(`      ${agStepIdx}. \`${step.type}\`: ${step.name}`);
              }
              agStepIdx++;
            }
          }
        }
      }

      if (lg.data.graphEdges && lg.data.graphEdges.length > 0) {
        lines.push("- **Execution Flow**:");
        for (const ge of lg.data.graphEdges) {
          const targets = ge.targets ? ge.targets.map((t) => t.id).join(", ") : "END";
          lines.push(`  - \`${ge.source}\` -> \`${targets}\``);
        }
      }

      if (lg.data.memoryConfig) {
        const mc = lg.data.memoryConfig;
        lines.push(`- **Memory Config**: Checkpointer: \`${mc.checkpointer || "memory"}\`, Thread Scope: \`${mc.threadScope || "session"}\`, Max Messages: ${mc.maxWindowMessages || 10}, Auto-Summarize: ${mc.autoSummarize ? "Enabled" : "Disabled"}`);
      }
      if (lg.data.envVars && lg.data.envVars.length > 0) {
        const envStr = formatEnvVars(lg.data.envVars);
        if (envStr) lines.push(`- **Environment Variables**: ${envStr}`);
      }

      lines.push("");
    }
  }

  // Compute & Data Transformers
  if (transformerNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Compute & Data Transformers");

    for (const tf of transformerNodes) {
      const fnName = tf.data.functionName || tf.data.label || "Transformer";
      const scope = (tf.data.scope || "global").toUpperCase();
      const asyncStr = tf.data.isAsync ? " [Async]" : "";
      lines.push(`### Transformer: \`${fnName}\` (${scope}${asyncStr})`);

      if (tf.data.description) lines.push(`- **Description**: ${tf.data.description}`);

      if (tf.data.packageImports && tf.data.packageImports.length > 0) {
        const pkgs = tf.data.packageImports.map((p) => p.packageName).filter(Boolean).join(", ");
        if (pkgs) lines.push(`- **External Packages**: \`${pkgs}\``);
      }

      if (tf.data.inputSchema && tf.data.inputSchema.length > 0) {
        const inStr = tf.data.inputSchema.map((i) => `${i.name}: ${i.type}${i.required ? " (required)" : ""}`).join(", ");
        lines.push(`- **Input Schema**: \`(${inStr})\``);
      }

      if (tf.data.returnSchema && tf.data.returnSchema.length > 0) {
        const retStr = tf.data.returnSchema.map((r) => `${r.name}: ${r.type}`).join(", ");
        lines.push(`- **Return Schema**: \`{ ${retStr} }\``);
      }

      if (tf.data.logicMode === "natural_language" && tf.data.prompt) {
        lines.push(`- **Logic Mode**: Natural Language ("${tf.data.prompt}")`);
      } else if (tf.data.code) {
        lines.push(`- **Logic Mode**: Custom Code Implementation`);
      }
      lines.push("");
    }
  }

  // 5. Database & SchemaView (Entities & Relationships)
  if (databaseNodes.length > 0 || entityNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## 5. Database & SchemaView (Entities & Relationships)");

    for (const db of databaseNodes) {
      const engine = db.data.dbEngine || "PostgreSQL";
      const provider = db.data.provider ? ` (${db.data.provider})` : "";
      const version = db.data.lastConnectionStatus?.serverInfo?.version
        ? ` - ${String(db.data.lastConnectionStatus.serverInfo.version)}`
        : "";
      lines.push(`### Database: \`${db.data.label}\` [${engine}${provider}${version}]`);
      if (db.data.host) lines.push(`- Host: \`${db.data.host}:${db.data.port || "5432"}\` | Database: \`${db.data.database || "postgres"}\``);
      if (db.data.sslMode) lines.push(`- **SSL Mode**: \`${db.data.sslMode}\``);
      if (db.data.lastConnectionStatus?.latencyMs !== undefined) {
        lines.push(`- **Connection Status**: Reachable (${db.data.lastConnectionStatus.latencyMs}ms latency)`);
      }
      if (db.data.envVars && db.data.envVars.length > 0) {
        const envStr = formatEnvVars(db.data.envVars);
        if (envStr) lines.push(`- **Environment Variables**: ${envStr}`);
      }
      lines.push("");
    }

    // Group tables by their group
    const groupMap = new Map<string, BackendNode[]>();
    for (const ent of entityNodes) {
      const groupKey = ent.data.group || ent.data.groupId || "Application";
      const existing = groupMap.get(groupKey);
      if (existing) {
        existing.push(ent);
      } else {
        groupMap.set(groupKey, [ent]);
      }
    }

    for (const [groupName, tables] of groupMap.entries()) {
      lines.push(`#### Group: ${groupName} (${tables.length} tables)`);

      for (const table of tables) {
        const tableName = table.data.tableName || table.data.label;
        const desc = table.data.description ? ` - ${table.data.description}` : "";
        lines.push(`- **\`${tableName}\`**${desc}`);

        if (table.data.columns && table.data.columns.length > 0) {
          for (const col of table.data.columns) {
            lines.push(formatColumn(col));
          }
        }

        if (table.data.indexes && table.data.indexes.length > 0) {
          for (const idx of table.data.indexes) {
            const u = idx.isUnique ? " [UNIQUE]" : "";
            lines.push(`  - Index: \`${idx.name}\` on (${idx.columns})${u}`);
          }
        }

        if (table.data.redisDataStructure) {
          lines.push(`  - Redis Data Structure: \`${table.data.redisDataStructure}\``);
        }
        if (table.data.keyTemplate) {
          lines.push(`  - Key Template: \`${table.data.keyTemplate}\``);
        }
        if (table.data.cacheStrategy) {
          lines.push(`  - Cache Strategy: \`${table.data.cacheStrategy}\``);
        }

        const parentDb = input.nodes.find(
          (n) => n.id === table.data.databaseId || n.id === table.parentId,
        );
        const engine = parentDb?.data?.dbEngine || table.data.dbEngine || "postgres";
        const tableClone = { type: table.type, data: { ...table.data } };
        const dbOps: DbOperationFunction[] = getEntityDbOperations(tableClone, input.nodes, engine);

        if (dbOps.length > 0) {
          const activeCount = dbOps.filter((op) => op.enabled !== false).length;
          const disabledCount = dbOps.length - activeCount;
          const statusSuffix = disabledCount > 0
            ? ` (${activeCount} active, ${disabledCount} disabled)`
            : ` (${activeCount} active)`;
          lines.push(`  - **Database Operations${statusSuffix}**:`);
          for (const op of dbOps) {
            lines.push(formatDbOperation(op));
          }
        }
      }
      lines.push("");
    }
  }

  // Messaging & Event Streaming
  if (messagingNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Messaging & Event Streaming");
    for (const msg of messagingNodes) {
      lines.push(`### Stream / Queue: \`${msg.data.label}\` (Type: ${msg.type})`);
      if (msg.data.description) lines.push(`- **Description**: ${msg.data.description}`);
      if (msg.data.techStack) lines.push(`- **Engine**: ${msg.data.techStack}`);
      lines.push("");
    }
  }

  // Object Storage & File Buckets
  if (storageNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Object Storage & File Buckets");
    for (const st of storageNodes) {
      lines.push(`### Storage: \`${st.data.label}\` (Provider: ${st.data.storageProvider || "S3 Compatible"})`);
      if (st.data.description) lines.push(`- **Description**: ${st.data.description}`);
      if (st.data.bucketName) lines.push(`- **Bucket**: \`${st.data.bucketName}\``);
      if (st.data.buckets && st.data.buckets.length > 0) {
        lines.push(`- **Configured Buckets**: ${st.data.buckets.map((b) => b.name).join(", ")}`);
      }
      lines.push("");
    }
  }

  // Background Workers & Serverless Functions
  if (workerNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Background Workers & Serverless Functions");
    for (const wk of workerNodes) {
      const kind = wk.type === "serverless" ? "Serverless Function" : "Background Worker";
      lines.push(`### ${kind}: \`${wk.data.label}\``);
      if (wk.data.description) lines.push(`- **Description**: ${wk.data.description}`);
      if (wk.data.runtime) lines.push(`- **Runtime**: ${wk.data.runtime}`);
      if (wk.data.triggerType) lines.push(`- **Trigger**: ${wk.data.triggerType}`);
      if (wk.data.concurrency) lines.push(`- **Concurrency**: ${wk.data.concurrency}`);
      lines.push("");
    }
  }

  // Payments & Subscriptions
  if (paymentsNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Payments & Subscriptions");
    for (const pay of paymentsNodes) {
      lines.push(`### Payments: \`${pay.data.label}\` (Provider: ${pay.data.provider || "Creem"})`);
      if (pay.data.plans && pay.data.plans.length > 0) {
        lines.push("- **Plans**:");
        for (const plan of pay.data.plans) {
          lines.push(`  - \`${plan.name}\`: $${plan.price}/${plan.interval || "month"}`);
        }
      }
      lines.push("");
    }
  }

  // Client State Stores & Hooks
  if (stateStoreNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Client State Stores (Zustand & Hooks)");
    for (const store of stateStoreNodes) {
      const scope = store.data.scope ? ` (${store.data.scope})` : "";
      lines.push(`### State Store: \`${store.data.label || store.data.name}\`${scope}`);
      if (store.data.storage) lines.push(`- **Persistence**: ${store.data.storage}`);
      if (store.data.fields && store.data.fields.length > 0) {
        const fieldsStr = store.data.fields.map((f) => `${f.name}: ${f.type}`).join(", ");
        lines.push(`- **State Fields**: \`{ ${fieldsStr} }\``);
      }
      if (store.data.actions && store.data.actions.length > 0) {
        const actsStr = store.data.actions.map((a) => a.name).join(", ");
        lines.push(`- **Actions**: ${actsStr}`);
      }
      lines.push("");
    }
  }

  // External APIs & 3rd Party Integrations
  if (externalNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## External APIs & 3rd-Party Integrations");
    for (const ext of externalNodes) {
      const url = ext.data.baseUrl || ext.data.url || "";
      lines.push(`### External API: \`${ext.data.label || ext.data.functionName}\`${url ? ` (${url})` : ""}`);
      if (ext.data.description) lines.push(`- **Description**: ${ext.data.description}`);
      if (ext.data.authType) lines.push(`- **Auth Type**: ${ext.data.authType}`);
      lines.push("");
    }
  }

  // AI Models & MCP Servers
  if (aiNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## AI Models & MCP Servers");
    for (const ai of aiNodes) {
      const kind = ai.type === "mcp_server" ? "MCP Server" : "LLM Model";
      lines.push(`### ${kind}: \`${ai.data.label}\``);
      if (ai.data.model) lines.push(`- **Model**: ${ai.data.model}`);
      if (ai.data.connectionType) lines.push(`- **Connection**: ${ai.data.connectionType}`);
      lines.push("");
    }
  }

  // Canvas Resource References
  if (referenceNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Canvas Resource References");
    for (const ref of referenceNodes) {
      const target = ref.data.targetServiceId || ref.data.targetEndpointId || ref.data.tableRef || ref.data.transformerRef || "";
      lines.push(`- **${ref.data.label || ref.id}** (\`${ref.type}\`)${target ? ` -> References \`${target}\`` : ""}`);
    }
    lines.push("");
  }

  // Other Canvas Nodes
  if (otherNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Additional Canvas Nodes");
    for (const ot of otherNodes) {
      lines.push(`- **${ot.data.label || ot.id}** (Type: \`${ot.type}\`)${ot.data.description ? ` - ${ot.data.description}` : ""}`);
    }
    lines.push("");
  }

  // 6. Connections & System Flows (Edges Explanation)
  if (input.edges.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Relationships & System Data Flow (Connections)");

    const clientToServiceFlows: string[] = [];
    const serviceToLangGraphFlows: string[] = [];
    const authConnections: string[] = [];
    const foreignKeyFlows: string[] = [];
    const databaseConnections: string[] = [];
    const typeReferenceFlows: string[] = [];
    const otherConnections: string[] = [];

    for (const edge of input.edges) {
      const sourceNode = lookup.getNode(edge.source);
      const targetNode = lookup.getNode(edge.target);
      const sourceLabel = sourceNode ? lookup.getLabel(edge.source) : edge.source;
      const targetLabel = targetNode ? lookup.getLabel(edge.target) : edge.target;

      if (edge.type === "foreign-key") {
        let fkDetail = `${sourceLabel} -> ${targetLabel}`;
        if (targetNode?.data.columns) {
          for (const col of targetNode.data.columns) {
            if (col.references && col.references.table === (sourceNode?.data.tableName || sourceNode?.data.label)) {
              fkDetail = `\`${targetLabel}.${col.name}\` -> \`${sourceLabel}.${col.references.column}\``;
              break;
            }
          }
        }
        foreignKeyFlows.push(`- ${fkDetail}`);
      } else if (edge.type === "identity-connection") {
        authConnections.push(`- \`${sourceLabel}\` -> \`${targetLabel}\` (Enforces authentication and user session control)`);
      } else if (edge.type === "database-connection") {
        databaseConnections.push(`- \`${sourceLabel}\` -> \`${targetLabel}\``);
      } else if (edge.type === "type-reference") {
        typeReferenceFlows.push(`- \`${sourceLabel}\` -> \`${targetLabel}\` (Generates companion TypeScript interface)`);
      } else if (edge.type === "connection") {
        if (sourceNode?.type === "webPage" && targetNode?.type === "service") {
          let epName = "API Endpoint";
          if (edge.targetHandle && edge.targetHandle.startsWith("endpoint-in-")) {
            const epId = edge.targetHandle.replace("endpoint-in-", "");
            const ep = lookup.getEndpoint(epId);
            if (ep) epName = `${ep.type || "GET"} ${ep.name}`;
          }
          clientToServiceFlows.push(`- Page \`${sourceLabel}\` -> Service \`${targetLabel}\`: Invokes \`${epName}\``);
        } else if (sourceNode?.type === "langgraph" && targetNode?.type === "service") {
          let epName = "API Endpoint";
          if (edge.targetHandle && edge.targetHandle.startsWith("endpoint-in-")) {
            const epId = edge.targetHandle.replace("endpoint-in-", "");
            const ep = lookup.getEndpoint(epId);
            if (ep) epName = `${ep.type || "POST"} ${ep.name}`;
          }
          serviceToLangGraphFlows.push(`- Service \`${targetLabel}\` (\`${epName}\`) -> LangGraph \`${sourceLabel}\` (Invoked by route pipeline)`);
        } else if (sourceNode?.type === "webApp" && targetNode?.type === "webPage") {
          clientToServiceFlows.push(`- WebApp \`${sourceLabel}\` hosts page \`${targetLabel}\``);
        } else if (sourceNode?.type === "transformer" || edge.sourceHandle === "transformer-out") {
          let targetDetail = `Service \`${targetLabel}\``;
          if (edge.targetHandle && edge.targetHandle.startsWith("endpoint-in-")) {
            const epId = edge.targetHandle.replace("endpoint-in-", "");
            const ep = lookup.getEndpoint(epId);
            if (ep) targetDetail = `Endpoint \`${ep.type || "POST"} ${ep.name}\` on \`${targetLabel}\``;
          }
          clientToServiceFlows.push(`- Transformer \`${sourceLabel}\` -> ${targetDetail} (Data transformation helper)`);
        } else {
          otherConnections.push(`- \`${sourceLabel}\` -> \`${targetLabel}\` (type: ${edge.type})`);
        }
      } else {
        otherConnections.push(`- \`${sourceLabel}\` -> \`${targetLabel}\` (type: ${edge.type})`);
      }
    }

    if (clientToServiceFlows.length > 0) {
      lines.push("### Client to Backend Service Flows");
      for (const flow of clientToServiceFlows) lines.push(flow);
      lines.push("");
    }

    if (serviceToLangGraphFlows.length > 0) {
      lines.push("### Backend Service to Agent Workflow Flows");
      for (const flow of serviceToLangGraphFlows) lines.push(flow);
      lines.push("");
    }

    if (authConnections.length > 0) {
      lines.push("### Identity & Authentication Bindings");
      for (const flow of authConnections) lines.push(flow);
      lines.push("");
    }

    if (foreignKeyFlows.length > 0) {
      lines.push("### Entity Relational Foreign Keys");
      for (const flow of foreignKeyFlows) lines.push(flow);
      lines.push("");
    }

    if (databaseConnections.length > 0) {
      lines.push("### Database Managed Tables");
      lines.push(`- Total tables connected to database: ${databaseConnections.length}`);
      lines.push("");
    }

    if (typeReferenceFlows.length > 0) {
      lines.push("### TypeScript Entity Schema Generation");
      lines.push(`- Total entity types generated: ${typeReferenceFlows.length}`);
      lines.push("");
    }

    if (otherConnections.length > 0) {
      lines.push("### Other Active Connections");
      for (const flow of otherConnections) lines.push(flow);
      lines.push("");
    }
  }

  // 7. Security & Test Personas
  if (authNodes.length > 0 || (input.testUsers && input.testUsers.length > 0)) {
    lines.push("---");
    lines.push("");
    lines.push("## 7. Security, Auth & Test Personas");

    for (const auth of authNodes) {
      lines.push(`### Auth Framework: \`${auth.data.label}\``);
      if (auth.data.plugins && auth.data.plugins.length > 0) {
        lines.push(`- **Plugins**: ${auth.data.plugins.join(", ")}`);
      }
      if (auth.data.redirects) {
        const red = auth.data.redirects;
        lines.push(`- **Redirect Routes**: Sign In: \`${red.signInPageUrl || "/login"}\`, Sign Up: \`${red.signUpPageUrl || "/register"}\`, Dashboard: \`${red.signInRedirectUrl || "/dashboard"}\``);
      }
      if (auth.data.envVars && auth.data.envVars.length > 0) {
        const envStr = formatEnvVars(auth.data.envVars);
        if (envStr) lines.push(`- **Environment Variables**: ${envStr}`);
      }
      if (auth.data.tableMappings) {
        const mappings = Object.entries(auth.data.tableMappings)
          .filter(([_, v]) => Boolean(v))
          .map(([k, v]) => `${k} -> \`${lookup.getLabel(v)}\``)
          .join(", ");
        if (mappings) lines.push(`- **Table Mappings**: ${mappings}`);
      }
      lines.push("");
    }

    if (input.testUsers && input.testUsers.length > 0) {
      lines.push("### Test Personas & Seed Fixtures");
      for (const persona of input.testUsers) {
        lines.push(`- **Persona**: ${persona.name} (\`${persona.id}\`)`);
        if (persona.description) lines.push(`  - Description: ${persona.description}`);
        if (persona.records && persona.records.length > 0) {
          lines.push(`  - Pre-seeded records (${persona.records.length}):`);
          for (const rec of persona.records) {
            const fEntries = Object.entries(rec.fields)
              .filter(([k]) => k !== "token")
              .map(([k, v]) => `${k}="${String(v)}"`)
              .join(", ");
            lines.push(`    - Table \`${rec.tableName}\`: ${fEntries}`);
          }
        }
        if (persona.activeAuthToken) {
          lines.push(`  - Auth Token: Active Bearer JWT available for simulation testing`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

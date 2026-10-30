import type { ProjectSystemContextInput } from "./formatSystemContext";

export type IssueCategory = "structural" | "execution" | "runtime" | "security";
export type IssueSeverity = "critical" | "high" | "medium" | "low";

export interface ArchitectureIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  nodeId?: string;
  remediation: string;
}

export interface ArchitectureCompletenessReport {
  score: number; // 0 - 100
  status: "production_ready" | "needs_attention" | "action_required";
  summary: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    totalIssues: number;
  };
  issues: ArchitectureIssue[];
  passedChecks: string[];
}

/**
 * Validates a project's canvas architecture for operational completeness,
 * detecting missing execution bindings, dangling route references, ownership checks,
 * checkpointer persistence mismatches, and protocol ambiguities before code generation.
 */
export function validateArchitectureCompleteness(
  input: ProjectSystemContextInput
): ArchitectureCompletenessReport {
  const issues: ArchitectureIssue[] = [];
  const passedChecks: string[] = [];

  const nodes = input.nodes || [];
  const edges = input.edges || [];
  const endpoints = input.endpoints || [];

  const webAppNodes = nodes.filter((n) => n.type === "webApp");
  const webPageNodes = nodes.filter((n) => n.type === "webPage");
  const serviceNodes = nodes.filter((n) => n.type === "service");
  const langGraphNodes = nodes.filter((n) => n.type === "langgraph" || n.type === "langgraph_step");
  const entityNodes = nodes.filter((n) => n.type === "entity");
  const stateStoreNodes = nodes.filter((n) => n.type === "state_store");

  const definedRoutes = new Set<string>();
  for (const page of webPageNodes) {
    const route = page.data.label || page.data.path;
    if (route) definedRoutes.add(route.trim());
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Critical: Frontend-to-Backend Message Flow Integrity
  // ─────────────────────────────────────────────────────────────────────────────
  const messageActionPages = webPageNodes.filter((page) => {
    const sections = page.data.sections || [];
    return sections.some((s: any) =>
      (s.actions || []).some((act: any) => {
        const name = (act.name || "").toLowerCase();
        return name.includes("message") || name.includes("send") || name.includes("chat") || name.includes("prompt");
      })
    );
  });

  if (messageActionPages.length > 0) {
    let hasMessageApiCall = false;
    for (const page of messageActionPages) {
      for (const section of page.data.sections || []) {
        for (const act of section.actions || []) {
          for (const step of act.actionSteps || []) {
            if (step.type === "api_call") {
              hasMessageApiCall = true;
            }
          }
        }
      }
    }

    if (!hasMessageApiCall) {
      issues.push({
        id: "EXECUTION_FLOW_BROKEN",
        category: "execution",
        severity: "critical",
        title: "Frontend Send Message Action Missing Backend API Call",
        description:
          "Dashboard or Chat page defines a send-message action that mutates client state, but lacks an `api_call` step invoking `POST /send-message/:id`. Messages will never reach the backend Conversations service.",
        nodeId: messageActionPages[0]?.id,
        remediation:
          "Add an `api_call` step to the send message action that targets the Conversations service's `POST /send-message/:id` endpoint with payload bindings.",
      });
    } else {
      passedChecks.push("Frontend-to-backend API invocation pipeline connected");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Critical: Meaningful State Mutation Bindings
  // ─────────────────────────────────────────────────────────────────────────────
  const emptyLiteralMutations: string[] = [];
  for (const page of webPageNodes) {
    for (const section of page.data.sections || []) {
      for (const act of section.actions || []) {
        for (const step of act.actionSteps || []) {
          if (step.type === "state_mutation") {
            const val = (step as any).value;
            const sourceKind = (step as any).bindingSource?.kind || (step as any).source?.kind;
            if ((val === "" || val === undefined) && (!sourceKind || sourceKind === "inline")) {
              emptyLiteralMutations.push(`Page "${page.data.label || page.id}" in action "${act.name}"`);
            }
          }
        }
      }
    }
  }

  if (emptyLiteralMutations.length > 0) {
    issues.push({
      id: "STATE_MUTATION_EMPTY_LITERAL",
      category: "execution",
      severity: "critical",
      title: "State Mutation Binds to Empty Literal Value",
      description: `State mutations are updating store fields with literal empty strings: ${emptyLiteralMutations.join(", ")}. User input is not being forwarded to state.`,
      remediation:
        "Update the state mutation step to bind to the action form input or API response payload instead of an empty literal.",
    });
  } else {
    passedChecks.push("Client state mutations bind to dynamic user input or responses");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Critical: Realtime Stream Payload-to-State Mapping
  // ─────────────────────────────────────────────────────────────────────────────
  const unmappedStreamPages = webPageNodes.filter((page) => {
    const conns = page.data.realtimeConnections || [];
    return conns.some((rc: any) => {
      const isStream = rc.protocol === "sse" || rc.protocol === "websocket" || rc.isLangGraph;
      if (!isStream) return false;
      const binding = rc.storeActionBinding;
      return !binding || !binding.targetFieldName;
    });
  });

  if (unmappedStreamPages.length > 0) {
    issues.push({
      id: "REALTIME_PAYLOAD_UNMAPPED",
      category: "execution",
      severity: "critical",
      title: "Realtime SSE Subscription Missing Payload-to-State Mapping",
      description: `Realtime connection on ${unmappedStreamPages.map((p) => p.data.label || p.id).join(", ")} does not define which store field receives incoming streaming chunks. Incoming tokens will be discarded.`,
      nodeId: unmappedStreamPages[0]?.id,
      remediation:
        "Configure `storeActionBinding` on the realtime connection targeting `AppStore.message` with an `append` or `stream_delta` reducer.",
    });
  } else {
    passedChecks.push("Realtime streaming listeners mapped to state store fields");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Critical: Resource Ownership Authorization on Parametric Routes
  // ─────────────────────────────────────────────────────────────────────────────
  const protectedParamEndpoints = endpoints.filter((ep) => {
    const isProtected = ep.requireAuth !== false;
    const hasParam = (ep.name && ep.name.includes(":")) || (ep.pathParams && ep.pathParams.length > 0);
    return isProtected && hasParam;
  });

  for (const ep of protectedParamEndpoints) {
    const steps = ep.pipelineSteps || [];
    const hasOwnershipGuard = steps.some((step: any) => {
      if (step.type === "db_operation") {
        const opName = (step.functionRef?.name || step.name || "").toLowerCase();
        return opName.includes("owner") || opName.includes("user") || opName.includes("auth");
      }
      if (step.type === "condition") {
        return true;
      }
      return false;
    });

    if (!hasOwnershipGuard) {
      issues.push({
        id: "MISSING_OWNERSHIP_CHECK",
        category: "security",
        severity: "critical",
        title: `Endpoint "${ep.name}" Missing Resource Ownership Check`,
        description: `Protected endpoint \`${ep.type || "POST"} ${ep.name}\` accepts an entity ID parameter, but has no step verifying that \`auth.user.id\` owns or has access to the conversation before invoking agents.`,
        remediation:
          `Add a database lookup or guard step verifying that \`conversation.created_by === auth.user.id\` before executing LangGraph.`,
      });
    }
  }

  if (protectedParamEndpoints.length > 0 && !issues.some((i) => i.id === "MISSING_OWNERSHIP_CHECK")) {
    passedChecks.push("Resource ownership verification configured on parametric routes");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. High: State / Conversation Hydration on Page Load
  // ─────────────────────────────────────────────────────────────────────────────
  const detailPages = webPageNodes.filter((page) => {
    const label = page.data.label || page.data.path || "";
    return label.includes("[") && label.includes("]");
  });

  for (const page of detailPages) {
    const sections = page.data.sections || [];
    let hasHydrationApiCall = false;

    for (const section of sections) {
      for (const act of section.actions || []) {
        if (act.event === "pageLoad" || act.event === "onLoad") {
          for (const step of act.actionSteps || []) {
            if (step.type === "api_call") hasHydrationApiCall = true;
          }
        }
      }
    }

    if (!hasHydrationApiCall) {
      issues.push({
        id: "MISSING_PAGE_HYDRATION",
        category: "execution",
        severity: "high",
        title: `Dynamic Route "${page.data.label}" Missing History Hydration`,
        description: `Page \`${page.data.label}\` accesses dynamic entity parameters (e.g. \`[id]\`), but has no \`pageLoad\` API call to fetch existing conversation message history on initial load.`,
        nodeId: page.id,
        remediation:
          `Add a \`pageLoad\` action calling \`GET /conversations/:id\` to hydrate previous conversation history into \`AppStore\`.`,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. High: Checkpointer Persistence Alignment
  // ─────────────────────────────────────────────────────────────────────────────
  const hasCheckpointTables = entityNodes.some((e) => {
    const name = (e.data.tableName || e.data.label || "").toLowerCase();
    return name.includes("checkpoint");
  });

  for (const lg of langGraphNodes) {
    const checkpointer = (lg.data.memoryConfig?.checkpointer || "memory").toLowerCase();
    if (hasCheckpointTables && checkpointer === "memory") {
      issues.push({
        id: "CHECKPOINTER_SCHEMA_MISMATCH",
        category: "runtime",
        severity: "high",
        title: "LangGraph Checkpointer Set to Memory Despite Postgres Checkpoint Tables",
        description:
          "The database schema contains Postgres LangGraph checkpoint tables, but the AI workflow checkpointer is configured as ephemeral `memory`. Conversation state will be wiped on server restart.",
        nodeId: lg.id,
        remediation:
          "Change LangGraph checkpointer from `memory` to `postgres` to enable persistent multi-turn conversations across deployments.",
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. High: Dangling Route References in Layouts and Redirects
  // ─────────────────────────────────────────────────────────────────────────────
  const referencedRoutes = new Set<string>();

  for (const app of webAppNodes) {
    for (const zone of app.data.zones || []) {
      const redirects = zone.rule?.redirects;
      if (redirects && typeof redirects === "object") {
        for (const target of Object.values(redirects)) {
          if (typeof target === "string" && target.startsWith("/")) {
            referencedRoutes.add(target.trim());
          }
        }
      }
    }
  }

  for (const page of webPageNodes) {
    for (const section of page.data.sections || []) {
      for (const act of section.actions || []) {
        for (const step of act.actionSteps || []) {
          if (step.type === "navigation" && step.targetRoute) {
            referencedRoutes.add(step.targetRoute.trim());
          }
        }
      }
    }
  }

  const danglingRoutes: string[] = [];
  for (const ref of referencedRoutes) {
    // Exact match or dynamic match (e.g. /chat/123 -> /chat/[id])
    const exists =
      definedRoutes.has(ref) ||
      Array.from(definedRoutes).some((def) => {
        if (def.includes("[") && def.includes("]")) {
          const prefix = def.split("[")[0] || "";
          return ref.startsWith(prefix);
        }
        return false;
      });

    if (!exists) {
      danglingRoutes.push(ref);
    }
  }

  if (danglingRoutes.length > 0) {
    issues.push({
      id: "DANGLING_ROUTE_REFERENCE",
      category: "structural",
      severity: "high",
      title: "Redirects and Navigation Target Non-Existent Web Pages",
      description: `Zone protection rules and navigation actions reference routes that do not exist as canvas pages: ${danglingRoutes.map((r) => `\`${r}\``).join(", ")}. Users will trigger 404s.`,
      remediation: `Create canvas \`webPage\` nodes for ${danglingRoutes.join(", ")} or update redirect targets.`,
    });
  } else {
    passedChecks.push("All redirect and navigation routes correspond to defined web pages");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Medium: Realtime Transport Coexistence & Protocol Ambiguity
  // ─────────────────────────────────────────────────────────────────────────────
  for (const svc of serviceNodes) {
    const wsEnabled =
      svc.data.enableWebSocket === true ||
      (svc.data.customDependencies || []).some((d: any) =>
        (typeof d === "string" ? d : d.name || "").includes("ws")
      );
    const hasSseEndpoints = endpoints.some((ep) => ep.nodeId === svc.id && (ep as any).isStreaming);

    if (wsEnabled && hasSseEndpoints) {
      issues.push({
        id: "AMBIGUOUS_REALTIME_TRANSPORT",
        category: "runtime",
        severity: "medium",
        title: "Service Enables Both WebSocket and Server-Sent Events (SSE)",
        description: `Service \`${svc.data.label}\` imports \`ws\` WebSocket dependencies while endpoints use SSE streaming. Transport responsibilities are ambiguous.`,
        nodeId: svc.id,
        remediation:
          "Designate SSE exclusively for LLM streaming and WebSockets for bi-directional presence/chat signaling, or standardize on a single protocol.",
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Medium: Endpoint Implementation Contract Completeness
  // ─────────────────────────────────────────────────────────────────────────────
  for (const ep of endpoints) {
    const hasLgStep = (ep.pipelineSteps || []).some((s: any) => s.type === "langgraph_invoke");
    if (hasLgStep) {
      const hasReqBody = ep.requestBody && ep.requestBody.fields && ep.requestBody.fields.length > 0;
      if (!hasReqBody) {
        issues.push({
          id: "INCOMPLETE_ENDPOINT_CONTRACT",
          category: "runtime",
          severity: "medium",
          title: `Streaming Endpoint "${ep.name}" Missing Request Schema Validation`,
          description: `Endpoint \`${ep.name}\` invokes an AI agent workflow but has no request body validation schema configured.`,
          remediation:
            "Define a request body schema containing `message: string` and optional parameters to prevent invalid agent invocations.",
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Score Calculation
  // ─────────────────────────────────────────────────────────────────────────────
  let deductions = 0;
  for (const issue of issues) {
    if (issue.severity === "critical") deductions += 20;
    else if (issue.severity === "high") deductions += 10;
    else if (issue.severity === "medium") deductions += 5;
    else if (issue.severity === "low") deductions += 2;
  }

  const score = Math.max(0, 100 - deductions);
  let status: ArchitectureCompletenessReport["status"] = "production_ready";
  if (score < 65) status = "action_required";
  else if (score < 90) status = "needs_attention";

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const highCount = issues.filter((i) => i.severity === "high").length;
  const mediumCount = issues.filter((i) => i.severity === "medium").length;
  const lowCount = issues.filter((i) => i.severity === "low").length;

  return {
    score,
    status,
    summary: {
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      totalIssues: issues.length,
    },
    issues,
    passedChecks,
  };
}

/**
 * Formats an ArchitectureCompletenessReport as readable Markdown diagnostic for AI prompts or reports.
 */
export function formatArchitectureDiagnostic(report: ArchitectureCompletenessReport): string {
  const lines: string[] = [];

  const statusBadge =
    report.status === "production_ready"
      ? "PASSED (Ready for Implementation)"
      : report.status === "needs_attention"
      ? "NEEDS ATTENTION (Configuration Incomplete)"
      : "ACTION REQUIRED (Critical Gaps Found)";

  lines.push(`### Architecture Completeness & Runtime Readiness`);
  lines.push(`- **Readiness Score**: ${report.score} / 100 [${statusBadge}]`);
  lines.push(
    `- **Audit Findings**: ${report.summary.criticalCount} Critical, ${report.summary.highCount} High, ${report.summary.mediumCount} Medium (${report.summary.totalIssues} total issues)`
  );
  lines.push("");

  if (report.issues.length > 0) {
    lines.push("#### Detected Gaps & Inconsistencies:");
    for (const issue of report.issues) {
      const tag = `[${issue.severity.toUpperCase()} | ${issue.category.toUpperCase()}]`;
      lines.push(`- **${tag} ${issue.title}**`);
      lines.push(`  - *Problem*: ${issue.description}`);
      lines.push(`  - *Remediation*: ${issue.remediation}`);
    }
    lines.push("");
  }

  if (report.passedChecks.length > 0) {
    lines.push("#### Verified Complete Contracts:");
    for (const check of report.passedChecks) {
      lines.push(`- [x] ${check}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

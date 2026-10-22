import { AvailableSource, StepSource } from "../types";

export function stepSourceToAccessor(
  source: StepSource,
  availableSources?: AvailableSource[],
): string {
  if (source.kind === "req_body") {
    return source.field ? `body.${source.field}` : "body";
  }
  if (source.kind === "req_params") {
    return source.field ? `params.${source.field}` : "params";
  }
  if (source.kind === "req_query") {
    return source.field ? `query.${source.field}` : "query";
  }
  if (source.kind === "req_headers") {
    return source.field ? `headers.${source.field}` : "headers";
  }
  if (source.kind === "auth") {
    return source.field ? `auth.${source.field}` : "auth";
  }
  if (source.kind === "env") {
    return source.field ? `env.${source.field}` : "env";
  }
  if (source.kind === "step_output") {
    const matched = availableSources?.find(
      (s) => s.kind === "step_output" && s.stepId === source.stepId,
    );
    const varName = matched?.variableName || source.stepId;
    return source.field ? `${varName}.${source.field}` : varName;
  }
  if (source.kind === "inline") {
    return source.value !== undefined && source.value !== "" ? String(source.value) : "inline:";
  }
  return "";
}

export function accessorToStepSource(
  accessor: string,
  availableSources?: AvailableSource[],
): StepSource {
  const trimmed = (accessor || "").trim();
  if (!trimmed) {
    return { kind: "req_body", field: "" };
  }
  if (trimmed.startsWith("auth.") || trimmed === "auth") {
    return { kind: "auth", field: trimmed === "auth" ? "" : trimmed.slice(5) };
  }
  if (trimmed.startsWith("body.") || trimmed === "body") {
    return { kind: "req_body", field: trimmed === "body" ? "" : trimmed.slice(5) };
  }
  if (trimmed.startsWith("event.") || trimmed === "event") {
    return { kind: "req_body", field: trimmed === "event" ? "" : trimmed.slice(6) };
  }
  if (trimmed.startsWith("params.") || trimmed === "params") {
    return { kind: "req_params", field: trimmed === "params" ? "" : trimmed.slice(7) };
  }
  if (trimmed.startsWith("query.") || trimmed === "query") {
    return { kind: "req_query", field: trimmed === "query" ? "" : trimmed.slice(6) };
  }
  if (trimmed.startsWith("headers.") || trimmed === "headers") {
    return { kind: "req_headers", field: trimmed === "headers" ? "" : trimmed.slice(8) };
  }
  const headerMatch = trimmed.match(/(?:req\.)?headers\[['"]([^'"]+)['"]\]/);
  if (headerMatch) {
    return { kind: "req_headers", field: headerMatch[1] };
  }
  if (
    trimmed === "env" ||
    trimmed === "process.env" ||
    trimmed.startsWith("env.") ||
    trimmed.startsWith("process.env.")
  ) {
    const field = trimmed.startsWith("process.env.")
      ? trimmed.slice(12)
      : trimmed.startsWith("env.")
      ? trimmed.slice(4)
      : "";
    return { kind: "env", field };
  }
  if (availableSources) {
    for (const src of availableSources) {
      if (src.kind === "step_output" && src.stepId) {
        const varName = src.variableName;
        if (varName && (trimmed === varName || trimmed.startsWith(`${varName}.`))) {
          const field = trimmed === varName ? "" : trimmed.slice(varName.length + 1);
          return { kind: "step_output", stepId: src.stepId, field };
        }
        if (trimmed === src.stepId || trimmed.startsWith(`${src.stepId}.`)) {
          const field = trimmed === src.stepId ? "" : trimmed.slice(src.stepId.length + 1);
          return { kind: "step_output", stepId: src.stepId, field };
        }
      }
    }
  }
  if (
    trimmed.startsWith("`") ||
    trimmed.startsWith('"') ||
    trimmed.startsWith("'") ||
    trimmed.includes("${") ||
    trimmed.startsWith("inline:")
  ) {
    const val = trimmed.startsWith("inline:") ? trimmed.slice(7).trim() : trimmed;
    return { kind: "inline", value: val };
  }
  return { kind: "req_body", field: trimmed };
}

/**
 * Identifies channels that already have dedicated UI sections:
 * - thread_id / threadId: handled by the Session Thread ID card (checkpointer configurable)
 * - messages / message: handled by the Conversation & Messages Input card when langGraphMessagesConfig is active
 */
export function isDedicatedChannel(
  key: string,
  stateChannelKey?: string,
  hasDedicatedMessages: boolean = true,
): boolean {
  if (!key) return true;
  const lower = key.toLowerCase();
  if (lower === "thread_id" || lower === "threadid") return true;

  // Any channel that maps to state "messages" is an input alias for conversation messages
  if (stateChannelKey) {
    const parts = stateChannelKey.split(",").map((s) => s.trim().toLowerCase());
    if (parts.includes("messages")) return true;
  }

  if (hasDedicatedMessages && lower === "messages") return true;
  return false;
}

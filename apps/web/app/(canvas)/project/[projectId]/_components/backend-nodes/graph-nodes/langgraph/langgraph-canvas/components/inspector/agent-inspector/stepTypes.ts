import React from "react";
import {
  Bot,
  Zap,
  FileJson,
  Radio,
  Terminal,
  Wrench,
  Shield,
  Shuffle,
} from "lucide-react";
import type {
  AgentNodeData,
  LangGraphNodeStepType,
  LangGraphNodePipelineStep,
} from "@workspace/canvas";

// ─────────────────────────────────────────────────────────────────────────────
// Step Metadata Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface LangGraphStepMeta {
  type: LangGraphNodeStepType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  borderColor: string;
  badgeBg: string;
  description: string;
}

export const LANGGRAPH_STEP_META: Record<LangGraphNodeStepType, LangGraphStepMeta> = {
  state_updates: {
    type: "state_updates",
    label: "State Updates",
    icon: Zap,
    color: "text-amber-400",
    borderColor: "border-amber-500/40",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    description: "Commit returned channels, reducers, and expressions to graph state",
  },
  llm_call: {
    type: "llm_call",
    label: "LLM Agent",
    icon: Bot,
    color: "text-sky-400",
    borderColor: "border-sky-500/40",
    badgeBg: "bg-sky-500/10 text-sky-300 border-sky-500/25",
    description: "Model, prompt, tools, structured output, middleware & streaming",
  },
  custom_code: {
    type: "custom_code",
    label: "Custom Code",
    icon: Terminal,
    color: "text-emerald-400",
    borderColor: "border-emerald-500/40",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
    description: "Inline TypeScript logic: (state, clone) => Partial<State>",
  },
  streaming: {
    type: "streaming",
    label: "Event Streaming",
    icon: Radio,
    color: "text-cyan-400",
    borderColor: "border-cyan-500/40",
    badgeBg: "bg-cyan-500/10 text-cyan-300 border-cyan-500/25",
    description: "SSE token streaming presets and custom event deltas",
  },
  tools: {
    type: "tools",
    label: "Attach Tools",
    icon: Wrench,
    color: "text-teal-400",
    borderColor: "border-teal-500/40",
    badgeBg: "bg-teal-500/10 text-teal-300 border-teal-500/25",
    description: "Connect canvas tool references, MCP endpoints, and functions",
  },
  structured_output: {
    type: "structured_output",
    label: "Structured Output",
    icon: FileJson,
    color: "text-fuchsia-400",
    borderColor: "border-fuchsia-500/40",
    badgeBg: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/25",
    description: "JSON Schema response enforcement and formatting",
  },
  middleware: {
    type: "middleware",
    label: "Middleware Pipeline",
    icon: Shield,
    color: "text-purple-400",
    borderColor: "border-purple-500/40",
    badgeBg: "bg-purple-500/10 text-purple-300 border-purple-500/25",
    description: "Guardrails, Human-in-the-Loop approvals, and rate limiting",
  },
  transformer: {
    type: "transformer",
    label: "Transformer",
    icon: Shuffle,
    color: "text-purple-400",
    borderColor: "border-purple-500/40",
    badgeBg: "bg-purple-500/10 text-purple-300 border-purple-500/25",
    description: "Compute node for data transformation & custom TypeScript logic",
  },
  transform: {
    type: "transform",
    label: "Transformer",
    icon: Shuffle,
    color: "text-purple-400",
    borderColor: "border-purple-500/40",
    badgeBg: "bg-purple-500/10 text-purple-300 border-purple-500/25",
    description: "Compute node for data transformation & custom TypeScript logic",
  },
};

/**
 * Primary Addable Node Execution Steps
 * (Tools, Structured Output, Middleware, and Event Streaming are grouped inside LLM Agent;
 *  State Updates is the pinned terminal return step)
 */
export const ADDABLE_LANGGRAPH_STEP_TYPES: readonly LangGraphNodeStepType[] = [
  "llm_call",
  "transformer",
];

// ─────────────────────────────────────────────────────────────────────────────
// Initial Step Derivation for Backwards Compatibility
// ─────────────────────────────────────────────────────────────────────────────

export function deriveInitialPipelineSteps(
  data: AgentNodeData,
  connectedLLMId?: string | null,
  connectedToolIds?: string[],
  connectedMiddlewareIds?: string[],
): LangGraphNodePipelineStep[] {
  // If user already saved pipelineSteps, return them directly (including empty array)
  if (Array.isArray(data.pipelineSteps)) {
    return data.pipelineSteps;
  }

  // If user saved legacy nodeSteps, normalize and map to pipeline steps with stable IDs
  if (Array.isArray(data.nodeSteps)) {
    if (data.nodeSteps.length === 0) {
      return [];
    }
    const steps: LangGraphNodePipelineStep[] = [];
    let codeIndex = 0;
    let llmIndex = 0;
    for (let i = 0; i < data.nodeSteps.length; i++) {
      const s = data.nodeSteps[i];
      if (s === "transformer" || s === "transform") {
        codeIndex++;
        steps.push({
          id: `step_trans_${codeIndex}`,
          type: "transformer",
          label: `Transformer ${codeIndex}`,
          outputVariable: `transformedData_${codeIndex}`,
          outputSchema: [{ name: "result", type: "string", required: true }],
          inputBindings: [],
        });
      } else if (s === "custom_code") {
        codeIndex++;
        steps.push({
          id: `step_code_${codeIndex}`,
          type: "custom_code",
          label:
            codeIndex === 1 && !steps.some((st) => st.type === "llm_call")
              ? "Pre-processing"
              : `Custom Code ${codeIndex}`,
          customCode: data.customCode || {
            body: "// TypeScript logic: (state, clone) => Partial<State>\nreturn {\n  // mutate channels\n};\n",
          },
        });
      } else if (
        s === "llm_call" ||
        s === "tools" ||
        s === "structured_output" ||
        s === "middleware" ||
        s === "streaming"
      ) {
        if (!steps.some((st) => st.type === "llm_call")) {
          llmIndex++;
          steps.push({
            id: `step_llm_${llmIndex}`,
            type: "llm_call",
            label: "LLM Agent",
          });
        }
      }
    }
    return steps;
  }

  // Otherwise infer initial steps from node properties
  const steps: LangGraphNodePipelineStep[] = [];
  const hasLLM = Boolean(connectedLLMId || data.llmConfig?.enabled);
  const hasPrompt = Boolean(
    data.systemPrompt &&
      data.systemPrompt.trim().length > 0 &&
      data.systemPrompt.trim() !== "System prompt / instructions for this node...",
  );
  const hasTools = Boolean(
    (connectedToolIds && connectedToolIds.length > 0) ||
      (data.tools && data.tools.length > 0),
  );
  const hasStructured = Boolean(data.responseFormat?.enabled);
  const hasMiddleware = Boolean(
    data.middlewareConfig?.enabled ||
      (connectedMiddlewareIds && connectedMiddlewareIds.length > 0),
  );
  const hasStreaming = Boolean(data.streamConfig?.enabled);

  if (
    hasLLM ||
    hasPrompt ||
    hasTools ||
    hasStructured ||
    hasMiddleware ||
    hasStreaming
  ) {
    steps.push({
      id: "step_llm_1",
      type: "llm_call",
      label: "LLM Agent",
    });
  }

  if (data.customCode?.body && data.customCode.body.trim().length > 0) {
    steps.push({
      id: "step_code_1",
      type: "custom_code",
      label: steps.length > 0 ? "Post-processing" : "Custom Code",
      customCode: data.customCode,
    });
  }

  return steps;
}

import { AIMessage } from "@langchain/core/messages";
import type {
  LangGraphCanvasNode,
  LangGraphCanvasEdge,
  StepNode,
  StepNodeData,
  LangGraphLLMNode,
  ToolNode,
  TransformerParameter,
} from "@workspace/canvas";
import { formatStreamingBatch, type StreamBatchItem } from "../streamFormatter";
import type {
  SimulationStepLogEntry,
  SimulationStepLogLevel,
} from "../types";
import { callServerLLM } from "./llm";
import { clone, serializeMessages } from "./messages";
import type {
  ServerLLMProvider,
  StepStateValue,
  StepStateRecord,
  StepExecutionNode,
  TransformerCapableNode,
  TransformerExecutionConfig,
  StepExecutionInputSource,
} from "./types";

export interface ExecuteStepNodeParams {
  node: LangGraphCanvasNode;
  nodeName: string;
  state: Record<string, unknown>;
  edges: LangGraphCanvasEdge[];
  nodes: StepExecutionNode[];
  threadId: string;
  provider?: ServerLLMProvider;
  apiKey?: string;
  modelName?: string;
  nodeStreamBatchesMap: Map<string, StreamBatchItem[]>;
}

export interface ExecuteStepNodeResult {
  outputDelta: Record<string, unknown>;
  stepLogs: SimulationStepLogEntry[];
  latestAssistantResponse?: string;
}

// ─── Type Predicates ──────────────────────────────────────────────────────────

function isStepExecutionStepNode(node: StepExecutionNode): node is StepNode {
  return node.type === "step";
}

function isStepExecutionLLMNode(node: StepExecutionNode): node is LangGraphLLMNode {
  return node.type === "langgraph_llm";
}

function isStepExecutionToolNode(node: StepExecutionNode): node is ToolNode {
  return node.type === "langgraph_tool";
}

function isTransformerCapableNode(node: StepExecutionNode): node is TransformerCapableNode {
  return node.type === "transformer" || node.type === "transformer_ref";
}

// ─── Input & Output Resolution Helpers ────────────────────────────────────────

/**
 * Safely traverses nested objects and arrays using dot or bracket notation.
 * e.g. "user.profile.name" or "items[0].id"
 */
function getNestedValue(target: object | null | undefined, path: string | undefined) {
  if (!target || !path) return target;
  const parts = path
    .replace(/\[(\w+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let current: object | null | undefined = target;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    if (!key || !current || typeof current !== "object") return undefined;
    const value: StepStateValue = Reflect.get(current, key);
    if (i === parts.length - 1) return value;
    current = typeof value === "object" && value !== null ? value : null;
  }
  return current;
}

interface ResolveInputContext {
  state: Record<string, unknown>;
  stepOutputs: Map<string, StepStateValue>;
}

/**
 * Resolves an individual StepSource / binding into an evaluation value.
 * Supports:
 * - "step_output": output from an above step (by step ID or outputVariable)
 * - "state" / "req_body" / "req_params" / "req_query" / "req_headers": from StateGraph state
 * - "inline": literal constant or template string with ${...} interpolation
 * - "env": process.env value
 */
export function resolveInputValue(
  source: StepExecutionInputSource | undefined,
  ctx: ResolveInputContext,
): StepStateValue {
  if (!source) return undefined;

  switch (source.kind) {
    case "step_output": {
      const stepSource = "stepId" in source ? source : undefined;
      if (!stepSource?.stepId) return undefined;
      const stepVal = ctx.stepOutputs.get(stepSource.stepId);
      if (stepSource.field && typeof stepVal === "object" && stepVal !== null) {
        return getNestedValue(stepVal, stepSource.field);
      }
      return stepVal;
    }
    case "state":
    case "req_body":
    case "req_params":
    case "req_query":
    case "req_headers": {
      if (source.field) {
        return getNestedValue(ctx.state, source.field);
      }
      return ctx.state;
    }
    case "env": {
      if (source.field && typeof process !== "undefined" && process.env) {
        return process.env[source.field];
      }
      return undefined;
    }
    case "inline": {
      const v = "value" in source ? source.value : undefined;
      if (typeof v === "string") {
        if (/\$\{([^}]+)\}/.test(v)) {
          return v.replace(/\$\{([^}]+)\}/g, (_, expr: string) => {
            const trimmed = expr.trim();
            if (trimmed.startsWith("state.")) {
              const val = getNestedValue(ctx.state, trimmed.replace(/^state\./, ""));
              return val !== undefined ? String(val) : "";
            }
            if (ctx.stepOutputs.has(trimmed)) {
              return String(ctx.stepOutputs.get(trimmed) ?? "");
            }
            const fromState = getNestedValue(ctx.state, trimmed);
            if (fromState !== undefined) return String(fromState);
            return "";
          });
        }
        const trimmed = v.trim();
        if (
          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("[") && trimmed.endsWith("]"))
        ) {
          try {
            return JSON.parse(trimmed);
          } catch {
            return v;
          }
        }
      }
      return v;
    }
    default:
      return undefined;
  }
}

export interface ResolvedTransformerDef {
  id: string;
  name: string;
  code: string;
  isAsync: boolean;
  inputSchema?: TransformerParameter[];
  returnSchema?: TransformerParameter[];
}

/**
 * Discovers and resolves a reusable TransformerNode or TransformerRefNode
 * either connected via canvas edges or referenced by transformer ID / functionName.
 */
export function findTransformerNode(
  nodeId: string,
  stepConfig: TransformerExecutionConfig,
  nodes: StepExecutionNode[],
  edges: LangGraphCanvasEdge[],
): ResolvedTransformerDef | null {
  // 1. Direct canvas connection: Edge targeting this node from a transformer / transformer_ref node
  const edge = edges.find((e) => {
    if (e.target !== nodeId) return false;
    const srcNode = nodes.find((n) => n.id === e.source);
    if (!srcNode) return false;
    return (
      srcNode.type === "transformer" ||
      srcNode.type === "transformer_ref" ||
      e.sourceHandle === "transformer-out" ||
      e.targetHandle === "transformer_in" ||
      e.targetHandle === "transformer-in"
    );
  });

  let rawNode: TransformerCapableNode | null = null;
  if (edge) {
    const candidate = nodes.find((n) => n.id === edge.source);
    if (candidate && isTransformerCapableNode(candidate)) {
      rawNode = candidate;
    }
  }

  // 2. Reference by transformerNodeId or transformerRef or functionRef
  const refId =
    stepConfig.transformerNodeId ||
    stepConfig.transformerRef ||
    stepConfig.functionRef?.name;

  if (!rawNode && refId) {
    const candidate = nodes.find((n) => {
      if (isTransformerCapableNode(n)) {
        return (
          n.id === refId ||
          n.data?.functionName === refId ||
          n.data?.label === refId
        );
      }
      return false;
    });
    if (candidate && isTransformerCapableNode(candidate)) {
      rawNode = candidate;
    }
  }

  if (!rawNode) return null;

  // 3. If transformer_ref, resolve to master transformer node
  let masterNode: TransformerCapableNode = rawNode;
  if (rawNode.type === "transformer_ref") {
    const masterRef = rawNode.data?.transformerRef || rawNode.id;
    const foundMaster = nodes.find((n): n is TransformerCapableNode => {
      if (n.type === "transformer") {
        return (
          n.id === masterRef ||
          n.data?.functionName === masterRef ||
          n.data?.label === masterRef
        );
      }
      return false;
    });
    if (foundMaster) {
      masterNode = foundMaster;
    }
  }

  const data = masterNode.data;
  const code = typeof data?.code === "string" ? data.code : "";
  const name =
    data?.functionName ||
    data?.label ||
    masterNode.id;

  return {
    id: masterNode.id,
    name,
    code,
    isAsync: Boolean(data?.isAsync),
    inputSchema: data?.inputSchema,
    returnSchema: data?.returnSchema,
  };
}

/**
 * Runs transformer logic in an async sandbox.
 * Destructures mapped inputs into local scope so the code can access
 * arguments directly (e.g. `const { userId, count } = inputs;`), while
 * also exposing `(inputs, state, clone)` and `(state, clone)` for flexibility.
 */
export async function runTransformer(params: {
  code: string;
  name: string;
  inputs: StepStateRecord;
  state: Record<string, unknown>;
  cloneFn: <T>(val: T) => T;
}) {
  const { code, name, inputs, state, cloneFn } = params;
  if (!code.trim()) {
    throw new Error(`Transformer "${name}" has an empty function body.`);
  }

  const inputKeys = Object.keys(inputs).filter((k) =>
    /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k),
  );
  const destructureLine =
    inputKeys.length > 0 ? `const { ${inputKeys.join(", ")} } = inputs;\n` : "";

  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  const runner = new AsyncFn(
    "inputs",
    "state",
    "clone",
    `${destructureLine}${code}`
  );

  return await runner(inputs, state, cloneFn);
}

// ─── Main executeStepNode ─────────────────────────────────────────────────────

export async function executeStepNode(
  params: ExecuteStepNodeParams,
): Promise<ExecuteStepNodeResult> {
  const {
    node,
    nodeName,
    state,
    edges,
    nodes,
    threadId,
    provider = "groq",
    apiKey,
    modelName,
    nodeStreamBatchesMap,
  } = params;

  const outputDelta: Record<string, unknown> = {};
  const stepLogs: SimulationStepLogEntry[] = [];
  let latestAssistantResponse: string | undefined;

  const addLog = (
    level: SimulationStepLogLevel,
    message: string,
    details?: StepStateValue,
  ) => {
    stepLogs.push({
      timestamp: Date.now(),
      level,
      message,
      nodeId: node.id,
      nodeLabel: nodeName,
      ...(details !== undefined ? { details } : {}),
    });
  };

  if (!isStepExecutionStepNode(node)) {
    return {
      outputDelta,
      stepLogs,
      latestAssistantResponse,
    };
  }

  const stepData: StepNodeData = node.data;

  // Track outputs of all steps executed inside this node (above steps -> below steps)
  const stepOutputs = new Map<string, StepStateValue>();

  // Helper to execute a single transformer step with input mapping and output registration
  const executeSingleTransformer = async (
    stepCfg: TransformerExecutionConfig,
    fallbackLabel: string,
  ) => {
    // 1. Resolve transformer definition from canvas / references or inline
    const trDef = findTransformerNode(node.id, stepCfg, nodes, edges);
    const rawCustomCode = stepCfg.customCode;
    const customCodeBody =
      typeof rawCustomCode === "object" && rawCustomCode !== null && "body" in rawCustomCode && typeof rawCustomCode.body === "string"
        ? rawCustomCode.body
        : typeof rawCustomCode === "string"
          ? rawCustomCode
          : "";

    const code: string =
      trDef?.code ||
      (typeof stepCfg.code === "string" ? stepCfg.code : "") ||
      customCodeBody ||
      (typeof stepData.code === "string" ? stepData.code : "") ||
      (typeof stepData.customCode?.body === "string" ? stepData.customCode.body : "") ||
      "";

    const trName =
      trDef?.name ||
      stepCfg.label ||
      stepCfg.name ||
      fallbackLabel;

    if (!code.trim()) {
      throw new Error(`Transformer "${trName}" has an empty function body.`);
    }

    // 2. Resolve Input Bindings
    const rawBindings = stepCfg.inputBindings || stepData.inputBindings;
    let inputs: StepStateRecord = {};

    if (rawBindings && rawBindings.length > 0) {
      for (const b of rawBindings) {
        if (b && b.argName) {
          inputs[b.argName] = resolveInputValue(b.source, {
            state,
            stepOutputs,
          });
        }
      }
    } else if (trDef?.inputSchema && trDef.inputSchema.length > 0) {
      // Auto-bind from prior step outputs or state matching schema argument names
      for (const param of trDef.inputSchema) {
        if (!param || !param.name) continue;
        if (stepOutputs.has(param.name)) {
          inputs[param.name] = stepOutputs.get(param.name);
        } else if (state[param.name] !== undefined) {
          const stateVal = state[param.name];
          inputs[param.name] =
            typeof stateVal === "object" ||
            typeof stateVal === "string" ||
            typeof stateVal === "number" ||
            typeof stateVal === "boolean" ||
            stateVal === null
              ? stateVal
              : undefined;
        }
      }
    }

    // Default: If no specific arguments bound, provide state channels as inputs
    if (Object.keys(inputs).length === 0 && Object.keys(state).length > 0) {
      for (const [k, v] of Object.entries(state)) {
        inputs[k] =
          typeof v === "object" ||
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean" ||
          v === null
            ? v
            : undefined;
      }
    }

    addLog(
      "step",
      `Executing Transformer "${trName}" (${Object.keys(inputs).length} input(s) mapped)`,
      { inputs },
    );

    // 3. Execute Transformer Sandbox
    const res = await runTransformer({
      code,
      name: trName,
      inputs,
      state,
      cloneFn: clone,
    });

    // 4. Output Mapping (Above Steps -> Below Steps)
    const stepId =
      stepCfg.id ||
      stepCfg.stepId ||
      stepCfg.name ||
      fallbackLabel;

    const outVar =
      stepCfg.outputVariable ||
      stepId;

    // Register in stepOutputs so all subsequent ("below") steps can access this output
    stepOutputs.set(stepId, res);
    if (outVar) {
      stepOutputs.set(outVar, res);
    }
    if (trName) {
      stepOutputs.set(trName, res);
    }

    // Populate outputDelta and update state
    outputDelta[outVar] = res;
    if (res && typeof res === "object" && !Array.isArray(res)) {
      Object.assign(state, res);
      Object.assign(outputDelta, res);
    }

    // 5. Apply step-level stateUpdates (if configured on the sub-step)
    const subStateUpdates = stepCfg.stateUpdates;
    if (subStateUpdates) {
      for (const update of subStateUpdates) {
        const rawVal = update.value;
        let resolvedVal: StepStateValue = rawVal;
        if (typeof rawVal === "string") {
          try {
            resolvedVal = JSON.parse(rawVal);
          } catch {
            const resolved =
              getNestedValue(typeof res === "object" && res !== null ? res : undefined, rawVal) ??
              getNestedValue(outputDelta, rawVal) ??
              getNestedValue(state, rawVal);
            if (resolved !== undefined) {
              resolvedVal = resolved;
            }
          }
        } else if (rawVal === undefined) {
          resolvedVal = getNestedValue(typeof res === "object" && res !== null ? res : undefined, update.channelKey) ?? res;
        }
        outputDelta[update.channelKey] = resolvedVal;
        state[update.channelKey] = resolvedVal;
      }
    }

    return res;
  };

  // ─── Sequence Execution: Pipeline Steps vs Single Step ───────────────────────

  const subSteps = stepData.pipelineSteps;

  // Multi-step pipeline mode (Output of above steps mapped to below steps)
  if (subSteps && subSteps.length > 0) {
    addLog(
      "info",
      `Executing ${subSteps.length} sequential pipeline step(s) in "${nodeName}"`,
    );

    for (let i = 0; i < subSteps.length; i++) {
      const subStep = subSteps[i];
      if (!subStep) continue;
      const stepType: string = subStep.type || "transform";

      if (
        stepType === "transformer" ||
        stepType === "transform" ||
        stepType === "custom_code"
      ) {
        await executeSingleTransformer(
          subStep,
          subStep.name || `step_${i}`,
        );
      } else if (
        stepType === "llm_call" ||
        stepType === "summarizer" ||
        stepType === "evaluator"
      ) {
        // LLM sub-step
        const stepRecord = typeof subStep === "object" && subStep !== null ? subStep : undefined;
        const modelCfg = stepRecord && "modelConfig" in stepRecord && typeof stepRecord.modelConfig === "object" && stepRecord.modelConfig !== null ? stepRecord.modelConfig : undefined;
        const prompt = modelCfg && "systemPrompt" in modelCfg && typeof modelCfg.systemPrompt === "string" ? modelCfg.systemPrompt : "Process inputs concisely.";
        const subModel = modelCfg && "model" in modelCfg && typeof modelCfg.model === "string" ? modelCfg.model : modelName || "gpt-4o-mini";
        addLog("llm", `Executing sub-step LLM call: "${subStep.name || `llm_${i}`}"`);
        const { text: responseText } = await callServerLLM({
          provider,
          apiKey,
          modelName: subModel,
          systemPrompt: prompt,
          messages: [{ role: "user", content: JSON.stringify({ ...state, ...Object.fromEntries(stepOutputs) }) }],
        });
        const outKey = subStep.outputVariable || subStep.id || `llm_step_${i}`;
        stepOutputs.set(outKey, responseText);
        outputDelta[outKey] = responseText;
      }
    }
  }

  // Single step execution (No sub-step pipeline defined)
  else {
    // B1: LLM Call / Evaluator / Summarizer
    if (
      stepData.stepType === "llm_call" ||
      stepData.stepType === "summarizer" ||
      stepData.stepType === "evaluator"
    ) {
      const llmEdge = edges.find(
        (e) => e.target === node.id && e.targetHandle === "llm_in",
      );
      const llmCandidate = llmEdge ? nodes.find((n) => n.id === llmEdge.source) : null;
      const llmNode: LangGraphLLMNode | null =
        llmCandidate && isStepExecutionLLMNode(llmCandidate) ? llmCandidate : null;
      const llmData = llmNode?.data;

      const candidateProvider = llmData?.provider || provider;
      let effectiveProvider: ServerLLMProvider = "groq";
      if (candidateProvider === "openai") {
        effectiveProvider = "openai";
      } else if (candidateProvider === "groq") {
        effectiveProvider = "groq";
      } else if (candidateProvider === "anthropic") {
        effectiveProvider = "anthropic";
      } else if (candidateProvider === "custom") {
        effectiveProvider = "custom";
      }

      const effectiveModel =
        llmData?.model ||
        stepData.modelConfig?.model ||
        modelName ||
        (effectiveProvider === "groq" ? "openai/gpt-oss-120b" : "gpt-4o-mini");

      const effectiveApiKey =
        apiKey ||
        (effectiveProvider === "groq"
          ? process.env.GROQ_API_KEY
          : effectiveProvider === "openai"
            ? process.env.OPENAI_API_KEY
            : process.env.ANTHROPIC_API_KEY);

      const systemPrompt =
        stepData.modelConfig?.systemPrompt ||
        (stepData.stepType === "summarizer"
          ? "Summarize state concisely."
          : stepData.stepType === "evaluator"
            ? "Evaluate input against criteria."
            : "You are a helpful assistant.");

      let msgs = serializeMessages(state.messages);
      if (msgs.length === 0) {
        msgs = [{ role: "user", content: JSON.stringify(state) }];
      }

      addLog(
        "llm",
        `Calling LLM: ${effectiveProvider.toUpperCase()} / ${effectiveModel} (${msgs.length} message(s))`,
      );

      const { text: responseText, streamBatches } = await callServerLLM({
        provider: effectiveProvider,
        apiKey: effectiveApiKey,
        modelName: effectiveModel,
        systemPrompt,
        messages: msgs,
        customUrl: llmData?.url || llmData?.baseUrl,
      });

      latestAssistantResponse = responseText;
      const outKey = stepData.stepId || node.id || "response";
      outputDelta[outKey] = responseText;
      outputDelta.messages = [new AIMessage(responseText)];

      if (streamBatches && streamBatches.length > 0) {
        const runId = `run_${threadId.slice(0, 8)}_${Math.random().toString(36).slice(2, 6)}`;
        const filtered = streamBatches.filter((b) => Boolean(b.delta));
        const formattedBatches: StreamBatchItem[] = filtered.map((b, newIdx) => ({
          ...b,
          index: newIdx,
          formatted: formatStreamingBatch({
            batch: b,
            nodeName,
            runId,
            streamConfig: undefined,
          }),
        }));

        nodeStreamBatchesMap.set(node.id, formattedBatches);
        outputDelta.streamBatches = formattedBatches;
        outputDelta.streamBatchCount = formattedBatches.length;
      }
    }

    // B2: Tool Node Step
    else if (stepData.stepType === "tool_node") {
      const toolEdge = edges.find(
        (e) => e.target === node.id && e.targetHandle === "tool_in",
      );
      const toolCandidate = toolEdge ? nodes.find((n) => n.id === toolEdge.source) : null;
      const toolNode: ToolNode | null =
        toolCandidate && isStepExecutionToolNode(toolCandidate) ? toolCandidate : null;
      const toolData = toolNode?.data;

      if (!toolData) {
        throw new Error(`Tool step "${nodeName}" has no connected tool definition.`);
      }

      if (toolData.source === "api_endpoint") {
        if (!toolData.endpointUrl) {
          throw new Error(`Tool "${toolData.name || nodeName}" has no endpoint URL.`);
        }
        const res = await fetch(toolData.endpointUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
        if (!res.ok) {
          throw new Error(`Tool endpoint returned HTTP ${res.status}: ${await res.text()}`);
        }
        const json = await res.json();
        const resKey = toolData.name || "tool_result";
        outputDelta[resKey] = json;
      } else if (toolData.functionBody?.trim()) {
        const toolFn = new Function("input", "state", "clone", toolData.functionBody);
        const res = await toolFn(state, state, clone);
        const resKey = toolData.name || "tool_result";
        outputDelta[resKey] = res;
      }
    }

    // B3: Transformer Step (Reusable Transformer, Connected TransformerNode, or Custom Code)
    else if (
      stepData.stepType === "transformer" ||
      stepData.stepType === "transform" ||
      stepData.stepType === "custom_code" ||
      Boolean(findTransformerNode(node.id, stepData, nodes, edges))
    ) {
      await executeSingleTransformer(stepData, nodeName);
    }

    // B4: Router Step
    else if (stepData.stepType === "router") {
      outputDelta.router_evaluated = true;
    }
  }

  // Node-level state updates
  for (const update of stepData.stateUpdates || []) {
    const rawVal = update.value;
    let resolvedVal: StepStateValue = rawVal;
    if (typeof rawVal === "string") {
      try {
        resolvedVal = JSON.parse(rawVal);
      } catch {
        const resolved =
          getNestedValue(outputDelta, rawVal) ??
          getNestedValue(state, rawVal);
        if (resolved !== undefined) {
          resolvedVal = resolved;
        }
      }
    } else if (rawVal === undefined) {
      const channelVal = getNestedValue(outputDelta, update.channelKey);
      if (channelVal !== undefined) {
        resolvedVal = channelVal;
      } else if (stepData.outputVariable) {
        const outVal = outputDelta[stepData.outputVariable];
        resolvedVal =
          typeof outVal === "object" ||
          typeof outVal === "string" ||
          typeof outVal === "number" ||
          typeof outVal === "boolean" ||
          outVal === null
            ? outVal
            : undefined;
      }
    }
    outputDelta[update.channelKey] = resolvedVal;
    state[update.channelKey] = resolvedVal;
  }

  return {
    outputDelta,
    stepLogs,
    latestAssistantResponse,
  };
}

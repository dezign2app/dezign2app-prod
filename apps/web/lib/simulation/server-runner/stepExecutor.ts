import { AIMessage } from "@langchain/core/messages";
import type {
  LangGraphCanvasNode,
  LangGraphCanvasEdge,
  StepNodeData,
  LangGraphLLMNodeData,
  ToolNodeData,
} from "@workspace/canvas";
import { formatStreamingBatch, type StreamBatchItem } from "../streamFormatter";
import type {
  SimulationStepLogEntry,
  SimulationStepLogLevel,
} from "../types";
import { callServerLLM } from "./llm";
import { clone, serializeMessages } from "./messages";

export interface ExecuteStepNodeParams {
  node: LangGraphCanvasNode;
  nodeName: string;
  state: Record<string, unknown>;
  edges: LangGraphCanvasEdge[];
  nodes: LangGraphCanvasNode[];
  threadId: string;
  provider?: "groq" | "openai" | "anthropic" | "custom";
  apiKey?: string;
  modelName?: string;
  nodeStreamBatchesMap: Map<string, StreamBatchItem[]>;
}

export interface ExecuteStepNodeResult {
  outputDelta: Record<string, unknown>;
  stepLogs: SimulationStepLogEntry[];
  latestAssistantResponse?: string;
}

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
    details?: unknown,
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

  const stepData = node.data as StepNodeData;

  // B1: LLM Call / Evaluator / Summarizer
  if (
    stepData.stepType === "llm_call" ||
    stepData.stepType === "summarizer" ||
    stepData.stepType === "evaluator"
  ) {
    const llmEdge = edges.find(
      (e) => e.target === node.id && e.targetHandle === "llm_in",
    );
    const llmNode = llmEdge ? nodes.find((n) => n.id === llmEdge.source) : null;
    const llmData = llmNode?.data as LangGraphLLMNodeData | undefined;

    const effectiveProvider =
      (llmData?.provider as typeof provider) || provider || "groq";
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
    const toolNode = toolEdge ? nodes.find((n) => n.id === toolEdge.source) : null;
    const toolData = toolNode?.data as ToolNodeData | undefined;

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

  // B3: Custom Code Step
  else if (stepData.stepType === "custom_code") {
    if (!stepData.customCode?.body?.trim()) {
      throw new Error(`Custom code step "${nodeName}" has an empty function body.`);
    }
    const runner = new Function("state", "clone", stepData.customCode.body);
    const res = await runner(state, clone);
    if (res && typeof res === "object") {
      Object.assign(outputDelta, res);
    }
  }

  // B4: Router Step
  else if (stepData.stepType === "router") {
    outputDelta.router_evaluated = true;
  }

  // State updates on step
  for (const update of stepData.stateUpdates || []) {
    let val: unknown = update.value;
    if (typeof val === "string") {
      try {
        val = JSON.parse(val);
      } catch {
        // plain text
      }
    }
    outputDelta[update.channelKey] = val;
  }

  return {
    outputDelta,
    stepLogs,
    latestAssistantResponse,
  };
}

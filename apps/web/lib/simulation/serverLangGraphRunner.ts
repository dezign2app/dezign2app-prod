import {
  StateGraph,
  Annotation,
  START,
  END,
  MemorySaver,
  addMessages,
} from "@langchain/langgraph";
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
  isBaseMessage,
} from "@langchain/core/messages";
import Groq from "groq-sdk";
import type {
  LangGraphCanvasNode,
  LangGraphCanvasEdge,
  LangGraphStateChannel,
  LangGraphInputChannel,
  LangGraphMemoryConfig,
  StepNodeData,
  LangGraphLLMNodeData,
  ToolNodeData,
  AgentNodeData,
} from "@workspace/canvas";
import { evaluateRouterBranch } from "./langgraph";
import type { SimulationTraceEntry } from "./types";

export interface ServerExecutionParams {
  nodes: LangGraphCanvasNode[];
  edges: LangGraphCanvasEdge[];
  stateChannels: LangGraphStateChannel[];
  inputChannels: LangGraphInputChannel[];
  memoryConfig?: LangGraphMemoryConfig;
  inputValues: Record<string, unknown>;
  threadId: string;
  provider?: "groq" | "openai" | "anthropic" | "custom";
  apiKey?: string;
  modelName?: string;
}

export interface ServerExecutionCheckpoint {
  id: string;
  threadId: string;
  stepName: string;
  state: Record<string, unknown>;
  timestamp: number;
}

export interface ServerExecutionResult {
  finalState: Record<string, unknown>;
  trace: SimulationTraceEntry[];
  totalDurationMs: number;
  visitedNodes: string[];
  latestAssistantResponse?: string;
  checkpoints?: ServerExecutionCheckpoint[];
  error?: string;
}

// Server-side thread checkpointer cache so multi-turn conversations persist across turns
const serverCheckpointerCache = new Map<string, MemorySaver>();

function getOrCreateCheckpointer(threadId: string): MemorySaver {
  let saver = serverCheckpointerCache.get(threadId);
  if (!saver) {
    saver = new MemorySaver();
    serverCheckpointerCache.set(threadId, saver);
  }
  return saver;
}

export function clearServerThread(threadId: string): void {
  serverCheckpointerCache.delete(threadId);
}

function clone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

function generateId(): string {
  return "cp_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

function serializeMessages(raw: unknown): Array<{ role: string; content: string; name?: string }> {
  if (!Array.isArray(raw)) return [];
  const result: Array<{ role: string; content: string; name?: string }> = [];
  for (const item of raw) {
    if (isBaseMessage(item)) {
      const role =
        item._getType() === "human"
          ? "user"
          : item._getType() === "ai"
            ? "assistant"
            : item._getType() === "system"
              ? "system"
              : "user";
      result.push({
        role,
        content: typeof item.content === "string" ? item.content : JSON.stringify(item.content),
        name: item.name,
      });
    } else if (item && typeof item === "object") {
      const msg = item as Record<string, unknown>;
      result.push({
        role: typeof msg.role === "string" ? msg.role : "user",
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content ?? ""),
        name: typeof msg.name === "string" ? msg.name : undefined,
      });
    } else if (typeof item === "string") {
      result.push({ role: "user", content: item });
    }
  }
  return result;
}

function coerceToLangChainMessages(raw: unknown): BaseMessage[] {
  if (!Array.isArray(raw)) return [];
  const list: BaseMessage[] = [];
  for (const item of raw) {
    if (isBaseMessage(item)) {
      list.push(item);
    } else if (typeof item === "string") {
      list.push(new HumanMessage(item));
    } else if (item && typeof item === "object") {
      const m = item as { role?: string; content?: string; text?: string };
      const content = m.content || m.text || "";
      if (m.role === "assistant" || m.role === "ai") {
        list.push(new AIMessage(content));
      } else if (m.role === "system") {
        list.push(new SystemMessage(content));
      } else {
        list.push(new HumanMessage(content));
      }
    }
  }
  return list;
}

/**
 * Execute graph directly via official @langchain/langgraph StateGraph runtime on Node.js
 */
export async function executeServerLangGraph(
  params: ServerExecutionParams,
): Promise<ServerExecutionResult> {
  const startTime = Date.now();
  const {
    nodes,
    edges,
    stateChannels,
    inputChannels,
    memoryConfig,
    inputValues,
    threadId,
    provider = "groq",
    apiKey,
    modelName,
  } = params;

  const trace: SimulationTraceEntry[] = [];
  const visitedNodes: string[] = [];
  let latestAssistantResponse: string | undefined;

  // 1. Build Dynamic Annotation Schema for @langchain/langgraph StateGraph
  const schemaSpec: Record<string, unknown> = {};

  const effectiveChannels = [...stateChannels];
  if (!effectiveChannels.some((c) => c.key === "messages")) {
    effectiveChannels.unshift({
      key: "messages",
      type: "messages",
      reducer: "add_messages",
      defaultValue: [],
    });
  }

  for (const ch of effectiveChannels) {
    if (ch.key === "messages" || ch.type === "messages") {
      schemaSpec[ch.key] = Annotation<BaseMessage[]>({
        reducer: addMessages,
        default: () => [],
      });
    } else if (ch.reducer === "append" || ch.type === "array") {
      schemaSpec[ch.key] = Annotation<unknown[]>({
        reducer: (x, y) => [...(x || []), ...(Array.isArray(y) ? y : [y])],
        default: () => (Array.isArray(ch.defaultValue) ? ch.defaultValue : []),
      });
    } else if (ch.type === "number") {
      schemaSpec[ch.key] = Annotation<number>({
        reducer: (_, y) => (y !== undefined ? Number(y) : 0),
        default: () => Number(ch.defaultValue) || 0,
      });
    } else if (ch.type === "boolean") {
      schemaSpec[ch.key] = Annotation<boolean>({
        reducer: (_, y) => Boolean(y),
        default: () => Boolean(ch.defaultValue),
      });
    } else if (ch.type === "object" || ch.type === "json") {
      schemaSpec[ch.key] = Annotation<Record<string, unknown>>({
        reducer: (x, y) => ({ ...(x || {}), ...((y as Record<string, unknown>) || {}) }),
        default: () => ((ch.defaultValue as Record<string, unknown>) || {}),
      });
    } else {
      schemaSpec[ch.key] = Annotation<string>({
        reducer: (_, y) => (y !== undefined ? String(y) : ""),
        default: () => String(ch.defaultValue ?? ""),
      });
    }
  }

  const GraphState = Annotation.Root(
    schemaSpec as Parameters<typeof Annotation.Root>[0],
  );

  // 2. Initialize StateGraph Builder
  const rawBuilder = new StateGraph(GraphState);
  const builder = rawBuilder as unknown as {
    addNode: (
      node: string,
      action: (state: Record<string, unknown>) => Promise<Record<string, unknown>>,
    ) => void;
    addEdge: (from: string | typeof START, to: string | typeof END) => void;
    addConditionalEdges: (
      from: string,
      condition: (state: Record<string, unknown>) => string,
      pathMap: Record<string, string | typeof END>,
    ) => void;
    compile: (options?: { checkpointer?: MemorySaver }) => {
      stream: (
        input: Record<string, unknown>,
        options?: { configurable?: { thread_id: string }; streamMode?: string },
      ) => Promise<AsyncIterable<Record<string, Record<string, unknown>>>>;
      invoke: (
        input: Record<string, unknown>,
        options?: { configurable?: { thread_id: string } },
      ) => Promise<Record<string, unknown>>;
      getState: (options?: {
        configurable?: { thread_id: string };
      }) => Promise<{ values?: Record<string, unknown> }>;
      getStateHistory: (options?: {
        configurable?: { thread_id: string };
      }) => AsyncIterable<{
        values?: Record<string, unknown>;
        config?: { configurable?: { checkpoint_id?: string; thread_id?: string } };
        metadata?: { step?: number };
        createdAt?: string;
      }>;
    };
  };

  // Step Node Labels map
  const nodeLabelMap = new Map<string, string>();
  for (const n of nodes) {
    const label =
      (n.data as { label?: string; name?: string })?.label ||
      (n.data as { label?: string; name?: string })?.name ||
      n.id;
    nodeLabelMap.set(n.id, label);
  }

  // 3. Register Nodes
  const executableNodes = nodes.filter(
    (n) =>
      n.type === "langgraph_agent" ||
      n.type === "langgraph_node" ||
      n.type === "step",
  );

  for (const node of executableNodes) {
    const nodeName = nodeLabelMap.get(node.id) || node.id;
    const isAgent = node.type === "langgraph_agent" || node.type === "langgraph_node";
    const isStep = node.type === "step";

    builder.addNode(node.id, async (state: Record<string, unknown>) => {
      const stepStart = Date.now();
      const outputDelta: Record<string, unknown> = {};

      // ── A. AGENT NODE ──────────────────────────────────────────────
      if (isAgent) {
        const agentData = node.data as AgentNodeData;
        const systemPrompt = agentData.systemPrompt || "You are a helpful assistant.";

        const rawMessages = (state.messages as unknown[]) || [];
        const messages = serializeMessages(rawMessages);

        if (messages.length === 0) {
          const candidateKeys = ["input", "prompt", "query", "question", "text", "message"];
          for (const key of candidateKeys) {
            if (typeof state[key] === "string" && (state[key] as string).trim()) {
              messages.push({ role: "user", content: (state[key] as string).trim() });
              break;
            }
          }
        }

        if (messages.length === 0) {
          throw new Error(
            `Agent "${nodeName}" execution failed: No prompt or user message was provided in graph state.`,
          );
        }

        // Detect LLM node connected to this agent
        const llmEdge = edges.find(
          (e) => e.target === node.id && e.targetHandle === "llm_in",
        );
        const llmNode = llmEdge ? nodes.find((n) => n.id === llmEdge.source) : null;
        const llmData = llmNode?.data as LangGraphLLMNodeData | undefined;

        const effectiveProvider =
          (llmData?.provider as typeof provider) || provider || "groq";
        const effectiveModel =
          llmData?.model ||
          modelName ||
          (effectiveProvider === "groq"
            ? "openai/gpt-oss-120b"
            : effectiveProvider === "openai"
              ? "gpt-4o-mini"
              : "claude-3-5-sonnet-20241022");

        const effectiveApiKey =
          apiKey ||
          (effectiveProvider === "groq"
            ? process.env.GROQ_API_KEY
            : effectiveProvider === "openai"
              ? process.env.OPENAI_API_KEY
              : effectiveProvider === "anthropic"
                ? process.env.ANTHROPIC_API_KEY
                : undefined);

        const responseText = await callServerLLM({
          provider: effectiveProvider,
          apiKey: effectiveApiKey,
          modelName: effectiveModel,
          systemPrompt,
          messages,
          customUrl: llmData?.url || llmData?.baseUrl,
        });

        latestAssistantResponse = responseText;
        outputDelta.messages = [new AIMessage(responseText)];
        outputDelta.response = responseText;

        for (const update of agentData.stateUpdates || []) {
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
      }

      // ── B. STEP NODE ───────────────────────────────────────────────
      else if (isStep) {
        const stepData = node.data as StepNodeData;

        // B1: LLM Call
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

          const responseText = await callServerLLM({
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

        // State updates
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
      }

      return outputDelta;
    });
  }

  // 4. Edges & Flow Configuration
  const flowEdges = edges.filter(
    (e) =>
      e.targetHandle !== "llm_in" &&
      e.targetHandle !== "tool_in" &&
      e.targetHandle !== "middleware_in" &&
      e.targetHandle !== "memory_in",
  );

  // START edges
  const startEdge = flowEdges.find((e) => e.source === "START");
  if (startEdge) {
    if (startEdge.target === "END" || startEdge.target.startsWith("end_")) {
      builder.addEdge(START, END);
    } else {
      builder.addEdge(START, startEdge.target);
    }
  }

  // Node to Node / Router Edges
  for (const node of executableNodes) {
    const stepData = node.data as StepNodeData | undefined;
    const isRouter = node.type === "step" && stepData?.stepType === "router";

    const outgoing = flowEdges.filter((e) => e.source === node.id);
    const firstTarget = outgoing[0]?.target;
    if (!firstTarget) {
      builder.addEdge(node.id, END);
      continue;
    }

    if (isRouter && stepData?.routerConfig?.branches) {
      const branches = stepData.routerConfig.branches;
      const pathMap: Record<string, string | typeof END> = {};

      for (const branch of branches) {
        const edge = outgoing.find((e) => e.sourceHandle === branch.id) || outgoing[0];
        const target =
          !edge?.target || edge.target === "END" || edge.target.startsWith("end_") ? END : edge.target;
        pathMap[branch.id] = target;
      }

      builder.addConditionalEdges(
        node.id,
        (state: Record<string, unknown>) => {
          let matched = branches.find((b) => !b.isDefault && evaluateRouterBranch(b, state));
          if (!matched) {
            matched = branches.find((b) => b.isDefault) || branches[0];
          }
          return matched?.id || "";
        },
        pathMap,
      );
    } else {
      const target =
        firstTarget === "END" || firstTarget.startsWith("end_")
          ? END
          : firstTarget;
      builder.addEdge(node.id, target);
    }
  }

  // 5. Compile Graph with Checkpointer
  const isMemoryEnabled = memoryConfig?.enabled !== false;
  const checkpointer = isMemoryEnabled ? getOrCreateCheckpointer(threadId) : undefined;

  const compiledGraph = isMemoryEnabled && checkpointer
    ? builder.compile({ checkpointer })
    : builder.compile();

  // 6. Map input channels & inputValues to initial state
  const initialState: Record<string, unknown> = {};

  for (const inputCh of inputChannels) {
    const val = inputValues[inputCh.key];
    if (val !== undefined) {
      const targetStateKey = inputCh.stateChannelKey || inputCh.key;
      if (targetStateKey === "messages") {
        initialState.messages = coerceToLangChainMessages(
          typeof val === "string" ? [{ role: "user", content: val }] : val,
        );
      } else {
        initialState[targetStateKey] = val;
      }
    }
  }

  for (const [k, v] of Object.entries(inputValues)) {
    if (k === "messages") {
      initialState.messages = coerceToLangChainMessages(
        typeof v === "string" ? [{ role: "user", content: v }] : v,
      );
    } else if (initialState[k] === undefined && v !== undefined) {
      initialState[k] = v;
    }
  }

  // Record START trace
  visitedNodes.push("START");
  trace.push({
    id: `trace_${generateId()}`,
    kind: "step",
    label: "START",
    status: "completed",
    nodeId: "START",
    input: clone(initialState),
    output: clone(initialState),
  });

  // 7. Execute official LangGraph streaming run
  try {
    const stream = await compiledGraph.stream(initialState, {
      configurable: { thread_id: threadId },
      streamMode: "updates",
    });

    for await (const chunk of stream) {
      for (const [nodeId, outputDelta] of Object.entries(chunk)) {
        visitedNodes.push(nodeId);
        const nodeName = nodeLabelMap.get(nodeId) || nodeId;

        const serializedDelta: Record<string, unknown> = {};
        if (outputDelta && typeof outputDelta === "object") {
          for (const [key, value] of Object.entries(outputDelta as Record<string, unknown>)) {
            if (key === "messages" && Array.isArray(value)) {
              serializedDelta.messages = serializeMessages(value);
            } else {
              serializedDelta[key] = value;
            }
          }
        }

        trace.push({
          id: `trace_${generateId()}`,
          kind: "step",
          label: nodeName,
          status: "completed",
          nodeId,
          output: clone(serializedDelta),
        });
      }
    }

    // Add END trace
    visitedNodes.push("END");
    trace.push({
      id: `trace_${generateId()}`,
      kind: "step",
      label: "END",
      status: "completed",
      nodeId: "END",
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    trace.push({
      id: `trace_${generateId()}`,
      kind: "step",
      label: "Error",
      status: "failed",
      nodeId: visitedNodes[visitedNodes.length - 1] || "START",
      output: { error: errMsg },
    });
    return {
      finalState: {},
      trace,
      totalDurationMs: Date.now() - startTime,
      visitedNodes,
      latestAssistantResponse,
      error: errMsg,
    };
  }

  // 8. Extract final state snapshot & checkpoints from official StateGraph checkpointer
  let finalState: Record<string, unknown> = {};
  const checkpoints: ServerExecutionCheckpoint[] = [];

  if (isMemoryEnabled && checkpointer) {
    try {
      const stateSnapshot = await compiledGraph.getState({
        configurable: { thread_id: threadId },
      });
      if (stateSnapshot?.values) {
        finalState = serializeStateValues(stateSnapshot.values);
      }

      for await (const stateItem of compiledGraph.getStateHistory({
        configurable: { thread_id: threadId },
      })) {
        const cpConfig = stateItem.config?.configurable as
          | { checkpoint_id?: string; thread_id?: string }
          | undefined;
        checkpoints.push({
          id: cpConfig?.checkpoint_id || generateId(),
          threadId: cpConfig?.thread_id || threadId,
          stepName: stateItem.metadata?.step !== undefined ? `Step ${stateItem.metadata.step}` : "Checkpoint",
          state: serializeStateValues(stateItem.values || {}),
          timestamp: stateItem.createdAt ? new Date(stateItem.createdAt).getTime() : Date.now(),
        });
      }
    } catch {
      // fallback
    }
  }

  // If latestAssistantResponse wasn't captured directly, pull from finalState messages
  if (!latestAssistantResponse && Array.isArray(finalState.messages)) {
    const msgs = finalState.messages as Array<{ role?: string; content?: string }>;
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg && (lastMsg.role === "assistant" || lastMsg.role === "ai")) {
      latestAssistantResponse = lastMsg.content;
    }
  }

  return {
    finalState,
    trace,
    totalDurationMs: Date.now() - startTime,
    visitedNodes,
    latestAssistantResponse,
    checkpoints,
  };
}

function serializeStateValues(values: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (k === "messages" && Array.isArray(v)) {
      result.messages = serializeMessages(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Server LLM Invocation
 */
async function callServerLLM(args: {
  provider: "openai" | "groq" | "anthropic" | "custom";
  apiKey?: string;
  modelName: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  customUrl?: string;
}): Promise<string> {
  const { provider, apiKey, modelName, systemPrompt, messages, customUrl } = args;

  // 1. Groq (uses groq-sdk or fetch)
  if (provider === "groq") {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) {
      throw new Error("Missing Groq API Key. Please provide an API key in the toolbar or GROQ_API_KEY env var.");
    }
    const groq = new Groq({ apiKey: key });
    const promptMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
    ];
    const completion = await groq.chat.completions.create({
      model: modelName || "openai/gpt-oss-120b",
      messages: promptMessages,
      temperature: 0.7,
    });
    return completion.choices[0]?.message?.content || "";
  }

  // 2. OpenAI & Anthropic & Custom HTTP
  const url =
    customUrl ||
    (provider === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : provider === "anthropic"
        ? "https://api.anthropic.com/v1/messages"
        : "http://localhost:11434/v1/chat/completions");

  const promptMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    if (provider === "anthropic") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(
      provider === "anthropic"
        ? {
            model: modelName,
            max_tokens: 2048,
            system: systemPrompt,
            messages: messages.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
          }
        : {
            model: modelName,
            messages: promptMessages,
            temperature: 0.7,
          },
    ),
  });

  if (!res.ok) {
    throw new Error(`${provider.toUpperCase()} API returned HTTP ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (provider === "anthropic") {
    return json.content?.[0]?.text || "";
  }
  return json.choices?.[0]?.message?.content || "";
}

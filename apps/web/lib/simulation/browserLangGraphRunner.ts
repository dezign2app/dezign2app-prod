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
  LangGraphAgentResponseFormatConfig,
} from "@workspace/canvas";
import {
  evaluateRouterBranch,
  resolveRouterFieldValue,
  extractJsonFromText,
  resolveStructuredFieldValue,
} from "./langgraph";
import {
  saveBrowserCheckpoint,
  getLatestBrowserCheckpoint,
  BrowserCheckpoint,
} from "./indexedDBCheckpointer";
import type { SimulationTraceEntry, SimulationStepLogEntry } from "./types";
import { formatStreamingBatch, type StreamBatchItem } from "./streamFormatter";

export interface BrowserExecutionParams {
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
  onStepStart?: (nodeId: string, nodeName: string, state: Record<string, unknown>) => void;
  onStepEnd?: (
    nodeId: string,
    nodeName: string,
    outputDelta: Record<string, unknown>,
    durationMs: number,
  ) => void;
  onCheckpoint?: (checkpoint: BrowserCheckpoint) => void;
}

export interface BrowserLLMStreamBatch {
  index: number;
  delta: string;
  content: string;
  timestamp: string;
  raw?: unknown;
}

export interface BrowserLLMResult {
  text: string;
  streamBatches: BrowserLLMStreamBatch[];
}

export interface BrowserExecutionResult {
  finalState: Record<string, unknown>;
  trace: SimulationTraceEntry[];
  logs?: SimulationStepLogEntry[];
  totalDurationMs: number;
  visitedNodes: string[];
  latestAssistantResponse?: string;
  error?: string;
}

export interface GraphChatMessage {
  role: string;
  content: string;
  name?: string;
  tool_calls?: unknown[];
}

export function extractMessages(raw: unknown): GraphChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const result: GraphChatMessage[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      result.push({ role: "user", content: item.trim() });
    } else if (item && typeof item === "object") {
      const msg = item as Record<string, unknown>;
      if (typeof msg.content === "string") {
        result.push({
          role: typeof msg.role === "string" ? msg.role : "user",
          content: msg.content,
          name: typeof msg.name === "string" ? msg.name : undefined,
          tool_calls: Array.isArray(msg.tool_calls) ? msg.tool_calls : undefined,
        });
      }
    }
  }
  return result;
}

function clone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

function generateId(): string {
  return "cp_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

/**
 * Execute LangGraph 100% in the browser environment.
 * Zero external servers, zero Next.js API routes, zero mock/fake responses.
 */
export async function executeBrowserLangGraph(
  params: BrowserExecutionParams,
): Promise<BrowserExecutionResult> {
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
    onStepStart,
    onStepEnd,
    onCheckpoint,
  } = params;

  if (memoryConfig?.checkpointer && memoryConfig.checkpointer !== "memory") {
    console.warn(
      `[sim] ${memoryConfig.checkpointer} checkpointer not supported directly in browser preview — using in-browser IndexedDB / MemorySaver fallback`,
    );
  }

  const trace: SimulationTraceEntry[] = [];
  const allRunLogs: SimulationStepLogEntry[] = [];
  const visitedNodes: string[] = [];
  let latestAssistantResponse: string | undefined;

  // 1. Initialize State
  let state: Record<string, unknown> & { messages: GraphChatMessage[] } = {
    messages: [],
  };

  // Check for prior checkpoint in thread memory
  const previousCheckpoint = await getLatestBrowserCheckpoint(threadId);
  if (previousCheckpoint?.state) {
    state = Object.assign(clone(previousCheckpoint.state), {
      messages: extractMessages((previousCheckpoint.state as Record<string, unknown>).messages),
    });
  } else {
    // Initialize default channel values
    for (const channel of stateChannels) {
      if (channel.key === "messages") {
        state[channel.key] = [];
      } else if (channel.type === "number") {
        state[channel.key] = 0;
      } else if (channel.type === "boolean") {
        state[channel.key] = false;
      } else if (channel.type === "array") {
        state[channel.key] = [];
      } else if (channel.type === "object" || channel.type === "json") {
        state[channel.key] = {};
      } else {
        state[channel.key] = "";
      }
    }
  }

  // 2. Map inputChannels values to stateChannels
  for (const inputCh of inputChannels) {
    const val = inputValues[inputCh.key];
    if (val !== undefined) {
      const targetStateKey = inputCh.stateChannelKey || inputCh.key;
      if (targetStateKey === "messages") {
        const msgs = extractMessages(state[targetStateKey]);
        if (typeof val === "string" && val.trim()) {
          state.messages = [
            ...msgs,
            { role: "user", content: val.trim() },
          ];
        } else if (Array.isArray(val)) {
          state.messages = [...msgs, ...extractMessages(val)];
        }
      } else {
        state[targetStateKey] = val;
      }
    }
  }

  // 3. Process direct inputs (like chatMessage or values passed directly)
  for (const [k, v] of Object.entries(inputValues)) {
    if (k === "messages") {
      const msgs = extractMessages(state.messages);
      if (typeof v === "string" && v.trim()) {
        state.messages = [...msgs, { role: "user", content: v.trim() }];
      } else if (Array.isArray(v)) {
        state.messages = [...msgs, ...extractMessages(v)];
      }
    } else if (state[k] === undefined && v !== undefined) {
      state[k] = v;
    }
  }

  // Record START step
  const startLogs: SimulationStepLogEntry[] = [
    {
      timestamp: Date.now(),
      level: "step",
      message: `Graph execution started (threadId: "${threadId}")`,
      nodeId: "START",
      nodeLabel: "START",
    },
    {
      timestamp: Date.now(),
      level: "state",
      message: `Initialized graph state channels (${Object.keys(state).length} active: ${Object.keys(state).join(", ")})`,
      nodeId: "START",
      nodeLabel: "START",
      details: clone(state),
    },
  ];
  allRunLogs.push(...startLogs);

  const startTrace: SimulationTraceEntry = {
    id: `trace_${generateId()}`,
    kind: "step",
    label: "START",
    status: "completed",
    nodeId: "START",
    input: clone(state),
    output: clone(state),
    logs: startLogs,
  };
  trace.push(startTrace);
  visitedNodes.push("START");
  onStepStart?.("START", "START", clone(state));
  onStepEnd?.("START", "START", clone(state), 2);

  // 4. Find outgoing flow edges from START
  const flowEdges = edges.filter(
    (e) =>
      e.targetHandle !== "llm_in" &&
      e.targetHandle !== "tool_in" &&
      e.targetHandle !== "middleware_in" &&
      e.targetHandle !== "memory_in",
  );

  let currentEdge = flowEdges.find((e) => e.source === "START");
  let currentNodeId = currentEdge?.target;
  let safetyLoopGuard = 0;
  const maxSteps = nodes.length * 4 + 10;

  while (
    currentNodeId &&
    currentNodeId !== "END" &&
    safetyLoopGuard++ < maxSteps
  ) {
    const node = nodes.find((n) => n.id === currentNodeId);
    if (!node) break;

    visitedNodes.push(node.id);
    const nodeName =
      (node.data as { label?: string; name?: string })?.label ||
      (node.data as { label?: string; name?: string })?.name ||
      node.id;

    onStepStart?.(node.id, nodeName, clone(state));
    const stepStartTime = Date.now();

    const stepLogs: SimulationStepLogEntry[] = [];
    const addLog = (
      level: SimulationStepLogEntry["level"],
      message: string,
      details?: unknown,
    ) => {
      const entry: SimulationStepLogEntry = {
        timestamp: Date.now(),
        level,
        message,
        nodeId: node.id,
        nodeLabel: nodeName,
        ...(details !== undefined ? { details } : {}),
      };
      stepLogs.push(entry);
      allRunLogs.push(entry);
    };

    addLog("step", `Started execution of step "${nodeName}" (type: ${node.type || "step"})`);

    const nodeTrace: SimulationTraceEntry = {
      id: `trace_${generateId()}`,
      kind: "step",
      label: nodeName,
      status: "completed",
      nodeId: node.id,
      input: clone(state),
      logs: stepLogs,
    };
    trace.push(nodeTrace);

    const outputDelta: Record<string, unknown> = {};

    try {
      const isAgent =
        node.type === "langgraph_agent" ||
        node.type === "langgraph_node";
      const isStep = node.type === "step";

      // ─── A. AGENT NODE ──────────────────────────────────────────────
      if (isAgent) {
        const agentData = node.data as AgentNodeData;
        const systemPrompt =
          agentData.systemPrompt || "You are a helpful assistant.";

        // Gather real conversation messages with strict typing (no any)
        let messages: GraphChatMessage[] = extractMessages(state.messages);

        // If messages is empty, inspect state channels for user prompt
        if (messages.length === 0) {
          const candidateKeys = ["input", "prompt", "query", "question", "text", "message"];
          for (const key of candidateKeys) {
            if (typeof state[key] === "string" && (state[key] as string).trim()) {
              messages = [{ role: "user", content: (state[key] as string).trim() }];
              break;
            }
          }
          if (messages.length === 0) {
            for (const [k, v] of Object.entries(state)) {
              if (typeof v === "string" && v.trim() && k !== "id") {
                messages = [{ role: "user", content: v.trim() }];
                break;
              }
            }
          }
        }

        if (messages.length === 0) {
          throw new Error(
            `Agent "${nodeName}" execution failed: No user input message or prompt was provided. Please type a message in the input box before running the graph.`
          );
        }

        // Detect LLM node connected to this agent on the canvas
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

        // Prefer passed apiKey, then localStorage, then NEXT_PUBLIC env
        let effectiveApiKey = apiKey;
        if (!effectiveApiKey && typeof window !== "undefined") {
          effectiveApiKey =
            localStorage.getItem(`dezign2app_lg_key_${effectiveProvider}`) || undefined;
        }
        if (!effectiveApiKey && effectiveProvider === "groq") {
          effectiveApiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
        }

        if (!effectiveApiKey && effectiveProvider !== "custom") {
          throw new Error(
            `Missing API Key: Agent node "${nodeName}" requires a valid ${effectiveProvider.toUpperCase()} API key. Please enter your API key in the toolbar.`
          );
        }

        // Extract connected tools (via edges and agent data)
        const connectedTools: Array<{ id: string; name: string; source?: string }> = [];
        const seenToolIds = new Set<string>();

        const toolEdges = edges.filter(
          (e) =>
            e.target === node.id &&
            (e.targetHandle === "tool_in" ||
              e.targetHandle === "tools_in" ||
              e.targetHandle?.includes("tool")),
        );
        for (const e of toolEdges) {
          const tn = nodes.find((n) => n.id === e.source);
          const tId = tn?.id || e.source;
          if (!seenToolIds.has(tId)) {
            seenToolIds.add(tId);
            connectedTools.push({
              id: tId,
              name: (tn?.data as any)?.name || (tn?.data as any)?.label || "Tool",
              source: (tn?.data as any)?.source,
            });
          }
        }
        if (Array.isArray(agentData.tools)) {
          for (const item of agentData.tools) {
            const tName = typeof item === "string" ? item : (item as any)?.name || (item as any)?.id;
            const tId = typeof item === "string" ? item : (item as any)?.id || tName;
            if (tId && !seenToolIds.has(tId)) {
              seenToolIds.add(tId);
              connectedTools.push({ id: tId, name: tName || "Tool" });
            }
          }
        }

        // Extract connected middleware
        const connectedMiddleware: Array<{ id: string; name: string; type?: string }> = [];
        const seenMwIds = new Set<string>();
        const mwEdges = edges.filter(
          (e) =>
            e.target === node.id &&
            (e.targetHandle === "middleware_in" ||
              e.targetHandle?.includes("middleware")),
        );
        for (const e of mwEdges) {
          const mn = nodes.find((n) => n.id === e.source);
          const mId = mn?.id || e.source;
          if (!seenMwIds.has(mId)) {
            seenMwIds.add(mId);
            connectedMiddleware.push({
              id: mId,
              name: (mn?.data as any)?.name || (mn?.data as any)?.label || "Middleware",
              type: (mn?.data as any)?.middlewareType,
            });
          }
        }
        if (Array.isArray(agentData.middleware)) {
          for (const item of agentData.middleware) {
            const mName = typeof item === "string" ? item : (item as any)?.name || (item as any)?.id;
            const mId = typeof item === "string" ? item : (item as any)?.id || mName;
            if (mId && !seenMwIds.has(mId)) {
              seenMwIds.add(mId);
              connectedMiddleware.push({ id: mId, name: mName || "Middleware" });
            }
          }
        }

        if (connectedTools.length > 0) {
          outputDelta.tools = connectedTools;
        }
        if (connectedMiddleware.length > 0) {
          outputDelta.middleware = connectedMiddleware;
        }

        // ── CONFIG 1/5: IDENTITY & PROMPT ──
        const agentName = agentData.name || agentData.label || nodeName;
        addLog(
          "config",
          `[Config 1/5 - Identity & Prompt] Agent: "${agentName}" | System Prompt: "${systemPrompt.length > 90 ? systemPrompt.slice(0, 90) + "..." : systemPrompt}" (${systemPrompt.length} chars)`,
          {
            agentName,
            systemPrompt,
            agentId: agentData.agentId || node.id,
          }
        );

        // ── CONFIG 2/5: MODEL & TOOLS ──
        addLog(
          "config",
          `[Config 2/5 - Model & Tools] Model: ${effectiveProvider.toUpperCase()} / ${effectiveModel} | Tools: ${connectedTools.length > 0 ? connectedTools.map((t) => t.name).join(", ") : "None attached"} (${connectedTools.length}) | Middleware: ${connectedMiddleware.length > 0 ? connectedMiddleware.map((m) => m.name).join(", ") : "0 active"}`,
          {
            provider: effectiveProvider,
            model: effectiveModel,
            tools: connectedTools,
            middleware: connectedMiddleware,
          }
        );

        // ── CONFIG 3/5: STRUCTURED OUTPUT ──
        const responseFormat = agentData.responseFormat;
        const isStructured = Boolean(responseFormat?.enabled);
        const schemaJsonStr = responseFormat?.schemaJson?.trim() || "";
        let parsedSchemaFields: Array<{ name: string; type?: string; required?: boolean }> = [];
        if (isStructured && schemaJsonStr) {
          try {
            const rawSchema = JSON.parse(schemaJsonStr);
            if (rawSchema?.properties && typeof rawSchema.properties === "object") {
              const reqs = Array.isArray(rawSchema.required) ? rawSchema.required : [];
              parsedSchemaFields = Object.entries(rawSchema.properties).map(([k, def]: [string, any]) => ({
                name: k,
                type: def?.type || "string",
                required: reqs.includes(k),
              }));
            }
          } catch {}
        }
        addLog(
          "config",
          `[Config 3/5 - Structured Output] ${isStructured ? `Active (Strategy: ${responseFormat?.strategy || "auto"}, Schema: { ${parsedSchemaFields.map((f) => `${f.name}:${f.type}${f.required ? " [REQ]" : ""}`).join(", ") || "custom"} })` : "Disabled (Plain Text Output)"}`,
          {
            enabled: isStructured,
            strategy: responseFormat?.strategy || "auto",
            schemaFields: parsedSchemaFields,
            schemaJson: responseFormat?.schemaJson,
            toolMessageContent: responseFormat?.toolMessageContent,
            handleErrorMode: responseFormat?.handleErrorMode,
          }
        );

        // ── CONFIG 4/5: STATE UPDATES ──
        const configuredUpdates = agentData.stateUpdates || [];
        addLog(
          "config",
          `[Config 4/5 - State Updates] ${configuredUpdates.length} channel update(s) configured: ${configuredUpdates.map((u) => `${u.channelKey} <- ${u.source === "structured_field" ? `structuredResponse.${u.schemaField || u.value}` : u.source || "value"} [mode: ${u.mode || "replace"}]`).join(", ") || "None"}`,
          {
            stateUpdates: configuredUpdates,
          }
        );

        // ── CONFIG 5/5: EVENT STREAMING ──
        const streamConfig = agentData.streamConfig;
        const isStreamActive = streamConfig?.enabled !== false;
        const streamPreset =
          ((streamConfig as Record<string, unknown> | undefined)?.preset as string) ||
          "Standard SSE";
        addLog(
          "config",
          `[Config 5/5 - Event Streaming] ${isStreamActive ? `Active (${streamConfig?.version || "v3"} - Preset: ${streamPreset})` : "Disabled"}`,
          {
            streamConfig,
          }
        );

        // Call the real LLM endpoint directly in the browser
        const streamEnabled = isStreamActive;
        addLog("llm", `Calling LLM: ${effectiveProvider.toUpperCase()} / ${effectiveModel} (${messages.length} message(s))`);
        const { text: responseText, streamBatches } = await callBrowserLLM({
          provider: effectiveProvider,
          apiKey: effectiveApiKey,
          modelName: effectiveModel,
          systemPrompt,
          messages,
          customUrl: llmData?.url || llmData?.baseUrl,
          responseFormat,
          streamEnabled,
        });

        latestAssistantResponse = responseText;
        addLog("llm", `Received LLM response (${responseText.length} chars, ${streamBatches.length} streaming batch(es))`);

        if (responseFormat?.enabled) {
          let parsed: Record<string, unknown> | null = extractJsonFromText(responseText);
          if (!parsed) {
            const trimmedClean = responseText.trim().replace(/^["']|["']$/g, "");
            if (
              parsedSchemaFields.length === 1 &&
              parsedSchemaFields[0]?.name &&
              trimmedClean.length < 100 &&
              !trimmedClean.startsWith("{")
            ) {
              parsed = { [parsedSchemaFields[0].name]: trimmedClean };
            } else {
              parsed = { raw: responseText };
            }
          }
          state.structuredResponse = parsed;
          outputDelta.structuredResponse = parsed;
          const formattedContent = JSON.stringify(parsed, null, 2);
          const newMessages = [...messages, { role: "assistant", content: formattedContent }];
          state.messages = newMessages;
          outputDelta.messages = newMessages;
          outputDelta.response = formattedContent;
          addLog("llm", `Structured Output Parsed: ${JSON.stringify(parsed)}`, { structuredResponse: parsed });
        } else {
          const newMessages = [...messages, { role: "assistant", content: responseText }];
          state.messages = newMessages;
          outputDelta.messages = newMessages;
          outputDelta.response = responseText;
        }

        if (streamBatches && streamBatches.length > 0) {
          const runId = `run_${threadId.slice(0, 8)}_${Math.random().toString(36).slice(2, 6)}`;
          const stripEmpty = agentData.streamConfig?.envelope?.stripEmptyDeltas !== false;
          const filtered = streamBatches.filter((b) => (stripEmpty ? Boolean(b.delta) : true));
          const formattedBatches: StreamBatchItem[] = filtered.map((b, newIdx) => ({
            ...b,
            index: newIdx,
            formatted: formatStreamingBatch({
              batch: b,
              nodeName,
              runId,
              streamConfig: agentData.streamConfig,
            }),
          }));

          outputDelta.streamBatches = formattedBatches;
          outputDelta.streamBatchCount = formattedBatches.length;
          if (agentData?.streamConfig) {
            outputDelta.streamConfig = agentData.streamConfig;
          }
        }

        // Apply stateUpdates configured on agent
        const appliedStateUpdates: Array<{
          channelKey: string;
          previousValue: unknown;
          newValue: unknown;
          reducer: string;
          source: string;
          sourceField?: string;
        }> = [];

        for (const update of agentData.stateUpdates || []) {
          const rawFieldKey = update.schemaField || update.value || update.channelKey || "";
          const cleanFieldKey = rawFieldKey.replace(/^structuredResponse\./, "").trim();

          const parsedObj = outputDelta.structuredResponse as
            | Record<string, unknown>
            | undefined;

          let val: unknown;

          if (update.source === "structured_field" || update.schemaField) {
            val = resolveStructuredFieldValue(rawFieldKey, parsedObj, latestAssistantResponse);
          } else if (update.source === "structured_full") {
            val = outputDelta.structuredResponse;
          } else if (update.source === "message_content") {
            val = latestAssistantResponse;
          } else if (update.source === "message_object") {
            const msgs = (outputDelta as Record<string, unknown>).messages;
            val = Array.isArray(msgs) && msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
          } else {
            val = update.value;
            if (typeof val === "string") {
              try {
                val = JSON.parse(val);
              } catch {
                // Keep plain string
              }
            }
          }

          if (val === undefined) {
            addLog(
              "warn",
              `State update for channel "${update.channelKey}" skipped: field "${cleanFieldKey}" not found in model output`,
              {
                update,
                structuredResponse: outputDelta.structuredResponse,
                response: latestAssistantResponse,
              }
            );
            continue;
          }

          const targetChannel = stateChannels.find(
            (c) => c.key === update.channelKey,
          );
          const channelReducer =
            targetChannel?.reducer ||
            (update.mode === "append" ? "append" : "replace");

          const prevVal = state[update.channelKey];

          if (
            (update.mode === "append" ||
              channelReducer === "append" ||
              channelReducer === "concat_array") &&
            Array.isArray(state[update.channelKey])
          ) {
            state[update.channelKey] = [
              ...(state[update.channelKey] as unknown[]),
              ...(Array.isArray(val) ? val : [val]),
            ];
          } else if (
            (channelReducer === "merge_object" ||
              targetChannel?.type === "object") &&
            typeof state[update.channelKey] === "object" &&
            typeof val === "object" &&
            state[update.channelKey] !== null &&
            val !== null
          ) {
            state[update.channelKey] = {
              ...(state[update.channelKey] as Record<string, unknown>),
              ...(val as Record<string, unknown>),
            };
          } else {
            state[update.channelKey] = val;
          }

          const newVal = state[update.channelKey];
          outputDelta[update.channelKey] = newVal;

          const record = {
            channelKey: update.channelKey,
            previousValue: prevVal,
            newValue: newVal,
            reducer: channelReducer,
            source: update.source || "structured_field",
            sourceField: cleanFieldKey,
          };
          appliedStateUpdates.push(record);

          addLog(
            "state",
            `State Channel Mutated: "${update.channelKey}" = ${JSON.stringify(newVal)} (Reducer: ${channelReducer}, was: ${JSON.stringify(prevVal)})`,
            record
          );
        }

        if (appliedStateUpdates.length > 0) {
          outputDelta.stateUpdates = appliedStateUpdates;
        }
      }

      // ─── B. STEP NODE ───────────────────────────────────────────────
      else if (isStep) {
        const stepData = node.data as StepNodeData;

        // B1: LLM Call / Summarizer / Evaluator Step
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
            (effectiveProvider === "groq"
              ? "openai/gpt-oss-120b"
              : effectiveProvider === "openai"
              ? "gpt-4o-mini"
              : "claude-3-5-sonnet-20241022");

          let effectiveApiKey = apiKey;
          if (!effectiveApiKey && typeof window !== "undefined") {
            effectiveApiKey =
              localStorage.getItem(`dezign2app_lg_key_${effectiveProvider}`) || undefined;
          }
          if (!effectiveApiKey && effectiveProvider === "groq") {
            effectiveApiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
          }

          if (!effectiveApiKey && effectiveProvider !== "custom") {
            throw new Error(
              `Missing API Key: Step "${nodeName}" requires a valid ${effectiveProvider.toUpperCase()} API key.`
            );
          }

          const systemPrompt =
            stepData.modelConfig?.systemPrompt ||
            (stepData.stepType === "summarizer"
              ? "Summarize the current conversation and state concisely."
              : stepData.stepType === "evaluator"
              ? "Evaluate the input against criteria and provide assessment."
              : "You are a helpful assistant.");

          let msgs: GraphChatMessage[] = extractMessages(state.messages);
          if (msgs.length === 0) {
            if (typeof state.message === "string" && state.message.trim()) {
              msgs = [{ role: "user", content: state.message.trim() }];
            } else if (typeof state.prompt === "string" && state.prompt.trim()) {
              msgs = [{ role: "user", content: state.prompt.trim() }];
            } else {
              msgs = [{ role: "user", content: JSON.stringify(state) }];
            }
          }

          addLog("llm", `Executing ${stepData.stepType} step via ${effectiveProvider.toUpperCase()} (${effectiveModel})`);
          const { text: responseText, streamBatches } = await callBrowserLLM({
            provider: effectiveProvider,
            apiKey: effectiveApiKey,
            modelName: effectiveModel,
            systemPrompt,
            messages: msgs,
            customUrl: llmData?.url || llmData?.baseUrl,
          });

          latestAssistantResponse = responseText;
          addLog("llm", `Received response from ${effectiveModel} (${responseText.length} chars)`);
          const outKey = stepData.stepId || node.id || "response";
          outputDelta[outKey] = responseText;
          if (Array.isArray(state.messages)) {
            const updated = [...state.messages, { role: "assistant", content: responseText }];
            state.messages = updated;
            outputDelta.messages = updated;
          } else {
            state[outKey] = responseText;
          }
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
            throw new Error(
              `Tool step "${nodeName}" does not have a connected tool definition on the canvas.`
            );
          }

          addLog("tool", `Invoking tool "${toolData.name || nodeName}" [source: ${toolData.source}]`);

          if (toolData.source === "api_endpoint") {
            if (!toolData.endpointUrl) {
              throw new Error(`Tool "${toolData.name || nodeName}" has no endpoint URL configured.`);
            }
            addLog("tool", `POST request sent to ${toolData.endpointUrl}`);
            let res: Response;
            try {
              res = await fetch(toolData.endpointUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(state),
              });
            } catch (netErr: unknown) {
              throw new Error(
                `API tool "${toolData.name || nodeName}" failed to reach ${toolData.endpointUrl}: ${netErr instanceof Error ? netErr.message : String(netErr)}`
              );
            }
            if (!res.ok) {
              const errBody = await res.text();
              throw new Error(
                `API tool "${toolData.name || nodeName}" (${toolData.endpointUrl}) failed with HTTP ${res.status}: ${errBody}`
              );
            }
            const json = await res.json();
            addLog("tool", `Tool "${toolData.name || nodeName}" returned HTTP ${res.status} (${JSON.stringify(json).length} bytes)`);
            const resKey = toolData.name || "tool_result";
            outputDelta[resKey] = json;
            state[resKey] = json;
          } else if (toolData.functionBody && toolData.functionBody.trim()) {
            try {
              const toolFn = new Function("input", "state", "clone", toolData.functionBody);
              const lastMsg = Array.isArray(state.messages)
                ? state.messages[state.messages.length - 1]
                : undefined;
              const result = await toolFn(lastMsg || state, state, clone);
              addLog("tool", `Executed custom tool function body successfully`);
              const resKey = toolData.name || "tool_result";
              outputDelta[resKey] = result;
              state[resKey] = result;
            } catch (err: unknown) {
              throw new Error(
                `Tool "${toolData.name || nodeName}" execution error: ${err instanceof Error ? err.message : String(err)}`
              );
            }
          } else if (toolData.source === "mcp_server") {
            throw new Error(
              `Tool "${toolData.name || nodeName}" is an MCP tool (${toolData.mcpConnectionId || "remote"}). Live MCP execution requires a backend server bridge. Configure a JavaScript function body or API endpoint to test in-browser.`
            );
          } else {
            throw new Error(
              `Tool "${toolData.name || nodeName}" has no implementation. Please define a JavaScript function body or API endpoint for this tool.`
            );
          }
        }

        // B3: Custom Code Step
        else if (stepData.stepType === "custom_code") {
          if (!stepData.customCode?.body || !stepData.customCode.body.trim()) {
            throw new Error(`Custom code step "${nodeName}" has an empty function body.`);
          }
          addLog("step", `Executing custom code script for "${nodeName}"`);
          try {
            const customConsole = {
              log: (...args: unknown[]) => {
                const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
                addLog("info", `[console.log] ${msg}`);
              },
              warn: (...args: unknown[]) => {
                const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
                addLog("warn", `[console.warn] ${msg}`);
              },
              error: (...args: unknown[]) => {
                const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
                addLog("error", `[console.error] ${msg}`);
              },
            };
            const runner = new Function("state", "clone", "console", stepData.customCode.body);
            const res = await runner(state, clone, customConsole);
            if (res && typeof res === "object") {
              Object.assign(state, res);
              Object.assign(outputDelta, res);
            }
            addLog("step", `Custom code block executed successfully`);
          } catch (codeErr: unknown) {
            throw new Error(
              `Custom code step "${nodeName}" error: ${codeErr instanceof Error ? codeErr.message : String(codeErr)}`
            );
          }
        }

        // B4: Router Step
        else if (stepData.stepType === "router") {
          const branches = stepData.routerConfig?.branches || [];
          const outgoing = flowEdges.filter((e) => e.source === currentNodeId);
          addLog("router", `Evaluating ${branches.length} conditional route branch(es)`);

          const evaluatedBranches = branches.map((b, bIdx) => {
            const actualVal = resolveRouterFieldValue(b.field, state);
            const isMatch = !b.isDefault && evaluateRouterBranch(b, state);
            const edge = outgoing.find((e) => e.sourceHandle === b.id) || outgoing[0];
            const targetNode = nodes.find((n) => n.id === edge?.target);
            const targetLabel =
              edge?.target === "END" || edge?.target?.startsWith("end_")
                ? "END"
                : (targetNode?.data as { label?: string })?.label || edge?.target || "END";
            addLog(
              "router",
              `Route "${b.label || `Route ${bIdx + 1}`}": (${b.field || "state"} ${b.operator} ${b.value ?? ""}) -> ${isMatch ? "MATCHED" : "SKIPPED"} [state: ${JSON.stringify(actualVal)}]`
            );
            return {
              id: b.id,
              label: b.label || `Route ${bIdx + 1}`,
              field: b.field,
              operator: b.operator,
              value: b.value,
              isDefault: b.isDefault,
              actualValue: actualVal,
              matched: isMatch,
              targetId: edge?.target,
              targetLabel,
            };
          });

          let matchedBranch = branches.find(
            (b) => !b.isDefault && evaluateRouterBranch(b, state),
          );
          if (!matchedBranch) {
            matchedBranch = branches.find((b) => b.isDefault);
          }

          const targetEdge = matchedBranch
            ? outgoing.find((e) => e.sourceHandle === matchedBranch?.id) || outgoing[0]
            : outgoing[0];

          const targetNode = nodes.find((n) => n.id === targetEdge?.target);
          const targetNodeLabel =
            targetEdge?.target === "END" || targetEdge?.target?.startsWith("end_")
              ? "END"
              : (targetNode?.data as { label?: string })?.label || targetEdge?.target || "END";

          const selectedRouteName =
            matchedBranch?.label || (matchedBranch?.id ? `Route (${matchedBranch.id})` : "Default");
          const conditionDesc = matchedBranch?.isDefault
            ? "default (fallback)"
            : matchedBranch
              ? `${matchedBranch.field} ${matchedBranch.operator} ${matchedBranch.value ?? ""}`.trim()
              : "none";

          addLog("router", `Selected Route: "${selectedRouteName}" -> Proceeding to step "${targetNodeLabel}"`);

          outputDelta.router = {
            selectedRoute: selectedRouteName,
            selectedBranchId: matchedBranch?.id,
            condition: conditionDesc,
            targetNodeId: targetEdge?.target,
            targetNodeLabel,
            evaluatedBranches,
          };
        }

        // B5: Human Gate / Interrupt Step
        else if (stepData.stepType === "human_gate" || stepData.stepType === "interrupt") {
          const pauseMsg =
            stepData.humanGateConfig?.approvalPrompt ||
            "Execution paused at human gate.";
          addLog("warn", `Human Gate: ${pauseMsg}`);
          outputDelta.interrupt = {
            message: pauseMsg,
          };
        }

        // Apply stateUpdates
        const appliedStepStateUpdates: Array<{
          channelKey: string;
          previousValue: unknown;
          newValue: unknown;
          reducer: string;
          source: string;
          sourceField?: string;
        }> = [];

        for (const updateItem of stepData.stateUpdates || []) {
          const update = updateItem as {
            channelKey: string;
            value?: string;
            mode?: "set" | "append" | "expression" | string;
            source?: string;
            schemaField?: string;
          };
          const rawFieldKey = update.schemaField || update.value || update.channelKey || "";
          const cleanFieldKey = rawFieldKey.replace(/^structuredResponse\./, "").trim();

          const parsedObj = outputDelta.structuredResponse as
            | Record<string, unknown>
            | undefined;

          let val: unknown;

          if (update.source === "structured_field" || update.schemaField) {
            val = resolveStructuredFieldValue(rawFieldKey, parsedObj, latestAssistantResponse);
          } else if (update.source === "structured_full") {
            val = outputDelta.structuredResponse;
          } else if (update.source === "message_content") {
            val = latestAssistantResponse;
          } else {
            val = update.value;
            if (typeof val === "string") {
              try {
                val = JSON.parse(val);
              } catch {
                // plain text
              }
            }
          }

          if (val === undefined) continue;

          const targetChannel = stateChannels.find(
            (c) => c.key === update.channelKey,
          );
          const channelReducer =
            targetChannel?.reducer ||
            (update.mode === "append" ? "append" : "replace");

          const prevVal = state[update.channelKey];

          if (
            (update.mode === "append" ||
              channelReducer === "append" ||
              channelReducer === "concat_array") &&
            Array.isArray(state[update.channelKey])
          ) {
            state[update.channelKey] = [
              ...(state[update.channelKey] as unknown[]),
              ...(Array.isArray(val) ? val : [val]),
            ];
          } else if (
            (channelReducer === "merge_object" ||
              targetChannel?.type === "object") &&
            typeof state[update.channelKey] === "object" &&
            typeof val === "object" &&
            state[update.channelKey] !== null &&
            val !== null
          ) {
            state[update.channelKey] = {
              ...(state[update.channelKey] as Record<string, unknown>),
              ...(val as Record<string, unknown>),
            };
          } else {
            state[update.channelKey] = val;
          }

          const newVal = state[update.channelKey];
          outputDelta[update.channelKey] = newVal;

          const record = {
            channelKey: update.channelKey,
            previousValue: prevVal,
            newValue: newVal,
            reducer: channelReducer,
            source: update.source || "custom",
            sourceField: cleanFieldKey,
          };
          appliedStepStateUpdates.push(record);

          addLog(
            "state",
            `State Channel Mutated: "${update.channelKey}" = ${JSON.stringify(newVal)} (Reducer: ${channelReducer}, was: ${JSON.stringify(prevVal)})`,
            record
          );
        }

        if (appliedStepStateUpdates.length > 0) {
          outputDelta.stateUpdates = appliedStepStateUpdates;
        }
      }

      // Attach generic connected tools and middleware metadata for any node
      const connectedTools = edges
        .filter((e) => e.target === node.id && (e.targetHandle === "tool_in" || e.targetHandle?.includes("tool")))
        .map((e) => {
          const tn = nodes.find((n) => n.id === e.source);
          return {
            id: tn?.id || e.source,
            name: (tn?.data as any)?.name || (tn?.data as any)?.label || "Tool",
            source: (tn?.data as any)?.source,
          };
        });

      const connectedMiddleware = edges
        .filter((e) => e.target === node.id && (e.targetHandle === "middleware_in" || e.targetHandle?.includes("middleware")))
        .map((e) => {
          const mn = nodes.find((n) => n.id === e.source);
          return {
            id: mn?.id || e.source,
            name: (mn?.data as any)?.name || (mn?.data as any)?.label || "Middleware",
            type: (mn?.data as any)?.middlewareType,
          };
        });

      if (connectedTools.length > 0) {
        outputDelta.tools = connectedTools;
        addLog("tool", `Connected tools (${connectedTools.length}): ${connectedTools.map((t) => t.name).join(", ")}`);
      }
      if (connectedMiddleware.length > 0) {
        outputDelta.middleware = connectedMiddleware;
        addLog("middleware", `Connected middleware (${connectedMiddleware.length}): ${connectedMiddleware.map((m) => m.name).join(", ")}`);
      }

      const durationMs = Date.now() - stepStartTime;
      addLog("step", `Completed step "${nodeName}" in ${durationMs}ms`);
      nodeTrace.status = "completed";
      nodeTrace.logs = stepLogs;
      nodeTrace.output = clone(outputDelta);
      onStepEnd?.(node.id, nodeName, clone(outputDelta), durationMs);

      // Save interim checkpoint
      const checkpoint: BrowserCheckpoint = {
        id: generateId(),
        threadId,
        stepId: node.id,
        stepName: nodeName,
        state: clone(state),
        timestamp: Date.now(),
      };
      await saveBrowserCheckpoint(checkpoint);
      onCheckpoint?.(checkpoint);
    } catch (err: unknown) {
      nodeTrace.status = "failed";
      const errMsg = err instanceof Error ? err.message : String(err);
      addLog("error", `Step "${nodeName}" failed: ${errMsg}`);
      nodeTrace.logs = stepLogs;
      nodeTrace.output = { error: errMsg };
      onStepEnd?.(node.id, nodeName, { error: errMsg }, Date.now() - stepStartTime);
      return {
        finalState: state,
        trace,
        logs: allRunLogs,
        totalDurationMs: Date.now() - startTime,
        visitedNodes,
        latestAssistantResponse,
        error: errMsg,
      };
    }

    // Determine Next Node
    const outgoing = flowEdges.filter((e) => e.source === currentNodeId);
    if (outgoing.length === 0) break;

    const routerInfo = (outputDelta.router as Record<string, unknown> | undefined);
    if (routerInfo?.targetNodeId) {
      currentNodeId = routerInfo.targetNodeId as string;
    } else {
      currentNodeId = outgoing[0]?.target;
    }
  }

  // END Step
  visitedNodes.push("END");
  const endLogs: SimulationStepLogEntry[] = [
    {
      timestamp: Date.now(),
      level: "step",
      message: `Graph reached END. Visited ${visitedNodes.length} steps in ${Date.now() - startTime}ms.`,
      nodeId: "END",
      nodeLabel: "END",
    },
  ];
  allRunLogs.push(...endLogs);

  const endTrace: SimulationTraceEntry = {
    id: `trace_${generateId()}`,
    kind: "step",
    label: "END",
    status: "completed",
    nodeId: "END",
    input: clone(state),
    output: clone(state),
    logs: endLogs,
  };
  trace.push(endTrace);
  onStepStart?.("END", "END", clone(state));
  onStepEnd?.("END", "END", clone(state), 2);

  // Final checkpoint
  const finalCheckpoint: BrowserCheckpoint = {
    id: generateId(),
    threadId,
    stepId: "END",
    stepName: "END",
    state: clone(state),
    timestamp: Date.now(),
  };
  await saveBrowserCheckpoint(finalCheckpoint);
  onCheckpoint?.(finalCheckpoint);

  return {
    finalState: state,
    trace,
    logs: allRunLogs,
    totalDurationMs: Date.now() - startTime,
    visitedNodes,
    latestAssistantResponse,
  };
}

/**
 * Direct browser LLM invocation via client-side fetch.
 * Returns the actual response string from the provider or throws the actual error.
 * Zero mocked strings.
 */
async function callBrowserLLM(args: {
  provider: "openai" | "groq" | "anthropic" | "custom";
  apiKey?: string;
  modelName: string;
  systemPrompt: string;
  messages: GraphChatMessage[];
  customUrl?: string;
  responseFormat?: LangGraphAgentResponseFormatConfig;
  streamEnabled?: boolean;
}): Promise<BrowserLLMResult> {
  const { provider, apiKey, modelName, systemPrompt, messages, customUrl, responseFormat, streamEnabled = true } = args;

  if (messages.length === 0) {
    throw new Error(`Cannot invoke ${provider.toUpperCase()}: No messages or prompt provided.`);
  }

  const isStructured = Boolean(responseFormat?.enabled);
  const schemaStr = responseFormat?.schemaJson?.trim();

  let effectiveSystemPrompt = systemPrompt;
  if (isStructured) {
    effectiveSystemPrompt += `\n\nCRITICAL INSTRUCTION: You must respond ONLY with a valid JSON object matching this schema or structure:\n${
      schemaStr || '{"aiResponse": "string"}'
    }\nDo not include any conversational preamble, explanations, markdown backticks, or any text other than the JSON object itself.`;
  }

  const streamBatches: BrowserLLMStreamBatch[] = [];
  let fullText = "";
  let idx = 0;

  // 1. Custom / Local LLM (Ollama, local vLLM, etc.)
  if (customUrl || provider === "custom") {
    const url = customUrl || "http://localhost:11434/v1/chat/completions";
    const promptMessages = [
      { role: "system", content: effectiveSystemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: modelName,
          messages: promptMessages,
          temperature: isStructured ? 0.2 : 0.7,
          stream: true,
        }),
      });
    } catch (netErr: unknown) {
      throw new Error(
        `Failed to connect to custom LLM at ${url}: ${netErr instanceof Error ? netErr.message : String(netErr)}. Ensure your local model or server is running with CORS enabled.`
      );
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Custom LLM endpoint (${url}) returned HTTP ${res.status}: ${errText}`);
    }

    if (res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;
            if (trimmed.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) fullText += delta;
                streamBatches.push({
                  index: idx++,
                  delta,
                  content: fullText,
                  timestamp: new Date().toISOString(),
                  raw: parsed.choices?.[0],
                });
              } catch {}
            }
          }
        }
      } catch {}
    }

    if (!fullText && streamBatches.length === 0) {
      try {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "";
        return {
          text: content,
          streamBatches: [{ index: 0, delta: content, content, timestamp: new Date().toISOString(), raw: data }],
        };
      } catch {}
    }

    return { text: fullText, streamBatches };
  }

  // 2. Groq & OpenAI (OpenAI-compatible chat completions)
  if (provider === "groq" || provider === "openai") {
    if (!apiKey) {
      throw new Error(`Missing API Key: ${provider.toUpperCase()} requires a valid API key.`);
    }
    const url =
      provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";

    const promptMessages = [
      { role: "system", content: effectiveSystemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: promptMessages,
          temperature: isStructured ? 0.2 : 0.7,
          stream: streamEnabled,
          ...(isStructured ? { response_format: { type: "json_object" } } : {}),
        }),
      });
    } catch (netErr: unknown) {
      throw new Error(
        `Network failure connecting to ${provider.toUpperCase()} (${url}): ${netErr instanceof Error ? netErr.message : String(netErr)}`
      );
    }

    if (!res.ok) {
      let errMsg = "";
      try {
        const errJson = await res.json();
        errMsg = errJson.error?.message || errJson.message || JSON.stringify(errJson);
      } catch {
        errMsg = await res.text();
      }
      throw new Error(`${provider.toUpperCase()} API error (${res.status}): ${errMsg}`);
    }

    if (!streamEnabled) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      return {
        text: content,
        streamBatches: [],
      };
    }

    if (res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;
            if (trimmed.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) fullText += delta;
                streamBatches.push({
                  index: idx++,
                  delta,
                  content: fullText,
                  timestamp: new Date().toISOString(),
                  raw: parsed.choices?.[0],
                });
              } catch {}
            }
          }
        }
      } catch {}
    }

    if (!fullText && streamBatches.length === 0) {
      try {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "";
        return {
          text: content,
          streamBatches: [{ index: 0, delta: content, content, timestamp: new Date().toISOString(), raw: data }],
        };
      } catch {}
    }

    return { text: fullText, streamBatches };
  }

  // 3. Anthropic Messages API
  if (provider === "anthropic") {
    if (!apiKey) {
      throw new Error(`Missing API Key: Anthropic requires a valid API key.`);
    }
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: modelName || "claude-3-5-sonnet-20241022",
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
          max_tokens: 1024,
          stream: true,
        }),
      });
    } catch (netErr: unknown) {
      throw new Error(
        `Network failure connecting to Anthropic: ${netErr instanceof Error ? netErr.message : String(netErr)}`
      );
    }

    if (!res.ok) {
      let errMsg = "";
      try {
        const errJson = await res.json();
        errMsg = errJson.error?.message || errJson.message || JSON.stringify(errJson);
      } catch {
        errMsg = await res.text();
      }
      throw new Error(`Anthropic API error (${res.status}): ${errMsg}`);
    }

    if (res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;
            if (trimmed.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const delta = parsed.type === "content_block_delta" ? parsed.delta?.text || "" : "";
                if (delta) fullText += delta;
                streamBatches.push({
                  index: idx++,
                  delta,
                  content: fullText,
                  timestamp: new Date().toISOString(),
                  raw: parsed,
                });
              } catch {}
            }
          }
        }
      } catch {}
    }

    if (!fullText && streamBatches.length === 0) {
      try {
        const data = await res.json();
        const content = data.content?.[0]?.text || "";
        return {
          text: content,
          streamBatches: [{ index: 0, delta: content, content, timestamp: new Date().toISOString(), raw: data }],
        };
      } catch {}
    }

    return { text: fullText, streamBatches };
  }

  throw new Error(`Unsupported LLM provider: "${provider}". Please choose Groq, OpenAI, or Anthropic.`);
}

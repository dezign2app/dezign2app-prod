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
import { evaluateRouterBranch } from "./langgraph";
import {
  saveBrowserCheckpoint,
  getLatestBrowserCheckpoint,
  BrowserCheckpoint,
} from "./indexedDBCheckpointer";
import type { SimulationTraceEntry } from "./types";
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
  const startTrace: SimulationTraceEntry = {
    id: `trace_${generateId()}`,
    kind: "step",
    label: "START",
    status: "completed",
    nodeId: "START",
    input: clone(state),
    output: clone(state),
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

    const nodeTrace: SimulationTraceEntry = {
      id: `trace_${generateId()}`,
      kind: "step",
      label: nodeName,
      status: "completed",
      nodeId: node.id,
      input: clone(state),
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

        // Call the real LLM endpoint directly in the browser
        const responseFormat = agentData.responseFormat;
        const streamEnabled = agentData.streamConfig?.enabled !== false;
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
        if (responseFormat?.enabled) {
          let parsed: Record<string, unknown> | null = null;
          try {
            let clean = responseText.trim();
            if (clean.startsWith("```")) {
              clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
            }
            parsed = JSON.parse(clean);
          } catch {
            parsed = { raw: responseText };
          }
          state.structuredResponse = parsed;
          outputDelta.structuredResponse = parsed;
          const formattedContent = JSON.stringify(parsed, null, 2);
          const newMessages = [...messages, { role: "assistant", content: formattedContent }];
          state.messages = newMessages;
          outputDelta.messages = newMessages;
          outputDelta.response = formattedContent;
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
        for (const update of agentData.stateUpdates || []) {
          let val: unknown;
          if (update.source === "structured_field" || update.schemaField) {
            const fieldKey = update.schemaField || update.value;
            const parsedObj = outputDelta.structuredResponse as
              | Record<string, unknown>
              | undefined;
            val = fieldKey && parsedObj ? parsedObj[fieldKey] : undefined;
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

          if (val === undefined) continue;

          const targetChannel = stateChannels.find(
            (c) => c.key === update.channelKey,
          );
          const channelReducer = targetChannel?.reducer;

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
          outputDelta[update.channelKey] = state[update.channelKey];
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

          const { text: responseText, streamBatches } = await callBrowserLLM({
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

          if (toolData.source === "api_endpoint") {
            if (!toolData.endpointUrl) {
              throw new Error(`Tool "${toolData.name || nodeName}" has no endpoint URL configured.`);
            }
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
          try {
            const runner = new Function("state", "clone", stepData.customCode.body);
            const res = await runner(state, clone);
            if (res && typeof res === "object") {
              Object.assign(state, res);
              Object.assign(outputDelta, res);
            }
          } catch (codeErr: unknown) {
            throw new Error(
              `Custom code step "${nodeName}" error: ${codeErr instanceof Error ? codeErr.message : String(codeErr)}`
            );
          }
        }

        // B4: Router Step (Edge determination handled below)
        else if (stepData.stepType === "router") {
          outputDelta.router = { evaluated: true };
        }

        // B5: Human Gate / Interrupt Step
        else if (stepData.stepType === "human_gate" || stepData.stepType === "interrupt") {
          outputDelta.interrupt = {
            message:
              stepData.humanGateConfig?.approvalPrompt ||
              "Execution paused at human gate.",
          };
        }

        // Apply stateUpdates
        for (const update of stepData.stateUpdates || []) {
          let val: unknown = update.value;
          if (typeof val === "string") {
            try {
              val = JSON.parse(val);
            } catch {
              // plain text
            }
          }
          if (update.mode === "append" && Array.isArray(state[update.channelKey])) {
            state[update.channelKey] = [
              ...(state[update.channelKey] as unknown[]),
              val,
            ];
          } else {
            state[update.channelKey] = val;
          }
          outputDelta[update.channelKey] = state[update.channelKey];
        }
      }

      const durationMs = Date.now() - stepStartTime;
      nodeTrace.status = "completed";
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
      nodeTrace.output = { error: errMsg };
      onStepEnd?.(node.id, nodeName, { error: errMsg }, Date.now() - stepStartTime);
      return {
        finalState: state,
        trace,
        totalDurationMs: Date.now() - startTime,
        visitedNodes,
        latestAssistantResponse,
        error: errMsg,
      };
    }

    // Determine Next Node
    const outgoing = flowEdges.filter((e) => e.source === currentNodeId);
    if (outgoing.length === 0) break;

    const stepData = node.data as StepNodeData | undefined;
    if (stepData?.stepType === "router" && stepData.routerConfig?.branches) {
      const branches = stepData.routerConfig.branches;
      let matchedBranch = branches.find(
        (b) => !b.isDefault && evaluateRouterBranch(b, state),
      );
      if (!matchedBranch) {
        matchedBranch = branches.find((b) => b.isDefault);
      }

      if (!matchedBranch) {
        const errMsg = `Router "${nodeName}" found no matching branch condition for state: ${JSON.stringify(state)}, and no default branch is configured.`;
        nodeTrace.status = "failed";
        nodeTrace.output = { error: errMsg };
        return {
          finalState: state,
          trace,
          totalDurationMs: Date.now() - startTime,
          visitedNodes,
          latestAssistantResponse,
          error: errMsg,
        };
      }

      const targetEdge =
        outgoing.find((e) => e.sourceHandle === matchedBranch?.id) || outgoing[0];
      if (!targetEdge) {
        const errMsg = `Router "${nodeName}" matched branch "${matchedBranch.label || matchedBranch.id}", but no outgoing edge is connected to it.`;
        nodeTrace.status = "failed";
        nodeTrace.output = { error: errMsg };
        return {
          finalState: state,
          trace,
          totalDurationMs: Date.now() - startTime,
          visitedNodes,
          latestAssistantResponse,
          error: errMsg,
        };
      }
      currentNodeId = targetEdge.target;
    } else {
      currentNodeId = outgoing[0]?.target;
    }
  }

  // END Step
  visitedNodes.push("END");
  const endTrace: SimulationTraceEntry = {
    id: `trace_${generateId()}`,
    kind: "step",
    label: "END",
    status: "completed",
    nodeId: "END",
    input: clone(state),
    output: clone(state),
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

import { AIMessage } from "@langchain/core/messages";
import type {
  LangGraphCanvasNode,
  LangGraphCanvasEdge,
  LangGraphStateChannel,
  AgentNodeData,
  LangGraphLLMNodeData,
  ToolNodeData,
  MiddlewareNodeData,
} from "@workspace/canvas";
import {
  extractJsonFromText,
  resolveStructuredFieldValue,
} from "../langgraph";
import { formatStreamingBatch, type StreamBatchItem } from "../streamFormatter";
import type {
  SimulationStepLogEntry,
  SimulationStepLogLevel,
} from "../types";
import { callServerLLM } from "./llm";
import { clone, serializeMessages } from "./messages";
import type {
  ConnectedToolInfo,
  ConnectedMiddlewareInfo,
  AppliedStateUpdate,
  StepStateRecord,
  StepStateValue,
} from "./types";
import {
  findTransformerNode,
  runTransformer,
  resolveInputValue,
} from "./stepExecutor";
import type { LangGraphNodePipelineStep } from "@workspace/canvas";

export interface ExecuteAgentNodeParams {
  node: LangGraphCanvasNode;
  nodeName: string;
  state: Record<string, unknown>;
  edges: LangGraphCanvasEdge[];
  nodes: LangGraphCanvasNode[];
  stateChannels: LangGraphStateChannel[];
  threadId: string;
  provider?: "groq" | "openai" | "anthropic" | "custom";
  apiKey?: string;
  modelName?: string;
  nodeStreamBatchesMap: Map<string, StreamBatchItem[]>;
  nodeLlmRequestMap: Map<string, unknown>;
}

export interface ExecuteAgentNodeResult {
  outputDelta: Record<string, unknown>;
  stepLogs: SimulationStepLogEntry[];
  latestAssistantResponse?: string;
}

export async function executeAgentNode(
  params: ExecuteAgentNodeParams,
): Promise<ExecuteAgentNodeResult> {
  const {
    node,
    nodeName,
    state,
    edges,
    nodes,
    stateChannels,
    threadId,
    provider = "groq",
    apiKey,
    modelName,
    nodeStreamBatchesMap,
    nodeLlmRequestMap,
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

  const agentData = node.data as AgentNodeData;
  const systemPrompt = agentData.systemPrompt || "You are a helpful assistant.";

  // Detect LLM node connected to this agent
  const llmEdge = edges.find(
    (e) => e.target === node.id && e.targetHandle === "llm_in",
  );
  const llmNode = llmEdge ? nodes.find((n) => n.id === llmEdge.source) : null;
  const llmData = llmNode?.data as LangGraphLLMNodeData | undefined;

  // Is LLM actually enabled/configured for this node?
  const isExplicitlyDisabled = agentData.llmConfig?.enabled === false;
  const hasConnectedLlm = Boolean(llmNode && llmData?.enabled !== false);
  const isLlmActive =
    !isExplicitlyDisabled &&
    (hasConnectedLlm ||
      agentData.llmConfig?.enabled === true ||
      node.type === "langgraph_agent");

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

  if (isLlmActive && messages.length === 0) {
    throw new Error(
      `Agent "${nodeName}" execution failed: No prompt or user message was provided in graph state.`,
    );
  }

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

  // Extract connected tools (via edges and agent data)
  const connectedTools: ConnectedToolInfo[] = [];
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
    const tnData = tn?.data as ToolNodeData | undefined;
    const tId = tn?.id || e.source;
    if (!seenToolIds.has(tId)) {
      seenToolIds.add(tId);
      connectedTools.push({
        id: tId,
        name: tnData?.name || tnData?.label || "Tool",
        source: tnData?.source,
      });
    }
  }
  if (Array.isArray(agentData.tools)) {
    for (const item of agentData.tools) {
      const tName =
        typeof item === "string"
          ? item
          : (item as { name?: string; id?: string })?.name ||
            (item as { name?: string; id?: string })?.id;
      const tId =
        typeof item === "string"
          ? item
          : (item as { name?: string; id?: string })?.id || tName;
      if (tId && !seenToolIds.has(tId)) {
        seenToolIds.add(tId);
        connectedTools.push({ id: tId, name: tName || "Tool" });
      }
    }
  }

  // Extract connected middleware
  const connectedMiddleware: ConnectedMiddlewareInfo[] = [];
  const seenMwIds = new Set<string>();
  const mwEdges = edges.filter(
    (e) =>
      e.target === node.id &&
      (e.targetHandle === "middleware_in" ||
        e.targetHandle?.includes("middleware")),
  );
  for (const e of mwEdges) {
    const mn = nodes.find((n) => n.id === e.source);
    const mnData = mn?.data as MiddlewareNodeData | undefined;
    const mId = mn?.id || e.source;
    if (!seenMwIds.has(mId)) {
      seenMwIds.add(mId);
      connectedMiddleware.push({
        id: mId,
        name: mnData?.name || mnData?.label || "Middleware",
        type: mnData?.type,
      });
    }
  }
  if (Array.isArray(agentData.middleware)) {
    for (const item of agentData.middleware) {
      const mName =
        typeof item === "string"
          ? item
          : (item as { name?: string; id?: string })?.name ||
            (item as { name?: string; id?: string })?.id;
      const mId =
        typeof item === "string"
          ? item
          : (item as { name?: string; id?: string })?.id || mName;
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
    `[Config 1/5 - Identity & Prompt] Node: "${agentName}" | Mode: ${isLlmActive ? "LLM Agent" : "State Mutator / Component Orchestrator"} | System Prompt: "${systemPrompt.length > 90 ? systemPrompt.slice(0, 90) + "..." : systemPrompt}" (${systemPrompt.length} chars)`,
    {
      agentName,
      systemPrompt,
      agentId: agentData.agentId || node.id,
      isLlmActive,
    },
  );

  // ── CONFIG 2/5: MODEL & TOOLS ──
  if (isLlmActive) {
    addLog(
      "config",
      `[Config 2/5 - Model & Tools] Model: ${effectiveProvider.toUpperCase()} / ${effectiveModel} | Tools: ${connectedTools.length > 0 ? connectedTools.map((t) => t.name).join(", ") : "None attached"} (${connectedTools.length}) | Middleware: ${connectedMiddleware.length > 0 ? connectedMiddleware.map((m) => m.name).join(", ") : "0 active"}`,
      {
        provider: effectiveProvider,
        model: effectiveModel,
        tools: connectedTools,
        middleware: connectedMiddleware,
      },
    );
  } else {
    addLog(
      "config",
      `[Config 2/5 - Model & Tools] LLM is disabled for node "${agentName}". Executing state channel mutations and connected components. | Tools: ${connectedTools.length} | Middleware: ${connectedMiddleware.length}`,
      {
        isLlmActive: false,
        tools: connectedTools,
        middleware: connectedMiddleware,
      },
    );
  }

  // ── CONFIG 3/5: STRUCTURED OUTPUT ──
  const responseFormat = agentData.responseFormat;
  const isStructured = Boolean(responseFormat?.enabled);
  const schemaJsonStr = responseFormat?.schemaJson?.trim() || "";
  let parsedSchemaFields: Array<{ name: string; type?: string; required?: boolean }> = [];
  if (isStructured && schemaJsonStr) {
    try {
      const rawSchema = JSON.parse(schemaJsonStr) as {
        properties?: Record<string, { type?: string }>;
        required?: string[];
      };
      if (rawSchema?.properties && typeof rawSchema.properties === "object") {
        const reqs = Array.isArray(rawSchema.required) ? rawSchema.required : [];
        parsedSchemaFields = Object.entries(rawSchema.properties).map(([k, def]) => ({
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
    },
  );

  // ── CONFIG 4/5: STATE UPDATES ──
  const configuredUpdates = agentData.stateUpdates || [];
  addLog(
    "config",
    `[Config 4/5 - State Updates] ${configuredUpdates.length} channel update(s) configured: ${configuredUpdates.map((u) => `${u.channelKey} <- ${u.source === "structured_field" ? `structuredResponse.${u.schemaField || u.value}` : u.source || "value"} [mode: ${u.mode || "replace"}]`).join(", ") || "None"}`,
    {
      stateUpdates: configuredUpdates,
    },
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
    },
  );

  // Track step outputs across pipeline execution (Step N can map inputs from Step 1..N-1)
  const stepOutputs = new Map<string, StepStateValue>();

  const interpolatePromptTemplate = (prompt: string): string => {
    if (!prompt || !/\$\{([^}]+)\}/.test(prompt)) return prompt;
    return prompt.replace(/\$\{([^}]+)\}/g, (match, expr: string) => {
      const trimmed = expr.trim();
      if (trimmed.startsWith("state.")) {
        const field = trimmed.replace(/^state\./, "");
        const val = resolveInputValue({ kind: "state", field }, { state, stepOutputs });
        if (val !== undefined && val !== null) {
          return typeof val === "object" ? JSON.stringify(val) : String(val);
        }
        return match;
      }

      const dotIdx = trimmed.indexOf(".");
      const rootVar = dotIdx > 0 ? trimmed.substring(0, dotIdx) : trimmed;
      const subField = dotIdx > 0 ? trimmed.substring(dotIdx + 1) : "";

      if (stepOutputs.has(rootVar)) {
        const stepVal = stepOutputs.get(rootVar);
        if (subField && typeof stepVal === "object" && stepVal !== null) {
          const fieldVal = resolveInputValue(
            { kind: "step_output", stepId: rootVar, field: subField },
            { state, stepOutputs },
          );
          if (fieldVal !== undefined && fieldVal !== null) {
            return typeof fieldVal === "object" ? JSON.stringify(fieldVal) : String(fieldVal);
          }
        } else if (stepVal !== undefined && stepVal !== null) {
          return typeof stepVal === "object" ? JSON.stringify(stepVal) : String(stepVal);
        }
        return match;
      }

      if (stepOutputs.has(trimmed)) {
        const val = stepOutputs.get(trimmed);
        if (val !== undefined && val !== null) {
          return typeof val === "object" ? JSON.stringify(val) : String(val);
        }
        return match;
      }

      const fromState = resolveInputValue({ kind: "state", field: trimmed }, { state, stepOutputs });
      if (fromState !== undefined && fromState !== null) {
        return typeof fromState === "object" ? JSON.stringify(fromState) : String(fromState);
      }

      return match;
    });
  };

  const runLlmStep = async () => {
    if (!isLlmActive) return;
    const streamEnabled = isStreamActive;
    const effectivePrompt = interpolatePromptTemplate(systemPrompt);
    addLog("llm", `Calling LLM: ${effectiveProvider.toUpperCase()} / ${effectiveModel} (${messages.length} message(s))`);
    const { text: responseText, streamBatches } = await callServerLLM({
      provider: effectiveProvider,
      apiKey: effectiveApiKey,
      modelName: effectiveModel,
      systemPrompt: effectivePrompt,
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
      outputDelta.structuredResponse = parsed;
      outputDelta.messages = [new AIMessage(JSON.stringify(parsed, null, 2))];
      outputDelta.response = JSON.stringify(parsed);
      addLog("llm", `Structured Output Parsed: ${JSON.stringify(parsed)}`, { structuredResponse: parsed });
    } else {
      outputDelta.messages = [new AIMessage(responseText)];
      outputDelta.response = responseText;
    }

    outputDelta.llmRequest = {
      provider: effectiveProvider,
      model: effectiveModel,
      stream: streamEnabled,
      systemPrompt: effectivePrompt,
      messageCount: messages.length,
    };
    nodeLlmRequestMap.set(node.id, outputDelta.llmRequest);

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

      nodeStreamBatchesMap.set(node.id, formattedBatches);
      outputDelta.streamBatches = formattedBatches;
      outputDelta.streamBatchCount = formattedBatches.length;
    }

    const llmOut = (outputDelta.structuredResponse || responseText) as StepStateValue;
    stepOutputs.set("response", responseText);
    stepOutputs.set("message", responseText);
    stepOutputs.set("content", responseText);
    if (outputDelta.structuredResponse) {
      stepOutputs.set("structuredResponse", outputDelta.structuredResponse as StepStateValue);
    }
    stepOutputs.set(node.id, llmOut);
  };

  const runTransformerStep = async (
    step: LangGraphNodePipelineStep,
    stepLabel: string,
  ) => {
    const trDef = findTransformerNode(node.id, step, nodes, edges);
    const code =
      trDef?.code ||
      step.customCode?.body ||
      "";
    const trName =
      trDef?.name ||
      step.label ||
      stepLabel;

    if (!code.trim()) {
      throw new Error(`Transformer "${trName}" has an empty function body.`);
    }

    const inputs: StepStateRecord = {};
    if (step.inputBindings && step.inputBindings.length > 0) {
      for (const b of step.inputBindings) {
        if (b && b.argName) {
          inputs[b.argName] = resolveInputValue(b.source, {
            state,
            stepOutputs,
          });
        }
      }
    } else if (trDef?.inputSchema && trDef.inputSchema.length > 0) {
      for (const param of trDef.inputSchema) {
        if (!param || !param.name) continue;
        if (stepOutputs.has(param.name)) {
          inputs[param.name] = stepOutputs.get(param.name);
        } else if (state[param.name] !== undefined) {
          inputs[param.name] = state[param.name] as StepStateValue;
        }
      }
    }

    if (Object.keys(inputs).length === 0 && Object.keys(state).length > 0) {
      for (const [k, v] of Object.entries(state)) {
        inputs[k] = v as StepStateValue;
      }
    }

    addLog(
      "info",
      `Executing step "${stepLabel}" (Transformer: ${trName}) (${Object.keys(inputs).length} input(s) mapped)`,
      { inputs },
    );

    try {
      const res = await runTransformer({
        code,
        name: trName,
        inputs,
        state,
        cloneFn: clone,
      });

      const resValue: StepStateValue =
        typeof res === "object" ||
        typeof res === "string" ||
        typeof res === "number" ||
        typeof res === "boolean" ||
        res === null
          ? (res as StepStateValue)
          : undefined;

      stepOutputs.set(step.id, resValue);
      if (step.outputVariable) {
        stepOutputs.set(step.outputVariable, resValue);
        outputDelta[step.outputVariable] = resValue;
      }

      if (res && typeof res === "object") {
        Object.assign(outputDelta, res);
        Object.assign(state, res);
      }

      addLog("info", `Completed step "${stepLabel}" (Transformer: ${trName})`, {
        outputVariable: step.outputVariable,
        result: resValue,
      });
    } catch (err) {
      const errStr = err instanceof Error ? err.message : String(err);
      addLog("error", `Error executing transformer step "${stepLabel}": ${errStr}`);
      throw new Error(`Transformer step "${stepLabel}" failed: ${errStr}`);
    }
  };

  const runCustomCodeStep = async (codeBody?: string, stepLabel = "Custom Code") => {
    if (!codeBody?.trim()) return;
    addLog("info", `Executing step "${stepLabel}" (Custom Code)`);
    try {
      const runner = new Function("state", "clone", codeBody);
      const res = await runner(state, clone);
      if (res && typeof res === "object") {
        Object.assign(outputDelta, res);
        Object.assign(state, res);
      }
    } catch (err) {
      const errStr = err instanceof Error ? err.message : String(err);
      addLog("error", `Error executing custom code step "${stepLabel}": ${errStr}`);
      throw new Error(`Custom code step "${stepLabel}" failed: ${errStr}`);
    }
  };

  // Execute pipeline steps in user-configured sequence
  if (agentData.pipelineSteps && agentData.pipelineSteps.length > 0) {
    for (const step of agentData.pipelineSteps) {
      if (step.type === "transformer" || step.type === "transform") {
        await runTransformerStep(step, step.label || "Transformer");
      } else if (step.type === "custom_code") {
        await runCustomCodeStep(step.customCode?.body, step.label || "Custom Code");
        if (step.outputVariable && outputDelta[step.outputVariable]) {
          stepOutputs.set(step.outputVariable, outputDelta[step.outputVariable] as StepStateValue);
        }
        stepOutputs.set(step.id, outputDelta as StepStateValue);
      } else if (step.type === "llm_call") {
        await runLlmStep();
        const llmOut = (outputDelta.structuredResponse || latestAssistantResponse) as StepStateValue;
        stepOutputs.set(step.id, llmOut);
        if (step.outputVariable) {
          stepOutputs.set(step.outputVariable, llmOut);
          outputDelta[step.outputVariable] = llmOut;
        }
      }
    }
  } else {
    // Legacy fallback: LLM then custom code
    if (isLlmActive) {
      await runLlmStep();
    }
    if (agentData.customCode?.body?.trim()) {
      await runCustomCodeStep(agentData.customCode.body, "Custom Code");
    }
  }

  // Apply stateUpdates configured on agent (if enabled)
  const appliedStateUpdates: AppliedStateUpdate[] = [];
  const isStateUpdatesEnabled = agentData.stateUpdatesConfig?.enabled !== false;

  if (isStateUpdatesEnabled) {
    for (const update of agentData.stateUpdates || []) {
      const rawFieldKey = update.schemaField || update.value || update.channelKey || "";
      const cleanFieldKey = rawFieldKey.replace(/^structuredResponse\./, "").trim();

      const parsedObj = outputDelta.structuredResponse as
        | Record<string, unknown>
        | undefined;

      let val: unknown;

      if (update.source === "none") {
        val = undefined;
      } else if (update.source === "structured_field" || update.schemaField) {
        val = resolveStructuredFieldValue(rawFieldKey, parsedObj, latestAssistantResponse);
      } else if (update.source === "structured_full") {
        val = outputDelta.structuredResponse;
      } else if (update.source === "message_content") {
        val = latestAssistantResponse;
      } else if (update.source === "message_object") {
        const msgs = (outputDelta as Record<string, unknown>).messages;
        val = Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : undefined;
      } else if (update.source === "expression" || update.mode === "expression") {
        try {
          const exprFn = new Function("state", "clone", `return (${update.value});`);
          val = exprFn(state, clone);
        } catch {
          val = update.value;
        }
      } else {
        val = update.value;
        if (typeof val === "string") {
          if (/\bstate\b/.test(val)) {
            try {
              const exprFn = new Function("state", "clone", `return (${val});`);
              val = exprFn(state, clone);
            } catch {
              // fallback to JSON parse
            }
          }
          if (typeof val === "string") {
            try {
              val = JSON.parse(val);
            } catch {
              // plain text
            }
          }
        }
      }

      const isActionWithoutValue =
        update.source === "none" ||
        update.action === "reset" ||
        update.action === "toggle" ||
        update.action === "clear";

      if (val === undefined && !isActionWithoutValue) {
        addLog(
          "warn",
          `State update for channel "${update.channelKey}" skipped: field "${cleanFieldKey}" not found in model output`,
          {
            update,
            structuredResponse: outputDelta.structuredResponse,
            response: latestAssistantResponse,
          },
        );
        continue;
      }

      const targetChannel = stateChannels.find(
        (c) => c.key === update.channelKey,
      );
      const channelReducer =
        targetChannel?.reducer ||
        update.reducer ||
        (update.mode === "append" ? "append" : "replace");

      const prevVal = state[update.channelKey];

      // Form the action payload if action is specified
      const actionPayload =
        update.action && update.action !== "default"
          ? (val !== undefined ? { action: update.action, value: val } : { action: update.action })
          : val;

      // Execute reducer:
      if (targetChannel?.customReducerCode) {
        try {
          const fn = new Function(
            "prev",
            "next",
            "state",
            `"use strict";
            const customFn = (${targetChannel.customReducerCode});
            if (typeof customFn === "function") {
              return customFn(prev, next, state);
            }
            return customFn;`,
          );
          state[update.channelKey] = fn(prevVal, actionPayload, state);
        } catch {
          state[update.channelKey] = executeBuiltInAction(
            update.action,
            channelReducer,
            targetChannel?.type,
            prevVal,
            val,
            actionPayload,
          );
        }
      } else {
        state[update.channelKey] = executeBuiltInAction(
          update.action,
          channelReducer,
          targetChannel?.type,
          prevVal,
          val,
          actionPayload,
        );
      }

      const newVal = state[update.channelKey];
      outputDelta[update.channelKey] = newVal;

      const record: AppliedStateUpdate = {
        channelKey: update.channelKey,
        previousValue: prevVal,
        newValue: newVal,
        reducer: channelReducer,
        action: update.action,
        source: update.source || "structured_field",
        sourceField: cleanFieldKey,
      };
      appliedStateUpdates.push(record);

      addLog(
        "state",
        `State Channel Mutated: "${update.channelKey}" = ${JSON.stringify(newVal)} (Reducer: ${channelReducer}${update.action ? `, Action: ${update.action}` : ""}, was: ${JSON.stringify(prevVal)})`,
        record,
      );
    }

    if (appliedStateUpdates.length > 0) {
      outputDelta.stateUpdates = appliedStateUpdates;
    }
  }

  return {
    outputDelta,
    stepLogs,
    latestAssistantResponse,
  };
}

function executeBuiltInAction(
  action: string | undefined,
  reducer: string,
  type: string | undefined,
  prevVal: unknown,
  val: unknown,
  actionPayload: unknown,
): unknown {
  if (action && action !== "default") {
    switch (action) {
      case "increment": {
        const current = typeof prevVal === "number" ? prevVal : (Number(prevVal) || 0);
        const amount = typeof val === "number" ? val : (Number(val) || 1);
        return current + amount;
      }
      case "decrement": {
        const current = typeof prevVal === "number" ? prevVal : (Number(prevVal) || 0);
        const amount = typeof val === "number" ? val : (Number(val) || 1);
        return current - amount;
      }
      case "toggle": {
        return !Boolean(prevVal);
      }
      case "reset":
      case "clear": {
        if (type === "number") return 0;
        if (type === "boolean") return false;
        if (type === "array" || type === "messages") return [];
        if (type === "object" || type === "json") return {};
        if (type === "string") return "";
        return undefined;
      }
      case "replace": {
        return val !== undefined ? val : actionPayload;
      }
      case "append": {
        const arr = Array.isArray(prevVal) ? prevVal : (prevVal != null ? [prevVal] : []);
        return [...arr, ...(Array.isArray(val) ? val : (val != null ? [val] : []))];
      }
      case "merge": {
        const obj = (prevVal && typeof prevVal === "object" && !Array.isArray(prevVal)) ? prevVal : {};
        const incoming = (val && typeof val === "object" && !Array.isArray(val)) ? val : {};
        return { ...obj, ...incoming };
      }
      case "concat": {
        const str = typeof prevVal === "string" ? prevVal : "";
        const incoming = val != null ? String(val) : "";
        return str ? `${str}\n${incoming}` : incoming;
      }
      default: {
        return val !== undefined ? val : actionPayload;
      }
    }
  }

  // Standard reducer logic without explicit action
  if ((reducer === "append" || reducer === "concat_array") && Array.isArray(prevVal)) {
    return [...prevVal, ...(Array.isArray(val) ? val : (val != null ? [val] : []))];
  }
  if ((reducer === "merge_object" || type === "object") && typeof prevVal === "object" && typeof val === "object" && prevVal !== null && val !== null) {
    return { ...(prevVal as Record<string, unknown>), ...(val as Record<string, unknown>) };
  }
  return val;
}

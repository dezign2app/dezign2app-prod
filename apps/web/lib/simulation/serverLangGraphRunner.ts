import {
  StateGraph,
  Annotation,
  START,
  END,
  MemorySaver,
  BaseCheckpointSaver,
  addMessages,
} from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { RedisSaver } from "@langchain/langgraph-checkpoint-redis";
import { Pool } from "pg";
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
  LangGraphAgentResponseFormatConfig,
} from "@workspace/canvas";
import { evaluateRouterBranch } from "./langgraph";
import type { SimulationTraceEntry } from "./types";
import { formatStreamingBatch, type StreamBatchItem } from "./streamFormatter";

export interface CheckpointerConnectionConfig {
  host?: string;
  port?: number | string;
  database?: string;
  user?: string;
  username?: string;
  password?: string;
  connectionString?: string;
  connectionStringEnv?: string;
}

export interface ServerExecutionParams {
  nodes: LangGraphCanvasNode[];
  edges: LangGraphCanvasEdge[];
  stateChannels: LangGraphStateChannel[];
  inputChannels: LangGraphInputChannel[];
  memoryConfig?: LangGraphMemoryConfig;
  checkpointerConnection?: CheckpointerConnectionConfig;
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

export interface ServerLLMStreamBatch {
  index: number;
  delta: string;
  content: string;
  timestamp: string;
  raw?: unknown;
}

export interface ServerLLMResult {
  text: string;
  streamBatches: ServerLLMStreamBatch[];
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

// Server-side thread checkpointer caches so multi-turn conversations persist across turns
const serverMemorySaverCache = new Map<string, MemorySaver>();
const serverPostgresPoolCache = new Map<string, { pool: Pool; saver: PostgresSaver }>();
const serverRedisSaverCache = new Map<string, RedisSaver>();

export function resolvePgConnectionString(
  config?: CheckpointerConnectionConfig,
  envVarName?: string,
): string {
  if (config?.connectionString) return config.connectionString;
  if (envVarName && process.env[envVarName]) return process.env[envVarName]!;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const host = config?.host || "localhost";
  const port = Number(config?.port) || 5432;
  const db = config?.database || "postgres";
  const user = config?.user || config?.username || "postgres";
  const pass = config?.password !== undefined ? config?.password : "postgres";

  const authPart = pass
    ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}`
    : encodeURIComponent(user);

  return `postgresql://${authPart}@${host}:${port}/${encodeURIComponent(db)}`;
}

export function resolveRedisUrl(
  config?: CheckpointerConnectionConfig,
  envVarName?: string,
): string {
  if (config?.connectionString) return config.connectionString;
  if (envVarName && process.env[envVarName]) return process.env[envVarName]!;
  if (process.env.REDIS_URL) return process.env.REDIS_URL;

  const host = config?.host || "localhost";
  const port = Number(config?.port) || 6379;
  const pass = config?.password ? `:${encodeURIComponent(config.password)}@` : "";

  return `redis://${pass}${host}:${port}`;
}

async function getOrCreateCheckpointer(
  memoryConfig: LangGraphMemoryConfig | undefined,
  threadId: string,
  connectionConfig?: CheckpointerConnectionConfig,
): Promise<BaseCheckpointSaver | undefined> {
  if (!memoryConfig || memoryConfig.enabled === false) {
    return undefined;
  }

  const engine = memoryConfig.checkpointer || "memory";

  // 1. PostgreSQL Checkpointer (PostgresSaver)
  if (engine === "postgres") {
    const connStr = resolvePgConnectionString(
      connectionConfig,
      memoryConfig.checkpointerEnvVar,
    );
    const maskedConn = connStr.replace(/:([^:@]+)@/, ":***@");

    let cached = serverPostgresPoolCache.get(connStr);
    if (!cached) {
      const pool = new Pool({
        connectionString: connStr,
        max: 5,
        connectionTimeoutMillis: 3000, // 3-second fail fast timeout
      });
      const saver = new PostgresSaver(pool);
      cached = { pool, saver };
      serverPostgresPoolCache.set(connStr, cached);
    }

    try {
      // setup() verifies connection and ensures checkpointer tables exist in PostgreSQL
      await cached.saver.setup();
    } catch (err: unknown) {
      // Clear cache on failure so next attempt retries fresh
      serverPostgresPoolCache.delete(connStr);
      await cached.pool.end().catch(() => {});
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `PostgreSQL Checkpointer Error: Failed to connect to PostgreSQL at ${maskedConn}.\n` +
        `Details: ${errMsg}\n` +
        `Verify your PostgreSQL server/container is running on the configured host and port.`,
      );
    }

    return cached.saver;
  }

  // 2. Redis Checkpointer (RedisSaver)
  if (engine === "redis") {
    const redisUrl = resolveRedisUrl(
      connectionConfig,
      memoryConfig.checkpointerEnvVar,
    );
    const maskedUrl = redisUrl.replace(/:([^:@]+)@/, ":***@");

    let saver = serverRedisSaverCache.get(redisUrl);
    if (!saver) {
      try {
        // RedisSaver.fromUrl connects to Redis with client.connect() and creates search indexes
        saver = await Promise.race([
          RedisSaver.fromUrl(redisUrl),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Connection timed out (3000ms)")), 3000),
          ),
        ]);
        serverRedisSaverCache.set(redisUrl, saver);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Redis Checkpointer Error: Failed to connect to Redis instance at ${maskedUrl}.\n` +
          `Details: ${errMsg}\n` +
          `Verify your Redis server/container is running on the configured host and port.`,
        );
      }
    }

    return saver;
  }

  // 3. Ephemeral In-Memory Checkpointer (MemorySaver)
  let memSaver = serverMemorySaverCache.get(threadId);
  if (!memSaver) {
    memSaver = new MemorySaver();
    serverMemorySaverCache.set(threadId, memSaver);
  }
  return memSaver;
}

export async function clearServerThread(
  threadId: string,
  memoryConfig?: LangGraphMemoryConfig,
  connectionConfig?: CheckpointerConnectionConfig,
): Promise<void> {
  serverMemorySaverCache.delete(threadId);

  if (memoryConfig?.checkpointer === "postgres") {
    const connStr = resolvePgConnectionString(
      connectionConfig,
      memoryConfig.checkpointerEnvVar,
    );
    const cached = serverPostgresPoolCache.get(connStr);
    if (cached) {
      try {
        await cached.saver.deleteThread(threadId);
      } catch {
        // ignore
      }
    }
  } else if (memoryConfig?.checkpointer === "redis") {
    const redisUrl = resolveRedisUrl(
      connectionConfig,
      memoryConfig.checkpointerEnvVar,
    );
    const cached = serverRedisSaverCache.get(redisUrl);
    if (cached) {
      try {
        await cached.deleteThread(threadId);
      } catch {
        // ignore
      }
    }
  }
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
  const nodeStreamBatchesMap = new Map<string, StreamBatchItem[]>();
  const nodeLlmRequestMap = new Map<string, unknown>();
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
    if (
      ch.customReducerCode &&
      (ch.reducer === "custom" ||
        !["replace", "add_messages", "append", "concat_array", "merge_object"].includes(ch.reducer))
    ) {
      try {
        const fn = new Function(
          "prev",
          "next",
          `return (${ch.customReducerCode})(prev, next);`,
        );
        schemaSpec[ch.key] = Annotation<unknown>({
          reducer: (x, y) => fn(x, y),
          default: () => ch.defaultValue,
        });
        continue;
      } catch (err) {
        console.warn(`[simulation] Failed to evaluate custom reducer for ${ch.key}:`, err);
      }
    }

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
        reducer: (x, y) => (y !== undefined ? Number(y) : (x !== undefined ? Number(x) : 0)),
        default: () => Number(ch.defaultValue) || 0,
      });
    } else if (ch.type === "boolean") {
      schemaSpec[ch.key] = Annotation<boolean>({
        reducer: (x, y) => (y !== undefined ? Boolean(y) : (x !== undefined ? Boolean(x) : false)),
        default: () => Boolean(ch.defaultValue),
      });
    } else if (ch.type === "object" || ch.type === "json") {
      schemaSpec[ch.key] = Annotation<Record<string, unknown>>({
        reducer: (x, y) => ({ ...(x || {}), ...((y as Record<string, unknown>) || {}) }),
        default: () => ((ch.defaultValue as Record<string, unknown>) || {}),
      });
    } else {
      schemaSpec[ch.key] = Annotation<string>({
        reducer: (x, y) => (y !== undefined ? String(y) : String(x ?? "")),
        default: () => String(ch.defaultValue ?? ""),
      });
    }
  }

  // Auto-register structuredResponse channel if any agent node has structured output enabled
  const hasStructuredOutput = nodes.some(
    (n) => (n.data as AgentNodeData)?.responseFormat?.enabled,
  );
  if (hasStructuredOutput && !schemaSpec["structuredResponse"]) {
    schemaSpec["structuredResponse"] = Annotation<Record<string, unknown> | null>({
      reducer: (_, y) => y,
      default: () => null,
    });
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
    compile: (options?: { checkpointer?: BaseCheckpointSaver }) => {
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

        const responseFormat = agentData.responseFormat;
        const streamEnabled = agentData.streamConfig?.enabled !== false;
        const { text: responseText, streamBatches } = await callServerLLM({
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
          outputDelta.structuredResponse = parsed;
          outputDelta.messages = [new AIMessage(JSON.stringify(parsed, null, 2))];
          outputDelta.response = JSON.stringify(parsed);
        } else {
          outputDelta.messages = [new AIMessage(responseText)];
          outputDelta.response = responseText;
        }

        outputDelta.llmRequest = {
          provider: effectiveProvider,
          model: effectiveModel,
          stream: streamEnabled,
          systemPrompt,
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
            val = Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : undefined;
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
          if (val !== undefined) {
            outputDelta[update.channelKey] = val;
          }
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
  let checkpointer: BaseCheckpointSaver | undefined;

  if (isMemoryEnabled) {
    try {
      checkpointer = await getOrCreateCheckpointer(
        memoryConfig,
        threadId,
        params.checkpointerConnection,
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      trace.push({
        id: `trace_${generateId()}`,
        kind: "step",
        label: "Checkpointer Error",
        status: "failed",
        nodeId: "START",
        output: { error: errMsg },
      });
      return {
        finalState: {},
        trace,
        totalDurationMs: Date.now() - startTime,
        visitedNodes: ["START"],
        error: errMsg,
      };
    }
  }

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

  if (Object.keys(initialState).length === 0) {
    initialState.messages = [];
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
  const accumulatedState: Record<string, unknown> = clone(initialState);
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

        Object.assign(accumulatedState, serializedDelta);

        // Attach streaming batches captured during execution
        const nodeBatches = nodeStreamBatchesMap.get(nodeId) || [];
        if (nodeBatches.length > 0) {
          serializedDelta.streamBatches = nodeBatches;
          serializedDelta.streamBatchCount = nodeBatches.length;
        }

        const nodeObj = nodes.find((n) => n.id === nodeId);
        const isAgent = nodeObj?.type === "langgraph_agent" || nodeObj?.type === "langgraph_node";
        const agentData = isAgent ? (nodeObj?.data as AgentNodeData) : undefined;
        if (agentData?.streamConfig) {
          serializedDelta.streamConfig = agentData.streamConfig;
        }

        const llmReq = nodeLlmRequestMap.get(nodeId);
        if (llmReq) {
          serializedDelta.llmRequest = llmReq;
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
  let finalState: Record<string, unknown> = { ...accumulatedState };
  const checkpoints: ServerExecutionCheckpoint[] = [];

  if (isMemoryEnabled && checkpointer) {
    try {
      const stateSnapshot = await compiledGraph.getState({
        configurable: { thread_id: threadId },
      });
      if (stateSnapshot?.values) {
        const snapVals = serializeStateValues(stateSnapshot.values);
        finalState = { ...accumulatedState, ...snapVals };
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
    } catch (err) {
      console.error("GETSTATE ERROR:", err);
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
  responseFormat?: LangGraphAgentResponseFormatConfig;
  streamEnabled?: boolean;
}): Promise<ServerLLMResult> {
  const { provider, apiKey, modelName, systemPrompt, messages, customUrl, responseFormat, streamEnabled = true } = args;

  const isStructured = Boolean(responseFormat?.enabled);
  const schemaStr = responseFormat?.schemaJson?.trim();

  let effectiveSystemPrompt = systemPrompt;
  if (isStructured) {
    effectiveSystemPrompt += `\n\nCRITICAL INSTRUCTION: You must respond ONLY with a valid JSON object matching this schema or structure:\n${
      schemaStr || '{"aiResponse": "string"}'
    }\nDo not include any conversational preamble, explanations, markdown backticks, or any text other than the JSON object itself.`;
  }

  // 1. Groq (streaming)
  if (provider === "groq") {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) {
      throw new Error("Missing Groq API Key. Please provide an API key in the toolbar or GROQ_API_KEY env var.");
    }
    const groq = new Groq({ apiKey: key });
    const promptMessages = [
      { role: "system" as const, content: effectiveSystemPrompt },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
    ];

    if (!streamEnabled) {
      const completion = await groq.chat.completions.create({
        model: modelName || "openai/gpt-oss-120b",
        messages: promptMessages,
        temperature: isStructured ? 0.2 : 0.7,
        stream: false,
        ...(isStructured ? { response_format: { type: "json_object" as const } } : {}),
      });
      const text = "choices" in completion ? completion.choices[0]?.message?.content || "" : "";
      return { text, streamBatches: [] };
    }

    try {
      const stream = await groq.chat.completions.create({
        model: modelName || "openai/gpt-oss-120b",
        messages: promptMessages,
        temperature: isStructured ? 0.2 : 0.7,
        stream: true,
        ...(isStructured ? { response_format: { type: "json_object" as const } } : {}),
      });

      const streamBatches: ServerLLMStreamBatch[] = [];
      let fullText = "";
      let idx = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          fullText += delta;
        }
        streamBatches.push({
          index: idx++,
          delta,
          content: fullText,
          timestamp: new Date().toISOString(),
          raw: chunk.choices[0],
        });
      }

      return { text: fullText, streamBatches };
    } catch {
      // Fallback to non-streaming if stream mode encountered an issue
      const completion = await groq.chat.completions.create({
        model: modelName || "openai/gpt-oss-120b",
        messages: promptMessages,
        temperature: isStructured ? 0.2 : 0.7,
        stream: false,
        ...(isStructured ? { response_format: { type: "json_object" as const } } : {}),
      });
      const text = "choices" in completion ? completion.choices[0]?.message?.content || "" : "";
      return {
        text,
        streamBatches: [
          {
            index: 0,
            delta: text,
            content: text,
            timestamp: new Date().toISOString(),
            raw: "choices" in completion ? completion.choices[0] : completion,
          },
        ],
      };
    }
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
    { role: "system", content: effectiveSystemPrompt },
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
            system: effectiveSystemPrompt,
            messages: messages.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
            stream: streamEnabled,
          }
        : {
            model: modelName,
            messages: promptMessages,
            temperature: isStructured ? 0.2 : 0.7,
            stream: streamEnabled,
            ...(isStructured
              ? { response_format: { type: "json_object" } }
              : {}),
          },
    ),
  });

  if (!res.ok) {
    throw new Error(`${provider.toUpperCase()} API returned HTTP ${res.status}: ${await res.text()}`);
  }

  if (!streamEnabled) {
    const json = await res.json();
    const content =
      provider === "anthropic"
        ? json.content?.[0]?.text || ""
        : json.choices?.[0]?.message?.content || "";
    return { text: content, streamBatches: [] };
  }

  const streamBatches: ServerLLMStreamBatch[] = [];
  let fullText = "";
  let idx = 0;

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
            const dataStr = trimmed.slice(6).trim();
            try {
              const parsed = JSON.parse(dataStr);
              let delta = "";
              if (provider === "anthropic") {
                if (parsed.type === "content_block_delta") {
                  delta = parsed.delta?.text || "";
                }
              } else {
                delta = parsed.choices?.[0]?.delta?.content || "";
              }
              if (delta) {
                fullText += delta;
              }
              streamBatches.push({
                index: idx++,
                delta,
                content: fullText,
                timestamp: new Date().toISOString(),
                raw: parsed,
              });
            } catch {
              // ignore non-json SSE lines
            }
          }
        }
      }
    } catch {
      // Stream reading ended
    }
  }

  // Fallback if reader didn't yield batches (e.g. non-streaming endpoint response)
  if (!fullText && streamBatches.length === 0) {
    try {
      const json = await res.json();
      const content =
        provider === "anthropic"
          ? json.content?.[0]?.text || ""
          : json.choices?.[0]?.message?.content || "";
      return {
        text: content,
        streamBatches: [
          {
            index: 0,
            delta: content,
            content,
            timestamp: new Date().toISOString(),
            raw: json,
          },
        ],
      };
    } catch {
      // return as-is
    }
  }

  return { text: fullText, streamBatches };
}

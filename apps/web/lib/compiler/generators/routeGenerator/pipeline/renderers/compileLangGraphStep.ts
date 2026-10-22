// ═══════════════════════════════════════════════════════════════
// MODULE: LangGraphStepRenderer
// LAYER:  generators / routeGenerator / pipeline / renderers
// EMITS:  LangGraph agent invocations (buffered or SSE streaming)
// ═══════════════════════════════════════════════════════════════

import { PipelineStep } from "@workspace/canvas/types";
import { PipelineRenderContext } from "../types";
import { resolveBinding } from "../sourceResolver";
import { toVarName } from "../../../../utils";

function isBlankOrQuotes(val: unknown): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === "string") {
    const trimmed = val.trim();
    return (
      trimmed === "" ||
      trimmed === '""' ||
      trimmed === "''" ||
      trimmed === "inline:" ||
      trimmed === 'inline:""' ||
      trimmed === "inline:''"
    );
  }
  return false;
}

function resolvePathAccessor(path: string, ctx: PipelineRenderContext): string {
  if (isBlankOrQuotes(path)) {
    return '""';
  }
  if (path.startsWith("headers.")) {
    return `req.headers["${path.slice(8)}"]`;
  }
  const headerMatch = path.match(/(?:req\.)?headers\[['"]([^'"]+)['"]\]/);
  if (headerMatch) {
    return `req.headers["${headerMatch[1]}"]`;
  }
  if (path.startsWith("body.")) {
    return `${ctx.bodyVar}.${path.slice(5)}`;
  }
  if (path.startsWith("params.")) {
    return `req.params.${path.slice(7)}`;
  }
  if (path.startsWith("query.")) {
    return `req.query.${path.slice(6)}`;
  }
  if (path.startsWith("event.")) {
    return `event.${path.slice(6)}`;
  }
  if (path === "env" || path === "process.env") {
    return "process.env";
  }
  if (path.startsWith("env.") || path.startsWith("process.env.")) {
    const field = path.startsWith("process.env.") ? path.slice(12) : path.slice(4);
    return `process.env.${field}`;
  }
  if (path.startsWith("inline:")) {
    const val = path.slice(7).trim();
    if (!val || val === '""' || val === "''") return '""';
    if (val.startsWith("`") || val.startsWith('"') || val.startsWith("'")) {
      const innerTrimmed = val.slice(1, -1).trim();
      if (!innerTrimmed && (val.startsWith('"') || val.startsWith("'"))) {
        return '""';
      }
      return val;
    }
    if (val.includes("${")) return `\`${val}\``;
    return JSON.stringify(val);
  }
  if (path.startsWith("`") || path.startsWith('"') || path.startsWith("'")) {
    const trimmed = path.trim();
    if (trimmed === '""' || trimmed === "''") return '""';
    return path;
  }
  if (path.includes("${")) {
    return `\`${path}\``;
  }
  if (path === "body") {
    return ctx.bodyVar;
  }
  if (path === "headers") {
    return "req.headers";
  }
  if (path === "params") {
    return "req.params";
  }
  if (path === "query") {
    return "req.query";
  }
  if (ctx.priorOutputs) {
    const parts = path.split(".");
    const first = parts[0];
    if (first && ctx.priorOutputs.has(first)) {
      const mappedVar = ctx.priorOutputs.get(first);
      return parts.length > 1 ? `${mappedVar}.${parts.slice(1).join(".")}` : (mappedVar || path);
    }
  }
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(path)) {
    return JSON.stringify(path);
  }
  return `${ctx.bodyVar}?.${path}`;
}

/**
 * Renders a LangGraph agent invocation step (sync await or real-time streaming).
 */
export function renderLangGraphInvokeStep(
  step: PipelineStep,
  ctx: PipelineRenderContext,
): string[] {
  const {
    outputVariable = "agentResult",
    functionRef,
    inputBindings = [],
    langGraphStateMapping,
    langGraphThreadIdSource,
    langGraphMessagesConfig,
    langGraphStreamingEnabled,
    langGraphStreamingFields = [],
    langGraphOutputMode = "full_state",
    langGraphOutputFields = [],
    langGraphTargetNodeId,
  } = step;

  const rawLines: string[] = [];
  const rawLabel = step.name || "agent";
  const graphVar =
    functionRef?.name ||
    (langGraphTargetNodeId &&
    !/^[0-9]/.test(langGraphTargetNodeId) &&
    !langGraphTargetNodeId.includes("-") &&
    langGraphTargetNodeId.length < 20
      ? `${toVarName(langGraphTargetNodeId)}Graph`
      : `${toVarName(rawLabel)}Graph`);

  // Extract thread_id if configured or mapped
  let threadIdExpr: string | undefined = langGraphThreadIdSource
    ? resolvePathAccessor(langGraphThreadIdSource, ctx)
    : undefined;

  // Build dedicated messages initialization if langGraphMessagesConfig is defined
  const stepPrefix = toVarName(step.name || step.id || "agent");
  const messagesInitLines: string[] = [];
  let messagesVarName: string | undefined;

  if (langGraphMessagesConfig) {
    messagesVarName = `${stepPrefix}Messages`;
    const systemSource = langGraphMessagesConfig.systemMessageSource?.trim();
    const systemAccessor = systemSource ? resolvePathAccessor(systemSource, ctx) : undefined;
    const aiSource = langGraphMessagesConfig.aiMessageSource?.trim();
    const aiAccessor = aiSource ? resolvePathAccessor(aiSource, ctx) : undefined;

    if (langGraphMessagesConfig.mode === "bulk") {
      const bulkSource = langGraphMessagesConfig.bulkMessagesSource || "body.messages";
      const bulkAccessor = resolvePathAccessor(bulkSource, ctx);
      messagesInitLines.push(
        `const ${messagesVarName}Raw = Array.isArray(${bulkAccessor}) ? ${bulkAccessor} : [];`,
        `const ${messagesVarName} = [`,
        ...(systemAccessor
          ? [`  ...(${systemAccessor} ? [new SystemMessage(String(${systemAccessor}))] : []),`]
          : []),
        `  ...${messagesVarName}Raw.map((m: any) => {`,
        `    if (typeof m === "string") return new HumanMessage(m);`,
        `    const content = m?.content ?? (typeof m === "object" ? JSON.stringify(m) : String(m ?? ""));`,
        `    if (m?.role === "system") return new SystemMessage(content);`,
        `    if (m?.role === "assistant" || m?.role === "ai") return new AIMessage(content);`,
        `    return new HumanMessage(content);`,
        `  }),`,
        `];`,
      );
    } else {
      // Single turn mode
      const userSource = langGraphMessagesConfig.userMessageSource || "body.message";
      const userAccessor = resolvePathAccessor(userSource, ctx);

      messagesInitLines.push(
        `const ${messagesVarName} = [`,
        ...(systemAccessor
          ? [`  ...(${systemAccessor} ? [new SystemMessage(String(${systemAccessor}))] : []),`]
          : []),
        ...(aiAccessor
          ? [`  ...(${aiAccessor} ? [new AIMessage(String(${aiAccessor}))] : []),`]
          : []),
        `  new HumanMessage(String(${userAccessor} || "")),`,
        `];`,
      );
    }
  }

  // Build state input object
  const stateFields: string[] = [];
  const mappedFieldKeys = new Set<string>();

  if (messagesVarName) {
    mappedFieldKeys.add("messages");
    if (langGraphMessagesConfig?.operation === "overwrite") {
      stateFields.push(`  "messages": { __overwrite__: ${messagesVarName} },`);
    } else {
      stateFields.push(`  "messages": ${messagesVarName},`);
    }
  }

  if (inputBindings.length > 0) {
    for (const b of inputBindings) {
      if (b.argName) {
        if (b.argName === "thread_id" || b.argName === "threadId") {
          if (!threadIdExpr) {
            threadIdExpr = resolveBinding(b, ctx);
          }
          continue;
        }
        if ((b.argName === "messages" || b.argName === "message") && messagesVarName) {
          continue;
        }
        mappedFieldKeys.add(b.argName);
        stateFields.push(`  ${JSON.stringify(b.argName)}: ${resolveBinding(b, ctx)},`);
      }
    }
  } else if (langGraphStateMapping && Object.keys(langGraphStateMapping).length > 0) {
    for (const [key, path] of Object.entries(langGraphStateMapping)) {
      if (path === undefined || path === null) continue;
      if (key === "thread_id" || key === "threadId") {
        if (!threadIdExpr && !isBlankOrQuotes(path)) {
          threadIdExpr = resolvePathAccessor(path, ctx);
        }
        continue;
      }
      if ((key === "messages" || key === "message") && messagesVarName) {
        continue;
      }
      mappedFieldKeys.add(key);
      if (isBlankOrQuotes(path)) {
        stateFields.push(`  ${JSON.stringify(key)}: "",`);
        continue;
      }
      stateFields.push(`  ${JSON.stringify(key)}: ${resolvePathAccessor(path, ctx)},`);
    }
  } else if (!messagesVarName) {
    mappedFieldKeys.add("messages");
    stateFields.push(
      `  messages: ${ctx.bodyVar}?.messages ?? [{ role: "user", content: ${ctx.bodyVar}?.message ?? (typeof ${ctx.bodyVar} === "string" ? ${ctx.bodyVar} : JSON.stringify(${ctx.bodyVar})) }],`,
    );
  }

  const stateInit =
    stateFields.length > 0
      ? `{\n${stateFields.join("\n")}\n}`
      : `{ messages: [{ role: "user", content: "hello" }] }`;

  const streamConfigOptions = threadIdExpr
    ? `{ streamMode: "messages", configurable: { thread_id: ${threadIdExpr} } }`
    : `{ streamMode: "messages" }`;

  const invokeConfigOptions = threadIdExpr
    ? `, { configurable: { thread_id: ${threadIdExpr} } }`
    : "";

  if (langGraphStreamingEnabled) {
    const streamProtocol = step.langGraphStreamingProtocol || "sse";

    if (streamProtocol === "sse" || streamProtocol === "raw") {
      const isRaw = streamProtocol === "raw";
      rawLines.push(
        `// --- LangGraph Streaming Invocation (${step.name}) via ${isRaw ? "Raw Stream" : "SSE"} ---`,
      );
      if (messagesInitLines.length > 0) {
        rawLines.push(...messagesInitLines);
      }
      rawLines.push(`const agentState = ${stateInit};`);
      if (isRaw) {
        rawLines.push(`res.setHeader("Content-Type", "text/plain; charset=utf-8");`);
        rawLines.push(`res.setHeader("Cache-Control", "no-cache");`);
        rawLines.push(`res.setHeader("Transfer-Encoding", "chunked");`);
      } else {
        rawLines.push(`res.setHeader("Content-Type", "text/event-stream");`);
        rawLines.push(`res.setHeader("Cache-Control", "no-cache");`);
        rawLines.push(`res.setHeader("Connection", "keep-alive");`);
      }
      if (threadIdExpr) {
        rawLines.push(`if (${threadIdExpr} && typeof res.setHeader === "function") {`);
        rawLines.push(`  res.setHeader("X-Thread-Id", String(${threadIdExpr}));`);
        rawLines.push(`}`);
      }
      rawLines.push(
        `const stream = await ${graphVar}.stream(agentState, ${streamConfigOptions});`,
      );
      rawLines.push(`for await (const chunk of stream) {`);
      rawLines.push(`  if (res.writableEnded || res.destroyed) {`);
      rawLines.push(`    break;`);
      rawLines.push(`  }`);
      rawLines.push(
        `  const [messageChunk, metadata] = Array.isArray(chunk) ? chunk : [chunk, undefined];`,
      );
      rawLines.push(
        `  const token = (typeof messageChunk === "object" && messageChunk !== null && "content" in messageChunk && messageChunk.content !== undefined ? messageChunk.content : undefined) ?? (typeof chunk === "string" ? chunk : (typeof chunk === "object" && chunk !== null && "content" in chunk && chunk.content !== undefined ? chunk.content : chunk));`,
      );
      rawLines.push(
        `  const nodeName = typeof metadata === "object" && metadata !== null && "langgraph_node" in metadata ? metadata.langgraph_node : undefined;`,
      );
      const writeChunk = isRaw
        ? `res.write(typeof token === "string" ? token : JSON.stringify(token));`
        : `res.write(\`data: \${JSON.stringify({ token, node: nodeName })}\\n\\n\`);`;

      if (langGraphStreamingFields.length > 0) {
        const allowedFields = JSON.stringify(langGraphStreamingFields);
        rawLines.push(`  if (${allowedFields}.includes(nodeName || "")) {`);
        rawLines.push(`    if (token !== undefined && token !== "") {`);
        rawLines.push(`      ${writeChunk}`);
        rawLines.push(`    }`);
        rawLines.push(`  }`);
      } else {
        rawLines.push(`  if (token !== undefined && token !== "") {`);
        rawLines.push(`    ${writeChunk}`);
        rawLines.push(`  }`);
      }
      rawLines.push(`}`);
      rawLines.push(`if (!res.writableEnded && !res.destroyed) {`);
      if (!isRaw) {
        rawLines.push(`  res.write("data: [DONE]\\n\\n");`);
      }
      rawLines.push(`  res.end();`);
      rawLines.push(`}`);
    } else if (streamProtocol === "websocket") {
      const roomExpr = step.langGraphStreamingRoom
        ? resolvePathAccessor(step.langGraphStreamingRoom, ctx)
        : (threadIdExpr || `"default"`);

      rawLines.push(`// --- LangGraph Streaming Invocation (${step.name}) via WebSocket ---`);
      if (messagesInitLines.length > 0) {
        rawLines.push(...messagesInitLines);
      }
      rawLines.push(`const agentState = ${stateInit};`);
      rawLines.push(
        `const stream = await ${graphVar}.stream(agentState, ${streamConfigOptions});`,
      );
      rawLines.push(`for await (const chunk of stream) {`);
      rawLines.push(
        `  const [messageChunk, metadata] = Array.isArray(chunk) ? chunk : [chunk, undefined];`,
      );
      rawLines.push(
        `  const token = (typeof messageChunk === "object" && messageChunk !== null && "content" in messageChunk && messageChunk.content !== undefined ? messageChunk.content : undefined) ?? (typeof chunk === "string" ? chunk : (typeof chunk === "object" && chunk !== null && "content" in chunk && chunk.content !== undefined ? chunk.content : chunk));`,
      );
      rawLines.push(
        `  const nodeName = typeof metadata === "object" && metadata !== null && "langgraph_node" in metadata ? metadata.langgraph_node : undefined;`,
      );
      if (langGraphStreamingFields.length > 0) {
        const allowedFields = JSON.stringify(langGraphStreamingFields);
        rawLines.push(`  if (${allowedFields}.includes(nodeName || "")) {`);
        rawLines.push(`    if (token !== undefined && token !== "") {`);
        rawLines.push(
          `      wsBroadcast("agent_stream", { token, node: nodeName, done: false }, ${roomExpr});`,
        );
        rawLines.push(`    }`);
        rawLines.push(`  }`);
      } else {
        rawLines.push(`  if (token !== undefined && token !== "") {`);
        rawLines.push(
          `    wsBroadcast("agent_stream", { token, node: nodeName, done: false }, ${roomExpr});`,
        );
        rawLines.push(`  }`);
      }
      rawLines.push(`}`);
      rawLines.push(`wsBroadcast("agent_stream", { done: true }, ${roomExpr});`);
      if (outputVariable) {
        rawLines.push(`const ${outputVariable} = { streamed: true, protocol: "websocket", room: ${roomExpr} };`);
      }
    } else if (streamProtocol === "kafka") {
      const topicExpr = JSON.stringify(step.langGraphStreamingKafkaTopic || `${toVarName(step.name || "agent")}-tokens`);
      const keyExpr = step.langGraphStreamingKafkaKey
        ? resolvePathAccessor(step.langGraphStreamingKafkaKey, ctx)
        : (threadIdExpr || `"agent"`);

      rawLines.push(`// --- LangGraph Streaming Invocation (${step.name}) to Kafka Topic ---`);
      if (messagesInitLines.length > 0) {
        rawLines.push(...messagesInitLines);
      }
      rawLines.push(`const agentState = ${stateInit};`);
      rawLines.push(
        `const stream = await ${graphVar}.stream(agentState, ${streamConfigOptions});`,
      );
      rawLines.push(`for await (const chunk of stream) {`);
      rawLines.push(
        `  const [messageChunk, metadata] = Array.isArray(chunk) ? chunk : [chunk, undefined];`,
      );
      rawLines.push(
        `  const token = (typeof messageChunk === "object" && messageChunk !== null && "content" in messageChunk && messageChunk.content !== undefined ? messageChunk.content : undefined) ?? (typeof chunk === "string" ? chunk : (typeof chunk === "object" && chunk !== null && "content" in chunk && chunk.content !== undefined ? chunk.content : chunk));`,
      );
      rawLines.push(
        `  const nodeName = typeof metadata === "object" && metadata !== null && "langgraph_node" in metadata ? metadata.langgraph_node : undefined;`,
      );
      if (langGraphStreamingFields.length > 0) {
        const allowedFields = JSON.stringify(langGraphStreamingFields);
        rawLines.push(`  if (${allowedFields}.includes(nodeName || "")) {`);
        rawLines.push(`    if (token !== undefined && token !== "") {`);
        rawLines.push(
          `      await publishKafkaEvent(${topicExpr}, { token, node: nodeName, done: false }, ${keyExpr});`,
        );
        rawLines.push(`    }`);
        rawLines.push(`  }`);
      } else {
        rawLines.push(`  if (token !== undefined && token !== "") {`);
        rawLines.push(
          `    await publishKafkaEvent(${topicExpr}, { token, node: nodeName, done: false }, ${keyExpr});`,
        );
        rawLines.push(`  }`);
      }
      rawLines.push(`}`);
      rawLines.push(`await publishKafkaEvent(${topicExpr}, { done: true }, ${keyExpr});`);
      if (outputVariable) {
        rawLines.push(`const ${outputVariable} = { streamed: true, protocol: "kafka", topic: ${topicExpr} };`);
      }
    } else if (streamProtocol === "redis_stream") {
      const rawRedisKey = step.langGraphStreamingRedisKey?.trim();
      const streamKeyExpr = rawRedisKey
        ? resolvePathAccessor(rawRedisKey, ctx)
        : (threadIdExpr ? `\`stream:agent:\${${threadIdExpr}}\`` : `"stream:agent:default"`);

      rawLines.push(`// --- LangGraph Streaming Invocation (${step.name}) to Redis Stream ---`);
      if (messagesInitLines.length > 0) {
        rawLines.push(...messagesInitLines);
      }
      rawLines.push(`const agentState = ${stateInit};`);
      rawLines.push(`const redisClient = await getRedisClient();`);
      rawLines.push(
        `const stream = await ${graphVar}.stream(agentState, ${streamConfigOptions});`,
      );
      rawLines.push(`for await (const chunk of stream) {`);
      rawLines.push(
        `  const [messageChunk, metadata] = Array.isArray(chunk) ? chunk : [chunk, undefined];`,
      );
      rawLines.push(
        `  const token = (typeof messageChunk === "object" && messageChunk !== null && "content" in messageChunk && messageChunk.content !== undefined ? messageChunk.content : undefined) ?? (typeof chunk === "string" ? chunk : (typeof chunk === "object" && chunk !== null && "content" in chunk && chunk.content !== undefined ? chunk.content : chunk));`,
      );
      rawLines.push(
        `  const nodeName = typeof metadata === "object" && metadata !== null && "langgraph_node" in metadata ? metadata.langgraph_node : undefined;`,
      );
      if (langGraphStreamingFields.length > 0) {
        const allowedFields = JSON.stringify(langGraphStreamingFields);
        rawLines.push(`  if (${allowedFields}.includes(nodeName || "")) {`);
        rawLines.push(`    if (token !== undefined && token !== "") {`);
        rawLines.push(
          `      await redisClient.xadd(${streamKeyExpr}, "*", "token", String(token), "node", String(nodeName || ""), "done", "false");`,
        );
        rawLines.push(`    }`);
        rawLines.push(`  }`);
      } else {
        rawLines.push(`  if (token !== undefined && token !== "") {`);
        rawLines.push(
          `    await redisClient.xadd(${streamKeyExpr}, "*", "token", String(token), "node", String(nodeName || ""), "done", "false");`,
        );
        rawLines.push(`  }`);
      }
      rawLines.push(`}`);
      rawLines.push(`await redisClient.xadd(${streamKeyExpr}, "*", "token", "", "done", "true");`);
      if (outputVariable) {
        rawLines.push(`const ${outputVariable} = { streamed: true, protocol: "redis_stream", streamKey: ${streamKeyExpr} };`);
      }
    }
  } else {
    rawLines.push(`// --- LangGraph Invocation (${step.name}) ---`);
    if (threadIdExpr) {
      rawLines.push(`if (${threadIdExpr} && typeof res.setHeader === "function") {`);
      rawLines.push(`  res.setHeader("X-Thread-Id", String(${threadIdExpr}));`);
      rawLines.push(`}`);
    }
    if (messagesInitLines.length > 0) {
      rawLines.push(...messagesInitLines);
    }
    rawLines.push(`const agentState = ${stateInit};`);
    rawLines.push(`const ${outputVariable}Raw = await ${graphVar}.invoke(agentState${invokeConfigOptions});`);

    if (langGraphOutputMode === "last_message") {
      rawLines.push(
        `const ${outputVariable} = Array.isArray(${outputVariable}Raw?.messages) && ${outputVariable}Raw.messages.length > 0`,
      );
      rawLines.push(
        `  ? ${outputVariable}Raw.messages[${outputVariable}Raw.messages.length - 1]?.content ?? ${outputVariable}Raw`,
      );
      rawLines.push(`  : ${outputVariable}Raw;`);
    } else if (
      langGraphOutputMode === "specific_fields" &&
      langGraphOutputFields.length > 0
    ) {
      const fieldPicks = langGraphOutputFields
        .map((f) => `  ${JSON.stringify(f)}: ${outputVariable}Raw?.${f},`)
        .join("\n");
      rawLines.push(`const ${outputVariable} = {\n${fieldPicks}\n};`);
    } else {
      rawLines.push(
        `const ${outputVariable}Messages = Array.isArray(${outputVariable}Raw?.messages) ? ${outputVariable}Raw.messages : [];`,
      );
      rawLines.push(
        `const ${outputVariable}LastMsg = ${outputVariable}Messages.length > 0 ? ${outputVariable}Messages[${outputVariable}Messages.length - 1] : undefined;`,
      );
      rawLines.push(
        `const ${outputVariable}Response = (typeof ${outputVariable}LastMsg === "object" && ${outputVariable}LastMsg !== null && "content" in ${outputVariable}LastMsg && ${outputVariable}LastMsg.content !== undefined ? (typeof ${outputVariable}LastMsg.content === "string" ? ${outputVariable}LastMsg.content : JSON.stringify(${outputVariable}LastMsg.content)) : undefined) ?? (typeof ${outputVariable}Raw === "string" ? ${outputVariable}Raw : "");`,
      );
      rawLines.push(`const ${outputVariable} = {
  ...${outputVariable}Raw,
  response: ${outputVariable}Response,
  content: ${outputVariable}Response,
  threadId: ${threadIdExpr || "undefined"},
  state: ${outputVariable}Raw,
};`);
    }
  }

  return rawLines;
}

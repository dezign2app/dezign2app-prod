// ═══════════════════════════════════════════════════════════════
// MODULE: LangGraphStepRenderer
// LAYER:  generators / routeGenerator / pipeline / renderers
// EMITS:  LangGraph agent invocations (buffered or SSE streaming)
// ═══════════════════════════════════════════════════════════════

import { PipelineStep } from "@workspace/canvas/types";
import { PipelineRenderContext } from "../types";
import { resolveBinding } from "../sourceResolver";

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
    langGraphStreamingEnabled,
    langGraphStreamingFields = [],
    langGraphOutputMode = "full_state",
    langGraphOutputFields = [],
    langGraphTargetNodeId,
  } = step;

  const rawLines: string[] = [];
  const graphVar =
    functionRef?.name ||
    (langGraphTargetNodeId
      ? `${langGraphTargetNodeId.replace(/[^a-zA-Z0-9]/g, "")}Graph`
      : "agentGraph");

  // Build state input object
  const stateFields: string[] = [];

  if (inputBindings.length > 0) {
    for (const b of inputBindings) {
      if (b.argName) {
        stateFields.push(`  ${JSON.stringify(b.argName)}: ${resolveBinding(b, ctx)},`);
      }
    }
  } else if (langGraphStateMapping && Object.keys(langGraphStateMapping).length > 0) {
    for (const [key, path] of Object.entries(langGraphStateMapping)) {
      if (!path) continue;
      let accessor: string;
      if (path.startsWith("headers.")) {
        accessor = `req.headers["${path.slice(8)}"]`;
      } else if (path.startsWith("body.")) {
        accessor = `${ctx.bodyVar}.${path.slice(5)}`;
      } else if (path.startsWith("params.")) {
        accessor = `req.params.${path.slice(7)}`;
      } else if (path.startsWith("query.")) {
        accessor = `req.query.${path.slice(6)}`;
      } else if (path === "body") {
        accessor = ctx.bodyVar;
      } else if (path === "headers") {
        accessor = "req.headers";
      } else if (path === "params") {
        accessor = "req.params";
      } else if (path === "query") {
        accessor = "req.query";
      } else {
        accessor = `${ctx.bodyVar}?.${path}`;
      }
      stateFields.push(`  ${JSON.stringify(key)}: ${accessor},`);
    }
  } else {
    stateFields.push(
      `  messages: ${ctx.bodyVar}?.messages ?? [{ role: "user", content: ${ctx.bodyVar}?.message ?? (typeof ${ctx.bodyVar} === "string" ? ${ctx.bodyVar} : JSON.stringify(${ctx.bodyVar})) }],`,
    );
  }

  const stateInit =
    stateFields.length > 0
      ? `{\n${stateFields.join("\n")}\n}`
      : `{ messages: [{ role: "user", content: "hello" }] }`;

  if (langGraphStreamingEnabled) {
    rawLines.push(`// --- LangGraph Streaming Invocation (${step.name}) ---`);
    rawLines.push(`const agentState = ${stateInit};`);
    rawLines.push(`res.setHeader("Content-Type", "text/event-stream");`);
    rawLines.push(`res.setHeader("Cache-Control", "no-cache");`);
    rawLines.push(`res.setHeader("Connection", "keep-alive");`);
    rawLines.push(
      `const stream = await ${graphVar}.stream(agentState, { streamMode: "messages" });`,
    );
    rawLines.push(`for await (const chunk of stream) {`);
    rawLines.push(
      `  const [messageChunk, metadata] = Array.isArray(chunk) ? chunk : [chunk, undefined];`,
    );
    rawLines.push(
      `  const token = messageChunk?.content ?? (typeof chunk === "string" ? chunk : (chunk as { content?: string })?.content ?? chunk);`,
    );
    rawLines.push(
      `  const nodeName = (metadata as { langgraph_node?: string } | undefined)?.langgraph_node;`,
    );
    if (langGraphStreamingFields.length > 0) {
      const allowedFields = JSON.stringify(langGraphStreamingFields);
      rawLines.push(`  if (${allowedFields}.includes(nodeName || "")) {`);
      rawLines.push(`    if (token !== undefined && token !== "") {`);
      rawLines.push(
        `      res.write(\`data: \${JSON.stringify({ token, node: nodeName })}\\n\\n\`);`,
      );
      rawLines.push(`    }`);
      rawLines.push(`  }`);
    } else {
      rawLines.push(`  if (token !== undefined && token !== "") {`);
      rawLines.push(
        `    res.write(\`data: \${JSON.stringify({ token, node: nodeName })}\\n\\n\`);`,
      );
      rawLines.push(`  }`);
    }
    rawLines.push(`}`);
    rawLines.push(`res.write("data: [DONE]\\n\\n");`);
    rawLines.push(`res.end();`);
  } else {
    rawLines.push(`// --- LangGraph Invocation (${step.name}) ---`);
    rawLines.push(`const agentState = ${stateInit};`);
    rawLines.push(`const ${outputVariable}Raw = await ${graphVar}.invoke(agentState);`);

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
      rawLines.push(`const ${outputVariable} = ${outputVariable}Raw;`);
    }
  }

  return rawLines;
}

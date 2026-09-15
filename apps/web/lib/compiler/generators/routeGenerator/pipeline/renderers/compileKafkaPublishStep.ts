// ═══════════════════════════════════════════════════════════════
// MODULE: KafkaPublishStepRenderer
// LAYER:  generators / routeGenerator / pipeline / renderers
// EMITS:  Kafka publish event invocation statements in the pipeline
// ═══════════════════════════════════════════════════════════════

import { PipelineStep } from "@workspace/canvas/types";
import { toVarName } from "../../../../utils";
import { PipelineRenderContext } from "../types";
import { resolveBinding } from "../sourceResolver";

/**
 * Renders a Kafka publisher pipeline step.
 */
export function renderKafkaPublishStep(
  step: PipelineStep,
  ctx: PipelineRenderContext,
): string[] {
  const { outputVariable, functionRef, inputBindings = [] } = step;
  if (!functionRef) {
    return [`// [pipeline] step "${step.name}": missing functionRef`];
  }
  const rawLines: string[] = [];
  const fnName = toVarName(functionRef.name || "publishKafkaEvent");
  const isGeneric = fnName === "publishKafkaEvent" || functionRef.name === "publishKafkaEvent";
  const topicBinding = inputBindings.find((b) => b.argName === "topic");
  const keyBinding = inputBindings.find((b) => b.argName === "key");

  // Determine if an explicit spread base was specified
  const spreadBinding = inputBindings.find(
    (b) =>
      b.argName === "_spread" ||
      b.argName === "..." ||
      ((b.argName === "payload" || b.argName === "data") &&
        (!b.source || !("field" in b.source) || !b.source.field || b.source.field.trim() === "") &&
        inputBindings.some(
          (other) =>
            other !== b &&
            other.argName !== "topic" &&
            other.argName !== "key" &&
            other.argName !== "_spread" &&
            other.argName !== "...",
        )),
  );

  // Field bindings are all non-topic, non-key bindings (excluding the spread binding)
  const fieldBindings = inputBindings.filter(
    (b) => b.argName !== "topic" && b.argName !== "key" && b !== spreadBinding,
  );

  const topicExpr = topicBinding
    ? resolveBinding(topicBinding, ctx)
    : JSON.stringify(step.name || "default-topic");

  let payloadExpr: string;
  const firstField = fieldBindings[0];
  const firstFieldSourceField = firstField?.source && "field" in firstField.source ? firstField.source.field : undefined;
  if (
    fieldBindings.length === 1 &&
    firstField &&
    !spreadBinding &&
    (!firstFieldSourceField || firstFieldSourceField.trim() === "") &&
    (firstField.argName === "payload" ||
      firstField.argName === "data" ||
      firstField.argName === "message")
  ) {
    payloadExpr = resolveBinding(firstField, ctx);
  } else if (fieldBindings.length > 0 || spreadBinding) {
    const fieldsStr = fieldBindings
      .map((b) => `    ${b.argName}: ${resolveBinding(b, ctx)},`)
      .join("\n");
    if (spreadBinding) {
      const baseExpr = resolveBinding(spreadBinding, ctx);
      payloadExpr = fieldsStr
        ? `{\n    ...${baseExpr},\n${fieldsStr}\n  }`
        : `{\n    ...${baseExpr}\n  }`;
    } else {
      payloadExpr = `{\n${fieldsStr}\n  }`;
    }
  } else {
    payloadExpr = "{}";
  }

  const keyExpr = keyBinding ? resolveBinding(keyBinding, ctx) : null;

  rawLines.push(`const ${outputVariable} = await ${fnName}(`);
  if (isGeneric) {
    rawLines.push(`  ${topicExpr},`);
  }
  rawLines.push(`  ${payloadExpr}${keyExpr ? `,` : ""}`);
  if (keyExpr) {
    rawLines.push(`  ${keyExpr},`);
  }
  rawLines.push(`);`);
  return rawLines;
}

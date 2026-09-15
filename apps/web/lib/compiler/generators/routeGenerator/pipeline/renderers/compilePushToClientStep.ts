// ═══════════════════════════════════════════════════════════════
// MODULE: PushToClientStepRenderer
// LAYER:  generators / routeGenerator / pipeline / renderers
// EMITS:  Real-time client delivery (SSE, WebSocket, WebRTC, API_PUSH webhook)
// ═══════════════════════════════════════════════════════════════

import { PipelineStep } from "@workspace/canvas/types";
import { PipelineRenderContext } from "../types";
import { resolveBinding } from "../sourceResolver";

/**
 * Renders a push_to_client pipeline step (delivering real-time events via SSE, WebSocket, WebRTC, or Webhook).
 */
export function renderPushToClientStep(
  step: PipelineStep,
  ctx: PipelineRenderContext,
): string[] {
  const {
    inputBindings = [],
    clientDeliveryProtocol = "SSE",
    clientDeliveryEventName,
    outputVariable = "deliveryResult",
  } = step;
  const eventName = clientDeliveryEventName || "message";

  const spreadBinding = inputBindings.find(
    (b) =>
      b.argName === "_spread" ||
      b.argName === "..." ||
      ((b.argName === "payload" || b.argName === "data") &&
        (!b.source || !("field" in b.source) || !b.source.field || b.source.field.trim() === "") &&
        inputBindings.some(
          (other) =>
            other !== b &&
            other.argName !== "_spread" &&
            other.argName !== "...",
        )),
  );

  const fieldBindings = inputBindings.filter((b) => b !== spreadBinding);

  let payloadExpr: string;
  const firstClientField = fieldBindings[0];
  const firstClientFieldSourceField =
    firstClientField?.source && "field" in firstClientField.source
      ? firstClientField.source.field
      : undefined;
  if (
    fieldBindings.length === 1 &&
    firstClientField &&
    !spreadBinding &&
    (!firstClientFieldSourceField || firstClientFieldSourceField.trim() === "") &&
    (firstClientField.argName === "payload" ||
      firstClientField.argName === "data" ||
      firstClientField.argName === "message")
  ) {
    payloadExpr = resolveBinding(firstClientField, ctx);
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
    payloadExpr = ctx.bodyVar || "{}";
  }

  const rawLines: string[] = [];
  if (clientDeliveryProtocol === "SSE") {
    rawLines.push(`// --- Push to Client via Server-Sent Events (SSE) ---`);
    rawLines.push(`sseBroadcast(${JSON.stringify(eventName)}, ${payloadExpr});`);
  } else if (clientDeliveryProtocol === "WEBSOCKET") {
    const roomParam = step.clientDeliveryRoom ? `, ${JSON.stringify(step.clientDeliveryRoom)}` : "";
    rawLines.push(`// --- Push to Client via WebSocket ---`);
    rawLines.push(`wsBroadcast(${JSON.stringify(eventName)}, ${payloadExpr}${roomParam});`);
  } else if (clientDeliveryProtocol === "API_PUSH") {
    const url = JSON.stringify(step.clientDeliveryWebhookUrl || "https://example.com/webhook");
    const method = JSON.stringify(step.clientDeliveryWebhookMethod || "POST");
    rawLines.push(`// --- Push to Client via Outbound Webhook ---`);
    rawLines.push(`await fetch(${url}, {`);
    rawLines.push(`  method: ${method},`);
    rawLines.push(`  headers: { "Content-Type": "application/json" },`);
    rawLines.push(`  body: JSON.stringify(${payloadExpr}),`);
    rawLines.push(`});`);
  } else {
    const roomParam = step.clientDeliveryRoom ? `, ${JSON.stringify(step.clientDeliveryRoom)}` : "";
    rawLines.push(`// --- Push to Client via WebRTC Data Channel ---`);
    rawLines.push(`webrtcBroadcast(${JSON.stringify(eventName)}, ${payloadExpr}${roomParam});`);
  }

  if (outputVariable) {
    rawLines.push(
      `const ${outputVariable} = { delivered: true, event: ${JSON.stringify(eventName)} };`,
    );
  }

  return rawLines;
}

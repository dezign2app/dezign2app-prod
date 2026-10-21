// ═══════════════════════════════════════════════════════════════
// MODULE: ResponseStepRenderer
// LAYER:  generators / routeGenerator / pipeline / renderers
// EMITS:  Explicit return_response and early_return statements in the pipeline
// ═══════════════════════════════════════════════════════════════

import { PipelineStep } from "@workspace/canvas/types";
import { PipelineRenderContext } from "../types";
import { resolveBinding } from "../sourceResolver";

/**
 * Renders response-emitting steps (early_return and return_response).
 */
export function renderResponseStep(
  step: PipelineStep,
  ctx: PipelineRenderContext,
): string[] {
  const { inputBindings = [], statusCode: rawStatusCode } = step;
  const statusCode = rawStatusCode || 200;
  const firstBinding = inputBindings[0];

  if (
    inputBindings.length === 1 &&
    firstBinding &&
    (firstBinding.argName === "_spread" ||
      !firstBinding.argName)
  ) {
    const expr = resolveBinding(firstBinding, ctx);
    return [`return res.status(${statusCode}).json(${expr});`];
  }

  if (inputBindings.length > 0) {
    const seen = new Set<string>();
    const uniqueBindings = inputBindings.filter((b) => {
      const key = (b.argName || "").trim();
      if (!key) return false;
      const lower = key.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });

    if (uniqueBindings.length > 0) {
      const fields = uniqueBindings
        .map((b) => `  ${b.argName}: ${resolveBinding(b, ctx)}`)
        .join(",\n");
      return [`return res.status(${statusCode}).json({\n${fields}\n});`];
    }
  }

  const defaultMsg = step.type === "early_return" ? "Early return" : "Success";
  return [`return res.status(${statusCode}).json({ message: "${defaultMsg}" });`];
}

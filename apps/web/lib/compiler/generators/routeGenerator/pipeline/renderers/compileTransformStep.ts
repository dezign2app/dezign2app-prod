// ═══════════════════════════════════════════════════════════════
// MODULE: TransformStepRenderer
// LAYER:  generators / routeGenerator / pipeline / renderers
// EMITS:  TypeScript statements for synchronous transformer helper function calls
// ═══════════════════════════════════════════════════════════════

import { PipelineStep } from "@workspace/canvas/types";
import { toVarName } from "../../../../utils";
import { PipelineRenderContext } from "../types";
import { buildArgList } from "../sourceResolver";

/**
 * Renders a "transform" pipeline step (pure synchronous function call).
 */
export function renderTransformStep(
  step: PipelineStep,
  ctx: PipelineRenderContext,
): string[] {
  const { outputVariable, functionRef, inputBindings = [] } = step;
  if (!functionRef) {
    return [`// [pipeline] step "${step.name}": missing functionRef`];
  }
  const fnName = toVarName(functionRef.name || "transform");
  const args = buildArgList(inputBindings, ctx);
  const isMultiLine = args.includes("\n");
  if (outputVariable) {
    ctx.narrowedOutputs?.add(outputVariable);
  }
  if (isMultiLine) {
    return [
      `const ${outputVariable} = ${fnName}(`,
      ...args.split("\n").map((l) => `  ${l}`),
      `);`,
    ];
  }
  const callExpr = args ? `${fnName}(${args})` : `${fnName}()`;
  return [`const ${outputVariable} = ${callExpr};`];
}

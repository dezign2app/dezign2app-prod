// ═══════════════════════════════════════════════════════════════
// MODULE: VariableStepRenderer
// LAYER:  generators / routeGenerator / pipeline / renderers
// EMITS:  TypeScript variable declarations (let/const) and variable assignments (=, +=, -=)
// ═══════════════════════════════════════════════════════════════

import { PipelineStep } from "@workspace/canvas/types";
import { toVarName } from "../../../../utils";
import { PipelineRenderContext } from "../types";
import { resolveSource } from "../sourceResolver";

/**
 * Renders a "variable" pipeline step (declaration of let/const or assignment).
 */
export function renderVariableStep(
  step: PipelineStep,
  ctx: PipelineRenderContext,
): string[] {
  const {
    outputVariable,
    variableOperation = "declare",
    declarationKind = "let",
    variableDataType,
    variableSource,
    variableOperator = "=",
  } = step;

  const varName = toVarName(outputVariable || "customVar");

  // Track the variable in narrowedOutputs so downstream can access
  if (ctx.narrowedOutputs) {
    ctx.narrowedOutputs.add(varName);
  }

  // If this step has an ID, record it in priorOutputs
  if (step.id) {
    ctx.priorOutputs.set(step.id, varName);
  }

  if (variableOperation === "assign") {
    const valExpr = variableSource ? resolveSource(variableSource, ctx) : "undefined";
    const op = variableOperator || "=";
    return [`${varName} ${op} ${valExpr};`];
  }

  // Declaration mode (let or const)
  const keyword = declarationKind === "const" ? "const" : "let";
  const typeAnnotation =
    variableDataType && variableDataType.trim() && variableDataType.trim() !== "inferred"
      ? `: ${variableDataType.trim()}`
      : "";

  if (variableSource) {
    const valExpr = resolveSource(variableSource, ctx);
    return [`${keyword} ${varName}${typeAnnotation} = ${valExpr};`];
  }

  // Uninitialized let
  if (keyword === "let") {
    return [`let ${varName}${typeAnnotation};`];
  }

  // const requires an initializer
  return [`const ${varName}${typeAnnotation} = undefined;`];
}

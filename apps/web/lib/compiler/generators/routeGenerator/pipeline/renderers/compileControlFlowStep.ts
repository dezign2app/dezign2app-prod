// ═══════════════════════════════════════════════════════════════
// MODULE: ControlFlowStepRenderer
// LAYER:  generators / routeGenerator / pipeline / renderers
// EMITS:  Branching, loops, conditions, and parallel blocks inside the pipeline
// ═══════════════════════════════════════════════════════════════

import { PipelineStep } from "@workspace/canvas/types";
import { PipelineRenderContext } from "../types";
import { resolveSource } from "../sourceResolver";
import { compileConditionExpr } from "../conditionCompiler";

/**
 * Renders control-flow steps (condition, try_catch, switch, parallel, loop).
 */
export function renderControlFlowStep(
  step: PipelineStep,
  ctx: PipelineRenderContext,
  renderNested: (steps: PipelineStep[], ctx: PipelineRenderContext) => string[],
): string[] {
  const rawLines: string[] = [];
  const { type, outputVariable } = step;

  switch (type) {
    case "condition": {
      const condStr = compileConditionExpr(step.conditionExpr, ctx);
      rawLines.push(`if (${condStr}) {`);
      if (step.thenSteps && step.thenSteps.length > 0) {
        const thenLines = renderNested(step.thenSteps, ctx);
        thenLines.forEach((l) => rawLines.push(`  ${l}`));
      }
      if (step.elseSteps && step.elseSteps.length > 0) {
        rawLines.push(`} else {`);
        const elseLines = renderNested(step.elseSteps, ctx);
        elseLines.forEach((l) => rawLines.push(`  ${l}`));
      }
      rawLines.push(`}`);
      break;
    }

    case "try_catch": {
      rawLines.push(`try {`);
      if (step.trySteps && step.trySteps.length > 0) {
        const tryLines = renderNested(step.trySteps, ctx);
        tryLines.forEach((l) => rawLines.push(`  ${l}`));
      }
      rawLines.push(`} catch (caughtError) {`);
      if (step.catchSteps && step.catchSteps.length > 0) {
        const catchLines = renderNested(step.catchSteps, ctx);
        catchLines.forEach((l) => rawLines.push(`  ${l}`));
      } else {
        rawLines.push(`  logger.error("Error in try_catch block:", caughtError);`);
      }
      rawLines.push(`}`);
      break;
    }

    case "switch": {
      const switchTarget = resolveSource(step.switchSource, ctx);
      rawLines.push(`switch (${switchTarget}) {`);
      if (step.switchCases && step.switchCases.length > 0) {
        step.switchCases.forEach((c) => {
          const valStr = typeof c.value === "string" ? JSON.stringify(c.value) : String(c.value);
          rawLines.push(`  case ${valStr}: {`);
          if (c.steps && c.steps.length > 0) {
            const caseLines = renderNested(c.steps, ctx);
            caseLines.forEach((l) => rawLines.push(`    ${l}`));
          }
          rawLines.push(`    break;`);
          rawLines.push(`  }`);
        });
      }
      if (step.switchDefault && step.switchDefault.length > 0) {
        rawLines.push(`  default: {`);
        const defaultLines = renderNested(step.switchDefault, ctx);
        defaultLines.forEach((l) => rawLines.push(`    ${l}`));
        rawLines.push(`    break;`);
        rawLines.push(`  }`);
      }
      rawLines.push(`}`);
      break;
    }

    case "parallel": {
      const outVar = outputVariable || `parallelResults`;
      const isSettled = step.failureMode === "any";
      const promiseMethod = isSettled ? "Promise.allSettled" : "Promise.all";
      const branches = step.parallelBranches || [];

      if (branches.length === 0) {
        rawLines.push(`const ${outVar} = await ${promiseMethod}([]);`);
      } else {
        rawLines.push(`const ${outVar} = await ${promiseMethod}([`);
        branches.forEach((b) => {
          rawLines.push(`  (async () => {`);
          if (b.label) rawLines.push(`    // Branch: ${b.label}`);
          if (b.steps && b.steps.length > 0) {
            const bLines = renderNested(b.steps, ctx);
            bLines.forEach((l) => rawLines.push(`    ${l}`));
          }
          rawLines.push(`  })(),`);
        });
        rawLines.push(`]);`);
      }
      break;
    }

    case "loop": {
      const outVar = outputVariable || `loopResults`;
      const loopTarget = resolveSource(step.loopSource, ctx);
      const iterVar = step.iteratorVariable || "item";

      rawLines.push(`const ${outVar} = await Promise.all(`);
      rawLines.push(`  (Array.isArray(${loopTarget}) ? ${loopTarget} : []).map(async (${iterVar}) => {`);
      if (step.loopBody && step.loopBody.length > 0) {
        const loopLines = renderNested(step.loopBody, ctx);
        loopLines.forEach((l) => rawLines.push(`    ${l}`));
      }
      rawLines.push(`  })`);
      rawLines.push(`);`);
      break;
    }
  }

  return rawLines;
}

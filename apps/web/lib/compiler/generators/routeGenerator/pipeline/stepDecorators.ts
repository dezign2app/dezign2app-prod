import { PipelineStep } from "@workspace/canvas/types";
import { toVarName } from "../../../utils";
import { PipelineRenderContext } from "./types";
import { compileConditionExpr } from "./conditionCompiler";

function getStepTypeDeclaration(step: PipelineStep): string {
  if (step.functionRef?.name) {
    const fn = toVarName(step.functionRef.name);
    return `: Awaited<ReturnType<typeof ${fn}>> | null = null;`;
  }
  return `: Record<string, string | number | boolean | null> | null = null;`;
}

function stripVariableDeclaration(lines: string[], outVar: string): string[] {
  const constPrefix = `const ${outVar}`;
  const letPrefix = `let ${outVar}`;
  return lines.map((line) => {
    if (line.startsWith(constPrefix)) {
      const eqIdx = line.indexOf("=");
      return eqIdx !== -1 ? `${outVar} =${line.slice(eqIdx + 1)}` : line;
    }
    if (line.startsWith(letPrefix)) {
      const eqIdx = line.indexOf("=");
      return eqIdx !== -1 ? `${outVar} =${line.slice(eqIdx + 1)}` : line;
    }
    return line;
  });
}

/**
 * Applies step decorators (onError retries, fallback / ignore / early_return error actions,
 * and runIf execution guards) to the raw emitted lines of a pipeline step.
 */
export function applyStepDecorators(
  step: PipelineStep,
  rawLines: string[],
  ctx: PipelineRenderContext,
): string[] {
  let resultLines = rawLines;

  // Wrap lines in onError handler if specified
  if (step.onError && resultLines.length > 0) {
    const { onError, outputVariable: outVar, id, name } = step;
    const safeStepName = (name || "step").replace(/"/g, '\\"');

    // 1. Handle retries if configured
    if (onError.retries && onError.retries > 0) {
      const stepKey = (id || "step").replace(/[^a-zA-Z0-9_]/g, "_");
      if (outVar) {
        const transformedLines = stripVariableDeclaration(resultLines, outVar);
        const typeDecl = getStepTypeDeclaration(step);
        resultLines = [
          `let ${outVar}${typeDecl}`,
          `let attempts_${stepKey} = 0;`,
          `while (attempts_${stepKey} <= ${onError.retries}) {`,
          `  try {`,
          ...transformedLines.map((l) => `    ${l}`),
          `    break;`,
          `  } catch (retryErr) {`,
          `    attempts_${stepKey}++;`,
          `    if (attempts_${stepKey} > ${onError.retries}) throw retryErr;`,
          `    await new Promise((r) => setTimeout(r, 300));`,
          `  }`,
          `}`,
        ];
      } else {
        resultLines = [
          `let attempts_${stepKey} = 0;`,
          `while (attempts_${stepKey} <= ${onError.retries}) {`,
          `  try {`,
          ...resultLines.map((l) => `    ${l}`),
          `    break;`,
          `  } catch (retryErr) {`,
          `    attempts_${stepKey}++;`,
          `    if (attempts_${stepKey} > ${onError.retries}) throw retryErr;`,
          `    await new Promise((r) => setTimeout(r, 300));`,
          `  }`,
          `}`,
        ];
      }
    }

    // 2. Handle failure actions: early_return, fallback, ignore, throw
    if (onError.action === "early_return") {
      resultLines = [
        `try {`,
        ...resultLines.map((l) => `  ${l}`),
        ...(outVar
          ? [
              `  if (${outVar} && typeof ${outVar} === "object" && "success" in ${outVar} && !(${outVar} as { success: boolean }).success) {`,
              `    const errMsg = (${outVar} as { error?: { message?: string } }).error?.message || "${onError.errorMessage || `${safeStepName} execution failed`}";`,
              `    logger.error("Step ${safeStepName} failed (early return):", errMsg);`,
              `    return res.status(${onError.statusCode || 502}).json({`,
              `      error: "${onError.errorMessage || `${safeStepName} execution failed`}",`,
              `      details: errMsg,`,
              `      statusCode: ${onError.statusCode || 502},`,
              `    });`,
              `  }`,
            ]
          : []),
        `} catch (stepErr) {`,
        `  logger.error("Step ${safeStepName} failed (early return):", stepErr);`,
        `  return res.status(${onError.statusCode || 502}).json({`,
        `    error: "${onError.errorMessage || `${safeStepName} execution failed`}",`,
        `    details: stepErr instanceof Error ? stepErr.message : String(stepErr),`,
        `    statusCode: ${onError.statusCode || 502},`,
        `  });`,
        `}`,
      ];
    } else if (onError.action === "fallback") {
      if (outVar) {
        ctx.narrowedOutputs?.delete(outVar);
        const transformedLines = stripVariableDeclaration(resultLines, outVar);
        const typeDecl = getStepTypeDeclaration(step);
        resultLines = [
          `let ${outVar}${typeDecl}`,
          `try {`,
          ...transformedLines.map((l) => `  ${l}`),
          `  if (${outVar} && typeof ${outVar} === "object" && "success" in ${outVar} && !(${outVar} as { success: boolean }).success) {`,
          `    logger.warn("Step ${safeStepName} returned failure, using fallback value:", (${outVar} as { error?: unknown }).error);`,
          `    ${outVar} = ${onError.fallbackValue || "null"};`,
          `  }`,
          `} catch (stepErr) {`,
          `  logger.warn("Step ${safeStepName} failed, using fallback value:", stepErr);`,
          `  ${outVar} = ${onError.fallbackValue || "null"};`,
          `}`,
        ];
      } else {
        resultLines = [
          `try {`,
          ...resultLines.map((l) => `  ${l}`),
          `} catch (stepErr) {`,
          `  logger.warn("Step ${safeStepName} failed, fallback applied:", stepErr);`,
          `}`,
        ];
      }
    } else if (onError.action === "ignore") {
      if (outVar) {
        ctx.narrowedOutputs?.delete(outVar);
        const transformedLines = stripVariableDeclaration(resultLines, outVar);
        const typeDecl = getStepTypeDeclaration(step);
        resultLines = [
          `let ${outVar}${typeDecl}`,
          `try {`,
          ...transformedLines.map((l) => `  ${l}`),
          `} catch (stepErr) {`,
          `  logger.error("Step ${safeStepName} failed, proceeding to next step:", stepErr);`,
          `}`,
        ];
      } else {
        resultLines = [
          `try {`,
          ...resultLines.map((l) => `  ${l}`),
          `} catch (stepErr) {`,
          `  logger.error("Step ${safeStepName} failed, proceeding to next step:", stepErr);`,
          `}`,
        ];
      }
    } else if (onError.action === "throw") {
      resultLines = [
        `try {`,
        ...resultLines.map((l) => `  ${l}`),
        ...(outVar
          ? [
              `  if (${outVar} && typeof ${outVar} === "object" && "success" in ${outVar} && !(${outVar} as { success: boolean }).success) {`,
              `    const errMsg = (${outVar} as { error?: { message?: string } }).error?.message || "${onError.errorMessage || `${safeStepName} execution failed`}";`,
              `    logger.error("Step ${safeStepName} failed:", errMsg);`,
              `    throw new Error(errMsg);`,
              `  }`,
            ]
          : []),
        `} catch (stepErr) {`,
        `  logger.error("Step ${safeStepName} failed:", stepErr);`,
        `  throw stepErr;`,
        `}`,
      ];
    }
  }

  // Wrap lines in runIf guard if specified
  if (step.runIf) {
    const guardExpr = compileConditionExpr(step.runIf, ctx);
    return [
      `if (${guardExpr}) {`,
      ...resultLines.map((l) => `  ${l}`),
      `}`,
    ];
  }

  return resultLines;
}

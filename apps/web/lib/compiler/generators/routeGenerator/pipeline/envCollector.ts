import {
  PipelineStep,
  PipelineStepInputSource,
  ConditionExpr,
} from "@workspace/canvas/types";

/**
 * Cleans and extracts the raw environment variable name from a field string.
 * Strips leading "process.env.", "${...}", and quotes/brackets.
 */
export function cleanEnvVarName(raw?: string): string {
  if (!raw) return "";
  let cleaned = raw.trim();
  if (cleaned.startsWith("${") && cleaned.endsWith("}")) {
    cleaned = cleaned.slice(2, -1).trim();
  }
  if (cleaned.startsWith("process.env.")) {
    cleaned = cleaned.slice("process.env.".length).trim();
  } else if (cleaned.startsWith("process.env[")) {
    cleaned = cleaned.slice("process.env[".length).trim();
  }
  return cleaned.replace(/^[\["']+|[\]"']+$/g, "").trim();
}

/**
 * Recursively traverses all pipeline steps (including sub-steps, conditions,
 * and branches) to collect all unique referenced environment variable names.
 */
export function collectReferencedEnvVars(steps: PipelineStep[]): string[] {
  const envVars = new Set<string>();

  function checkSource(source?: PipelineStepInputSource) {
    if (source && source.kind === "env" && source.field) {
      const cleaned = cleanEnvVarName(source.field);
      if (cleaned) {
        envVars.add(cleaned);
      }
    }
  }

  function checkConditionExpr(expr?: ConditionExpr) {
    if (!expr) return;
    if ("left" in expr) {
      checkSource(expr.left);
      checkSource(expr.right);
    } else if ("and" in expr && Array.isArray(expr.and)) {
      expr.and.forEach(checkConditionExpr);
    } else if ("or" in expr && Array.isArray(expr.or)) {
      expr.or.forEach(checkConditionExpr);
    } else if ("not" in expr && expr.not) {
      checkConditionExpr(expr.not);
    }
  }

  function traverseStep(step: PipelineStep) {
    if (step.enabled === false) return;

    if (Array.isArray(step.inputBindings)) {
      for (const b of step.inputBindings) {
        checkSource(b.source);
      }
    }

    if (step.switchSource) {
      checkSource(step.switchSource);
    }

    if (step.loopSource) {
      checkSource(step.loopSource);
    }

    if (step.runIf) {
      checkConditionExpr(step.runIf);
    }

    if (step.conditionExpr) {
      checkConditionExpr(step.conditionExpr);
    }

    if (step.loopConditionExpr) {
      checkConditionExpr(step.loopConditionExpr);
    }

    if (Array.isArray(step.thenSteps)) {
      step.thenSteps.forEach(traverseStep);
    }

    if (Array.isArray(step.elseSteps)) {
      step.elseSteps.forEach(traverseStep);
    }

    if (Array.isArray(step.trySteps)) {
      step.trySteps.forEach(traverseStep);
    }

    if (Array.isArray(step.catchSteps)) {
      step.catchSteps.forEach(traverseStep);
    }

    if (Array.isArray(step.cacheMissSteps)) {
      step.cacheMissSteps.forEach(traverseStep);
    }

    if (Array.isArray(step.switchCases)) {
      for (const sc of step.switchCases) {
        if (Array.isArray(sc.steps)) {
          sc.steps.forEach(traverseStep);
        }
      }
    }

    if (Array.isArray(step.switchDefault)) {
      step.switchDefault.forEach(traverseStep);
    }

    if (Array.isArray(step.parallelBranches)) {
      for (const branch of step.parallelBranches) {
        if (Array.isArray(branch.steps)) {
          branch.steps.forEach(traverseStep);
        }
      }
    }

    if (Array.isArray(step.loopBody)) {
      step.loopBody.forEach(traverseStep);
    }
  }

  steps.forEach(traverseStep);
  return Array.from(envVars);
}

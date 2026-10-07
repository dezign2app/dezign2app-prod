import { PipelineStepDraft } from "../types";

/**
 * Collects all variables declared as mutable (let) in prior steps
 * so they can be selected as assignment targets in subsequent steps.
 */
export function getPriorMutableVariables(
  priorSteps: readonly PipelineStepDraft[] = [],
): Array<{ name: string; type?: string; stepId?: string }> {
  const vars: Array<{ name: string; type?: string; stepId?: string }> = [];
  const seen = new Set<string>();

  for (const s of priorSteps) {
    const varName = (s.outputVariable || "").trim();
    if (!varName) continue;

    const isLet =
      s.declarationKind === "let" ||
      (s.type === "variable" &&
        s.variableOperation !== "assign" &&
        !s.declarationKind);

    if (isLet && !seen.has(varName)) {
      seen.add(varName);
      vars.push({
        name: varName,
        type: s.variableDataType || (s.outputSchema ? "object" : "string"),
        stepId: s.id,
      });
    }
  }

  return vars;
}

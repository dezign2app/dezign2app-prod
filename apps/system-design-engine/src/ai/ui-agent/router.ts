import { UiEditorState } from "./state";

/**
 * Conditional router after validation step.
 * If code is invalid and we haven't exceeded retry limit (max 2 retries), route to repair.
 * Otherwise, complete the graph execution.
 */
export function shouldRepairOrFinish(state: UiEditorState): "uiRepair" | "__end__" {
  if (state.validationStatus === "invalid" && state.retryCount < 2) {
    return "uiRepair";
  }
  return "__end__";
}

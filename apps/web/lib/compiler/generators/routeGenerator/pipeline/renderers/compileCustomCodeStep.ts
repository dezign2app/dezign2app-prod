// ═══════════════════════════════════════════════════════════════
// MODULE: CustomCodeStepRenderer
// LAYER:  generators / routeGenerator / pipeline / renderers
// EMITS:  Inlined custom TypeScript code blocks inside the pipeline
// ═══════════════════════════════════════════════════════════════

import { PipelineStep } from "@workspace/canvas/types";

/**
 * Renders an inlined custom TypeScript code block.
 */
export function renderCustomCodeStep(step: PipelineStep): string[] {
  const { customCode, name } = step;
  if (customCode && customCode.trim()) {
    return customCode.split("\n");
  }
  return [`// [pipeline] custom_code step "${name}" has no code`];
}

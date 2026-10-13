import { CompiledFile } from "@workspace/canvas/types";
import { compileFormComponents } from "./formComponents";
import { compileDisplayComponents } from "./displayComponents";
import { compileOverlayComponents } from "./overlayComponents";

/**
 * Aggregates all Shadcn UI components for `@workspace/ui/components/*`.
 */
export function compileAllUiComponents(): CompiledFile[] {
  return [
    ...compileFormComponents(),
    ...compileDisplayComponents(),
    ...compileOverlayComponents(),
  ];
}

export * from "./formComponents";
export * from "./displayComponents";
export * from "./overlayComponents";

import { CompiledFile } from "@workspace/canvas/types";
import { compileFormComponents } from "./formComponents";
import { compileDisplayComponents } from "./displayComponents";
import { compileOverlayComponents } from "./overlayComponents";
import { compileChatComponents } from "./chatComponents";

/**
 * Aggregates all Shadcn UI components for `@workspace/ui/components/*`.
 */
export function compileAllUiComponents(): CompiledFile[] {
  return [
    ...compileFormComponents(),
    ...compileDisplayComponents(),
    ...compileOverlayComponents(),
    ...compileChatComponents(),
  ];
}

export * from "./formComponents";
export * from "./displayComponents";
export * from "./overlayComponents";
export * from "./chatComponents";

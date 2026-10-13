import { CompiledFile } from "@workspace/canvas/types";
import { compileUiManifests } from "./manifests";
import { compileUiStyles } from "./styles";
import { compileAllUiComponents } from "./components";

/**
 * Compiles the entire `@workspace/ui` package matching the monorepo's
 * Shadcn UI configuration, CSS variables, and components.
 */
export function compileUiPackage(): { files: CompiledFile[] } {
  const files: CompiledFile[] = [
    ...compileUiManifests(),
    ...compileUiStyles(),
    ...compileAllUiComponents(),
  ];

  return { files };
}

export * from "./manifests";
export * from "./styles";
export * from "./components";

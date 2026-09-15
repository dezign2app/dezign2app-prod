// ═══════════════════════════════════════════════════════════════════════════
// MODULE:  compileMonorepo/ barrel index
// PURPOSE: Re-exports all sub-module public surfaces so external code can
//          import from "@/lib/compiler/compileMonorepo" (the directory barrel)
//          if needed, while the main compileMonorepo.ts stays a thin entry.
// ═══════════════════════════════════════════════════════════════════════════

export { classifyNodes } from "./classifyNodes";
export type { ClassifiedNodes } from "./classifyNodes";

export { createFolderNameResolvers } from "./folderNameResolver";
export type { FolderEntry, FolderNameResolvers } from "./folderNameResolver";

export { compileSharedPackages } from "./sharedPackages";
export type { SharedPackagesResult } from "./sharedPackages";

export { buildWebAppMap } from "./webAppMapper";
export type { WebAppEntry } from "./webAppMapper";

export { compileAllApps } from "./appCompilers";
export type { AllAppsResult } from "./appCompilers";

export { assembleRoot } from "./rootAssembly";
export type { RootAssemblyParams } from "./rootAssembly";

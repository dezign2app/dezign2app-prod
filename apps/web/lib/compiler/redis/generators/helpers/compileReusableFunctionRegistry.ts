// ═══════════════════════════════════════════════════════════════
// MODULE: CompileReusableFunctionRegistry
// LAYER:  redis / generators / helpers
// EMITS:  Canvas reusable function metadata for pipeline editor autocomplete
// ═══════════════════════════════════════════════════════════════

import { ReusableFunction } from "@workspace/canvas/types";
import { HelperContext } from "./types";

export function compileReusableFunctionRegistry(ctx: HelperContext): ReusableFunction[] {
  const { schema, packageName } = ctx;
  const { varName, typeName, dataStructure, keyArgsSig } = schema;
  const reusableFunctions: ReusableFunction[] = [];

  if (dataStructure === "list") {
    reusableFunctions.push({
      name: `push${typeName}`,
      importPath: packageName,
      signature: `push${typeName}(${keyArgsSig ? `${keyArgsSig}, ` : ""}...items: string[]): Promise<number>`,
      targetName: varName,
      kind: "create",
    });
    reusableFunctions.push({
      name: `pop${typeName}`,
      importPath: packageName,
      signature: `pop${typeName}(${keyArgsSig}): Promise<string | null>`,
      targetName: varName,
      kind: "delete",
    });
    reusableFunctions.push({
      name: `get${typeName}List`,
      importPath: packageName,
      signature: `get${typeName}List(${keyArgsSig ? `${keyArgsSig}, ` : ""}start: number = 0, stop: number = -1): Promise<string[]>`,
      targetName: varName,
      kind: "findAll",
    });
    reusableFunctions.push({
      name: `get${typeName}Length`,
      importPath: packageName,
      signature: `get${typeName}Length(${keyArgsSig}): Promise<number>`,
      targetName: varName,
      kind: "findById",
    });
  } else if (dataStructure === "json" && schema.isJsonArray && schema.itemTypeName) {
    const itemType = schema.itemTypeName;
    reusableFunctions.push({
      name: `append${typeName}Item`,
      importPath: packageName,
      signature: `append${typeName}Item(${keyArgsSig ? `${keyArgsSig}, ` : ""}item: ${itemType}): Promise<number>`,
      targetName: varName,
      kind: "create",
    });
    reusableFunctions.push({
      name: `pop${typeName}Item`,
      importPath: packageName,
      signature: `pop${typeName}Item(${keyArgsSig ? `${keyArgsSig}, ` : ""}index: number = -1): Promise<${itemType} | null>`,
      targetName: varName,
      kind: "delete",
    });
    reusableFunctions.push({
      name: `getRecent${typeName}Items`,
      importPath: packageName,
      signature: `getRecent${typeName}Items(${keyArgsSig ? `${keyArgsSig}, ` : ""}count: number = 20): Promise<${itemType}[]>`,
      targetName: varName,
      kind: "findAll",
    });
    reusableFunctions.push({
      name: `get${typeName}Length`,
      importPath: packageName,
      signature: `get${typeName}Length(${keyArgsSig}): Promise<number>`,
      targetName: varName,
      kind: "findById",
    });
    reusableFunctions.push({
      name: `get${typeName}`,
      importPath: packageName,
      signature: `get${typeName}(${keyArgsSig}): Promise<${typeName} | null>`,
      targetName: varName,
      kind: "findById",
    });
    reusableFunctions.push({
      name: `set${typeName}`,
      importPath: packageName,
      signature: `set${typeName}(${keyArgsSig ? `${keyArgsSig}, ` : ""}data: Partial<${typeName}>): Promise<void>`,
      targetName: varName,
      kind: "create",
    });
  } else if (dataStructure === "hash") {
    reusableFunctions.push({
      name: `get${typeName}`,
      importPath: packageName,
      signature: `get${typeName}(${keyArgsSig}): Promise<${typeName} | null>`,
      targetName: varName,
      kind: "findById",
    });
    reusableFunctions.push({
      name: `getAll${typeName}Fields`,
      importPath: packageName,
      signature: `getAll${typeName}Fields(${keyArgsSig}): Promise<${typeName} | null>`,
      targetName: varName,
      kind: "findAll",
    });
    reusableFunctions.push({
      name: `set${typeName}`,
      importPath: packageName,
      signature: `set${typeName}(${keyArgsSig ? `${keyArgsSig}, ` : ""}data: Partial<${typeName}>): Promise<void>`,
      targetName: varName,
      kind: "create",
    });
    reusableFunctions.push({
      name: `set${typeName}Fields`,
      importPath: packageName,
      signature: `set${typeName}Fields(${keyArgsSig ? `${keyArgsSig}, ` : ""}data: Partial<${typeName}>): Promise<void>`,
      targetName: varName,
      kind: "create",
    });
    reusableFunctions.push({
      name: `get${typeName}Field`,
      importPath: packageName,
      signature: `get${typeName}Field(${keyArgsSig ? `${keyArgsSig}, ` : ""}field: string): Promise<string | number | boolean | null>`,
      targetName: varName,
      kind: "findById",
    });
    reusableFunctions.push({
      name: `set${typeName}Field`,
      importPath: packageName,
      signature: `set${typeName}Field(${keyArgsSig ? `${keyArgsSig}, ` : ""}field: string, value: string | number | boolean): Promise<void>`,
      targetName: varName,
      kind: "update",
    });
  } else {
    reusableFunctions.push({
      name: `get${typeName}`,
      importPath: packageName,
      signature: `get${typeName}(${keyArgsSig}): Promise<${typeName} | null>`,
      targetName: varName,
      kind: "findById",
    });
    reusableFunctions.push({
      name: `set${typeName}`,
      importPath: packageName,
      signature: `set${typeName}(${keyArgsSig ? `${keyArgsSig}, ` : ""}data: Partial<${typeName}>): Promise<void>`,
      targetName: varName,
      kind: "create",
    });
  }

  reusableFunctions.push({
    name: `invalidate${typeName}`,
    importPath: packageName,
    signature: `invalidate${typeName}(${keyArgsSig}): Promise<boolean>`,
    targetName: varName,
    kind: "delete",
  });

  reusableFunctions.push({
    name: `delete${typeName}`,
    importPath: packageName,
    signature: `delete${typeName}(${keyArgsSig}): Promise<boolean>`,
    targetName: varName,
    kind: "delete",
  });

  return reusableFunctions;
}

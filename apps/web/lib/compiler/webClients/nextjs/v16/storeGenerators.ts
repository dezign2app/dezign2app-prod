import { CompiledFile, GlobalStoreDefinition, GlobalStoreField, StateVariableType } from "@workspace/canvas/types";

function toPascalCase(str: string): string {
  const clean = str.trim();
  if (!clean) return "App";
  if (/[\s\-_]/.test(clean)) {
    return clean
      .split(/[\s\-_]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function toCamelCase(str: string): string {
  const clean = str.trim();
  if (!clean) return "app";
  if (/[\s\-_]/.test(clean)) {
    const words = clean.split(/[\s\-_]+/);
    return words[0]!.toLowerCase() + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  }
  return clean.charAt(0).toLowerCase() + clean.slice(1);
}

function mapFieldTypeToTs(type: StateVariableType | string): string {
  switch (type) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "unknown[]";
    case "object":
      return "Record<string, unknown>";
    case "any":
      return "any";
    case "unknown":
      return "unknown";
    default:
      return type || "unknown";
  }
}

function formatDefaultValue(field: GlobalStoreField): string {
  if (field.defaultValue !== undefined && field.defaultValue !== null) {
    if (typeof field.defaultValue === "string") {
      return JSON.stringify(field.defaultValue);
    }
    if (typeof field.defaultValue === "number" || typeof field.defaultValue === "boolean") {
      return String(field.defaultValue);
    }
    try {
      return JSON.stringify(field.defaultValue);
    } catch {
      // fallback
    }
  }

  switch (field.type) {
    case "string":
      return '""';
    case "number":
      return "0";
    case "boolean":
      return "false";
    case "array":
      return "[]";
    case "object":
      return "{}";
    default:
      return "null";
  }
}

function toKebabCase(str: string): string {
  const clean = str.trim();
  if (!clean) return "app";
  return clean
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

export function generateZustandStore(
  store: GlobalStoreDefinition,
  options?: { filePath?: string }
): CompiledFile {
  const baseName = toPascalCase(store.name || "App");
  const storeCompName = baseName.endsWith("Store") ? baseName : `${baseName}Store`;
  const hookName = `use${storeCompName}`;
  const interfaceName = `${storeCompName}State`;

  const fields = store.fields && store.fields.length > 0 ? store.fields : [
    { id: "field-state", name: "value", type: "string" as StateVariableType, defaultValue: "" }
  ];

  // TypeScript fields
  const fieldTypeLines = fields.map((f) => {
    const fName = toCamelCase(f.name);
    const tsType = mapFieldTypeToTs(f.type);
    return `  ${fName}: ${tsType};`;
  });

  // Default setters
  const setterLines = fields.map((f) => {
    const fName = toCamelCase(f.name);
    const fPascal = toPascalCase(f.name);
    const tsType = mapFieldTypeToTs(f.type);
    return `  set${fPascal}: (value: ${tsType}) => void;`;
  });

  // Custom action types
  const customActionSignatures: string[] = [];
  const customActionImpls: string[] = [];

  (store.actions || []).forEach((act) => {
    const actName = toCamelCase(act.name);
    if (!actName) return;

    const targetField = fields.find((f) => f.id === act.targetFieldId) || fields[0]!;
    const targetName = toCamelCase(targetField.name);
    const tsType = mapFieldTypeToTs(targetField.type);

    switch (act.actionType) {
      case "set":
        customActionSignatures.push(`  ${actName}: (value: ${tsType}) => void;`);
        customActionImpls.push(`  ${actName}: (value) => set({ ${targetName}: value }),`);
        break;
      case "append":
        customActionSignatures.push(`  ${actName}: (item: unknown) => void;`);
        customActionImpls.push(`  ${actName}: (item) => set((s) => ({ ${targetName}: Array.isArray(s.${targetName}) ? [...s.${targetName}, item] : [item] })),`);
        break;
      case "remove":
        customActionSignatures.push(`  ${actName}: (indexOrId: unknown) => void;`);
        customActionImpls.push(`  ${actName}: (indexOrId) => set((s) => ({ ${targetName}: Array.isArray(s.${targetName}) ? s.${targetName}.filter((it, idx) => idx !== indexOrId && (it as { id?: unknown })?.id !== indexOrId) : [] })),`);
        break;
      case "toggle":
        customActionSignatures.push(`  ${actName}: () => void;`);
        customActionImpls.push(`  ${actName}: () => set((s) => ({ ${targetName}: !s.${targetName} })),`);
        break;
      case "increment":
        customActionSignatures.push(`  ${actName}: (amount?: number) => void;`);
        customActionImpls.push(`  ${actName}: (amount = 1) => set((s) => ({ ${targetName}: typeof s.${targetName} === "number" ? s.${targetName} + amount : amount })),`);
        break;
      case "reset":
        customActionSignatures.push(`  ${actName}: () => void;`);
        customActionImpls.push(`  ${actName}: () => set(initialState),`);
        break;
      case "populate":
        customActionSignatures.push(`  ${actName}: (data: unknown) => void;`);
        customActionImpls.push(`  ${actName}: (data) => set((s) => ({ ...s, ...(typeof data === "object" && data !== null ? data : {}) })),`);
        break;
      case "custom":
      default:
        customActionSignatures.push(`  ${actName}: (payload?: unknown) => void;`);
        customActionImpls.push(`  ${actName}: (payload) => set((s) => ({ ...s, ${targetName}: payload !== undefined ? payload : s.${targetName} })),`);
        break;
    }
  });

  // Initial state lines
  const initialStateLines = fields.map((f) => {
    const fName = toCamelCase(f.name);
    const val = formatDefaultValue(f);
    return `  ${fName}: ${val},`;
  });

  // Default setter implementations
  const setterImpls = fields.map((f) => {
    const fName = toCamelCase(f.name);
    const fPascal = toPascalCase(f.name);
    return `  set${fPascal}: (value) => set({ ${fName}: value }),`;
  });

  const descriptionComment = store.description
    ? `/**\n * ${store.description.replace(/\n/g, "\n * ")}\n */\n`
    : "";

  const isPersisted = store.storage === "localStorage" || store.storage === "sessionStorage";
  const storageMethod = store.storage === "sessionStorage" ? "sessionStorage" : "localStorage";
  const storageKey = `${toKebabCase(store.name || "app")}-storage`;

  const imports = isPersisted
    ? `import { create } from "zustand";\nimport { persist, createJSONStorage } from "zustand/middleware";`
    : `import { create } from "zustand";`;

  const hasPopulate = (store.actions || []).some((a) => a.actionType === "populate" || a.name === "populate");
  const hasReset = (store.actions || []).some((a) => a.actionType === "reset" || a.name === "reset");

  const builtInSignatures: string[] = [];
  const builtInImpls: string[] = [];

  if (!hasPopulate) {
    builtInSignatures.push("  populate: (data: unknown) => void;");
    builtInImpls.push("      populate: (data: unknown) => set((s) => ({ ...s, ...(typeof data === \"object\" && data !== null ? data : {}) })),");
  }

  if (!hasReset) {
    builtInSignatures.push("  reset: () => void;");
    builtInImpls.push("      reset: () => set(initialState),");
  }

  const storeCreation = isPersisted
    ? `export const ${hookName} = create<${interfaceName}>()(
  persist(
    (set) => ({
      ...initialState,
${setterImpls.map((l) => `    ${l}`).join("\n")}
${customActionImpls.length > 0 ? `${customActionImpls.map((l) => `    ${l}`).join("\n")}\n` : ""}${builtInImpls.join("\n")}
    }),
    {
      name: "${storageKey}",
      storage: createJSONStorage(() => ${storageMethod}),
    }
  )
);`
    : `export const ${hookName} = create<${interfaceName}>((set) => ({
  ...initialState,
${setterImpls.join("\n")}
${customActionImpls.length > 0 ? `${customActionImpls.join("\n")}\n` : ""}${builtInImpls.join("\n")}
}));`;

  const STANDARD_TS_TYPES = new Set([
    "string",
    "number",
    "boolean",
    "unknown",
    "any",
    "void",
    "null",
    "undefined",
    "never",
    "Date",
    "object",
    "array",
    "unknown[]",
    "any[]",
    "Record<string, unknown>",
    "Record<string, any>",
  ]);

  const customImports = new Set<string>();
  fields.forEach((f) => {
    const rawType = (f.type || "string").trim();
    const baseType = rawType.replace(/\[\]$/, "").trim();
    if (baseType && !STANDARD_TS_TYPES.has(baseType) && !STANDARD_TS_TYPES.has(rawType)) {
      customImports.add(baseType);
    }
  });

  const typesImportStmt =
    customImports.size > 0
      ? `\nimport type { ${Array.from(customImports).sort().join(", ")} } from "@workspace/types";`
      : "";

  const content = `"use client";

${imports}${typesImportStmt}

${descriptionComment}export interface ${interfaceName} {
${fieldTypeLines.join("\n")}
${setterLines.join("\n")}
${customActionSignatures.length > 0 ? `${customActionSignatures.join("\n")}\n` : ""}${builtInSignatures.join("\n")}
}

const initialState = {
${initialStateLines.join("\n")}
};

${storeCreation}

export default ${hookName};
`;

  let filename = options?.filePath;
  if (!filename) {
    filename = `lib/stores/${hookName}.ts`;
  }

  return {
    filename,
    language: "typescript",
    content,
  };
}

export function generateZustandStores(
  stores: GlobalStoreDefinition[],
  options?: { localStorePaths?: Record<string, string> }
): CompiledFile[] {
  if (!stores || stores.length === 0) return [];

  const files: CompiledFile[] = [];
  const globalExportStatements: string[] = [];

  stores.forEach((st) => {
    const isLocal = st.scope === "local";
    const customPath = (isLocal && st.id && options?.localStorePaths?.[st.id])
      ? options.localStorePaths[st.id]
      : undefined;

    const file = generateZustandStore(st, { filePath: customPath });
    files.push(file);

    if (!isLocal || !customPath) {
      const baseName = toPascalCase(st.name || "App");
      const storeCompName = baseName.endsWith("Store") ? baseName : `${baseName}Store`;
      const hookName = `use${storeCompName}`;
      globalExportStatements.push(`export * from "./${hookName}";\nexport { default as ${hookName} } from "./${hookName}";`);
    }
  });

  if (globalExportStatements.length > 0) {
    files.push({
      filename: "lib/stores/index.ts",
      language: "typescript",
      content: `${globalExportStatements.join("\n\n")}\n`,
    });
  }

  return files;
}

import type {
  CustomTypeItem,
  CustomTypeField,
  LangGraphTypesNode,
} from "@workspace/canvas";
import { isTypesNode, isTypesRefNode } from "@workspace/canvas";
import type { CompileContext } from "../types";
import { toPascalCase, toCamelCase } from "../utils";

function normalizeReducerCode(code: string, updateType?: string, typeName?: string): string {
  let fn = code.trim();

  // If updateType is provided, type parameter 'next' with updateType
  if (updateType) {
    fn = fn.replace(
      /^\s*\(\s*(?:prev|x|current)\s*,\s*(?:next|y|update)(?:\s*:\s*[^)]+)?\s*\)\s*=>/,
      `(prev, next: ${updateType}) =>`,
    );
  }

  // Type-safe guards for action checking without any/as
  fn = fn.replace(
    /const\s+action\s*=\s*next\?\.action;/g,
    `const action = typeof next === "object" && next !== null && "action" in next ? next.action : undefined;`,
  );

  // Type-safe guard for separator without any/as
  fn = fn.replace(
    /next\?\.separator\s*!==\s*undefined\s*\?\s*String\(next\.separator\)\s*:\s*""/g,
    `typeof next === "object" && next !== null && "separator" in next && next.separator !== undefined ? String(next.separator) : ""`,
  );

  // Type-safe guard for amount without any/as
  fn = fn.replace(
    /\(Number\(next\?\.amount\)\s*\|\|\s*1\)/g,
    `(typeof next === "object" && next !== null && "amount" in next ? Number(next.amount) || 1 : 1)`,
  );

  // Type-safe guard for next?.value
  fn = fn.replace(
    /next\?\.value\s*!==\s*undefined\s*\?\s*next\.value/g,
    `typeof next === "object" && next !== null && "value" in next && next.value !== undefined ? next.value`,
  );

  // Destructuring rawPayload replaced with strongly-typed payload
  if (typeName) {
    fn = fn.replace(
      /const\s+payload\s*=\s*typeof\s+next\s*===/g,
      `const payload: Partial<${typeName}> = typeof next ===`,
    );
    fn = fn.replace(
      /const\s+rawPayload\s*=[\s\S]*?const\s*\{\s*action:\s*_action\s*,\s*\.\.\.payload\s*\}\s*=\s*rawPayload;/g,
      `const payload: Partial<${typeName}> = typeof next === "object" && next !== null && "value" in next && typeof next.value === "object" && next.value !== null ? next.value : (typeof next === "object" && next !== null ? next : {});`,
    );
    fn = fn.replace(
      /const\s+initial\s*=\s*\{/g,
      `const initial: ${typeName} = {`,
    );
    fn = fn.replace(
      /const\s+current\s*=\s*\(prev/g,
      `const current: ${typeName} = (prev`,
    );
  }

  return fn;
}

export function buildStateFile(ctx: CompileContext): string {
  const schemaName = `${toPascalCase(ctx.graphId)}State`;
  const imports: string[] = ["Annotation"];

  if (ctx.usesMessages) {
    imports.push("MessagesAnnotation");
  }

  const hasCustomMessages = ctx.input.stateChannels.some(
    (c) =>
      c.key !== "messages" &&
      (c.type === "messages" || c.reducer === "add_messages"),
  );

  // Extract all available custom types across graph nodes and state channels
  const customTypes: CustomTypeItem[] = [];
  const seenTypeNames = new Set<string>();

  const addCustomType = (t?: CustomTypeItem | null) => {
    if (t && t.name && !seenTypeNames.has(t.name)) {
      seenTypeNames.add(t.name);
      customTypes.push(t);
    }
  };

  if (Array.isArray(ctx.input.nodes)) {
    ctx.input.nodes.forEach((n) => {
      if (!n) return;
      if (isTypesNode(n)) {
        if (n.data?.types && Array.isArray(n.data.types)) {
          n.data.types.forEach(addCustomType);
        }
      } else if (isTypesRefNode(n)) {
        if (n.data?.typesRef) {
          const master = ctx.input.nodes.find(
            (m): m is LangGraphTypesNode => isTypesNode(m) && m.id === n.data.typesRef,
          );
          if (master?.data?.types && Array.isArray(master.data.types)) {
            master.data.types.forEach(addCustomType);
          }
        }
      }
    });
  }

  if (Array.isArray(ctx.input.stateChannels)) {
    ctx.input.stateChannels.forEach((ch) => {
      if (ch.customTypeSchema) {
        addCustomType(ch.customTypeSchema);
      }
    });
  }

  // Generate interface / type definitions for all defined custom types
  const customTypeDefs: string[] = [];
  for (const ct of customTypes) {
    if (ct.rawCode && ct.rawCode.trim()) {
      customTypeDefs.push(ct.rawCode.trim());
      continue;
    }
    const typeName = ct.name.trim();
    if (ct.kind === "enum") {
      const vals = ct.enumValues || [];
      const enumLines = vals.map((v) => `  ${v} = "${v}",`).join("\n");
      customTypeDefs.push(`export enum ${typeName} {\n${enumLines}\n}`);
    } else if (ct.kind === "type") {
      if (ct.typeAliasValue) {
        customTypeDefs.push(`export type ${typeName} = ${ct.typeAliasValue};`);
      } else {
        const fields = ct.fields || [];
        const fieldLines = fields
          .map((f) => {
            const isArr = Boolean(f.isArray || f.type?.endsWith("[]"));
            const base = (f.type || "string").replace(/\[\]$/, "");
            const finalType = isArr ? `${base}[]` : base;
            return `  ${f.name}${f.required === false ? "?" : ""}: ${finalType};`;
          })
          .join("\n");
        customTypeDefs.push(`export type ${typeName} = {\n${fieldLines}\n};`);
      }
      customTypeDefs.push(`export type ${typeName}Update = Partial<${typeName}> & {\n  action?: string;\n  value?: Partial<${typeName}>;\n};`);
    } else {
      const fields = ct.fields || [];
      const fieldLines = fields
        .map((f) => {
          const isArr = Boolean(f.isArray || f.type?.endsWith("[]"));
          const base = (f.type || "string").replace(/\[\]$/, "");
          const finalType = isArr ? `${base}[]` : base;
          return `  ${f.name}${f.required === false ? "?" : ""}: ${finalType};`;
        })
        .join("\n");
      customTypeDefs.push(`export interface ${typeName} {\n${fieldLines}\n}`);
      customTypeDefs.push(`export type ${typeName}Update = Partial<${typeName}> & {\n  action?: string;\n  value?: Partial<${typeName}>;\n};`);
    }
  }

  // Check if primitive update helper types are needed
  const codeUsesActionUpdates = (code?: string): boolean => {
    if (!code) return false;
    return (
      code.includes(".action") ||
      code.includes('"action"') ||
      code.includes("'action'") ||
      code.includes(".amount") ||
      code.includes('"amount"') ||
      code.includes("'amount'") ||
      code.includes(".separator") ||
      code.includes('"separator"') ||
      code.includes("'separator'")
    );
  };

  const needsStringUpdate = ctx.input.stateChannels.some(
    (c) => c.type === "string" && codeUsesActionUpdates(c.customReducerCode),
  );
  const needsNumberUpdate = ctx.input.stateChannels.some(
    (c) => c.type === "number" && codeUsesActionUpdates(c.customReducerCode),
  );
  const needsBooleanUpdate = ctx.input.stateChannels.some(
    (c) => c.type === "boolean" && codeUsesActionUpdates(c.customReducerCode),
  );

  const primitiveUpdateDefs: string[] = [];
  if (needsStringUpdate) {
    primitiveUpdateDefs.push(`export type StringChannelUpdate = string | {
  action?: string;
  value?: string;
  separator?: string;
};`);
  }
  if (needsNumberUpdate) {
    primitiveUpdateDefs.push(`export type NumberChannelUpdate = number | {
  action?: string;
  value?: number;
  amount?: number;
};`);
  }
  if (needsBooleanUpdate) {
    primitiveUpdateDefs.push(`export type BooleanChannelUpdate = boolean | {
  action?: string;
  value?: boolean;
};`);
  }

  const channelLines: string[] = [];

  for (const ch of ctx.input.stateChannels) {
    const field = toCamelCase(ch.key);
    if (
      ch.key === "messages" ||
      ch.type === "messages" ||
      ch.reducer === "add_messages"
    ) {
      if (ch.key === "messages") {
        channelLines.push(`  ...MessagesAnnotation.spec,`);
      } else {
        channelLines.push(
          `  ${field}: Annotation<BaseMessage[]>({
    reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  }),`,
        );
      }
      continue;
    }

    const customTypeMatch =
      ch.customTypeName ||
      (ch.customTypeId && customTypes.find((t) => t.id === ch.customTypeId)?.name) ||
      ch.customTypeSchema?.name;
    const isCustomType = Boolean(customTypeMatch);

    const typeMap: Record<string, string> = {
      string: "string",
      number: "number",
      boolean: "boolean",
      array: "string[]",
      object: customTypeMatch || "Record<string, string>",
      json: customTypeMatch || "Record<string, string>",
      messages: "BaseMessage[]",
    };
    const tsType = customTypeMatch || typeMap[ch.type] || "string";

    if (ch.reducer === "custom" || ch.customReducerCode) {
      let updateType: string | undefined;
      if (isCustomType && customTypeMatch) {
        updateType = `${customTypeMatch}Update`;
      } else if (ch.type === "string" && codeUsesActionUpdates(ch.customReducerCode)) {
        updateType = "StringChannelUpdate";
      } else if (ch.type === "number" && codeUsesActionUpdates(ch.customReducerCode)) {
        updateType = "NumberChannelUpdate";
      } else if (ch.type === "boolean" && codeUsesActionUpdates(ch.customReducerCode)) {
        updateType = "BooleanChannelUpdate";
      }

      const customFn = normalizeReducerCode(
        ch.customReducerCode || `(prev, next) => next`,
        updateType,
        customTypeMatch,
      );
      const defaultVal =
        ch.defaultValue !== undefined && ch.defaultValue !== ""
          ? JSON.stringify(ch.defaultValue)
          : undefined;

      const annotationGeneric = updateType ? `${tsType}, ${updateType}` : tsType;
      channelLines.push(
        `  ${field}: Annotation<${annotationGeneric}>({
    reducer: ${customFn},${defaultVal !== undefined ? `\n    default: () => ${defaultVal},` : ""}
  }),`,
      );
      continue;
    }

    if (isCustomType && customTypeMatch) {
      const updateType = `${customTypeMatch}Update`;
      const defaultVal =
        ch.defaultValue !== undefined && ch.defaultValue !== ""
          ? JSON.stringify(ch.defaultValue)
          : undefined;
      if (ch.reducer === "merge_object") {
        channelLines.push(
          `  ${field}: Annotation<${tsType}, ${updateType}>({
    reducer: (x: ${tsType}, y: ${updateType}) => ({ ...x, ...(typeof y === "object" && y !== null && "value" in y && typeof y.value === "object" ? y.value : y) }),${defaultVal !== undefined ? `\n    default: () => ${defaultVal},` : ""}
  }),`,
        );
      } else {
        channelLines.push(
          `  ${field}: Annotation<${tsType}, ${updateType}>({
    reducer: (x: ${tsType}, y: ${updateType}): ${tsType} => {
      const initial = { ...x };
      if (typeof y === "object" && y !== null) {
        const payload = "value" in y && typeof y.value === "object" && y.value !== null ? y.value : y;
        return { ...initial, ...payload };
      }
      return initial;
    },${defaultVal !== undefined ? `\n    default: () => ${defaultVal},` : ""}
  }),`,
        );
      }
      continue;
    }

    if (ch.type === "string") {
      if (ch.reducer === "append") {
        channelLines.push(
          `  ${field}: Annotation<string>({
    reducer: (x: string, y: string) => x + y,
    default: () => ${JSON.stringify(ch.defaultValue ?? "")},
  }),`,
        );
      } else if (ch.defaultValue !== undefined && ch.defaultValue !== "") {
        channelLines.push(
          `  ${field}: Annotation<string>({
    reducer: (_, y: string) => y,
    default: () => ${JSON.stringify(ch.defaultValue)},
  }),`,
        );
      } else {
        channelLines.push(`  ${field}: Annotation<string>(),`);
      }
    } else if (ch.type === "number") {
      if (ch.reducer === "append") {
        channelLines.push(
          `  ${field}: Annotation<number>({
    reducer: (x: number, y: number) => x + y,
    default: () => ${Number(ch.defaultValue ?? 0)},
  }),`,
        );
      } else if (ch.defaultValue !== undefined && ch.defaultValue !== 0) {
        channelLines.push(
          `  ${field}: Annotation<number>({
    reducer: (_, y: number) => y,
    default: () => ${Number(ch.defaultValue)},
  }),`,
        );
      } else {
        channelLines.push(`  ${field}: Annotation<number>(),`);
      }
    } else if (ch.type === "boolean") {
      if (ch.defaultValue !== undefined) {
        channelLines.push(
          `  ${field}: Annotation<boolean>({
    reducer: (_, y: boolean) => y,
    default: () => ${Boolean(ch.defaultValue)},
  }),`,
        );
      } else {
        channelLines.push(`  ${field}: Annotation<boolean>(),`);
      }
    } else if (ch.type === "array") {
      const defArr = Array.isArray(ch.defaultValue) ? ch.defaultValue : [];
      if (ch.reducer === "concat_array" || ch.reducer === "append") {
        channelLines.push(
          `  ${field}: Annotation<string[]>({
    reducer: (x: string[], y: string[]) => x.concat(y),
    default: () => ${JSON.stringify(defArr)},
  }),`,
        );
      } else if (defArr.length > 0) {
        channelLines.push(
          `  ${field}: Annotation<string[]>({
    reducer: (_, y: string[]) => y,
    default: () => ${JSON.stringify(defArr)},
  }),`,
        );
      } else {
        channelLines.push(`  ${field}: Annotation<string[]>(),`);
      }
    } else if (ch.type === "object" || ch.type === "json") {
      if (ch.reducer === "merge_object") {
        channelLines.push(
          `  ${field}: Annotation<Record<string, string>>({
    reducer: (x: Record<string, string>, y: Record<string, string>) => ({ ...x, ...y }),
    default: () => ({}),
  }),`,
        );
      } else {
        channelLines.push(`  ${field}: Annotation<Record<string, string>>(),`);
      }
    } else {
      channelLines.push(`  ${field}: Annotation<string>(),`);
    }
  }

  const extraImports: string[] = [];
  if (hasCustomMessages) {
    extraImports.push(`import type { BaseMessage } from "@langchain/core/messages";`);
  }

  const allTypeDefs = [...customTypeDefs, ...primitiveUpdateDefs];
  const customTypesSection =
    allTypeDefs.length > 0 ? `\n\n${allTypeDefs.join("\n\n")}` : "";

  return `import { ${imports.sort().join(", ")} } from "@langchain/langgraph";${extraImports.length > 0 ? "\n" + extraImports.join("\n") : ""}${customTypesSection}

/**
 * Graph State Schema Definition
 */
export const ${schemaName} = Annotation.Root({
${channelLines.join("\n")}
});

export type ${schemaName}Type = typeof ${schemaName}.State;
export type ${schemaName}UpdateType = typeof ${schemaName}.Update;
`;
}

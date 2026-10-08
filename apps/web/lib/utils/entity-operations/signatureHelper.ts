import { toVarName } from "@/lib/compiler/utils";

/**
 * Unwraps outer `function name() { ... }` boilerplate if present,
 * leaving only the clean inner body statements for the framed editor.
 */
export function cleanInnerFunctionBody(code: string, fnName?: string): string {
  const trimmed = (code || "").trim();
  if (!trimmed) return "";
  const regex = new RegExp(
    `^(?:export\\s+)?(?:async\\s+)?function\\s*(?:${fnName ? toVarName(fnName) : "[a-zA-Z0-9_$]*"})?\\s*\\([^)]*\\)[^{]*\\{([\\s\\S]*)\\}\\s*$`,
  );
  const match = trimmed.match(regex);
  if (match && match[1] !== undefined) {
    const lines = match[1].split("\n");
    while (lines.length > 0 && !lines[0]?.trim()) lines.shift();
    while (lines.length > 0 && !lines[lines.length - 1]?.trim()) lines.pop();
    const indent = lines[0]?.match(/^\s*/)?.[0]?.length || 0;
    return lines.map((l) => (l.startsWith(" ".repeat(indent)) ? l.slice(indent) : l)).join("\n");
  }
  return trimmed;
}

/**
 * Dynamically derives a clean TypeScript function signature:
 * e.g. `test(): Promise<boolean>` or `findConversationById(id: string): Promise<ConversationsRow | null>`
 */
export function deriveDbFunctionSignature(
  name: string,
  params: Array<{ name: string; type?: string; required?: boolean }> = [],
  returnType = "void",
): string {
  const cleanName = toVarName(name) || name || "operation";
  const paramStr = (params || [])
    .filter((p) => p && p.name && p.name.trim())
    .map((p) => `${p.name.trim()}${p.required === false ? "?" : ""}: ${p.type || "string"}`)
    .join(", ");
  const retStr = returnType.startsWith("Promise<") ? returnType : `Promise<${returnType}>`;
  return `${cleanName}(${paramStr}): ${retStr}`;
}

/**
 * Extracts function parameters from outer `function name(...) { ... }` boilerplate if present.
 */
export function extractDbOperationParams(
  code: string,
): Array<{ name: string; type: string; required?: boolean }> | null {
  const trimmed = (code || "").trim();
  if (!trimmed) return null;
  const regex = /^(?:export\s+)?(?:async\s+)?function\s*(?:[a-zA-Z0-9_$]+)?\s*\(([^)]*)\)/m;
  const match = trimmed.match(regex);
  if (!match || match[1] === undefined) return null;

  const rawParams = match[1].trim();
  if (!rawParams) return [];

  // Parse comma-separated params, handling nested generics/types like Record<string, any>
  const paramList: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < rawParams.length; i++) {
    const char = rawParams[i];
    if (char === "<" || char === "{" || char === "(" || char === "[") depth++;
    else if (char === ">" || char === "}" || char === ")" || char === "]") depth--;

    if (char === "," && depth === 0) {
      if (current.trim()) paramList.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) paramList.push(current.trim());

  return paramList.map((pStr) => {
    let namePart = pStr;
    let typePart = "string";
    let isOptional = false;

    if (pStr.includes(":")) {
      const colonIdx = pStr.indexOf(":");
      namePart = pStr.slice(0, colonIdx).trim();
      typePart = pStr.slice(colonIdx + 1).trim();
    } else if (pStr.includes("=")) {
      const eqIdx = pStr.indexOf("=");
      namePart = pStr.slice(0, eqIdx).trim();
      const val = pStr.slice(eqIdx + 1).trim();
      if (val === "true" || val === "false") {
        typePart = "boolean";
      } else if (!isNaN(Number(val)) && val !== "") {
        typePart = "number";
      } else {
        typePart = "string";
      }
      isOptional = true;
    }

    if (namePart.endsWith("?")) {
      isOptional = true;
      namePart = namePart.slice(0, -1).trim();
    }

    if (typePart.includes("=")) {
      typePart = typePart.slice(0, typePart.indexOf("=")).trim();
      isOptional = true;
    }

    return {
      name: namePart.replace(/[^a-zA-Z0-9_$]/g, "") || "param",
      type: typePart || "string",
      required: !isOptional,
    };
  });
}

/**
 * Extracts function parameters from a TypeScript signature string, e.g.:
 * `findAllConversationsByUser(createdBy: string, limit?: number, offset?: number): Promise<Conversations[]>`
 */
export function extractDbOperationParamsFromSignature(
  signature?: string,
): Array<{ name: string; type: string; required?: boolean }> {
  if (!signature) return [];
  const parenMatch = signature.match(/\((.*?)\)(?:\s*:\s*.+)?$/s);
  if (!parenMatch || parenMatch[1] === undefined) return [];
  const rawParams = parenMatch[1].trim();
  if (!rawParams) return [];

  // Parse comma-separated params, handling nested generics/types
  const paramList: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < rawParams.length; i++) {
    const char = rawParams[i];
    if (char === "<" || char === "{" || char === "(" || char === "[") depth++;
    else if (char === ">" || char === "}" || char === ")" || char === "]") depth--;

    if (char === "," && depth === 0) {
      if (current.trim()) paramList.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) paramList.push(current.trim());

  return paramList.map((pStr) => {
    let namePart = pStr.trim();
    let typePart = "string";
    let isOptional = false;

    if (namePart.includes(":")) {
      const colonIdx = namePart.indexOf(":");
      typePart = namePart.slice(colonIdx + 1).trim();
      namePart = namePart.slice(0, colonIdx).trim();
    } else if (namePart.includes("=")) {
      const eqIdx = namePart.indexOf("=");
      const val = namePart.slice(eqIdx + 1).trim();
      namePart = namePart.slice(0, eqIdx).trim();
      if (val === "true" || val === "false") {
        typePart = "boolean";
      } else if (!isNaN(Number(val)) && val !== "") {
        typePart = "number";
      } else {
        typePart = "string";
      }
      isOptional = true;
    }

    if (namePart.endsWith("?")) {
      isOptional = true;
      namePart = namePart.slice(0, -1).trim();
    }

    if (typePart.includes("=")) {
      typePart = typePart.slice(0, typePart.indexOf("=")).trim();
      isOptional = true;
    }

    return {
      name: namePart.replace(/[^a-zA-Z0-9_$]/g, "") || "param",
      type: typePart || "string",
      required: !isOptional,
    };
  });
}

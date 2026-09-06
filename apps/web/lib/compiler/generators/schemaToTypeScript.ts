import { parseSchemaJson } from "../utils";

export interface ParameterItem {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
  enumValues?: string[];
  isArray?: boolean;
}

export interface SchemaItem {
  rawJson?: string;
  fields?: ParameterItem[];
  id?: string;
  requestBodyMode?: "field_builder" | "raw_json";
  mode?: "field_builder" | "raw_json";
}

export function typeStrToTsAndZod(
  typeStr: string,
  enumValues?: string[],
): { ts: string; zod: string } {
  const raw = typeStr.trim();
  if (!raw) return { ts: "string", zod: "z.string()" };

  // Explicit enum values provided
  if (enumValues && enumValues.length > 0) {
    const isArr = raw.endsWith("[]");
    const tsUnion = enumValues.map((v) => JSON.stringify(v)).join(" | ");
    const zodEnum = `z.enum([${enumValues.map((v) => JSON.stringify(v)).join(", ")}])`;
    if (isArr) {
      return { ts: `(${tsUnion})[]`, zod: `z.array(${zodEnum})` };
    }
    return { ts: tsUnion, zod: zodEnum };
  }

  const isArr = raw.endsWith("[]");
  const base = isArr ? raw.slice(0, -2).trim() : raw;
  const t = base.toLowerCase();

  if (
    t === "string" ||
    t === "text" ||
    t === "uuid" ||
    t === "email"
  ) {
    return isArr
      ? { ts: "string[]", zod: "z.array(z.string())" }
      : { ts: "string", zod: "z.string()" };
  }

  if (t === "date" || t === "datetime") {
    return isArr
      ? { ts: "string[]", zod: "z.array(z.string())" }
      : { ts: "string", zod: "z.string()" };
  }

  if (
    t === "number" ||
    t === "int" ||
    t === "integer" ||
    t === "float" ||
    t === "double" ||
    t === "decimal" ||
    t === "real" ||
    t === "timestamp"
  ) {
    return isArr
      ? { ts: "number[]", zod: "z.array(z.number())" }
      : { ts: "number", zod: "z.number()" };
  }

  if (t === "boolean" || t === "bool") {
    return isArr
      ? { ts: "boolean[]", zod: "z.array(z.boolean())" }
      : { ts: "boolean", zod: "z.boolean()" };
  }

  if (t === "any") {
    return isArr
      ? { ts: "any[]", zod: "z.array(z.any())" }
      : { ts: "any", zod: "z.any()" };
  }

  if (t === "unknown") {
    return isArr
      ? { ts: "unknown[]", zod: "z.array(z.unknown())" }
      : { ts: "unknown", zod: "z.unknown()" };
  }

  if (t === "record<string, string>" || t === "record<string,string>") {
    return isArr
      ? { ts: "Record<string, string>[]", zod: "z.array(z.record(z.string()))" }
      : { ts: "Record<string, string>", zod: "z.record(z.string())" };
  }

  if (t === "object") {
    return isArr
      ? { ts: "Record<string, unknown>[]", zod: "z.array(z.record(z.unknown()))" }
      : { ts: "Record<string, unknown>", zod: "z.record(z.unknown())" };
  }

  if (t === "array") {
    return { ts: "unknown[]", zod: "z.array(z.unknown())" };
  }

  if (t === "enum") {
    return isArr
      ? { ts: "string[]", zod: "z.array(z.string())" }
      : { ts: "string", zod: "z.string()" };
  }

  // Handle generic array syntax e.g. array<string>
  if (t.startsWith("array<") && t.endsWith(">")) {
    const inner = t.slice(6, -1);
    const innerRes = typeStrToTsAndZod(inner);
    return { ts: `${innerRes.ts}[]`, zod: `z.array(${innerRes.zod})` };
  }

  // Custom / Package type: preserve original identifier casing if valid identifier
  const cleanIdentifier = base;
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(cleanIdentifier)) {
    if (isArr) {
      return {
        ts: `${cleanIdentifier}[]`,
        zod: `z.array(z.custom<${cleanIdentifier}>())`,
      };
    }

    return {
      ts: cleanIdentifier,
      zod: `z.custom<${cleanIdentifier}>()`,
    };
  }

  // Default fallback for any unrecognized non-identifier text
  return isArr
    ? { ts: "string[]", zod: "z.array(z.string())" }
    : { ts: "string", zod: "z.string()" };
}

function valToTsAndZod(
  val: unknown,
  depth = 1,
  indent = 2,
): { ts: string; zod: string } {
  if (val === null || val === undefined) {
    return { ts: "unknown", zod: "z.unknown()" };
  }
  if (typeof val === "string") {
    const t = val.trim().toLowerCase();
    const isExplicitType =
      t === "string" ||
      t === "text" ||
      t === "uuid" ||
      t === "email" ||
      t === "date" ||
      t === "datetime" ||
      t === "number" ||
      t === "int" ||
      t === "integer" ||
      t === "float" ||
      t === "double" ||
      t === "decimal" ||
      t === "real" ||
      t === "timestamp" ||
      t === "boolean" ||
      t === "bool" ||
      t === "any" ||
      t === "unknown" ||
      t === "record<string, string>" ||
      t === "record<string,string>" ||
      t === "object" ||
      t === "array" ||
      t === "enum" ||
      t.endsWith("[]") ||
      (t.startsWith("array<") && t.endsWith(">"));

    if (isExplicitType) {
      return typeStrToTsAndZod(val);
    }
    return { ts: "string", zod: "z.string()" };
  }
  if (typeof val === "number") {
    return { ts: "number", zod: "z.number()" };
  }
  if (typeof val === "boolean") {
    return { ts: "boolean", zod: "z.boolean()" };
  }
  if (Array.isArray(val)) {
    if (val.length === 0) {
      return { ts: "unknown[]", zod: "z.array(z.unknown())" };
    }
    const elem = valToTsAndZod(val[0], depth, indent);
    return { ts: `${elem.ts}[]`, zod: `z.array(${elem.zod})` };
  }
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return { ts: "Record<string, unknown>", zod: "z.record(z.unknown())" };
    }
    const currentIndent = " ".repeat(depth * indent);
    const prevIndent = " ".repeat((depth - 1) * indent);
    const tsFields: string[] = [];
    const zodFields: string[] = [];
    for (const key of keys) {
      const res = valToTsAndZod(obj[key], depth + 1, indent);
      const validKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
        ? key
        : JSON.stringify(key);
      tsFields.push(`${currentIndent}${validKey}: ${res.ts};`);
      zodFields.push(`${currentIndent}${validKey}: ${res.zod}`);
    }
    return {
      ts: `{\n${tsFields.join("\n")}\n${prevIndent}}`,
      zod: `z.object({\n${zodFields.join(",\n")}\n${prevIndent}})`,
    };
  }
  return { ts: "unknown", zod: "z.unknown()" };
}

export function parametersToTsInterface(
  interfaceName: string,
  params?: ParameterItem[],
  defaultRequired = true,
): { code: string; hasContent: boolean } {
  if (!params || params.length === 0) {
    return {
      code: `export type ${interfaceName} = Record<string, string>;\n`,
      hasContent: false,
    };
  }

  const lines: string[] = [];
  for (const p of params) {
    if (!p.name) continue;
    const req = p.required ?? defaultRequired;
    const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p.name)
      ? p.name
      : JSON.stringify(p.name);
    const typeRes = typeStrToTsAndZod(p.type || "string", p.enumValues);
    const optMark = req ? "" : "?";
    lines.push(`  ${key}${optMark}: ${typeRes.ts};`);
  }

  if (lines.length === 0) {
    return {
      code: `export type ${interfaceName} = Record<string, string>;\n`,
      hasContent: false,
    };
  }

  return {
    code: `export interface ${interfaceName} {\n${lines.join("\n")}\n}\n`,
    hasContent: true,
  };
}

export function parametersToZodSchema(
  schemaName: string,
  params?: ParameterItem[],
  defaultRequired = true,
): { code: string; hasContent: boolean } {
  if (!params || params.length === 0) {
    return {
      code: `export const ${schemaName} = z.record(z.string());\n`,
      hasContent: false,
    };
  }

  const lines: string[] = [];
  for (const p of params) {
    if (!p.name) continue;
    const req = p.required ?? defaultRequired;
    const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p.name)
      ? p.name
      : JSON.stringify(p.name);
    const typeRes = typeStrToTsAndZod(p.type || "string", p.enumValues);
    const zodType = req ? typeRes.zod : `${typeRes.zod}.optional()`;
    lines.push(`  ${key}: ${zodType}`);
  }

  if (lines.length === 0) {
    return {
      code: `export const ${schemaName} = z.record(z.string());\n`,
      hasContent: false,
    };
  }

  return {
    code: `export const ${schemaName} = z.object({\n${lines.join(",\n")}\n});\n`,
    hasContent: true,
  };
}

export function schemaToTsInterface(
  interfaceName: string,
  schema?: SchemaItem,
): { code: string; hasContent: boolean } {
  if (!schema) {
    return {
      code: `export type ${interfaceName} = Record<string, unknown>;\n`,
      hasContent: false,
    };
  }

  const effectiveMode = schema.requestBodyMode || schema.mode;

  if (effectiveMode === "field_builder" && schema.fields && schema.fields.length > 0) {
    return parametersToTsInterface(interfaceName, schema.fields, true);
  }

  const parsedJson = parseSchemaJson(schema.rawJson);
  if (parsedJson && typeof parsedJson === "object") {
    const res = valToTsAndZod(parsedJson, 1, 2);
    if (res.ts.startsWith("{")) {
      return {
        code: `export interface ${interfaceName} ${res.ts}\n`,
        hasContent: true,
      };
    }
    return {
      code: `export type ${interfaceName} = ${res.ts};\n`,
      hasContent: true,
    };
  }

  if (schema.fields && schema.fields.length > 0) {
    return parametersToTsInterface(interfaceName, schema.fields, true);
  }

  return {
    code: `export type ${interfaceName} = Record<string, unknown>;\n`,
    hasContent: false,
  };
}

export function schemaToZodSchema(
  schemaName: string,
  schema?: SchemaItem,
): { code: string; hasContent: boolean } {
  if (!schema) {
    return {
      code: `export const ${schemaName} = z.record(z.unknown());\n`,
      hasContent: false,
    };
  }

  const effectiveMode = schema.requestBodyMode || schema.mode;

  if (effectiveMode === "field_builder" && schema.fields && schema.fields.length > 0) {
    return parametersToZodSchema(schemaName, schema.fields, true);
  }

  const parsedJson = parseSchemaJson(schema.rawJson);
  if (parsedJson && typeof parsedJson === "object") {
    const res = valToTsAndZod(parsedJson, 1, 2);
    return {
      code: `export const ${schemaName} = ${res.zod};\n`,
      hasContent: true,
    };
  }

  if (schema.fields && schema.fields.length > 0) {
    return parametersToZodSchema(schemaName, schema.fields, true);
  }

  return {
    code: `export const ${schemaName} = z.record(z.unknown());\n`,
    hasContent: false,
  };
}

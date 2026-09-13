/**
 * Extracts template parameter names like `{id}` from a Redis key template
 */
export function extractTemplateParams(template: string): string[] {
  const matches = template.match(/\{([a-zA-Z0-9_]+)\}/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.slice(1, -1))));
}

/**
 * Maps column types to corresponding TypeScript types
 */
export function mapColumnTypeToTs(colType: string): string {
  const t = (colType || "").toUpperCase();
  if (
    t === "INTEGER" ||
    t === "INT" ||
    t === "REAL" ||
    t === "FLOAT" ||
    t === "NUMERIC" ||
    t === "NUMBER"
  ) {
    return "number";
  }
  if (t === "BOOLEAN" || t === "BOOL") {
    return "boolean";
  }
  if (t === "JSON" || t === "OBJECT") {
    return "Record<string, string | number | boolean | null>";
  }
  if (t === "ARRAY") {
    return "string[]";
  }
  return "string";
}

export interface GeneratedTypeInfo {
  interfacesCode: string;
  rootTypeName: string;
  itemTypeName?: string;
  isArray: boolean;
  topLevelFields: Array<{ name: string; type: string }>;
}

/**
 * Generates structured TypeScript interfaces from sample JSON data
 * Supports recursive objects and arrays of objects
 */
export function jsonToTypeScriptInterfaces(
  rootName: string,
  jsonSample: unknown,
): GeneratedTypeInfo {
  const cleanName = (rootName || "Data")
    .replace(/[^a-zA-Z0-9_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("") || "Data";

  const isArray = Array.isArray(jsonSample);
  const targetObj = isArray
    ? Array.isArray(jsonSample) &&
      jsonSample.length > 0 &&
      typeof jsonSample[0] === "object" &&
      jsonSample[0] !== null
      ? jsonSample[0]
      : {}
    : typeof jsonSample === "object" && jsonSample !== null
      ? jsonSample
      : {};

  const subInterfaces: string[] = [];
  const topLevelFields: Array<{ name: string; type: string }> = [];

  function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function inferType(val: unknown, propName: string): string {
    if (val === null || val === undefined) return "string | null";
    if (typeof val === "boolean") return "boolean";
    if (typeof val === "number") return "number";
    if (typeof val === "string") return "string";

    if (Array.isArray(val)) {
      if (val.length === 0) return "unknown[]";
      const first = val[0];
      if (typeof first === "object" && first !== null) {
        const itemTypeName = capitalize(propName) + "Item";
        buildInterface(itemTypeName, first as Record<string, unknown>);
        return `${itemTypeName}[]`;
      }
      return `${typeof first}[]`;
    }

    if (typeof val === "object") {
      const nestedTypeName = capitalize(propName);
      buildInterface(nestedTypeName, val as Record<string, unknown>);
      return nestedTypeName;
    }

    return "unknown";
  }

  function mapValToSqlType(val: unknown): string {
    if (typeof val === "number") return "INTEGER";
    if (typeof val === "boolean") return "BOOLEAN";
    if (typeof val === "object" && val !== null) return "JSON";
    return "TEXT";
  }

  function buildInterface(name: string, obj: Record<string, unknown>): void {
    const lines: string[] = [];
    for (const [key, val] of Object.entries(obj)) {
      const tsType = inferType(val, key);
      lines.push(`  ${key}: ${tsType};`);
    }
    const ifaceCode = `export interface ${name} {\n${lines.length > 0 ? lines.join("\n") : "  [key: string]: unknown;"}\n}`;
    if (!subInterfaces.some((i) => i.startsWith(`export interface ${name} `))) {
      subInterfaces.push(ifaceCode);
    }
  }

  const rootLines: string[] = [];
  if (typeof targetObj === "object" && targetObj !== null) {
    for (const [key, val] of Object.entries(
      targetObj as Record<string, unknown>,
    )) {
      const tsType = inferType(val, key);
      rootLines.push(`  ${key}: ${tsType};`);
      topLevelFields.push({ name: key, type: mapValToSqlType(val) });
    }
  }

  let fullCode = "";
  if (isArray) {
    const itemTypeName = `${cleanName}Item`;
    const itemInterface = `export interface ${itemTypeName} {\n${rootLines.length > 0 ? rootLines.join("\n") : "  [key: string]: unknown;"}\n}`;
    const allInterfaces = [...subInterfaces, itemInterface];
    fullCode = `${allInterfaces.join("\n\n")}\n\nexport type ${cleanName} = ${itemTypeName}[];`;
    return {
      interfacesCode: fullCode,
      rootTypeName: cleanName,
      itemTypeName,
      isArray: true,
      topLevelFields,
    };
  } else {
    const rootInterface = `export interface ${cleanName} {\n${rootLines.length > 0 ? rootLines.join("\n") : "  [key: string]: unknown;"}\n}`;
    const allInterfaces = [...subInterfaces, rootInterface];
    fullCode = allInterfaces.join("\n\n");
    return {
      interfacesCode: fullCode,
      rootTypeName: cleanName,
      isArray: false,
      topLevelFields,
    };
  }
}

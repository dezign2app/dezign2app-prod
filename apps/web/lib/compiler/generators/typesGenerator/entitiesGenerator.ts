import { BackendNode } from "@/types/canvas";
import {
  toPascalCase,
  toSingular,
  toPlural,
} from "../../utils";

export function generateEntitiesModule(
  nodes: BackendNode[],
  referencedEntityNames?: Set<string>,
  customTypeNames?: Set<string>,
  exportedNamesOut?: Set<string>,
): string {
  let code = `/**\n * Shared Data Models & Schemas\n */\n\n`;
  const seenNames = new Set<string>();

  function renderEntityInterface(
    pascal: string,
    rawName: string,
    cols: Array<{
      name?: string;
      type?: string;
      isPrimaryKey?: boolean;
      isPrimary?: boolean;
      primaryKey?: boolean;
      isNotNull?: boolean;
      required?: boolean;
    }>,
    isJsonArray = false,
  ) {
    const singularPascal = toPascalCase(toSingular(rawName));
    const pluralPascal = toPascalCase(toPlural(rawName));
    const itemType = isJsonArray ? `${pascal}Item` : pascal;

    if (isJsonArray) {
      seenNames.add(itemType);
    }

    if (!cols || cols.length === 0) {
      if (isJsonArray) {
        code += `export interface ${itemType} {\n  id: string;\n}\n\nexport type ${pascal} = ${itemType};\n`;
      } else {
        code += `export interface ${pascal} {\n  id: string;\n}\n`;
      }
    } else {
      const fieldLines = cols.map((col) => {
        const fieldName = col.name || "field";
        const isReq =
          col.isPrimaryKey ||
          col.isPrimary ||
          col.primaryKey ||
          col.isNotNull ||
          col.required;
        let tsType = "string";
        switch (col.type?.toLowerCase()) {
          case "integer":
          case "int":
          case "number":
          case "float":
          case "double":
          case "real":
            tsType = "number";
            break;
          case "boolean":
          case "bool":
            tsType = "boolean";
            break;
          case "json":
          case "object":
            tsType = "Record<string, string | number | boolean | null>";
            break;
          default:
            tsType = "string";
        }
        return `  ${fieldName}${isReq ? "" : "?"}: ${tsType};`;
      });

      if (isJsonArray) {
        code += `export interface ${itemType} {\n${fieldLines.join("\n")}\n}\n\nexport type ${pascal} = ${itemType};\n`;
      } else {
        code += `export interface ${pascal} {\n${fieldLines.join("\n")}\n}\n`;
      }
    }

    // Generate dual singular/plural type aliases so both "Product" and "Products" work seamlessly,
    // but avoid colliding with explicit user-defined custom types
    if (
      singularPascal &&
      singularPascal !== pascal &&
      !seenNames.has(singularPascal) &&
      !customTypeNames?.has(singularPascal)
    ) {
      seenNames.add(singularPascal);
      code += `export type ${singularPascal} = ${pascal};\n`;
      if (
        isJsonArray &&
        !seenNames.has(`${singularPascal}Item`) &&
        !customTypeNames?.has(`${singularPascal}Item`)
      ) {
        seenNames.add(`${singularPascal}Item`);
        code += `export type ${singularPascal}Item = ${itemType};\n`;
      }
    }
    if (
      pluralPascal &&
      pluralPascal !== pascal &&
      !seenNames.has(pluralPascal) &&
      !customTypeNames?.has(pluralPascal)
    ) {
      seenNames.add(pluralPascal);
      code += `export type ${pluralPascal} = ${pascal};\n`;
    }
    code += `\n`;
  }

  // 1. Relational Entity and DB Ref nodes (Primary persisted domain models)
  const dbEntityNodes = nodes.filter(
    (n) => n.type === "entity" || n.type === "db_ref",
  );

  dbEntityNodes.forEach((node) => {
    const rawName = node.data?.label || node.data?.tableRef || "Entity";
    const pascal = toPascalCase(rawName);
    if (!pascal || seenNames.has(pascal)) return;
    seenNames.add(pascal);

    const cols = node.data?.columns || [];
    renderEntityInterface(pascal, rawName, cols, false);
  });

  // 2. Database nodes with embedded tables
  const dbNodes = nodes.filter((n) => n.type === "database");

  dbNodes.forEach((dbNode) => {
    const tables = dbNode.data?.tables || [];
    tables.forEach((tbl) => {
      const rawName = tbl.name || tbl.label || tbl.tableRef || "Entity";
      const pascal = toPascalCase(rawName);
      if (!pascal || seenNames.has(pascal)) return;
      seenNames.add(pascal);

      const cols = tbl.columns || tbl.fields || [];
      renderEntityInterface(pascal, rawName, cols, false);
    });
  });

  // 3. Redis schema and cache nodes (Secondary cache structures)
  const redisNodes = nodes.filter(
    (n) => n.type === "redis_schema" || n.type === "redis-cache",
  );

  redisNodes.forEach((node) => {
    const rawName = node.data?.label || node.data?.tableRef || "Entity";
    const pascal = toPascalCase(rawName);
    const singularPascal = toPascalCase(toSingular(rawName));
    const pluralPascal = toPascalCase(toPlural(rawName));
    const isJsonArray = node.data?.jsonRootType === "array";
    const itemType = isJsonArray ? `${singularPascal || pascal}Item` : pascal;

    // If an entity with this name was already defined by a relational DB table, don't overwrite it
    if (seenNames.has(pascal) || seenNames.has(singularPascal) || seenNames.has(pluralPascal)) {
      if (isJsonArray && !seenNames.has(itemType)) {
        seenNames.add(itemType);
        code += `export type ${itemType} = ${singularPascal || pascal};\n\n`;
      }
      return;
    }

    seenNames.add(pascal);
    const cols = node.data?.columns || [];
    renderEntityInterface(pascal, rawName, cols, isJsonArray);
  });

  // 3. Fallback for any entities referenced by endpoints (e.g. Products, Users)
  if (referencedEntityNames) {
    referencedEntityNames.forEach((entName) => {
      const pascal = toPascalCase(entName);
      if (pascal && !seenNames.has(pascal)) {
        seenNames.add(pascal);
        renderEntityInterface(pascal, entName, []);
      }
    });
  }

  if (seenNames.size === 0) {
    code += `export type GenericEntity = Record<string, string | number | boolean | null>;\n`;
  }

  if (exportedNamesOut) {
    seenNames.forEach((n) => exportedNamesOut.add(n));
  }

  return code;
}

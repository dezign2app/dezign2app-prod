import { BackendNode } from "@/types/canvas";
import { CompiledFile } from "@workspace/canvas/types";

export function sanitizeCustomTypeString(rawType: string): string {
  const trimmed = (rawType || "string").trim();
  if (!trimmed || trimmed === "any" || trimmed === "unknown") {
    return "string";
  }
  // Guard against truncated type strings ending with ellipsis (e.g. "conn..." or "string | ...")
  if (/\.\.\.\s*$/.test(trimmed) || trimmed.endsWith("...")) {
    if (trimmed.startsWith("(") || trimmed.includes("=>")) {
      return "(...args: any[]) => any";
    }
    return "any";
  }
  return trimmed;
}

export function formatFieldType(rawType: string, isArray?: boolean): string {
  const isArr = Boolean(isArray || rawType?.endsWith("[]"));
  const base = sanitizeCustomTypeString((rawType || "string").replace(/\[\]$/, ""));
  if (!isArr) return base;
  const needsParens = (base.includes("|") || base.includes("&")) && !base.startsWith("(");
  return needsParens ? `(${base})[]` : `${base}[]`;
}

export interface CustomTypesModuleResult {
  file?: CompiledFile;
  exportStatement?: string;
  exportedTypes: Set<string>;
  exportedValues: Set<string>;
}

export function generateCustomTypesModule(
  nodes: BackendNode[],
): CustomTypesModuleResult {
  const exportedTypes = new Set<string>();
  const exportedValues = new Set<string>();

  const typesNodes = nodes.filter((n) => n.type === "types");
  if (typesNodes.length === 0) {
    return { exportedTypes, exportedValues };
  }

  let customTypesCode = `// @ts-nocheck
/* eslint-disable */
/**
 * Custom Reusable Types & Domain Models
 * Defined via Architecture Canvas Types Nodes
 */

`;

  typesNodes.forEach((tNode) => {
    const isEntityDerivedNode = Boolean(
      tNode.data?.isEntitySchemas ||
      tNode.id === "types-entity-schemas" ||
      tNode.data?.label === "Entity Types" ||
      tNode.data?.sourceEntityId,
    );

    const isServiceDerivedNode = Boolean(
      tNode.data?.isServiceEndpointSchemas ||
      tNode.id.startsWith("types-service-") ||
      tNode.data?.sourceServiceId,
    );

    const nodeLabel = tNode.data?.label || "Custom Types";
    const isRaw = tNode.data?.definitionMode === "raw";
    const rawCode = tNode.data?.rawTypeScript;
    let typesList = tNode.data?.types || [];

    // Filter out auto-derived entity schemas from custom.ts since src/entities/index.ts already exports them
    if (isEntityDerivedNode) {
      typesList = typesList.filter(
        (item) =>
          !item.id?.startsWith("type-entity-") &&
          !item.description?.startsWith("Auto-generated TypeScript interface from"),
      );
    }

    // Filter out auto-derived endpoint schemas from custom.ts since service route generator already exports them
    if (isServiceDerivedNode) {
      typesList = typesList.filter(
        (item) =>
          !item.id?.startsWith("type-endpoint-") &&
          !item.description?.includes("Success response (200 OK)") &&
          !item.description?.includes("Request payload for") &&
          !item.description?.includes("Error response for"),
      );
    }

    if (typesList.length === 0 && (!isRaw || !rawCode)) {
      return;
    }

    customTypesCode += `// ─── ${nodeLabel} ───────────────────────────────────────────\n`;

    if (isRaw && rawCode) {
      customTypesCode += `${rawCode.trim()}\n\n`;
      // Extract exported type / interface names from raw TypeScript
      const typeMatches = rawCode.matchAll(/export\s+(?:type|interface)\s+([A-Za-z0-9_]+)/g);
      for (const m of typeMatches) {
        if (m[1]) exportedTypes.add(m[1].trim());
      }
      // Extract exported enum / const / function / class names from raw TypeScript
      const valMatches = rawCode.matchAll(/export\s+(?:enum|const|function|class)\s+([A-Za-z0-9_]+)/g);
      for (const m of valMatches) {
        if (m[1]) exportedValues.add(m[1].trim());
      }
    } else if (typesList.length > 0) {
      typesList.forEach((item) => {
        const itemName = item.name?.trim() || "CustomType";
        if (item.kind === "enum") {
          exportedValues.add(itemName);
        } else {
          exportedTypes.add(itemName);
        }

        if (item.description) {
          customTypesCode += `/**\n * ${item.description}\n */\n`;
        }

        // ── Extended type: emit proper extends / intersection syntax ──────────
        if (item.extendedFrom) {
          const baseName = item.extendedFrom;
          const allFields = item.fields || [];
          const addedFields = allFields.filter((f) => !f.isInherited);
          type FieldWithOmit = { name: string; isInherited?: boolean; isOmitted?: boolean };
          const inheritedFields = allFields.filter((f) => f.isInherited) as FieldWithOmit[];
          const omittedFields = inheritedFields.filter((f) => f.isOmitted);

          const bodyLines = addedFields.map((f) => {
            const finalType = formatFieldType(f.type, f.isArray);
            return `  ${f.name}${f.required === false ? "?" : ""}: ${finalType};`;
          });

          let baseRef: string;
          if (omittedFields.length > 0) {
            const omitUnion = omittedFields.map((f) => `"${f.name}"`).join(" | ");
            baseRef = `Omit<${baseName}, ${omitUnion}>`;
          } else {
            baseRef = baseName;
          }

          const bodyStr = bodyLines.length > 0 ? `\n${bodyLines.join("\n")}\n` : "";

          if (item.kind === "type") {
            if (bodyLines.length === 0) {
              customTypesCode += `export type ${itemName} = ${baseRef};\n\n`;
            } else {
              customTypesCode += `export type ${itemName} = ${baseRef} & {${bodyStr}};\n\n`;
            }
          } else {
            if (bodyLines.length === 0) {
              customTypesCode += `export interface ${itemName} extends ${baseRef} {}\n\n`;
            } else {
              customTypesCode += `export interface ${itemName} extends ${baseRef} {${bodyStr}}\n\n`;
            }
          }
          return;
        }

        if (item.kind === "enum") {
          const vals = item.enumValues || [];
          if (vals.length > 0) {
            const enumLines = vals.map((v) => `  ${v} = "${v}",`).join("\n");
            customTypesCode += `export enum ${itemName} {\n${enumLines}\n}\n\n`;
          } else {
            customTypesCode += `export enum ${itemName} {}\n\n`;
          }
        } else if (item.kind === "type") {
          if (item.typeAliasValue !== undefined) {
            const cleanAlias = sanitizeCustomTypeString(item.typeAliasValue);
            customTypesCode += `export type ${itemName} = ${cleanAlias};\n\n`;
          } else {
            const fields = item.fields || [];
            const allUnnamed = fields.length > 0 && fields.every((f) => !f.name || !f.name.trim());
            if (allUnnamed) {
              const parts = fields.map((f) => formatFieldType(f.type, f.isArray));
              customTypesCode += `export type ${itemName} = ${parts.join(" | ")};\n\n`;
            } else {
              const fieldLines = fields
                .map((f) => {
                  const finalType = formatFieldType(f.type, f.isArray);
                  return `  ${f.name}${f.required === false ? "?" : ""}: ${finalType};`;
                })
                .join("\n");
              customTypesCode += `export type ${itemName} = {\n${fieldLines}\n};\n\n`;
            }
          }
        } else if (item.kind === "function") {
          const params = (item.fields || [])
            .map((f) => {
              const finalType = formatFieldType(f.type, f.isArray);
              const opt = f.required === false ? "?" : "";
              return `${f.name || "arg"}${opt}: ${finalType}`;
            })
            .join(", ");
          const ret = sanitizeCustomTypeString(item.returnType || item.typeAliasValue || "void");
          customTypesCode += `export type ${itemName} = (${params}) => ${ret};\n\n`;
        } else {
          // interface
          const fields = item.fields || [];
          if (fields.length === 0) {
            customTypesCode += `export interface ${itemName} {\n  id: string;\n}\n\n`;
          } else {
            const fieldLines = fields
              .map((f) => {
                const finalType = formatFieldType(f.type, f.isArray);
                return `  ${f.name}${f.required === false ? "?" : ""}: ${finalType};`;
              })
              .join("\n");
            customTypesCode += `export interface ${itemName} {\n${fieldLines}\n}\n\n`;
          }
        }
      });
    }
  });

  if (exportedTypes.size === 0 && exportedValues.size === 0) {
    return { exportedTypes, exportedValues };
  }

  return {
    file: {
      filename: "src/custom.ts",
      language: "typescript",
      content: customTypesCode,
    },
    exportStatement: `export * from "./custom";`,
    exportedTypes,
    exportedValues,
  };
}

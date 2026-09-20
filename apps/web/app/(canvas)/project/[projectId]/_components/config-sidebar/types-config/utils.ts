import type { CustomTypeItem } from "@workspace/canvas/types";

/**
 * Generates formatted TypeScript preview code for a given CustomTypeItem.
 */
export function generateTypePreviewCode(currentType: CustomTypeItem): string {
  const desc = currentType.description
    ? `/**\n * ${currentType.description}\n */\n`
    : "";

  if (currentType.kind === "enum") {
    const vals = currentType.enumValues || [];
    if (vals.length === 0) return `${desc}export enum ${currentType.name} {}\n`;
    const lines = vals.map((v) => `  ${v} = "${v}",`).join("\n");
    return `${desc}export enum ${currentType.name} {\n${lines}\n}\n`;
  }

  if (currentType.kind === "function") {
    const params = (currentType.fields || [])
      .map((f) => {
        const isArr = Boolean(f.isArray || f.type?.endsWith("[]"));
        const base = (f.type || "unknown").replace(/\[\]$/, "");
        const finalType = isArr ? `${base}[]` : base;
        const opt = f.required === false ? "?" : "";
        const comment = f.description ? ` /* ${f.description} */` : "";
        return `${f.name || "arg"}${opt}: ${finalType}${comment}`;
      })
      .join(", ");
    const ret = currentType.returnType || currentType.typeAliasValue || "void";
    return `${desc}export type ${currentType.name} = (${params}) => ${ret};\n`;
  }

  // For read-only package types: rawCode is the source of truth — show it as-is
  if (currentType.isReadOnly && currentType.rawCode) {
    return currentType.rawCode.trim() + "\n";
  }

  // For alias types with no parsed fields but a typeAliasValue
  if (
    currentType.kind === "type" &&
    (!currentType.fields || currentType.fields.length === 0) &&
    currentType.typeAliasValue
  ) {
    return `${desc}export type ${currentType.name} = ${currentType.typeAliasValue};\n`;
  }

  const fields = currentType.fields || [];
  const fieldLines = fields
    .map((f) => {
      const isArr = Boolean(f.isArray || f.type?.endsWith("[]"));
      const base = (f.type || "string").replace(/\[\]$/, "");
      let finalType: string;
      if (base === "enum") {
        const vals =
          f.enumValues && f.enumValues.length > 0
            ? f.enumValues.map((v) => `"${v}"`).join(" | ")
            : `"value1" | "value2"`;
        finalType = isArr ? `(${vals})[]` : vals;
      } else {
        finalType = isArr ? `${base}[]` : base;
      }
      const opt = f.required === false ? "?" : "";
      const comment = f.description ? ` // ${f.description}` : "";
      return `  ${f.name || "prop"}${opt}: ${finalType};${comment}`;
    })
    .join("\n");

  if (currentType.kind === "type") {
    return `${desc}export type ${currentType.name} = {\n${fieldLines}\n};\n`;
  }

  return `${desc}export interface ${currentType.name} {\n${fieldLines}\n}\n`;
}

import type { CustomTypeItem, CustomTypeField } from "@workspace/canvas/types";

/** Renders one field line for an interface/type body. */
function renderFieldLine(f: CustomTypeField): string {
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
}

/**
 * Generates formatted TypeScript preview code for a given CustomTypeItem.
 *
 * Extended types (extendedFrom is set) produce proper extension syntax:
 *   - interface → `export interface Foo extends Base { ...newFields }`
 *   - type      → `export type Foo = Base & { ...newFields }`
 *
 * If every inherited field was removed (user pruned the base), it renders:
 *   - `export interface Foo extends Omit<Base, 'a' | 'b'> { ...newFields }`
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
        const base = (f.type || "string").replace(/\[\]$/, "");
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

  const allFields = currentType.fields || [];

  // ── Extended type: emit proper extends / intersection syntax ──────────────
  if (currentType.extendedFrom) {
    const baseName = currentType.extendedFrom;

    // Fields the user added on top of the base (not inherited)
    const addedFields = allFields.filter((f) => !f.isInherited);

    // Inherited fields: split into kept vs omitted
    type FieldWithOmit = CustomTypeField & { isOmitted?: boolean };
    const inheritedFields = allFields.filter((f) => f.isInherited) as FieldWithOmit[];
    const omittedFields = inheritedFields.filter((f) => f.isOmitted);

    // Build the body from new/custom fields only
    const bodyLines = addedFields.map(renderFieldLine);

    // Build baseRef — apply Omit<> for omitted inherited fields
    let baseRef: string;
    if (omittedFields.length > 0) {
      const omitUnion = omittedFields.map((f) => `"${f.name}"`).join(" | ");
      baseRef = `Omit<${baseName}, ${omitUnion}>`;
    } else {
      baseRef = baseName;
    }

    const bodyStr = bodyLines.length > 0 ? `\n${bodyLines.join("\n")}\n` : "";

    if (currentType.kind === "type") {
      if (bodyLines.length === 0) {
        return `${desc}export type ${currentType.name} = ${baseRef};\n`;
      }
      return `${desc}export type ${currentType.name} = ${baseRef} & {${bodyStr}};\n`;
    }

    // interface — use extends
    if (bodyLines.length === 0) {
      return `${desc}export interface ${currentType.name} extends ${baseRef} {}\n`;
    }
    return `${desc}export interface ${currentType.name} extends ${baseRef} {${bodyStr}}\n`;
  }

  // ── Regular (non-extended) type ───────────────────────────────────────────
  const fieldLines = allFields.map(renderFieldLine).join("\n");

  if (currentType.kind === "type") {
    return `${desc}export type ${currentType.name} = {\n${fieldLines}\n};\n`;
  }

  return `${desc}export interface ${currentType.name} {\n${fieldLines}\n}\n`;
}

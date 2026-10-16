export interface TransformerSchemaFieldLike {
  name: string;
  type?: string;
  required?: boolean;
}

export interface GenerateTransformerCodeOptions {
  functionName?: string;
  inputSchema?: TransformerSchemaFieldLike[];
  returnSchema?: TransformerSchemaFieldLike[];
  outputTypeName?: string;
  prompt?: string;
}

/**
 * Validates if a string is a valid JavaScript identifier.
 */
function isValidIdentifier(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

/**
 * Generates default, clean, and typed TypeScript function body code for a transformer node.
 * Strictly aligns with the function definition:
 *   export function <functionName>( { <param1>, <param2> }: <InputType> ): <OutputType>
 */
export function generateDefaultTransformerCode(
  options: GenerateTransformerCodeOptions = {},
): string {
  const {
    inputSchema = [],
    returnSchema = [],
    outputTypeName = "TransformerOutput",
    prompt,
  } = options;

  const inputFields = inputSchema
    .map((f) => f.name?.trim() || "")
    .filter(isValidIdentifier);

  const returnFields = returnSchema
    .map((f) => f.name?.trim() || "")
    .filter(isValidIdentifier);

  const comment =
    prompt && prompt.trim()
      ? `// Specification: ${prompt.trim().split("\n").join("\n// ")}`
      : `// Transform input parameters to match ${outputTypeName}`;

  // If return fields are explicitly declared in returnSchema, produce matching return entries
  if (returnFields.length > 0) {
    const returnLines = returnFields.map((field) => {
      if (inputFields.includes(field)) {
        return `  ${field},`;
      }
      const mappedVal = inputFields.length > 0 ? inputFields[0] : `"transformed"`;
      return `  ${field}: ${mappedVal},`;
    });
    return `${comment}\nreturn {\n${returnLines.join("\n")}\n};\n`;
  }

  // If input fields exist, return { result: firstField }
  if (inputFields.length > 0) {
    const firstField = inputFields[0];
    return `${comment}\nreturn {\n  result: ${firstField},\n};\n`;
  }

  // Fallback when no input schema fields are defined
  return `${comment}\nreturn {\n  result: "transformed",\n};\n`;
}

/**
 * Checks whether code is undefined, empty, or uses the legacy flawed template
 * that referenced `...inputs` or `(inputs, state, clone) => any`.
 */
export function isLegacyOrEmptyTransformerCode(
  code: string | null | undefined,
): boolean {
  if (!code || !code.trim()) {
    return true;
  }
  const trimmed = code.trim();
  if (trimmed.includes("(inputs, state, clone) => any")) {
    return true;
  }
  if (/return\s*\{\s*\.\.\.inputs\s*\};?/m.test(trimmed)) {
    return true;
  }
  if (trimmed.includes("...inputs")) {
    return true;
  }
  return false;
}

/**
 * Checks whether code is still an unedited starter template (either empty, legacy, or default).
 * Used when inputSchema changes to automatically adapt the starter return to the new fields
 * without overriding user's custom logic.
 */
export function isDefaultStarterTransformerCode(
  code: string | null | undefined,
): boolean {
  if (isLegacyOrEmptyTransformerCode(code)) {
    return true;
  }
  if (!code) {
    return true;
  }
  const trimmed = code.trim();
  const hasDefaultComment =
    trimmed.includes("// Transform input parameters to match") ||
    trimmed.includes("// Specification:");
  const isSimpleResultReturn =
    /^(\/\/[^\n]*\n\s*)*return\s*\{\s*result:\s*[^,}]+,?\s*\}\s*;?$/m.test(
      trimmed,
    );
  return hasDefaultComment && isSimpleResultReturn;
}

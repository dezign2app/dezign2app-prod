import type { SchemaFieldInput, InferredFieldDraft } from "./types";
import { inferTypeFromExpression } from "./typeInference";

/**
 * Parses an object literal string (e.g. `{ key: conversation_id, value: { message, sender } }`)
 * into a list of inferred field drafts.
 */
export function parseObjectLiteral(
  objStr: string,
  inputSchema?: SchemaFieldInput[],
): InferredFieldDraft[] {
  let content = objStr.trim();
  // Strip outer parentheses if any: ({ ... })
  if (content.startsWith("(") && content.endsWith(")")) {
    content = content.slice(1, -1).trim();
  }
  // Must start with { and end with }
  if (!content.startsWith("{") || !content.endsWith("}")) {
    return [];
  }

  const inner = content.slice(1, -1).trim();
  if (!inner) return [];

  const fields: InferredFieldDraft[] = [];
  let i = 0;
  const len = inner.length;

  let currentEntry = "";
  let bDepth = 0;
  let pDepth = 0;
  let aDepth = 0;
  let inQuote: string | null = null;

  const entries: string[] = [];

  while (i < len) {
    const ch = inner[i];

    if (inQuote) {
      currentEntry += ch;
      if (ch === "\\") {
        i++;
        if (i < len) currentEntry += inner[i];
      } else if (ch === inQuote) {
        inQuote = null;
      }
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inQuote = ch;
      currentEntry += ch;
      i++;
      continue;
    }

    if (ch === "{") bDepth++;
    else if (ch === "}") bDepth--;
    else if (ch === "(") pDepth++;
    else if (ch === ")") pDepth--;
    else if (ch === "[") aDepth++;
    else if (ch === "]") aDepth--;

    if (ch === "," && bDepth === 0 && pDepth === 0 && aDepth === 0) {
      if (currentEntry.trim()) {
        entries.push(currentEntry.trim());
      }
      currentEntry = "";
      i++;
      continue;
    }

    currentEntry += ch;
    i++;
  }

  if (currentEntry.trim()) {
    entries.push(currentEntry.trim());
  }

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    // Handle spread operator: `...input`
    if (trimmed.startsWith("...")) {
      const spreadTarget = trimmed.slice(3).trim();
      if ((spreadTarget === "input" || spreadTarget.startsWith("input.")) && inputSchema) {
        for (const inputParam of inputSchema) {
          fields.push({
            name: inputParam.name,
            type: inputParam.type || "string",
            isArray: inputParam.isArray,
            required: inputParam.required,
          });
        }
      }
      continue;
    }

    // Split at the first colon `:` (which is not inside quotes or brackets)
    let colonIdx = -1;
    let bD = 0, pD = 0, aD = 0, q: string | null = null;
    for (let cIdx = 0; cIdx < trimmed.length; cIdx++) {
      const c = trimmed[cIdx];
      if (q) {
        if (c === "\\") cIdx++;
        else if (c === q) q = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        q = c;
        continue;
      }
      if (c === "{") bD++;
      else if (c === "}") bD--;
      else if (c === "(") pD++;
      else if (c === ")") pD--;
      else if (c === "[") aD++;
      else if (c === "]") aD--;
      else if (c === ":" && bD === 0 && pD === 0 && aD === 0) {
        colonIdx = cIdx;
        break;
      }
    }

    if (colonIdx !== -1) {
      let rawKey = trimmed.slice(0, colonIdx).trim();
      const valExpr = trimmed.slice(colonIdx + 1).trim();

      // Clean quotes from key e.g. "key" or 'key'
      if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
        rawKey = rawKey.slice(1, -1);
      }

      if (rawKey) {
        const { type, isArray } = inferTypeFromExpression(valExpr, rawKey, inputSchema);
        let nestedFields: InferredFieldDraft[] | undefined;

        const cleanVal = valExpr.trim();
        if (cleanVal.startsWith("{") && cleanVal.endsWith("}")) {
          const parsed = parseObjectLiteral(cleanVal, inputSchema);
          if (parsed.length > 0) {
            nestedFields = parsed;
          }
        } else if (cleanVal.startsWith("[") && cleanVal.endsWith("]")) {
          const innerArr = cleanVal.slice(1, -1).trim();
          if (innerArr.startsWith("{") && innerArr.endsWith("}")) {
            const parsed = parseObjectLiteral(innerArr, inputSchema);
            if (parsed.length > 0) {
              nestedFields = parsed;
            }
          }
        }

        fields.push({
          name: rawKey,
          type,
          isArray,
          required: true,
          nestedFields,
        });
      }
    } else {
      // Shorthand property: e.g. `conversation_id` or `message`
      let rawKey = trimmed;
      if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
        rawKey = rawKey.slice(1, -1);
      }
      if (/^[a-zA-Z0-9_$]+$/.test(rawKey)) {
        const { type, isArray } = inferTypeFromExpression(rawKey, rawKey, inputSchema);
        fields.push({
          name: rawKey,
          type,
          isArray,
          required: true,
        });
      }
    }
  }

  return fields;
}

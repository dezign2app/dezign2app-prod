/**
 * Strips single-line and multi-line comments from JavaScript/TypeScript code
 * while preserving string and template literals.
 */
export function stripComments(code: string): string {
  let result = "";
  let i = 0;
  const len = code.length;

  while (i < len) {
    const ch = code[i];
    const next = code[i + 1];

    // Check string literals
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      result += ch;
      i++;
      while (i < len) {
        const cur = code[i];
        result += cur;
        if (cur === "\\") {
          i++;
          if (i < len) result += code[i];
        } else if (cur === quote) {
          break;
        } else if (quote === "`" && cur === "$" && code[i + 1] === "{") {
          // Inside template literal expression
          result += code[i + 1];
          i += 2;
          let braceCount = 1;
          while (i < len && braceCount > 0) {
            const b = code[i];
            result += b;
            if (b === "{") braceCount++;
            else if (b === "}") braceCount--;
            i++;
          }
          continue;
        }
        i++;
      }
      i++;
      continue;
    }

    // Single-line comment
    if (ch === "/" && next === "/") {
      i += 2;
      while (i < len && code[i] !== "\n") {
        i++;
      }
      continue;
    }

    // Multi-line comment
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < len && !(code[i] === "*" && code[i + 1] === "/")) {
        i++;
      }
      i += 2;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

/**
 * Finds the index of the matching closing bracket/brace/paren.
 */
export function findMatchingBracket(
  str: string,
  startIndex: number,
  openChar: string,
  closeChar: string,
): number {
  let depth = 0;
  let inString: string | null = null;

  for (let i = startIndex; i < str.length; i++) {
    const ch = str[i];

    if (inString) {
      if (ch === "\\") {
        i++; // skip escaped char
      } else if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }

    if (ch === openChar) {
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

/**
 * Unwraps outer function declaration if present (e.g. export [async] function name(...) { body }).
 */
export function unwrapFunctionBody(cleanCode: string): string {
  const trimmed = cleanCode.trim();
  const fnMatch = trimmed.match(
    /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*[\w$]*\s*\([^)]*\)\s*(?::\s*[^{]+)?\{([\s\S]*)\}\s*$/,
  );
  if (fnMatch && fnMatch[1] !== undefined) {
    return fnMatch[1];
  }
  return cleanCode;
}

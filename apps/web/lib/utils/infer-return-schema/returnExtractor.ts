import type { SchemaFieldInput, InferredFieldDraft } from "./types";
import { findMatchingBracket, unwrapFunctionBody } from "./sanitizer";
import { parseObjectLiteral } from "./objectParser";

/**
 * Extracts raw return expression strings from the top-level scope of the code.
 * Ignores return statements inside nested functions or arrow callbacks.
 */
export function extractTopLevelReturns(cleanCode: string): string[] {
  const body = unwrapFunctionBody(cleanCode);
  const returns: string[] = [];
  const len = body.length;

  let i = 0;
  let braceDepth = 0;
  let subFunctionBraceDepth = -1; // -1 means not inside an inner sub-function

  while (i < len) {
    const ch = body[i];

    // Track string literals to avoid miscounting braces
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < len) {
        if (body[i] === "\\") {
          i += 2;
          continue;
        }
        if (body[i] === quote) break;
        i++;
      }
      i++;
      continue;
    }

    // Check for arrow function `=>` or inner `function` keyword
    if (
      (ch === "=" && body[i + 1] === ">") ||
      (body.slice(i, i + 8).match(/\bfunction\b/))
    ) {
      // Find the next opening brace '{'
      let lookAhead = i;
      while (
        lookAhead < len &&
        body[lookAhead] !== "{" &&
        body[lookAhead] !== ";" &&
        body[lookAhead] !== "\n"
      ) {
        lookAhead++;
      }
      if (body[lookAhead] === "{" && subFunctionBraceDepth === -1) {
        subFunctionBraceDepth = braceDepth + 1;
      }
    }

    if (ch === "{") {
      braceDepth++;
      i++;
      continue;
    }

    if (ch === "}") {
      if (subFunctionBraceDepth === braceDepth) {
        subFunctionBraceDepth = -1;
      }
      braceDepth--;
      i++;
      continue;
    }

    // Match word boundary for "return"
    if (
      subFunctionBraceDepth === -1 &&
      body.slice(i, i + 6) === "return" &&
      (i === 0 || /[\s;{}()]/.test(body[i - 1] ?? "")) &&
      (i + 6 >= len || /[\s;{}()]/.test(body[i + 6] ?? ""))
    ) {
      let start = i + 6;
      while (start < len && /\s/.test(body[start] ?? "")) {
        start++;
      }

      if (start >= len || body[start] === ";" || body[start] === "}") {
        // Bare return (e.g. return;)
        returns.push("");
        i = start;
        continue;
      }

      // Check what kind of expression follows return
      if (body[start] === "{") {
        const closeIdx = findMatchingBracket(body, start, "{", "}");
        if (closeIdx !== -1) {
          returns.push(body.slice(start, closeIdx + 1).trim());
          let next = closeIdx + 1;
          while (next < len && (body[next] === ";" || /\s/.test(body[next] ?? ""))) {
            if (body[next] === "\n") {
              next++;
              break;
            }
            next++;
          }
          i = next;
          continue;
        }
      } else if (body[start] === "[") {
        const closeIdx = findMatchingBracket(body, start, "[", "]");
        if (closeIdx !== -1) {
          returns.push(body.slice(start, closeIdx + 1).trim());
          let next = closeIdx + 1;
          while (next < len && (body[next] === ";" || /\s/.test(body[next] ?? ""))) {
            if (body[next] === "\n") {
              next++;
              break;
            }
            next++;
          }
          i = next;
          continue;
        }
      } else if (body[start] === "(") {
        const closeIdx = findMatchingBracket(body, start, "(", ")");
        if (closeIdx !== -1) {
          returns.push(body.slice(start + 1, closeIdx).trim());
          let next = closeIdx + 1;
          while (next < len && (body[next] === ";" || /\s/.test(body[next] ?? ""))) {
            if (body[next] === "\n") {
              next++;
              break;
            }
            next++;
          }
          i = next;
          continue;
        }
      } else {
        // Variable, identifier, ternary, or primitive
        let end = start;
        let pD = 0;
        let bD = 0;
        let aD = 0;
        let q: string | null = null;

        while (end < len) {
          const c = body[end];
          if (q) {
            if (c === "\\") end += 2;
            else if (c === q) q = null;
            else end++;
            continue;
          }
          if (c === '"' || c === "'" || c === "`") {
            q = c;
            end++;
            continue;
          }
          if (c === "(") pD++;
          else if (c === ")") pD--;
          else if (c === "{") bD++;
          else if (c === "}") {
            if (bD === 0) break;
            bD--;
          } else if (c === "[") aD++;
          else if (c === "]") aD--;
          else if ((c === ";" || c === "\n") && pD === 0 && bD === 0 && aD === 0) {
            break;
          }
          end++;
        }

        const expr = body.slice(start, end).trim();
        if (expr) {
          returns.push(expr);
        }
        i = end;
        continue;
      }
    }

    i++;
  }

  return returns;
}

/**
 * Resolves a return expression into a list of field drafts.
 * Supports object literals, variable references, ternary branches, and array returns.
 */
export function resolveReturnExpression(
  expr: string,
  cleanCode: string,
  inputSchema?: SchemaFieldInput[],
): InferredFieldDraft[] {
  let trimmed = expr.trim();
  if (!trimmed) return [];

  // Remove outer parentheses: `({ ... })`
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  // 1. Direct object literal
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseObjectLiteral(trimmed, inputSchema);
  }

  // 2. Direct array return: `[ ... ]`
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return [
      {
        name: "items",
        type: "any",
        isArray: true,
        required: true,
      },
    ];
  }

  // 3. Ternary expression: `cond ? { a: 1 } : { b: 2 }`
  const ternaryMatch = trimmed.match(/\?\s*({.*?})\s*:\s*({.*?})/s);
  if (ternaryMatch && ternaryMatch[1] && ternaryMatch[2]) {
    const leftFields = parseObjectLiteral(ternaryMatch[1], inputSchema);
    const rightFields = parseObjectLiteral(ternaryMatch[2], inputSchema);
    return [...leftFields, ...rightFields];
  }

  // 4. Returning `input` directly
  if (trimmed === "input" && inputSchema && inputSchema.length > 0) {
    return inputSchema.map((p) => ({
      name: p.name,
      type: p.type || "string",
      isArray: p.isArray,
      required: p.required ?? true,
    }));
  }

  // 5. Variable identifier reference: `return output;`
  // Search cleanCode for `const output = { ... }` or `let output = { ... }`
  const varIdentMatch = trimmed.match(/^[a-zA-Z0-9_$]+$/);
  if (varIdentMatch && varIdentMatch[0]) {
    const varName = varIdentMatch[0];
    const declRegex = new RegExp(
      `(?:const|let|var)\\s+${varName}\\s*=\\s*`,
    );
    const match = declRegex.exec(cleanCode);
    if (match) {
      let startCharIdx = match.index + match[0].length;
      while (startCharIdx < cleanCode.length && /\s/.test(cleanCode[startCharIdx] ?? "")) {
        startCharIdx++;
      }
      if (cleanCode[startCharIdx] === "{") {
        const closeIdx = findMatchingBracket(cleanCode, startCharIdx, "{", "}");
        if (closeIdx !== -1) {
          return parseObjectLiteral(cleanCode.slice(startCharIdx, closeIdx + 1), inputSchema);
        }
      } else if (cleanCode[startCharIdx] === "[") {
        return [{ name: "items", type: "any", isArray: true, required: true }];
      }
    }
  }

  // 6. Primitive return fallback
  if (/^["'`]/.test(trimmed)) {
    return [{ name: "result", type: "string", required: true }];
  }
  if (/^-?\d+/.test(trimmed)) {
    return [{ name: "result", type: "number", required: true }];
  }
  if (/^(true|false)/.test(trimmed)) {
    return [{ name: "result", type: "boolean", required: true }];
  }

  return [];
}

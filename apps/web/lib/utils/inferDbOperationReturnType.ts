import { stripComments } from "./infer-return-schema";

export interface InferDbReturnTypeOptions {
  pascalLabel?: string;
  tableName?: string;
  fallback?: string;
  dbType?: string;
}

/**
 * Extracts return expressions from the top level of the code/function body.
 * Correctly handles quotes, template literals, brackets, and inner functions.
 */
function extractReturnsFromCode(rawCode: string): string[] {
  const clean = stripComments(rawCode);
  let body = clean.trim();

  // If wrapped in a function, unwrap its outermost body
  const fnMatch = body.match(
    /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function(?:\s+[\w$]+)?(?:\s*<[^>]*>)?\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/,
  );
  if (fnMatch) {
    const startIdx = body.indexOf("{");
    const endIdx = body.lastIndexOf("}");
    if (startIdx !== -1 && endIdx > startIdx) {
      body = body.slice(startIdx + 1, endIdx);
    }
  }

  const returns: string[] = [];
  const len = body.length;
  let i = 0;
  let braceDepth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let subFnBraceDepth = -1;

  while (i < len) {
    const ch = body[i];

    // String literal handling
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < len) {
        if (body[i] === "\\") {
          i += 2;
          continue;
        }
        if (body[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // Inner sub-function tracking
    if (
      (ch === "=" && body[i + 1] === ">") ||
      (body.slice(i, i + 8).match(/\bfunction\b/))
    ) {
      let lookAhead = i;
      while (lookAhead < len && body[lookAhead] !== "{" && body[lookAhead] !== ";" && body[lookAhead] !== "\n") {
        lookAhead++;
      }
      if (body[lookAhead] === "{" && subFnBraceDepth === -1) {
        subFnBraceDepth = braceDepth + 1;
      }
    }

    if (ch === "{") {
      braceDepth++;
      i++;
      continue;
    }
    if (ch === "}") {
      if (subFnBraceDepth === braceDepth) {
        subFnBraceDepth = -1;
      }
      braceDepth--;
      i++;
      continue;
    }
    if (ch === "(") {
      parenDepth++;
      i++;
      continue;
    }
    if (ch === ")") {
      parenDepth--;
      i++;
      continue;
    }
    if (ch === "[") {
      bracketDepth++;
      i++;
      continue;
    }
    if (ch === "]") {
      bracketDepth--;
      i++;
      continue;
    }

    // Match top-level "return" keyword
    if (
      subFnBraceDepth === -1 &&
      body.slice(i, i + 6) === "return" &&
      (i === 0 || /[\s;{}()]/.test(body[i - 1] ?? "")) &&
      (i + 6 >= len || /[\s;{}()]/.test(body[i + 6] ?? ""))
    ) {
      let start = i + 6;
      while (start < len && /\s/.test(body[start] ?? "")) {
        start++;
      }

      if (start >= len || body[start] === ";" || body[start] === "}") {
        returns.push("");
        i = start;
        continue;
      }

      // Read expression until end of statement (; or newline outside parens/brackets/braces)
      let end = start;
      let exprParenDepth = 0;
      let exprBraceDepth = 0;
      let exprBracketDepth = 0;
      let exprQuote: string | null = null;

      while (end < len) {
        const c = body[end];
        if (exprQuote) {
          if (c === "\\") {
            end += 2;
            continue;
          }
          if (c === exprQuote) {
            exprQuote = null;
            end++;
            continue;
          }
          end++;
          continue;
        }

        if (c === '"' || c === "'" || c === "`") {
          exprQuote = c;
          end++;
          continue;
        }

        if (c === "(") exprParenDepth++;
        else if (c === ")") exprParenDepth--;
        else if (c === "{") exprBraceDepth++;
        else if (c === "}") {
          if (exprBraceDepth === 0) break;
          exprBraceDepth--;
        } else if (c === "[") exprBracketDepth++;
        else if (c === "]") exprBracketDepth--;
        else if (
          (c === ";" || c === "\n") &&
          exprParenDepth === 0 &&
          exprBraceDepth === 0 &&
          exprBracketDepth === 0
        ) {
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

    i++;
  }

  return returns;
}

/**
 * Infers the TypeScript return type for a database operation function from its code.
 */
export function inferDbOperationReturnType(
  code: string | undefined | null,
  options: InferDbReturnTypeOptions = {},
): string {
  const {
    pascalLabel = "Entity",
    fallback = `${pascalLabel}Row[]`,
  } = options;

  if (!code || !code.trim()) {
    return fallback;
  }

  const rawCode = code.trim();

  // 1. Explicit TypeScript return type annotation on function signature
  const tsFunctionReturnMatch = rawCode.match(
    /(?:export\s+)?(?:async\s+)?function(?:\s+[a-zA-Z0-9_$]+)?(?:\s*<[^>]*>)?\s*\([^)]*\)\s*:\s*([^;{]+)\s*\{/,
  );
  if (tsFunctionReturnMatch && tsFunctionReturnMatch[1]) {
    const extracted = tsFunctionReturnMatch[1].trim();
    if (extracted && extracted !== "any") {
      return extracted;
    }
  }

  const tsArrowReturnMatch = rawCode.match(
    /(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*:\s*([^;{=]+)\s*=>/,
  );
  if (tsArrowReturnMatch && tsArrowReturnMatch[1]) {
    const extracted = tsArrowReturnMatch[1].trim();
    if (extracted && extracted !== "any") {
      return extracted;
    }
  }

  // 2. Check for Raw SQL Queries (if the code itself is a raw SQL statement without JS wrapper)
  const isRawSql =
    /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH)\b/i.test(rawCode) &&
    !rawCode.includes("function") &&
    !rawCode.includes("const ") &&
    !rawCode.includes("let ") &&
    !rawCode.includes("return ");

  if (isRawSql) {
    if (/^\s*SELECT\s+COUNT\b/i.test(rawCode)) {
      return "number";
    }
    if (/^\s*SELECT\s+EXISTS\b/i.test(rawCode)) {
      return "boolean";
    }
    if (/^\s*SELECT\b/i.test(rawCode)) {
      return `${pascalLabel}Row[]`;
    }
    if (/^\s*INSERT\b/i.test(rawCode)) {
      return `${pascalLabel}Row`;
    }
    if (/^\s*UPDATE\b/i.test(rawCode)) {
      return `${pascalLabel}Row | undefined`;
    }
    if (/^\s*DELETE\b/i.test(rawCode)) {
      return "{ success: boolean; message: string }";
    }
  }

  // 3. Extract return statements from the function body
  const cleanCode = stripComments(rawCode);
  const returns = extractReturnsFromCode(rawCode);

  if (returns.length === 0) {
    if (cleanCode.trim().length > 0) {
      if (
        cleanCode.includes(";") ||
        cleanCode.includes("console.") ||
        cleanCode.includes("stmt") ||
        cleanCode.includes("redis.")
      ) {
        return "void";
      }
    }
    return fallback;
  }

  // Analyze each return expression
  const inferredTypes: string[] = [];

  for (const ret of returns) {
    const expr = ret.trim();
    if (!expr) {
      inferredTypes.push("void");
      continue;
    }

    // A. Type assertion: `... as unknown as ConversationsRow[]` or `... as boolean`
    const asAssertionMatch = expr.match(
      /\bas\s+(?:unknown\s+as\s+)?([A-Za-z0-9_$<>\[\]|& ]+)(?:;)?$/,
    );
    if (asAssertionMatch && asAssertionMatch[1]) {
      const asserted = asAssertionMatch[1].trim();
      if (asserted) {
        inferredTypes.push(asserted);
        continue;
      }
    }

    // B. Literal booleans or boolean expressions
    if (
      /^(?:true|false)$/.test(expr) ||
      expr.startsWith("!") ||
      expr.includes("===") ||
      expr.includes("!==") ||
      expr.includes("==") ||
      expr.includes("!=") ||
      expr.includes(" < ") ||
      expr.includes(" > ") ||
      expr.includes(" <= ") ||
      expr.includes(" >= ") ||
      expr.startsWith("Boolean(") ||
      /\.(?:includes|startsWith|endsWith|every|some|has)\(/.test(expr)
    ) {
      inferredTypes.push("boolean");
      continue;
    }

    // C. Literal numbers or numeric expressions
    if (
      /^-?\d+(?:\.\d+)?$/.test(expr) ||
      expr.includes(".length") ||
      expr.startsWith("parseInt(") ||
      expr.startsWith("parseFloat(") ||
      expr.startsWith("Number(") ||
      expr.startsWith("Math.") ||
      expr.startsWith("Date.now(") ||
      /^[a-zA-Z0-9_$]+\s*[\+\-\*\/%]\s*[a-zA-Z0-9_$]+$/.test(expr)
    ) {
      inferredTypes.push("number");
      continue;
    }

    // D. Literal strings or string expressions
    if (
      /^["'`].*["'`]$/s.test(expr) ||
      expr.startsWith("String(") ||
      /\.(?:toString|toLowerCase|toUpperCase|trim|substring|slice|replace|concat)\(/.test(expr)
    ) {
      inferredTypes.push("string");
      continue;
    }

    // E. Undefined / null
    if (expr === "undefined") {
      inferredTypes.push("undefined");
      continue;
    }
    if (expr === "null") {
      inferredTypes.push("null");
      continue;
    }

    // F. Object literals: `{ success: true, message: "..." }`
    if (expr.startsWith("{") && expr.endsWith("}")) {
      if (
        expr.includes("success") &&
        (expr.includes("message") || expr.includes("true") || expr.includes("false"))
      ) {
        inferredTypes.push("{ success: boolean; message: string }");
        continue;
      }
      if (expr.includes("changes") && expr.includes("lastInsertRowid")) {
        inferredTypes.push("{ changes: number; lastInsertRowid: number }");
        continue;
      }
      inferredTypes.push("Record<string, unknown>");
      continue;
    }

    // G. Array literals: `[...]`
    if (expr.startsWith("[") && expr.endsWith("]")) {
      const inner = expr.slice(1, -1).trim();
      if (!inner) {
        inferredTypes.push("any[]");
        continue;
      }
      if (/^["'`]/.test(inner)) {
        inferredTypes.push("string[]");
        continue;
      }
      if (/^-?\d+/.test(inner)) {
        inferredTypes.push("number[]");
        continue;
      }
      inferredTypes.push(`${pascalLabel}Row[]`);
      continue;
    }

    // H. Redis operations (checked before stmt to prevent .get() collision)
    if (/redis\.(?:hlen|llen|zcard|scard|publish|incr|decr)\b/.test(expr)) {
      inferredTypes.push("Promise<number>");
      continue;
    }
    if (/redis\.get\b/.test(expr)) {
      inferredTypes.push("Promise<string | null>");
      continue;
    }
    if (/redis\.hgetall\b/.test(expr)) {
      inferredTypes.push("Promise<Record<string, string>>");
      continue;
    }
    if (/redis\.(?:lrange|zrange|smembers|keys)\b/.test(expr)) {
      inferredTypes.push("Promise<string[]>");
      continue;
    }
    if (/redis\.(?:del|exists)\b/.test(expr)) {
      inferredTypes.push("Promise<boolean>");
      continue;
    }

    // I. Prepared statement operations
    if (/\bstmt[a-zA-Z0-9_$]*\.all\b/.test(expr)) {
      inferredTypes.push(`${pascalLabel}Row[]`);
      continue;
    }
    if (/\bstmt[a-zA-Z0-9_$]*\.get\b/.test(expr)) {
      inferredTypes.push(`${pascalLabel}Row | undefined`);
      continue;
    }
    if (/\bstmt[a-zA-Z0-9_$]*\.run\b/.test(expr)) {
      inferredTypes.push("{ success: boolean; message: string }");
      continue;
    }

    // J. Ternary expression: `condition ? val1 : val2`
    if (expr.includes("?") && expr.includes(":")) {
      const qIdx = expr.indexOf("?");
      const cIdx = expr.lastIndexOf(":");
      if (qIdx > 0 && cIdx > qIdx) {
        const branch1 = expr.slice(qIdx + 1, cIdx).trim();
        const branch2 = expr.slice(cIdx + 1).trim();
        const t1 = inferDbOperationReturnType(`return ${branch1};`, options);
        const t2 = inferDbOperationReturnType(`return ${branch2};`, options);
        if (t1 === t2) {
          inferredTypes.push(t1);
        } else if (
          (t1 === "undefined" || t2 === "undefined") ||
          (t1 === "null" || t2 === "null")
        ) {
          const nonNull = t1 === "undefined" || t1 === "null" ? t2 : t1;
          const nullable = t1 === "null" || t2 === "null" ? "null" : "undefined";
          inferredTypes.push(nonNull.includes(nullable) ? nonNull : `${nonNull} | ${nullable}`);
        } else {
          inferredTypes.push(`${t1} | ${t2}`);
        }
        continue;
      }
    }

    // K. Identifier / variable heuristics
    const lowerExpr = expr.toLowerCase();
    if (["rows", "records", "items", "results", "entries", "list"].includes(lowerExpr)) {
      inferredTypes.push(`${pascalLabel}Row[]`);
      continue;
    }
    if (["row", "record", "item", "fresh", "current", "entity", "result"].includes(lowerExpr)) {
      inferredTypes.push(`${pascalLabel}Row | undefined`);
      continue;
    }
    if (
      lowerExpr.startsWith("is") ||
      lowerExpr.startsWith("has") ||
      lowerExpr.startsWith("can") ||
      ["ok", "success", "exists", "found", "valid"].includes(lowerExpr)
    ) {
      inferredTypes.push("boolean");
      continue;
    }
    if (["count", "total", "amount", "size", "len", "length", "price", "age"].includes(lowerExpr)) {
      inferredTypes.push("number");
      continue;
    }
    if (["id", "key", "token", "name", "email", "slug", "text", "msg", "message"].includes(lowerExpr)) {
      inferredTypes.push("string");
      continue;
    }

    // Default for unrecognized expressions
    inferredTypes.push(fallback);
  }

  // Deduplicate and combine branches
  const uniqueTypes = Array.from(new Set(inferredTypes));

  const firstType = uniqueTypes[0];
  if (uniqueTypes.length === 1 && typeof firstType === "string") {
    return firstType;
  }

  const hasUndefined = uniqueTypes.includes("undefined");
  const hasNull = uniqueTypes.includes("null");
  const filtered = uniqueTypes.filter((t) => t !== "undefined" && t !== "null" && t !== "void");

  const base = filtered[0];
  if (filtered.length === 1 && typeof base === "string") {
    if (hasUndefined && !base.includes("undefined")) return `${base} | undefined`;
    if (hasNull && !base.includes("null")) return `${base} | null`;
    return base;
  }

  if (filtered.length > 0) {
    let combined = filtered.join(" | ");
    if (hasUndefined && !combined.includes("undefined")) {
      combined += " | undefined";
    }
    if (hasNull && !combined.includes("null")) {
      combined += " | null";
    }
    return combined;
  }

  return uniqueTypes.join(" | ") || fallback;
}

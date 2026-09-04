export interface PipelineRenderContextLike {
  bodyVar?: string;
  priorOutputs?: Map<string, string>;
}

/**
 * Normalizes relaxed JSON/JavaScript object literal strings (supporting backtick strings,
 * unquoted keys, single quotes, and trailing commas) into standard JSON for parsing.
 */
export function normalizeRelaxedJson(input: string): string {
  if (!input || !input.trim()) return "";

  let result = input;

  // 1. Remove single-line comments (// ...) and multi-line comments (/* ... */)
  result = result.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, "$1");

  // 2. Replace backtick template strings `...` with double-quoted strings "..."
  result = result.replace(/`([\s\S]*?)`/g, (_, content) => {
    const escaped = content
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, "\\n");
    return `"${escaped}"`;
  });

  // 3. Replace single-quoted strings '...' with double-quoted strings "..."
  result = result.replace(/'((?:\\.|[^'])*)'/g, (_, content) => {
    const escaped = content.replace(/"/g, '\\"');
    return `"${escaped}"`;
  });

  // 4. Quote unquoted object keys: e.g. { name: "foo", user_id: 123 }
  result = result.replace(
    /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$-]*)\s*:/g,
    '$1"$2":',
  );

  // 5. Remove trailing commas before } or ]
  result = result.replace(/,\s*([}\]])/g, "$1");

  return result;
}

/**
 * Safely parses a JSON or relaxed JS object string.
 * Supports:
 * - Unquoted keys: { name: "..." }
 * - Backtick template literals: { name: `demo ${body.query}` }
 * - Single quotes: { 'name': '...' }
 * - Trailing commas: { name: "...", }
 */
export function parseRelaxedJson(input: string): {
  parsed: unknown;
  data: unknown;
  error: string | null;
} {
  if (!input || !input.trim()) {
    return { parsed: null, data: null, error: null };
  }

  // 1. Try standard JSON.parse first for performance
  try {
    const parsed = JSON.parse(input);
    return { parsed, data: parsed, error: null };
  } catch {
    // 2. Fall back to relaxed normalization
    try {
      const normalized = normalizeRelaxedJson(input);
      const parsed = JSON.parse(normalized);
      return { parsed, data: parsed, error: null };
    } catch (err) {
      return {
        parsed: null,
        data: null,
        error: err instanceof Error ? err.message : "Invalid JSON syntax",
      };
    }
  }
}

/**
 * Resolves a single dynamic token expression (e.g. "body.query" or "step1.summary")
 * into a valid TypeScript runtime variable access expression.
 */
export function resolveTemplateToken(
  rawExpr: string,
  ctx?: PipelineRenderContextLike,
): string {
  const token = rawExpr.trim();
  const bodyVar = ctx?.bodyVar || "body";

  // 1. Request Body
  if (token === "body" || token === "req.body") {
    return bodyVar;
  }
  if (token.startsWith("req.body.")) {
    return `${bodyVar}.${token.slice("req.body.".length)}`;
  }
  if (token.startsWith("body.")) {
    return `${bodyVar}.${token.slice("body.".length)}`;
  }

  // 2. Request Params
  if (token === "params" || token === "req.params") {
    return "req.params";
  }
  if (token.startsWith("req.params.")) {
    return token;
  }
  if (token.startsWith("params.")) {
    return `req.params.${token.slice("params.".length)}`;
  }

  // 3. Request Query
  if (token === "query" || token === "req.query") {
    return "req.query";
  }
  if (token.startsWith("req.query.")) {
    return token;
  }
  if (token.startsWith("query.")) {
    return `req.query.${token.slice("query.".length)}`;
  }

  // 4. Request Headers
  if (token === "headers" || token === "req.headers") {
    return "req.headers";
  }
  if (token.startsWith("req.headers.")) {
    const field = token.slice("req.headers.".length);
    return `(req.headers["${field}"] as string)`;
  }
  if (token.startsWith("headers.")) {
    const field = token.slice("headers.".length);
    return `(req.headers["${field}"] as string)`;
  }

  // 5. Environment Variables
  if (token.startsWith("process.env.")) {
    return token;
  }
  if (token.startsWith("env.")) {
    return `process.env.${token.slice("env.".length)}`;
  }

  // 6. Prior Step Outputs
  if (ctx?.priorOutputs) {
    const dotIdx = token.indexOf(".");
    const stepRef = dotIdx > 0 ? token.substring(0, dotIdx) : token;
    const fieldPart = dotIdx > 0 ? token.substring(dotIdx) : "";

    // Exact stepId in priorOutputs
    const varName = ctx.priorOutputs.get(stepRef);
    if (varName) {
      return `${varName}${fieldPart}`;
    }

    // Step name check (e.g. step1Result -> step1Result.field)
    for (const [, outVar] of ctx.priorOutputs.entries()) {
      if (outVar.toLowerCase() === stepRef.toLowerCase()) {
        return `${outVar}${fieldPart}`;
      }
    }
  }

  // Fallback: return token as-is
  return token;
}

/**
 * Compiles a template string containing `${...}` dynamic tokens into an ES6 template literal.
 * Escapes backticks in static text segments.
 */
export function compileTemplateString(
  template: string,
  ctx?: PipelineRenderContextLike,
): string {
  if (!template) return '""';

  // If no dynamic token, return string literal
  if (!/\$\{([^}]+)\}/.test(template)) {
    return JSON.stringify(template);
  }

  const tokenRegex = /\$\{([^}]+)\}/g;
  let lastIndex = 0;
  let result = "";
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(template)) !== null) {
    // Static segment before the token
    const staticPart = template.substring(lastIndex, match.index);
    result += staticPart.replace(/\\/g, "\\\\").replace(/`/g, "\\`");

    // Dynamic token
    const rawToken = match[1] ?? "";
    const resolved = resolveTemplateToken(rawToken, ctx);
    result += `\${${resolved}}`;

    lastIndex = match.index + match[0].length;
  }

  // Trailing static segment
  const trailingPart = template.substring(lastIndex);
  result += trailingPart.replace(/\\/g, "\\\\").replace(/`/g, "\\`");

  return `\`${result}\``;
}

/**
 * Compiles a JSON string or parsed object with dynamic variable tokens into a TypeScript
 * object literal expression string where any `${...}` tokens in string values resolve to
 * their evaluated runtime scope variables.
 */
export function compileJsonExpression(
  input: string | unknown,
  ctx?: PipelineRenderContextLike,
  indent = 2,
): string {
  let target = input;

  if (typeof input === "string") {
    const { parsed, error } = parseRelaxedJson(input);
    if (!error && parsed !== null) {
      target = parsed;
    } else {
      return compileTemplateString(input, ctx);
    }
  }

  const pad = " ".repeat(indent);
  const innerPad = " ".repeat(indent + 2);

  if (target === null || target === undefined) {
    return "null";
  }

  if (typeof target === "number" || typeof target === "boolean") {
    return String(target);
  }

  if (typeof target === "string") {
    if (/\$\{([^}]+)\}/.test(target)) {
      return compileTemplateString(target, ctx);
    }
    return JSON.stringify(target);
  }

  if (Array.isArray(target)) {
    if (target.length === 0) return "[]";
    const items = target
      .map((item) => `${innerPad}${compileJsonExpression(item, ctx, indent + 2)}`)
      .join(",\n");
    return `[\n${items}\n${pad}]`;
  }

  if (typeof target === "object") {
    const entries = Object.entries(target as Record<string, unknown>);
    if (entries.length === 0) return "{}";

    const lines = entries.map(([k, v]) => {
      const keyStr = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      const valStr = compileJsonExpression(v, ctx, indent + 2);
      return `${innerPad}${keyStr}: ${valStr}`;
    });

    return `{\n${lines.join(",\n")}\n${pad}}`;
  }

  return JSON.stringify(target);
}

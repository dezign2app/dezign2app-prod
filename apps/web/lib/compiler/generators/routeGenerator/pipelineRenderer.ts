import { PipelineStep, PipelineStepInputBinding } from "@workspace/canvas/types";

/**
 * Context available while rendering a pipeline step sequence.
 * Tracks which output variables are declared by prior steps so
 * subsequent steps can reference them safely.
 */
export interface PipelineRenderContext {
  /** Map of stepId -> outputVariable name for all prior steps */
  priorOutputs: Map<string, string>;
  /** The validated body variable name (e.g. "body" or "req.body") */
  bodyVar: string;
}

/**
 * Resolves a single InputBinding into a TypeScript expression string.
 *
 * Examples:
 *   { kind: "req_body", field: "name" }          → "body.name"
 *   { kind: "req_params", field: "id" }           → "req.params.id"
 *   { kind: "step_output", stepId: "s1", field: "slug" } → "step1Var.slug"
 *   { kind: "step_output", stepId: "s1" }         → "step1Var" (whole object)
 *   { kind: "literal", value: 42 }                → "42"
 */
export function resolveBinding(
  binding: PipelineStepInputBinding,
  ctx: PipelineRenderContext,
): string {
  const { source } = binding;
  if (!source) return "undefined";

  switch (source.kind) {
    case "req_body": {
      const field = source.field ? source.field.trim() : "";
      return field ? `${ctx.bodyVar}.${field}` : ctx.bodyVar;
    }
    case "req_params": {
      const field = source.field ? source.field.trim() : "";
      return field ? `req.params.${field}` : "req.params";
    }
    case "req_query": {
      const field = source.field ? source.field.trim() : "";
      return field ? `req.query.${field}` : "req.query";
    }
    case "req_headers": {
      const field = source.field ? source.field.trim() : "";
      return field ? `(req.headers["${field}"] as string)` : "req.headers";
    }
    case "step_output": {
      const varName = ctx.priorOutputs.get(source.stepId);
      const field = source.field ? source.field.trim() : "";
      if (!varName) {
        // Fallback: use a descriptive placeholder so generated code still compiles
        const fallback = `/* step "${source.stepId}" not found */ undefined`;
        return field ? `${fallback}?.${field}` : fallback;
      }
      return field ? `${varName}.${field}` : varName;
    }
    case "literal": {
      const v = source.value;
      return typeof v === "string" ? `"${v}"` : String(v);
    }
    default:
      return "undefined";
  }
}

/**
 * Builds the argument list for a function call expression from bindings.
 *
 * If there are no bindings the call is emitted as `fn()`.
 * If there is exactly one binding named "_spread" the value is passed positionally.
 * Otherwise all bindings are assembled into a single object literal `{ argA: exprA, argB: exprB }`.
 * Individual positional bindings can be forced by giving them a numeric argName ("0", "1", …).
 */
export function buildArgList(
  bindings: PipelineStepInputBinding[],
  ctx: PipelineRenderContext,
): string {
  if (bindings.length === 0) return "";

  // Positional mode: all argNames are numeric strings "0", "1", …
  const allPositional = bindings.every((b) => /^\d+$/.test(b.argName));
  if (allPositional) {
    return bindings
      .sort((a, b) => Number(a.argName) - Number(b.argName))
      .map((b) => resolveBinding(b, ctx))
      .join(", ");
  }

  // Spread-single mode: single binding with special argName "_spread"
  if (bindings.length === 1 && bindings[0]!.argName === "_spread") {
    return resolveBinding(bindings[0]!, ctx);
  }

  // Object-literal mode: build { argA: exprA, argB: exprB, ... }
  const fields = bindings
    .map((b) => `  ${b.argName}: ${resolveBinding(b, ctx)}`)
    .join(",\n");
  return `{\n${fields}\n}`;
}

/**
 * Renders a single pipeline step into one or more lines of TypeScript.
 *
 * @param step    - The pipeline step configuration
 * @param ctx     - Render context (prior outputs, body var name)
 * @returns       Array of code lines (without trailing newline)
 */
export function renderPipelineStep(
  step: PipelineStep,
  ctx: PipelineRenderContext,
): string[] {
  if (step.enabled === false) return [];

  const lines: string[] = [];
  const { outputVariable, functionRef, inputBindings, type, customCode } = step;

  switch (type) {
    // -------------------------------------------------------------------------
    // Transform: pure function call
    // -------------------------------------------------------------------------
    case "transform": {
      if (!functionRef) {
        lines.push(`// [pipeline] step "${step.name}": missing functionRef`);
        break;
      }
      const args = buildArgList(inputBindings, ctx);
      const isMultiLine = args.includes("\n");
      if (isMultiLine) {
        lines.push(`const ${outputVariable} = ${functionRef.name}(`);
        args.split("\n").forEach((l) => lines.push(`  ${l}`));
        lines.push(`);`);
      } else {
        const callExpr = args ? `${functionRef.name}(${args})` : `${functionRef.name}()`;
        lines.push(`const ${outputVariable} = ${callExpr};`);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // DB / Redis / Service call: async function call
    // -------------------------------------------------------------------------
    case "db_operation":
    case "redis_operation":
    case "service_call": {
      if (!functionRef) {
        lines.push(`// [pipeline] step "${step.name}": missing functionRef`);
        break;
      }
      const args = buildArgList(inputBindings, ctx);
      const isMultiLine = args.includes("\n");
      if (isMultiLine) {
        lines.push(`const ${outputVariable} = await ${functionRef.name}(`);
        args.split("\n").forEach((l) => lines.push(`  ${l}`));
        lines.push(`);`);
      } else {
        const callExpr = args
          ? `await ${functionRef.name}(${args})`
          : `await ${functionRef.name}()`;
        lines.push(`const ${outputVariable} = ${callExpr};`);
      }
      // DB reads by ID get a 404 guard
      if (
        type === "db_operation" &&
        (functionRef.name.toLowerCase().includes("byid") ||
          functionRef.name.toLowerCase().includes("findone"))
      ) {
        lines.push(`if (${outputVariable} === undefined || ${outputVariable} === null) {`);
        lines.push(`  return res.status(404).json({ error: "Not found" });`);
        lines.push(`}`);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // Kafka publish: no meaningful return value, but we still track the var
    // -------------------------------------------------------------------------
    case "kafka_publish": {
      if (!functionRef) {
        lines.push(`// [pipeline] step "${step.name}": missing functionRef`);
        break;
      }
      const topicBinding = inputBindings.find((b) => b.argName === "topic");
      const payloadBinding = inputBindings.find((b) => b.argName === "payload");
      const topicExpr = topicBinding
        ? resolveBinding(topicBinding, ctx)
        : "/* topic */";
      const payloadExpr = payloadBinding
        ? resolveBinding(payloadBinding, ctx)
        : "/* payload */";
      lines.push(`const ${outputVariable} = await ${functionRef.name}(`);
      lines.push(`  ${topicExpr},`);
      lines.push(`  ${payloadExpr},`);
      lines.push(`);`);
      break;
    }

    // -------------------------------------------------------------------------
    // Custom code: inline the raw TypeScript block as-is
    // -------------------------------------------------------------------------
    case "custom_code": {
      if (customCode && customCode.trim()) {
        customCode.split("\n").forEach((l) => lines.push(l));
      } else {
        lines.push(`// [pipeline] custom_code step "${step.name}" has no code`);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // Return Response: emit final HTTP response return statement
    // -------------------------------------------------------------------------
    case "return_response": {
      const statusCode = step.statusCode || 200;
      const firstBinding = inputBindings[0];
      if (
        inputBindings.length === 1 &&
        firstBinding &&
        (firstBinding.argName === "data" ||
          firstBinding.argName === "_spread" ||
          !firstBinding.argName)
      ) {
        const expr = resolveBinding(firstBinding, ctx);
        lines.push(`return res.status(${statusCode}).json(${expr});`);
      } else if (inputBindings.length > 0) {
        const fields = inputBindings
          .map((b) => `  ${b.argName}: ${resolveBinding(b, ctx)}`)
          .join(",\n");
        lines.push(`return res.status(${statusCode}).json({\n${fields}\n});`);
      } else {
        lines.push(
          `return res.status(${statusCode}).json({ status: ${statusCode}, message: "Success" });`,
        );
      }
      break;
    }

    default:
      lines.push(`// [pipeline] unknown step type "${type}"`);
  }

  return lines;
}

/**
 * Renders an entire ordered pipeline into a block of TypeScript lines.
 *
 * Automatically tracks which output variables are declared so that
 * later steps can reference them via step_output bindings.
 *
 * @param steps    - Ordered pipeline step definitions
 * @param bodyVar  - The validated request body variable name
 * @returns        Array of rendered code lines
 */
export function renderPipeline(
  steps: PipelineStep[],
  bodyVar = "body",
): string[] {
  const ctx: PipelineRenderContext = {
    priorOutputs: new Map(),
    bodyVar,
  };

  const allLines: string[] = [];

  for (const step of steps) {
    if (step.enabled === false) continue;

    allLines.push(`// --- Pipeline Step: ${step.name} ---`);
    const stepLines = renderPipelineStep(step, ctx);
    allLines.push(...stepLines);
    allLines.push("");

    // Register this step's output so subsequent steps can reference it
    ctx.priorOutputs.set(step.id, step.outputVariable);
  }

  return allLines;
}

/**
 * Builds an import map from the pipeline steps — de-duped by importPath.
 * Returns a map of { importPath -> Set<functionName> }.
 */
export function collectPipelineImports(
  steps: PipelineStep[],
): Map<string, Set<string>> {
  const imports = new Map<string, Set<string>>();
  for (const step of steps) {
    if (!step.functionRef || step.enabled === false) continue;
    const { name, importPath } = step.functionRef;
    if (!imports.has(importPath)) {
      imports.set(importPath, new Set());
    }
    imports.get(importPath)!.add(name);
  }
  return imports;
}

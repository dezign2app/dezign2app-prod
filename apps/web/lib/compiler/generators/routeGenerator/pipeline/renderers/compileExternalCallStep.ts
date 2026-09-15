// ═══════════════════════════════════════════════════════════════
// MODULE: ExternalCallStepRenderer
// LAYER:  generators / routeGenerator / pipeline / renderers
// EMITS:  External API invocation statements (custom fetchCall or direct fetch)
// ═══════════════════════════════════════════════════════════════

import { PipelineStep } from "@workspace/canvas/types";
import { toVarName } from "../../../../utils";
import { PipelineRenderContext } from "../types";
import { buildArgList, resolveBinding } from "../sourceResolver";

/**
 * Renders an external API call step (3rd-party SaaS / REST endpoint).
 */
export function renderExternalCallStep(
  step: PipelineStep,
  ctx: PipelineRenderContext,
): string[] {
  const { outputVariable, functionRef, inputBindings = [] } = step;
  if (functionRef) {
    const fnName = toVarName(functionRef.name || "fetchCall");
    const args = buildArgList(inputBindings, ctx);
    const isMultiLine = args.includes("\n");
    if (isMultiLine) {
      return [
        `const ${outputVariable} = await ${fnName}(`,
        ...args.split("\n").map((l) => `  ${l}`),
        `);`,
      ];
    }
    const callExpr = args
      ? `await ${fnName}(${args})`
      : `await ${fnName}()`;
    return [`const ${outputVariable} = ${callExpr};`];
  }

  // Direct fetch call when no custom functionRef is configured
  const rawLines: string[] = [];
  const endpointPath = step.operationId?.includes("_")
    ? step.operationId.substring(step.operationId.indexOf("_") + 1)
    : "/";
  const method = step.operationId?.includes("_")
    ? step.operationId.substring(0, step.operationId.indexOf("_"))
    : "POST";
  const bodyBinding = inputBindings.find(
    (b) => b.argName === "body" || b.argName === "data" || b.argName === "payload",
  );
  const bodyExpr = bodyBinding ? resolveBinding(bodyBinding, ctx) : null;
  const headerBindings = inputBindings.filter((b) =>
    ["authorization", "token", "apikey", "api-key", "x-api-key"].includes(
      b.argName.toLowerCase(),
    ) || b.argName.toLowerCase().startsWith("x-"),
  );
  const nonBodyNonHeaderBindings = inputBindings.filter(
    (b) => b !== bodyBinding && !headerBindings.includes(b),
  );
  const payloadExpr =
    bodyExpr || (nonBodyNonHeaderBindings.length > 0 ? buildArgList(nonBodyNonHeaderBindings, ctx) : null);

  rawLines.push(`// External API Call: ${step.name || "external_call"}`);
  rawLines.push(`let ${outputVariable}: Record<string, string | number | boolean | null> | null = null;`);
  rawLines.push(`let ${outputVariable}Error: Record<string, string | number | boolean | null> | null = null;`);
  rawLines.push(`try {`);
  rawLines.push(
    `  const ${outputVariable}Response = await fetch(\`\${process.env.EXTERNAL_API_BASE_URL || ""}${endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`}\`, {`,
  );
  rawLines.push(`    method: "${method.toUpperCase()}",`);
  if (headerBindings.length > 0) {
    rawLines.push(`    headers: {`);
    rawLines.push(`      "Content-Type": "application/json",`);
    headerBindings.forEach((hb) => {
      rawLines.push(`      "${hb.argName}": ${resolveBinding(hb, ctx)},`);
    });
    rawLines.push(`    },`);
  } else {
    rawLines.push(`    headers: { "Content-Type": "application/json" },`);
  }
  if (payloadExpr && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
    rawLines.push(`    body: JSON.stringify(${payloadExpr}),`);
  }
  rawLines.push(`  });`);
  rawLines.push(`  if (!${outputVariable}Response.ok) {`);
  rawLines.push(`    try { ${outputVariable}Error = await ${outputVariable}Response.json(); } catch { ${outputVariable}Error = { error: ${outputVariable}Response.statusText, statusCode: ${outputVariable}Response.status }; }`);
  rawLines.push(`  } else {`);
  rawLines.push(`    ${outputVariable} = await ${outputVariable}Response.json();`);
  rawLines.push(`  }`);
  rawLines.push(`} catch (fetchErr) {`);
  rawLines.push(`  ${outputVariable}Error = { error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr), statusCode: 500 };`);
  rawLines.push(`  logger.error("External call ${step.name || "external_call"} failed:", fetchErr);`);
  rawLines.push(`}`);
  return rawLines;
}

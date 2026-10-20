import type {
  CanvasNodeData,
  StepNodeData,
} from "@/app/(canvas)/project/[projectId]/_components/backend-nodes/graph-nodes/langgraph/langgraph-canvas/types";
import { NODE_ID_END } from "@/app/(canvas)/project/[projectId]/_components/backend-nodes/graph-nodes/langgraph/langgraph-canvas/constants";
import type { CompileContext, NodeMeta, LLMMeta, ToolMeta } from "../types";
import {
  toIdentifier,
  toPascalCase,
  toCamelCase,
  escapeTemplateLiteral,
  buildCondition,
  indent,
} from "../utils";

import { renderAgentPipelineSteps } from "./agentPipelineSteps";

export function buildAgentNodeFile(
  agentNode: { id: string; data: CanvasNodeData },
  ctx: CompileContext,
  nodeMetaMap: Map<string, NodeMeta>,
  llmMetaMap: Map<string, LLMMeta>,
): string {
  const d = agentNode.data;
  const nodeMeta = nodeMetaMap.get(agentNode.id);
  const fnName = nodeMeta
    ? nodeMeta.exportName
    : toIdentifier(d.name || d.label || `node_${agentNode.id}`);
  const schemaName = `${toPascalCase(ctx.graphId)}State`;

  const llmId = ctx.agentLLMMap.get(agentNode.id);
  const llmNode = llmId ? ctx.llmNodes.find((l) => l.id === llmId) : null;
  const llmMeta = llmId ? llmMetaMap.get(llmId) : null;
  const llmVar = llmMeta ? llmMeta.varName : null;

  const importMap = new Map<string, Set<string>>();
  const addImport = (source: string, specifiers: string[]) => {
    if (!importMap.has(source)) importMap.set(source, new Set());
    const set = importMap.get(source)!;
    specifiers.forEach((s) => set.add(s));
  };

  addImport("../state", [`${schemaName}Type`]);

  const systemPrompt = d.systemPrompt?.trim();

  const pipelineSteps = d.pipelineSteps;
  const hasConfiguredSteps = Array.isArray(pipelineSteps) && pipelineSteps.length > 0;

  let bodyLines: string[] = [];
  let responseVar = "response";
  let hasLLM = false;

  if (hasConfiguredSteps) {
    if (llmVar && llmMeta) {
      addImport(`../llm/${llmMeta.fileName}`, [llmVar]);
    }

    const rendered = renderAgentPipelineSteps(pipelineSteps, d, ctx, llmVar);
    bodyLines = rendered.bodyLines;
    responseVar = rendered.llmOutputVar;
    hasLLM = rendered.hasLLMCall;

    for (const imp of rendered.imports) {
      addImport(imp.source, imp.specifiers);
    }
  } else {
    // Legacy fallback without pipelineSteps array
    if (llmVar && llmMeta) {
      addImport(`../llm/${llmMeta.fileName}`, [llmVar]);
    }

    if (systemPrompt && llmVar) {
      addImport("@langchain/core/messages", ["SystemMessage"]);
      bodyLines.push(`  const messages = [`);
      bodyLines.push(
        `    new SystemMessage(\`${escapeTemplateLiteral(systemPrompt)}\`),`,
      );
      bodyLines.push(`    ...state.messages,`);
      bodyLines.push(`  ];`);
      bodyLines.push(`  const response = await ${llmVar}.invoke(messages);`);
      hasLLM = true;
    } else if (llmVar) {
      bodyLines.push(
        `  const response = await ${llmVar}.invoke(state.messages);`,
      );
      hasLLM = true;
    } else {
      bodyLines.push(`  // Node without LLM execution logic`);
      bodyLines.push(`  const response: Record<string, string | undefined> = {};`);
    }
  }

  const stateUpdates = d.stateUpdates || [];
  const returnEntries: string[] = [];
  if (hasLLM) returnEntries.push(`    messages: [${responseVar}],`);

  for (const su of stateUpdates) {
    if (su.channelKey === "messages") continue;
    const key = toCamelCase(su.channelKey);
    const isValueless =
      su.source === "none" ||
      ((su.action === "reset" || su.action === "toggle" || su.action === "clear") &&
        (!su.value || (su.source === "literal" && !su.value)));

    let val: string = "undefined";
    if (!isValueless) {
      if (su.source === "structured_field" || su.schemaField) {
        const fieldKey = su.schemaField || su.value;
        val = `${responseVar}?.${fieldKey}`;
      } else if (su.source === "structured_full") {
        val = responseVar;
      } else if (su.source === "expression" || (su.value && su.value.trim().startsWith("{"))) {
        val = su.value || `state.${key}`;
        if (typeof val === "string" && val.includes("${")) {
          val = val
            .replace(/["`]\$\{response\.([a-zA-Z0-9_]+)\}["`]/g, `${responseVar}?.$1`)
            .replace(/["`]\$\{state\.([a-zA-Z0-9_]+)\}["`]/g, "state?.$1")
            .replace(/["`]\$\{([^}]+)\}["`]/g, "$1");
        }
      } else if (su.source === "message_content") {
        val = `typeof ${responseVar}?.content === "string" ? ${responseVar}.content : JSON.stringify(${responseVar}?.content ?? "")`;
      } else if (su.source === "message_object") {
        val = responseVar;
      } else if (su.source === "literal") {
        val = JSON.stringify(su.value ?? "");
      } else {
        val = su.value ? `${su.value}` : `state.${key}`;
      }
    }

    if (su.action && su.action !== "default") {
      if (isValueless) {
        returnEntries.push(`    ${key}: { action: "${su.action}" },`);
      } else {
        returnEntries.push(`    ${key}: { action: "${su.action}", value: ${val} },`);
      }
    } else {
      returnEntries.push(`    ${key}: ${val},`);
    }
  }

  bodyLines.push(`  return {`);
  bodyLines.push(...returnEntries);
  bodyLines.push(`  };`);

  const importStatements = Array.from(importMap.entries())
    .map(([source, specifiers]) => `import { ${Array.from(specifiers).join(", ")} } from "${source}";`)
    .join("\n");

  return `${importStatements}

export async function ${fnName}(state: ${schemaName}Type) {
${bodyLines.join("\n")}
}
`;
}

export function buildStepNodeFile(
  stepNode: { id: string; data: StepNodeData },
  ctx: CompileContext,
  nodeMetaMap: Map<string, NodeMeta>,
  llmMetaMap: Map<string, LLMMeta>,
  toolMetaMap?: Map<string, ToolMeta>,
): string {
  const d = stepNode.data;
  const nodeMeta = nodeMetaMap.get(stepNode.id);
  const fnName = nodeMeta
    ? nodeMeta.exportName
    : toIdentifier(d.label || `step_${stepNode.id}`);
  const schemaName = `${toPascalCase(ctx.graphId)}State`;

  if (d.stepType === "router") {
    const routerConfig = d.routerConfig;

    const branches = routerConfig?.branches || [];
    const branchLines: string[] = [];
    const possibleTargets = new Set<string>();

    for (const branch of branches) {
      // Find connected target node if targetId is not explicitly set
      let targetId = branch.targetId;
      if (!targetId) {
        const edge = ctx.input.edges.find(
          (e) => e.source === stepNode.id && e.sourceHandle === branch.id,
        );
        if (edge) {
          targetId = edge.target;
        }
      }

      let targetExpr = "";
      if (targetId) {
        const meta = nodeMetaMap.get(targetId);
        if (meta) {
          targetExpr = `"${meta.exportName}"`;
          possibleTargets.add(`"${meta.exportName}"`);
        } else if (
          targetId === "END" ||
          targetId === "__end__" ||
          targetId === NODE_ID_END
        ) {
          targetExpr = "END";
          possibleTargets.add("typeof END");
        } else {
          const ident = toIdentifier(targetId);
          targetExpr = `"${ident}"`;
          possibleTargets.add(`"${ident}"`);
        }
      } else {
        const label = branch.label || "END";
        if (label === "END" || label === "__end__") {
          targetExpr = "END";
          possibleTargets.add("typeof END");
        } else {
          targetExpr = `"${label}"`;
          possibleTargets.add(`"${label}"`);
        }
      }

      let condExpr = "";
      if (branch.conditions && branch.conditions.length > 0) {
        const condParts = branch.conditions.map((c) => {
          const rawField = c.field || "messages";
          const field = rawField.startsWith("state.")
            ? rawField
            : `state.${toCamelCase(rawField)}`;
          return buildCondition(field, c.operator || "eq", c.value || "");
        });
        condExpr = condParts.join(" && ");
      } else if (branch.field) {
        const rawField = branch.field;
        const field = rawField.startsWith("state.")
          ? rawField
          : `state.${toCamelCase(rawField)}`;
        condExpr = buildCondition(
          field,
          branch.operator || "eq",
          branch.value || "",
        );
      }

      if (condExpr) {
        branchLines.push(`  if (${condExpr}) return ${targetExpr};`);
      } else if (branch.isDefault) {
        // default branch handled below if no condition match
      }
    }

    let defaultTargetExpr = "END";
    const defaultBranch = branches.find((b) => b.isDefault);
    if (defaultBranch) {
      let defTargetId = defaultBranch.targetId;
      if (!defTargetId) {
        const edge = ctx.input.edges.find(
          (e) =>
            e.source === stepNode.id && e.sourceHandle === defaultBranch.id,
        );
        if (edge) defTargetId = edge.target;
      }
      if (defTargetId) {
        const meta = nodeMetaMap.get(defTargetId);
        if (meta) {
          defaultTargetExpr = `"${meta.exportName}"`;
          possibleTargets.add(`"${meta.exportName}"`);
        } else if (
          defTargetId === "END" ||
          defTargetId === "__end__" ||
          defTargetId === NODE_ID_END
        ) {
          defaultTargetExpr = "END";
          possibleTargets.add("typeof END");
        }
      }
    } else if (routerConfig?.defaultBranchId) {
      const meta = nodeMetaMap.get(routerConfig.defaultBranchId);
      if (meta) {
        defaultTargetExpr = `"${meta.exportName}"`;
        possibleTargets.add(`"${meta.exportName}"`);
      } else if (
        routerConfig.defaultBranchId === "END" ||
        routerConfig.defaultBranchId === "__end__"
      ) {
        defaultTargetExpr = "END";
        possibleTargets.add("typeof END");
      } else {
        const ident = toIdentifier(routerConfig.defaultBranchId);
        defaultTargetExpr = `"${ident}"`;
        possibleTargets.add(`"${ident}"`);
      }
    } else {
      possibleTargets.add("typeof END");
    }

    const returnTypeStr =
      possibleTargets.size > 0 ? [...possibleTargets].join(" | ") : "string";
    const hasEnd = possibleTargets.has("typeof END");
    const importHeader = hasEnd
      ? `import { END } from "@langchain/langgraph";\nimport { ${schemaName}Type } from "../state";`
      : `import { ${schemaName}Type } from "../state";`;

    return `${importHeader}

export function ${fnName}(state: ${schemaName}Type): ${returnTypeStr} {
${branchLines.join("\n")}
  return ${defaultTargetExpr};
}
`;
  }

  if (d.stepType === "tool_node") {
    const toolVarNames: string[] = [
      ...new Set(
        ctx.toolNodes
          .map((t) => {
            const tMeta = toolMetaMap?.get(t.id);
            return tMeta ? tMeta.varName : toIdentifier(t.data.name || `tool_${t.id}`);
          })
          .filter((x): x is string => Boolean(x)),
      ),
    ];
    return `import { ToolNode } from "@langchain/langgraph";
import { ${toolVarNames.join(", ")} } from "../tools";

export const ${fnName} = new ToolNode([${toolVarNames.join(", ")}]);
`;
  }

  if (d.stepType === "human_gate" || d.stepType === "interrupt") {
    return `import { interrupt } from "@langchain/langgraph";
import { ${schemaName}Type } from "../state";

export async function ${fnName}(state: ${schemaName}Type) {
  const humanInput = interrupt({
    question: "Review step input:",
    state,
  });
  return { messages: [{ role: "human", content: humanInput }] };
}
`;
  }

  if (d.stepType === "custom_code" || d.customCode?.body?.trim()) {
    const promptText = (d.modelConfig?.systemPrompt || "").trim();
    const codeBlock = (d.customCode?.body || "").trim();

    let bodyLines: string[] = [];
    if (promptText) {
      bodyLines.push(`  // --- Natural Language Instructions ---`);
      promptText.split("\n").forEach((line: string, idx: number) => {
        if (line.trim()) bodyLines.push(`  // STEP ${idx + 1}: ${line.trim()}`);
      });
    }
    if (codeBlock) {
      bodyLines.push(indent(codeBlock, 2));
    } else if (!promptText) {
      bodyLines.push(`  return {};`);
    }

    const body = bodyLines.join("\n");
    return `import { ${schemaName}Type } from "../state";

export async function ${fnName}(state: ${schemaName}Type) {
${body}
}
`;
  }

  return `import { ${schemaName}Type } from "../state";

export async function ${fnName}(state: ${schemaName}Type) {
  return {};
}
`;
}

export function buildNodesIndexFile(
  ctx: CompileContext,
  nodeMetaMap: Map<string, NodeMeta>,
): string {
  const files = new Set<string>();
  for (const agentNode of ctx.agentNodes) {
    const meta = nodeMetaMap.get(agentNode.id);
    if (meta) files.add(meta.fileName);
  }
  for (const stepNode of ctx.stepNodes) {
    const meta = nodeMetaMap.get(stepNode.id);
    if (meta) files.add(meta.fileName);
  }
  return [...files].map((f) => `export * from "./${f}";`).join("\n") + "\n";
}

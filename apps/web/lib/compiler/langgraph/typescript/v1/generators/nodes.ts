import type {
  CanvasNodeData,
  StepNodeData,
} from "@/app/(canvas)/project/[projectId]/_components/backend-nodes/graph-nodes/langgraph/langgraph-canvas/types";
import {
  NODE_ID_END,
  LANGGRAPH_CANVAS_NODE_END,
} from "@/app/(canvas)/project/[projectId]/_components/backend-nodes/graph-nodes/langgraph/langgraph-canvas/constants";
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
    const rendered = renderAgentPipelineSteps(pipelineSteps, d, ctx, llmVar);
    bodyLines = rendered.bodyLines;
    responseVar = rendered.llmOutputVar;
    hasLLM = rendered.hasLLMCall;

    if (hasLLM && llmVar && llmMeta) {
      addImport(`../llm/${llmMeta.fileName}`, [llmVar]);
    }

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

    const isEndTarget = (id?: string | null, label?: string | null): boolean => {
      if (!id && !label) return false;
      const lowerId = (id || "").toLowerCase();
      const lowerLabel = (label || "").toLowerCase();
      if (
        id === "END" ||
        id === "__end__" ||
        id === NODE_ID_END ||
        lowerId === "end" ||
        lowerId.startsWith("end_") ||
        lowerLabel === "end" ||
        lowerLabel === "__end__"
      ) {
        return true;
      }
      return ctx.input.nodes.some(
        (n) => n.id === id && n.type === LANGGRAPH_CANVAS_NODE_END,
      );
    };

    const getCanvasNodeNameOrLabel = (n: (typeof ctx.input.nodes)[number]): string => {
      const d = n.data;
      if (!d) return n.id;
      if ("name" in d && typeof d.name === "string" && d.name.trim()) {
        return d.name.trim();
      }
      if ("label" in d && typeof d.label === "string" && d.label.trim()) {
        return d.label.trim();
      }
      return n.id;
    };

    const resolveTargetExpr = (
      targetId: string | undefined,
      branchId: string | undefined,
      branchLabel: string | undefined,
      branchIdx: number,
    ): { expr: string; typeStr: string } => {
      // 1. Check if explicitly targeting END
      if (isEndTarget(targetId, branchLabel)) {
        return { expr: "END", typeStr: "typeof END" };
      }

      // 2. Resolve targetId if not present by inspecting outgoing edges from this router node
      let resolvedId = targetId;
      if (!resolvedId) {
        const outgoing = ctx.input.edges.filter((e) => e.source === stepNode.id);
        const edge =
          (branchId ? outgoing.find((e) => e.sourceHandle === branchId) : undefined) ||
          outgoing.find(
            (e) =>
              e.sourceHandle === `branch_${branchIdx}` ||
              e.sourceHandle === `b_${branchIdx}`,
          ) ||
          outgoing[branchIdx] ||
          (outgoing.length === 1 ? outgoing[0] : undefined);
        if (edge) {
          resolvedId = edge.target;
        }
      }

      // 3. Check again if resolvedId points to an END node
      if (isEndTarget(resolvedId, branchLabel)) {
        return { expr: "END", typeStr: "typeof END" };
      }

      // 4. Try matching with nodeMetaMap
      if (resolvedId) {
        const meta = nodeMetaMap.get(resolvedId);
        if (meta) {
          return { expr: `"${meta.exportName}"`, typeStr: `"${meta.exportName}"` };
        }
      }

      // 5. Try finding canvas node by id
      if (resolvedId) {
        const canvasNode = ctx.input.nodes.find((n) => n.id === resolvedId);
        if (canvasNode) {
          if (canvasNode.type === LANGGRAPH_CANVAS_NODE_END) {
            return { expr: "END", typeStr: "typeof END" };
          }
          const meta = nodeMetaMap.get(canvasNode.id);
          if (meta) {
            return { expr: `"${meta.exportName}"`, typeStr: `"${meta.exportName}"` };
          }
          const ident = toIdentifier(getCanvasNodeNameOrLabel(canvasNode));
          return { expr: `"${ident}"`, typeStr: `"${ident}"` };
        }
      }

      // 6. Match by branch label matching an existing node name or label in the graph
      if (branchLabel) {
        const lowerLabel = branchLabel.toLowerCase();
        const matchedNode = ctx.input.nodes.find(
          (n) => getCanvasNodeNameOrLabel(n).toLowerCase() === lowerLabel,
        );
        if (matchedNode) {
          if (matchedNode.type === LANGGRAPH_CANVAS_NODE_END) {
            return { expr: "END", typeStr: "typeof END" };
          }
          const meta = nodeMetaMap.get(matchedNode.id);
          if (meta) {
            return { expr: `"${meta.exportName}"`, typeStr: `"${meta.exportName}"` };
          }
          const ident = toIdentifier(getCanvasNodeNameOrLabel(matchedNode));
          return { expr: `"${ident}"`, typeStr: `"${ident}"` };
        }
      }

      // 7. If still unresolved and there's a resolvedId, format it as an identifier
      if (resolvedId) {
        const ident = toIdentifier(resolvedId);
        return { expr: `"${ident}"`, typeStr: `"${ident}"` };
      }

      // 8. Fallback to END
      return { expr: "END", typeStr: "typeof END" };
    };

    for (let idx = 0; idx < branches.length; idx++) {
      const branch = branches[idx]!;
      const { expr: targetExpr, typeStr } = resolveTargetExpr(
        branch.targetId,
        branch.id,
        branch.label,
        idx,
      );
      possibleTargets.add(typeStr);

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
        // default branch — handled as the final return below
      } else if (targetExpr) {
        // Non-default branch with no condition expression: treat as fallback
        branchLines.push(`  // Branch "${branch.label || branch.id || `route_${idx + 1}`}" has no condition`);
        branchLines.push(`  return ${targetExpr};`);
      }
    }

    let defaultTargetExpr = "END";
    possibleTargets.add("typeof END");

    const defaultBranch = branches.find((b) => b.isDefault);
    if (defaultBranch) {
      const defRes = resolveTargetExpr(
        defaultBranch.targetId,
        defaultBranch.id,
        defaultBranch.label,
        branches.indexOf(defaultBranch),
      );
      defaultTargetExpr = defRes.expr;
      possibleTargets.add(defRes.typeStr);
    } else if (routerConfig?.defaultBranchId) {
      const defRes = resolveTargetExpr(
        routerConfig.defaultBranchId,
        undefined,
        undefined,
        -1,
      );
      defaultTargetExpr = defRes.expr;
      possibleTargets.add(defRes.typeStr);
    }

    const returnTypeStr =
      possibleTargets.size > 0 ? [...possibleTargets].join(" | ") : "string";
    const hasEnd = possibleTargets.has("typeof END") || defaultTargetExpr === "END";
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

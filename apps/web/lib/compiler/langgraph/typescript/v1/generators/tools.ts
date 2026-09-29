import type { CompileContext, ToolMeta } from "../types";
import { jsonSchemaToZod, escapeStr, indent } from "../utils";

export function buildToolsFile(
  ctx: CompileContext,
  toolMetaMap: Map<string, ToolMeta>,
): string {
  if (ctx.toolNodes.length === 0) return "// No tools defined";

  const parts: string[] = [
    `import { tool } from "@langchain/core/tools";`,
    `import { z } from "zod";`,
    ``,
  ];

  const seenVarNames = new Set<string>();
  const seenNodeIds = new Set<string>();

  for (const toolNode of ctx.toolNodes) {
    if (seenNodeIds.has(toolNode.id)) continue;
    seenNodeIds.add(toolNode.id);

    const d = toolNode.data;
    const meta = toolMetaMap.get(toolNode.id);
    const fnName = meta
      ? meta.varName
      : `tool_${toolNode.id.replace(/[^a-zA-Z0-9_]/g, "_")}`;

    if (seenVarNames.has(fnName)) continue;
    seenVarNames.add(fnName);

    let inputSchemaCode = "z.object({})";

    if (d.inputSchema) {
      try {
        const schema = JSON.parse(d.inputSchema);
        inputSchemaCode = jsonSchemaToZod(schema);
      } catch {
        inputSchemaCode = `z.object({})`;
      }
    }

    if (d.source === "api_endpoint") {
      parts.push(`export const ${fnName} = tool(
  async (input) => {
    const response = await fetch("${d.endpointUrl || "https://api.example.com"}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(\`API error: \${response.status}\`);
    return response.json();
  },
  {
    name: "${d.name || fnName}",
    description: "${escapeStr(d.description)}",
    schema: ${inputSchemaCode},
  }
);`);
      continue;
    }

    const promptText = (d.prompt || "").trim();
    const codeBlock = (d.functionBody || "").trim();

    let bodyLines: string[] = [];
    if (promptText) {
      bodyLines.push(`    // --- Natural Language Instructions ---`);
      promptText.split("\n").forEach((line: string, idx: number) => {
        if (line.trim())
          bodyLines.push(`    // STEP ${idx + 1}: ${line.trim()}`);
      });
    }
    if (codeBlock) {
      bodyLines.push(indent(codeBlock, 4));
    } else if (!promptText) {
      bodyLines.push(`    return "Tool execution success";`);
    }

    const body = bodyLines.join("\n");

    parts.push(`export const ${fnName} = tool(
  async (input) => {
${body}
  },
  {
    name: "${d.name || fnName}",
    description: "${escapeStr(d.description)}",
    schema: ${inputSchemaCode},
  }
);`);
  }

  return parts.join("\n\n");
}

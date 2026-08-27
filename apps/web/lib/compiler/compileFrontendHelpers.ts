import { BackendNode, BackendEdge } from "@/types/canvas";
import { CompiledFile, Endpoint } from "@workspace/canvas/types";
import { toPascalCase, toVarName } from "./utils";

export interface CompiledFrontendResult {
  /** Global files to write into packages/ui/ or packages/hooks/ */
  globalFiles: CompiledFile[];
  /** App-local files keyed by appSlug */
  appLocalFiles: Map<string, CompiledFile[]>;
}

function mapTypeToTs(type: string): string {
  const t = (type || "string").toLowerCase();
  if (["number", "int", "integer", "float", "double"].includes(t)) return "number";
  if (["boolean", "bool"].includes(t)) return "boolean";
  if (["string[]", "array"].includes(t)) return "string[]";
  if (["object", "record"].includes(t)) return "Record<string, string | number | boolean | null>";
  return "string";
}

/**
 * Generates a TypeScript React Hook file
 */
export function generateHookFile(
  hookNode: BackendNode,
  allNodes: BackendNode[] = [],
  endpoints: (Endpoint & { nodeId: string })[] = [],
): CompiledFile {
  const rawName = hookNode.data?.hookName || hookNode.data?.label || "useCustomHook";
  const hookName = rawName.startsWith("use")
    ? rawName
    : `use${toPascalCase(toVarName(rawName))}`;
  const Pascal = toPascalCase(toVarName(hookName.replace(/^use/, "")));

  const inputParams = hookNode.data?.inputParams || [];
  const returnSchema = hookNode.data?.returnSchema || [];

  // Build input args interface
  const inputInterfaceName = `${Pascal}Args`;
  const inputFields =
    inputParams.length > 0
      ? inputParams
          .map(
            (p) =>
              `  ${p.name}${p.required === false ? "?" : ""}: ${mapTypeToTs(p.type)};`,
          )
          .join("\n")
      : "  [key: string]: string | number | boolean | null | undefined;";

  // Build return interface
  const returnInterfaceName = `${Pascal}Result`;
  const returnFields =
    returnSchema.length > 0
      ? returnSchema
          .map(
            (r) =>
              `  ${r.name}${r.required === false ? "?" : ""}: ${mapTypeToTs(r.type)};`,
          )
          .join("\n")
      : `  data: Record<string, string | number | boolean | null> | null;\n  isLoading: boolean;\n  error: Error | null;`;

  // Linked endpoint details
  const endpointId = hookNode.data?.targetEndpointId;
  const boundEndpoint = endpoints.find((e) => e.id === endpointId);

  let body = "";
  if (hookNode.data?.code && hookNode.data.code.trim()) {
    body = hookNode.data.code
      .split("\n")
      .map((l) => `  ${l}`)
      .join("\n");
  } else if (boundEndpoint) {
    const method = (boundEndpoint.type || "GET").toUpperCase();
    const route = boundEndpoint.name || "/";
    body = `  const [data, setData] = useState<Record<string, string | number | boolean | null> | null>(null);\n  const [isLoading, setIsLoading] = useState<boolean>(false);\n  const [error, setError] = useState<Error | null>(null);\n\n  useEffect(() => {\n    let isMounted = true;\n    setIsLoading(true);\n    fetch("${route}", {\n      method: "${method}",\n      headers: { "Content-Type": "application/json" },\n    })\n      .then((res) => res.json())\n      .then((json: Record<string, string | number | boolean | null>) => { if (isMounted) { setData(json); setIsLoading(false); } })\n      .catch((err: Error) => { if (isMounted) { setError(err); setIsLoading(false); } });\n    return () => { isMounted = false; };\n  }, [JSON.stringify(args)]);\n\n  return { data, isLoading, error };`;
  } else {
    body = `  const [data, setData] = useState<Record<string, string | number | boolean | null> | null>(null);\n  const [isLoading, setIsLoading] = useState<boolean>(false);\n  const [error, setError] = useState<Error | null>(null);\n\n  // TODO: Implement custom hook logic\n  return { data, isLoading, error };`;
  }

  const content = `"use client";\n\nimport { useState, useEffect } from "react";\n\nexport interface ${inputInterfaceName} {\n${inputFields}\n}\n\nexport interface ${returnInterfaceName} {\n${returnFields}\n}\n\nexport function ${hookName}(args?: ${inputInterfaceName}): ${returnInterfaceName} {\n${body}\n}\n`;

  return {
    filename: `hooks/${hookName}.ts`,
    language: "typescript",
    content,
  };
}

/**
 * Compiles all frontend Hook nodes into Global Packages and App-Local Directories
 */
export function compileFrontendNodes(
  allNodes: BackendNode[],
  allEdges: BackendEdge[] = [],
  endpoints: (Endpoint & { nodeId: string })[] = [],
): CompiledFrontendResult {
  const globalFiles: CompiledFile[] = [];
  const appLocalFiles = new Map<string, CompiledFile[]>();

  const hookNodes = allNodes.filter((n) => n.type === "hook");
  const webAppNodes = allNodes.filter((n) => n.type === "webApp");

  // Helper to resolve appSlug for a node
  const getAppSlugForNode = (node: BackendNode): string => {
    if (node.data?.targetWebAppId) {
      const app = webAppNodes.find((a) => a.id === node.data?.targetWebAppId);
      if (app) {
        return (
          app.data?.appSlug ||
          app.data?.label?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
          "web-app"
        );
      }
    }
    return (
      webAppNodes[0]?.data?.appSlug ||
      webAppNodes[0]?.data?.label?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
      "web-app"
    );
  };

  // Process Hook Nodes
  hookNodes.forEach((hNode) => {
    const file = generateHookFile(hNode, allNodes, endpoints);
    if (hNode.data?.scope === "global") {
      globalFiles.push({
        ...file,
        filename: `packages/ui/src/${file.filename}`,
      });
    } else {
      const appSlug = getAppSlugForNode(hNode);
      if (!appLocalFiles.has(appSlug)) {
        appLocalFiles.set(appSlug, []);
      }
      appLocalFiles.get(appSlug)!.push(file);
    }
  });

  return {
    globalFiles,
    appLocalFiles,
  };
}

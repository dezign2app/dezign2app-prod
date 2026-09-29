// ═══════════════════════════════════════════════════════════════════════════
// MODULE:  appCompilers
// LAYER:   compilers
// PURPOSE: Compiles individual app packages: standalone service nodes
//          (step 5) and web app clients (step 6).
//
// EMITS:
//   apps/<serviceFolder>/**                     (Express / FastAPI / Next.js services)
//   apps/<webAppFolder>/**                      (Next.js web-app clients)
// ═══════════════════════════════════════════════════════════════════════════

import { BackendNode, BackendEdge, SimulationTestCase } from "@/types/canvas";
import {
  Endpoint,
  AnyMessagingResource,
  CompiledFile,
  ReusableFunction,
} from "@workspace/canvas/types";
import { FolderEntry } from "./folderNameResolver";
import { WebAppEntry } from "./webAppMapper";
import { compileServiceNode } from "../compileServiceNode";
import { compileWebPageNodes } from "../compileWebPageNode";
import { compileFrontendNodes } from "../compileFrontendHelpers";

/** Output produced by {@link compileAllApps}. */
export interface AllAppsResult {
  /** All generated app files with their fully-qualified `apps/<folder>/...` paths. */
  files: CompiledFile[];
}

/**
 * Compiles all three app categories and returns their combined file list.
 *
 * Step 5   — Standalone service nodes (Express / FastAPI / Next.js microservices)
 * Step 5.5 — LangGraph AI agent graphs (injected into the service that uses them)
 * Step 6   — Web-app clients (Next.js full-stack apps with connected WebPage nodes)
 *
 * @debugTag app-compilers-step-5-to-6
 */
export function compileAllApps(params: {
  standaloneServiceNodes: BackendNode[];
  langGraphNodes: BackendNode[];
  webAppMap: Map<string, WebAppEntry>;
  servicesInfo: FolderEntry[];
  webClientsInfo: FolderEntry[];
  nodes: BackendNode[];
  edges: BackendEdge[];
  endpoints: (Endpoint & { nodeId: string })[];
  events: (AnyMessagingResource & { nodeId: string; variant: "publish" | "consume" })[];
  testCases: SimulationTestCase[];
  dbFunctions: ReusableFunction[];
  kafkaFunctions: ReusableFunction[];
  redisFunctions: ReusableFunction[];
  externalFunctions: ReusableFunction[];
  storageFunctions?: ReusableFunction[];
  compiledFrontend: ReturnType<typeof compileFrontendNodes>;
  projectName: string;
  getUniqueLangGraphFolder: (label: string, defaultName: string) => string;
  getUniqueWebAppFolder: (slug: string, defaultName: string) => string;
}): AllAppsResult {
  const files: CompiledFile[] = [];

  const {
    standaloneServiceNodes,
    langGraphNodes,
    webAppMap,
    servicesInfo,
    webClientsInfo,
    nodes,
    edges,
    endpoints,
    events,
    testCases,
    dbFunctions,
    kafkaFunctions,
    redisFunctions,
    externalFunctions,
    storageFunctions = [],
    compiledFrontend,
    projectName,
    getUniqueWebAppFolder,
  } = params;

  // ── step 5 | standalone service nodes ────────────────────────────────────
  // ✦ emits: apps/<serviceFolder>/**
  standaloneServiceNodes.forEach((srvNode) => {
    const srvInfo = servicesInfo.find((s) => s.id === srvNode.id);
    if (!srvInfo) return; // pre-populated in planning pass — should never be missing

    const folderName = srvInfo.folderName;

    const srvResult = compileServiceNode(
      srvNode,
      endpoints,
      events,
      nodes,
      edges,
      testCases,
      [...dbFunctions, ...externalFunctions],
      kafkaFunctions,
      folderName,
      redisFunctions,
      storageFunctions,
    );

    srvResult.files.forEach((f) => {
      // ✦ step-5 | service → apps/<folderName>/<filename>
      files.push({
        filename: `apps/${folderName}/${f.filename}`,
        language: f.language,
        content: f.content,
      });
    });
  });

  // ── step 6 | web-app clients ─────────────────────────────────────────────
  // ✦ emits: apps/<appSlug>/**
  webAppMap.forEach(({ appName, appSlug, pageNodes, webAppNode }) => {
    const folderName = getUniqueWebAppFolder(appSlug, "web-app");
    webClientsInfo.push({
      id: `web-app-${appSlug}`,
      name: appName,
      folderName,
    });

    const webClientResult = compileWebPageNodes(
      pageNodes,
      endpoints,
      events,
      nodes,
      edges,
      `${projectName} - ${appName}`,
      testCases,
      folderName,
      webAppNode,
    );

    webClientResult.files.forEach((f) => {
      // ✦ step-6 | webapp → apps/<folderName>/<filename>
      files.push({
        filename: `apps/${folderName}/${f.filename}`,
        language: f.language,
        content: f.content,
      });
    });

    // ── step 6.1 | app-local frontend hooks & components ─────────────────
    // ✦ emits: apps/<folderName>/hooks/**, apps/<folderName>/components/**
    const appLocalItems =
      compiledFrontend.appLocalFiles.get(appSlug) ||
      compiledFrontend.appLocalFiles.get(folderName) ||
      [];
    appLocalItems.forEach((f) => {
      // ✦ step-6.1 | app-local frontend → apps/<folderName>/<filename>
      files.push({
        filename: `apps/${folderName}/${f.filename}`,
        language: f.language,
        content: f.content,
      });
    });
  });

  return { files };
}

import { BackendNode, BackendEdge, SimulationTestCase } from "@/types/canvas";
import {
  Endpoint,
  AnyMessagingResource,
  CompiledFile,
  PipelineStep,
  WebAppZone,
  PageSection,
} from "@workspace/canvas/types";
import { compileMonorepo } from "@/lib/compiler/compileMonorepo";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import {
  DeletionTarget,
  NodeArchitectureImpact,
  SeveredConnectionInfo,
  CascadeElementInfo,
  BrokenReferenceInfo,
} from "./types";
import { NodeDeletionDiffResult } from "@/lib/compiler/nodeDeletionDiff";

export interface SubItemDeletionComputationResult {
  architectureImpact: NodeArchitectureImpact;
  diff: NodeDeletionDiffResult;
}

/**
 * Computes both Architecture Impact and Monorepo Code Diff for granular canvas sub-items
 * (e.g. database columns, table indexes, page sections, access zones, endpoints).
 */
export function computeSubItemDeletion(
  nodes: BackendNode[],
  endpoints: (Endpoint & { nodeId: string })[] = [],
  events: (AnyMessagingResource & {
    nodeId: string;
    variant: "publish" | "consume";
  })[] = [],
  edges: BackendEdge[] = [],
  testCases: SimulationTestCase[] = [],
  projectName: string = "Blueprint Monorepo",
  target: DeletionTarget,
): SubItemDeletionComputationResult {
  let filesBefore: CompiledFile[] = [];
  try {
    const beforeNodes =
      target.type === "pageRename"
        ? nodes.map((n) =>
            n.id === target.nodeId
              ? { ...n, data: { ...n.data, label: target.oldLabel } }
              : n,
          )
        : nodes;

    filesBefore = compileMonorepo(
      beforeNodes,
      endpoints,
      events,
      edges,
      testCases,
      projectName,
    ).files;
  } catch (e) {
    console.error("[computeSubItemDeletion] Error compiling before state:", e);
  }

  let nextNodes = [...nodes];
  let nextEndpoints = [...endpoints];
  let nextEvents = [...events];
  let nextEdges = [...edges];

  const severedConnections: SeveredConnectionInfo[] = [];
  const cascadeElements: CascadeElementInfo[] = [];
  const brokenReferences: BrokenReferenceInfo[] = [];
  const targetNodes: NodeArchitectureImpact["targetNodes"] = [];

  if (target.type === "column") {
    const parentNode = nodes.find((n) => n.id === target.nodeId);
    const tableLabel = parentNode?.data?.label || "Table";
    const colName = target.column.name;
    const colLower = colName.toLowerCase();

    targetNodes.push({
      id: target.nodeId,
      label: `${tableLabel}.${colName}`,
      type: "column",
      dbEngine: parentNode?.data?.dbEngine || parentNode?.type,
      techStack: target.column.type || "TEXT",
    });

    // 1. Simulate canvas modification: remove column from table
    nextNodes = nodes.map((n) => {
      if (n.id === target.nodeId) {
        const columns = n.data?.columns || [];
        const remainingCols = columns.filter((c) => c.name !== colName);
        return {
          ...n,
          data: {
            ...n.data,
            columns: remainingCols,
          },
        };
      }
      return n;
    });

    // 2. Severed Edges connected to this column
    edges.forEach((e) => {
      const isConnected =
        (e.source === target.nodeId &&
          (e.sourceHandle === colName ||
            e.sourceHandle === `col-source-${colName}`)) ||
        (e.target === target.nodeId &&
          (e.targetHandle === colName ||
            e.targetHandle === `col-target-${colName}`));

      if (isConnected) {
        const otherNode = nodes.find(
          (n) => n.id === (e.source === target.nodeId ? e.target : e.source),
        );
        severedConnections.push({
          edgeId: e.id,
          edgeType: e.type,
          sourceNodeId: e.source,
          sourceNodeLabel: tableLabel,
          sourceNodeType: parentNode?.type || "entity",
          targetNodeId: e.target,
          targetNodeLabel: otherNode?.data?.label || "Target",
          targetNodeType: otherNode?.type || "node",
          otherNodeId: otherNode?.id || "",
          otherNodeLabel: otherNode?.data?.label || "Node",
          otherNodeType: otherNode?.type || "node",
          direction: e.source === target.nodeId ? "outgoing" : "incoming",
          description: `Severed relation link on handle "${colName}"`,
        });
      }
    });

    // 3. Cascade affected DB Functions on this table
    if (parentNode) {
      const dbOps = getEntityDbOperations(parentNode, nodes);
      dbOps.forEach((op) => {
        const hasParam = op.params?.some(
          (p) => p.name.toLowerCase() === colLower,
        );
        const isPkOp =
          target.column.isPrimaryKey &&
          (op.kind === "findById" || op.kind === "delete" || op.kind === "update");
        const mentionsCol =
          op.name.toLowerCase().includes(colLower) ||
          op.prompt?.toLowerCase().includes(colLower) ||
          op.query?.toLowerCase().includes(colLower) ||
          op.code?.toLowerCase().includes(colLower);

        if (hasParam || isPkOp || mentionsCol) {
          cascadeElements.push({
            id: op.id,
            label: `${tableLabel}.${op.name}`,
            type: op.kind,
            category: "step",
            description: `DB function signature/implementation references "${colName}"`,
          });
        }
      });
    }

    // 4. Broken Foreign Keys in other tables
    const tableLabelLower = tableLabel.toLowerCase();
    nodes.forEach((n) => {
      if (n.type === "entity" && n.id !== target.nodeId) {
        const columns = n.data?.columns || [];
        columns.forEach((otherCol) => {
          if (
            otherCol.references?.table?.toLowerCase() === tableLabelLower &&
            otherCol.references?.column?.toLowerCase() === colLower
          ) {
            brokenReferences.push({
              referencingNodeId: n.id,
              referencingNodeLabel: n.data?.label || "Table",
              referencingNodeType: "entity",
              referenceType: "Foreign Key",
              description: `Column "${otherCol.name}" references deleted column "${tableLabel}.${colName}"`,
            });
          }
        });
      }
    });

    // 5. Broken references in Server Endpoints
    endpoints.forEach((ep) => {
      const serviceNode = nodes.find((n) => n.id === ep.nodeId);
      const serviceLabel = serviceNode?.data?.label || "Service";

      const steps: PipelineStep[] = ep.pipelineSteps || [];
      for (const step of steps) {
        if (step.tableNodeId === target.nodeId || step.databaseId === target.nodeId) {
          const isBindingMatch = step.inputBindings?.some((b) => {
            const isArgMatch = b.argName.toLowerCase() === colLower;
            const isSourceFieldMatch =
              b.source.kind !== "literal" &&
              "field" in b.source &&
              b.source.field?.toLowerCase() === colLower;
            return isArgMatch || isSourceFieldMatch;
          });

          const isFunctionMatch =
            step.functionRef?.name.toLowerCase().includes(colLower) ||
            step.name.toLowerCase().includes(colLower);

          if (isBindingMatch || isFunctionMatch) {
            brokenReferences.push({
              referencingNodeId: ep.nodeId,
              referencingNodeLabel: `${serviceLabel} → ${ep.name}`,
              referencingNodeType: "endpoint",
              referenceType: "Pipeline Step",
              description: `Pipeline step "${step.name}" references column "${colName}"`,
            });
            break;
          }
        }
      }
    });
  } else if (target.type === "index") {
    const parentNode = nodes.find((n) => n.id === target.nodeId);
    const tableLabel = parentNode?.data?.label || "Table";
    const indexName = target.indexItem.name;

    targetNodes.push({
      id: target.nodeId,
      label: `${tableLabel} (${indexName})`,
      type: "index",
      dbEngine: parentNode?.data?.dbEngine || parentNode?.type,
      techStack: target.indexItem.isUnique ? "UNIQUE INDEX" : "INDEX",
    });

    // Remove index from table
    nextNodes = nodes.map((n) => {
      if (n.id === target.nodeId) {
        const indexes = n.data?.indexes || [];
        const remainingIdxs = indexes.filter((idx) => idx.name !== indexName);
        return {
          ...n,
          data: {
            ...n.data,
            indexes: remainingIdxs,
          },
        };
      }
      return n;
    });

    // Affected fetchByIndex operations
    if (parentNode) {
      const dbOps = getEntityDbOperations(parentNode, nodes);
      dbOps.forEach((op) => {
        if (op.kind === "fetchByIndex" && op.name.toLowerCase().includes(indexName.toLowerCase())) {
          cascadeElements.push({
            id: op.id,
            label: `${tableLabel}.${op.name}`,
            type: "fetchByIndex",
            category: "step",
            description: `Index query function configured for index "${indexName}"`,
          });
        }
      });
    }
  } else if (target.type === "section") {
    const parentNode = nodes.find((n) => n.id === target.nodeId);
    const pageLabel = parentNode?.data?.label || "Page";
    const sectionName = target.section.name || target.section.title || "Section";

    targetNodes.push({
      id: target.nodeId,
      label: `${pageLabel} → ${sectionName}`,
      type: "section",
      techStack: target.section.type || "Section",
    });

    nextNodes = nodes.map((n) => {
      if (n.id === target.nodeId) {
        const sections: PageSection[] = n.data?.sections || [];
        const remainingSections = sections.filter((s) => s.id !== target.section.id);
        return {
          ...n,
          data: {
            ...n.data,
            sections: remainingSections,
          },
        };
      }
      return n;
    });
  } else if (target.type === "action") {
    const parentNode = nodes.find((n) => n.id === target.nodeId);
    const pageLabel = parentNode?.data?.label || "Page";
    const actionName = target.action.name || target.action.event || "Action";

    targetNodes.push({
      id: target.action.id,
      label: `${pageLabel} → ${actionName}`,
      type: "action",
      techStack: target.action.event || "click",
    });

    // 1. Simulate canvas modification: remove action from sections
    nextNodes = nodes.map((n) => {
      if (n.id === target.nodeId) {
        const sections: PageSection[] = n.data?.sections || [];
        const updatedSections = sections.map((sec) => ({
          ...sec,
          actions: (sec.actions || []).filter((act) => act.id !== target.action.id),
        }));
        return {
          ...n,
          data: {
            ...n.data,
            sections: updatedSections,
          },
        };
      }
      return n;
    });

    // 2. Severed connections originating from this action's handle
    const actionHandle = `events-${target.action.id}`;
    edges.forEach((e) => {
      if (e.source === target.nodeId && e.sourceHandle === actionHandle) {
        const targetNode = nodes.find((n) => n.id === e.target);
        severedConnections.push({
          edgeId: e.id,
          edgeType: e.type,
          sourceNodeId: e.source,
          sourceNodeLabel: `${pageLabel} (${actionName})`,
          sourceNodeType: "webPage",
          targetNodeId: e.target,
          targetNodeLabel: targetNode?.data?.label || "Target",
          targetNodeType: targetNode?.type || "node",
          otherNodeId: targetNode?.id || "",
          otherNodeLabel: targetNode?.data?.label || "Node",
          otherNodeType: targetNode?.type || "node",
          direction: "outgoing",
          description: `Severed event trigger connection to "${targetNode?.data?.label || "Target"}"`,
        });

        // 3. Cascade check: if connected to page_ref with no other incoming edges
        if (targetNode && targetNode.type === "page_ref") {
          const remainingEdges = edges.filter(
            (edge) => edge.target === targetNode.id && edge.id !== e.id,
          );
          if (remainingEdges.length === 0) {
            cascadeElements.push({
              id: targetNode.id,
              label: targetNode.data?.label || "Page Reference",
              type: "page_ref",
              category: "ref",
              description: `Orphaned page navigation reference node "${targetNode.data?.label || "Page Reference"}"`,
            });
            nextNodes = nextNodes.filter((n) => n.id !== targetNode.id);
          }
        }
      }
    });
  } else if (target.type === "zone") {
    const parentNode = nodes.find((n) => n.id === target.nodeId);
    const appLabel = parentNode?.data?.label || "WebApp";
    const zoneName = target.zone.name || target.zone.route || "Zone";

    targetNodes.push({
      id: target.nodeId,
      label: `${appLabel} → ${zoneName}`,
      type: "zone",
      techStack: "Access Zone",
    });

    nextNodes = nodes.map((n) => {
      if (n.id === target.nodeId) {
        const zones: WebAppZone[] = n.data?.zones || [];
        const remainingZones = zones.filter((z) => z.id !== target.zone.id);
        return {
          ...n,
          data: {
            ...n.data,
            zones: remainingZones,
          },
        };
      }
      return n;
    });
  } else if (target.type === "endpoint") {
    const parentNode = nodes.find((n) => n.id === target.nodeId);
    const serviceLabel = parentNode?.data?.label || "Service";

    targetNodes.push({
      id: target.endpoint.id,
      label: `${serviceLabel} → ${target.endpoint.type || "GET"} ${target.endpoint.name}`,
      type: "endpoint",
      techStack: target.endpoint.type || "GET",
    });

    nextEndpoints = endpoints.filter((ep) => ep.id !== target.endpoint.id);
  } else if (target.type === "pageRename") {
    const parentNode = nodes.find((n) => n.id === target.nodeId);
    const oldLabel = target.oldLabel || parentNode?.data?.label || "Page";
    const newLabel = target.newLabel;

    targetNodes.push({
      id: target.nodeId,
      label: `${oldLabel} → ${newLabel}`,
      type: "webPage",
      techStack: "Next.js Page",
    });

    // 1. Simulate canvas modification: update page label to newLabel
    nextNodes = nodes.map((n) => {
      if (n.id === target.nodeId) {
        return {
          ...n,
          data: {
            ...n.data,
            label: newLabel,
          },
        };
      }
      return n;
    });

    // 2. Cascade check: page references connected to this page
    edges.forEach((e) => {
      if (e.target === target.nodeId || e.source === target.nodeId) {
        const otherId = e.source === target.nodeId ? e.target : e.source;
        const otherNode = nodes.find((n) => n.id === otherId);
        if (otherNode && otherNode.type === "page_ref") {
          cascadeElements.push({
            id: otherNode.id,
            label: otherNode.data?.label || "Page Reference",
            type: "page_ref",
            category: "ref",
            description: `Page reference pointing to "${oldLabel}" updated to "${newLabel}"`,
          });
        }
      }
    });

    // 3. Check actions in other pages navigating to this page
    nodes.forEach((n) => {
      if (n.id !== target.nodeId && n.type === "webPage") {
        const sections: PageSection[] = n.data?.sections || [];
        sections.forEach((sec) => {
          (sec.actions || []).forEach((act) => {
            if (act.event === "navigateToPage" && act.targetPageId === target.nodeId) {
              brokenReferences.push({
                referencingNodeId: n.id,
                referencingNodeLabel: `${n.data?.label || "Page"} → ${act.name || "Action"}`,
                referencingNodeType: "webPage",
                referenceType: "Navigation Target",
                description: `Navigation action routing updated from "${oldLabel}" to "${newLabel}"`,
              });
            }
          });
        });
      }
    });
  } else if (target.type === "custom") {
    targetNodes.push({
      id: target.nodeId || "custom",
      label: target.itemLabel || "Item",
      type: target.itemType || "item",
    });
  }

  // Compile monorepo with updated nodes/endpoints
  let filesAfter: CompiledFile[] = [];
  try {
    filesAfter = compileMonorepo(
      nextNodes,
      nextEndpoints,
      nextEvents,
      nextEdges,
      testCases,
      projectName,
    ).files;
  } catch (e) {
    console.error("[computeSubItemDeletion] Error compiling after state:", e);
    filesAfter = filesBefore;
  }

  // Calculate file diffs
  const deletedFiles: string[] = [];
  const modifiedFiles: string[] = [];
  const addedFiles: string[] = [];

  const beforeMap = new Map<string, string>();
  filesBefore.forEach((f) => beforeMap.set(f.filename, f.content));

  const afterMap = new Map<string, string>();
  filesAfter.forEach((f) => afterMap.set(f.filename, f.content));

  beforeMap.forEach((beforeContent, filename) => {
    if (!afterMap.has(filename)) {
      deletedFiles.push(filename);
    } else if (afterMap.get(filename) !== beforeContent) {
      modifiedFiles.push(filename);
    }
  });

  afterMap.forEach((_, filename) => {
    if (!beforeMap.has(filename)) {
      addedFiles.push(filename);
    }
  });

  const diff: NodeDeletionDiffResult = {
    deletedNodes: targetNodes.map((t) => ({
      id: t.id,
      label: t.label,
      type: t.type,
    })),
    deletedFiles,
    modifiedFiles,
    addedFiles,
    totalAffectedCount: deletedFiles.length + modifiedFiles.length + addedFiles.length,
    filesBefore,
    filesAfter,
  };

  const totalCanvasImpactCount =
    severedConnections.length + cascadeElements.length + brokenReferences.length;

  const architectureImpact: NodeArchitectureImpact = {
    targetNodes,
    severedConnections,
    cascadeElements,
    brokenReferences,
    totalCanvasImpactCount,
  };

  return {
    architectureImpact,
    diff,
  };
}

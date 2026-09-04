import { PipelineStep, CanvasEntityColumn } from "@workspace/canvas/types";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import {
  DeletionColumnTarget,
  NodeArchitectureImpact,
  SeveredConnectionInfo,
  CascadeElementInfo,
  BrokenReferenceInfo,
} from "../types";
import { SubItemSimulationContext, SubItemSimulationResult } from "./types";

export function handleColumnDeletion(
  ctx: SubItemSimulationContext,
  target: DeletionColumnTarget,
): SubItemSimulationResult {
  const { nodes, endpoints, events, edges } = ctx;
  const parentNode = nodes.find((n) => n.id === target.nodeId);
  const tableLabel = parentNode?.data?.label || "Table";
  const colName = target.column.name;
  const colLower = colName.toLowerCase();

  const targetNodes: NodeArchitectureImpact["targetNodes"] = [
    {
      id: target.nodeId,
      label: `${tableLabel}.${colName}`,
      type: "column",
      dbEngine: parentNode?.data?.dbEngine || parentNode?.type,
      techStack: target.column.type || "TEXT",
    },
  ];

  // 1. Simulate canvas modification: remove column from table
  const nextNodes = nodes.map((n) => {
    if (n.id === target.nodeId) {
      const columns: CanvasEntityColumn[] = n.data?.columns || [];
      const remainingCols = columns.filter((c: CanvasEntityColumn) => c.name !== colName);
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

  const severedConnections: SeveredConnectionInfo[] = [];
  const cascadeElements: CascadeElementInfo[] = [];
  const brokenReferences: BrokenReferenceInfo[] = [];

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
      const columns: CanvasEntityColumn[] = n.data?.columns || [];
      columns.forEach((otherCol: CanvasEntityColumn) => {
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
            b.source.kind !== "inline" &&
            "field" in b.source &&
            typeof b.source.field === "string" &&
            b.source.field.toLowerCase() === colLower;
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

  return {
    nextNodes,
    nextEndpoints: [...endpoints],
    nextEvents: [...events],
    nextEdges: [...edges],
    targetNodes,
    severedConnections,
    cascadeElements,
    brokenReferences,
  };
}

"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { NodeProps, Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import {
  CANVAS_HANDLE_CLASS,
  CANVAS_HANDLE_LEFT_OFFSET_CLASS,
  CANVAS_HANDLE_RIGHT_OFFSET_CLASS,
} from "@workspace/canvas/constants";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  useSimulationNodeState,
  getSimulationNodeBorderClass,
} from "../../common";
import type { CustomTypeItem } from "@workspace/canvas/types";
import {
  createExtendedTypeNode,
  refreshPackageTypesFromNodeModules,
} from "@/lib/stores/backendCanvas/packageTypesSync";
import {
  TypesNodeHeader,
  TypesNodeInstallBanner,
  TypesNodeEntityWarningBanner,
  TypesNodeList,
} from "./types-node";

export const TypesNode = ({
  id,
  data,
  selected,
}: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const deleteNode = useBackendCanvasStore((s) => s.deleteNode);
  const deleteEdge = useBackendCanvasStore((s) => s.deleteEdge);
  const edges = useBackendCanvasStore((s) => s.edges);
  const requestDeleteNode = useBackendCanvasStore((s) => s.requestDeleteNode);
  const setActiveConfigItem = useBackendCanvasStore(
    (s) => s.setActiveConfigItem,
  );
  const updateNodeInternals = useUpdateNodeInternals();

  const simulation = useSimulationNodeState(id);
  const borderClass = getSimulationNodeBorderClass(
    simulation,
    Boolean(selected),
  );

  const [isEditing, setIsEditing] = useState(!data.label || data.label.trim() === "");
  const [name, setName] = useState(data.label || "");
  const inputRef = useRef<HTMLInputElement>(null);

  const rawTypesList: CustomTypeItem[] = data.types || [];
  const [isRefreshing, setIsRefreshing] = useState(false);

  const COLLAPSED_THRESHOLD = 6;
  const [isListCollapsed, setIsListCollapsed] = useState(true);

  // Extended/connected = has an active outgoing edge OR extends another type.
  // Pinned above scroll so xyflow can reliably position handles.
  const { connectedTypes, restTypes, totalCount } = useMemo(() => {
    const connected: CustomTypeItem[] = [];
    const rest: CustomTypeItem[] = [];
    for (const t of rawTypesList) {
      const hasOutgoing = edges.some(
        (e) => e.source === id && e.sourceHandle === `type-out-${t.id}`,
      );
      if (t.extendedFrom || hasOutgoing) {
        connected.push(t);
      } else {
        rest.push(t);
      }
    }
    return { connectedTypes: connected, restTypes: rest, totalCount: rawTypesList.length };
  }, [rawTypesList, edges, id]);

  const shouldCollapse = restTypes.length > COLLAPSED_THRESHOLD;

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const pkg = data.packageName || data.label;
    if (!pkg) return;
    setIsRefreshing(true);
    try {
      await refreshPackageTypesFromNodeModules(id, pkg);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Re-calculate XYFlow handle bounds whenever the types list changes
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, rawTypesList, updateNodeInternals]);

  useEffect(() => {
    setName(data.label || "");
    if (!data.label || !data.label.trim()) {
      setIsEditing(true);
    }
  }, [data.label]);

  useEffect(() => {
    if (isEditing) {
      const focus = () => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      };
      const raf = requestAnimationFrame(focus);
      const timer = setTimeout(focus, 50);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      if (!data.label || !data.label.trim()) {
        deleteNode(id);
        return;
      }
      setName(data.label || "");
      setIsEditing(false);
      return;
    }
    updateNode(id, {
      data: {
        ...data,
        label: trimmed,
      },
    });
    setName(trimmed);
    setIsEditing(false);
  };

  const handleOpenConfig = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveConfigItem({
      id,
      nodeId: id,
      type: "types",
      selectedTypeId: (connectedTypes[0] ?? restTypes[0])?.id,
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    requestDeleteNode(id);
  };

  const handleAddType = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newTypeId = `type-${Date.now()}`;
    const newType: CustomTypeItem = {
      id: newTypeId,
      name: `Type${rawTypesList.length + 1}`,
      kind: "interface",
      description: "",
      fields: [
        { id: `f-${Date.now()}-1`, name: "id", type: "string", required: true, isArray: false },
        { id: `f-${Date.now()}-2`, name: "name", type: "string", required: true, isArray: false },
      ],
    };
    const updated = [newType, ...rawTypesList];
    updateNode(id, {
      data: {
        ...data,
        types: updated,
      },
    });
    setActiveConfigItem({
      id,
      nodeId: id,
      type: "types",
      selectedTypeId: newTypeId,
    });
  };

  const handleOpenConfigForType = (typeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveConfigItem({
      id,
      nodeId: id,
      type: "types",
      selectedTypeId: typeId,
    });
  };

  const handleDeleteType = (typeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = rawTypesList.filter((t) => t.id !== typeId);
    updateNode(id, {
      data: {
        ...data,
        types: updated,
      },
    });
    const connectedEdges = edges.filter(
      (edge) =>
        (edge.source === id && edge.sourceHandle === `type-out-${typeId}`) ||
        (edge.target === id && edge.targetHandle === `type-in-${typeId}`),
    );
    connectedEdges.forEach((edge) => deleteEdge(edge.id));
  };

  const hasIncomingEdge = (typeId: string) =>
    edges.some((e) => e.target === id && e.targetHandle === `type-in-${typeId}`);
  const hasOutgoingEdge = (typeId: string) =>
    edges.some((e) => e.source === id && e.sourceHandle === `type-out-${typeId}`);

  const isPackageNode = Boolean(
    data.isPackageNode ||
      (data.packageSources && data.packageSources.length > 0 && !data.isExtended),
  );
  const isInstalled = data.isInstalled !== false;
  const hasInstallError = isPackageNode && (!isInstalled || Boolean(data.installError));

  const allNodes = useBackendCanvasStore((s) => s.nodes);

  // Check if this TypesNode is derived from EntityNode(s)
  const isConsolidated =
    data.isEntitySchemas ||
    id === "types-entity-schemas" ||
    data.label === "Entity Types";

  const isEntityDerived = Boolean(
    isConsolidated ||
      data.sourceEntityId ||
      data.types?.some((t) => t.id.startsWith("type-entity-")),
  );

  const isServiceDerived = Boolean(
    data.isServiceEndpointSchemas ||
      Boolean(data.sourceServiceId) ||
      id.startsWith("types-service-"),
  );

  const sourceServiceId =
    data.sourceServiceId ||
    (id.startsWith("types-service-") ? id.replace("types-service-", "") : undefined);

  const sourceServiceNode = useMemo(() => {
    if (!sourceServiceId) return undefined;
    return allNodes.find((n) => n.id === sourceServiceId && n.type === "service");
  }, [allNodes, sourceServiceId]);

  const sourceServiceName =
    data.sourceServiceName ||
    sourceServiceNode?.data?.label ||
    "Service";

  const sourceEntityId = isConsolidated
    ? undefined
    : data.sourceEntityId ||
      data.types?.find((t) => t.id.startsWith("type-entity-"))?.id.replace("type-entity-", "");

  const sourceEntityNode = useMemo(() => {
    if (!sourceEntityId) return undefined;
    return allNodes.find((n) => n.id === sourceEntityId && n.type === "entity");
  }, [allNodes, sourceEntityId]);

  const sourceEntityName = isConsolidated
    ? `All Entities (${rawTypesList.length})`
    : data.sourceEntityName ||
      sourceEntityNode?.data?.tableName ||
      sourceEntityNode?.data?.label ||
      "Entity";

  // Calculate downstream affected nodes (direct outgoing edges from this node)
  const downstreamAffectedNodes = useMemo(() => {
    if (!isEntityDerived) return [];
    const directOutgoingEdges = edges.filter(
      (e) => e.source === id && e.target !== id,
    );
    const targetIds = new Set(directOutgoingEdges.map((e) => e.target));
    return allNodes
      .filter((n) => targetIds.has(n.id))
      .map((n) => ({
        id: n.id,
        name: n.data?.label || n.id,
        type: n.type,
      }));
  }, [edges, id, allNodes, isEntityDerived]);

  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  const handleViewEntity = () => {
    if (sourceEntityId) {
      setActiveConfigItem({
        id: sourceEntityId,
        nodeId: sourceEntityId,
        type: "entityFunctions",
      });
    }
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2.5 rounded-xl bg-card/95 backdrop-blur border-2 min-w-[250px] max-w-[320px] shadow-md transition-all duration-150 cursor-pointer select-none",
        hasInstallError
          ? "border-red-500 shadow-red-500/20 ring-1 ring-red-500/50"
          : selected
            ? "border-indigo-500 shadow-indigo-500/20 ring-1 ring-indigo-500/30"
            : isPackageNode
              ? "border-emerald-500/50 hover:border-emerald-400 hover:shadow-lg"
              : isServiceDerived
                ? "border-sky-500/50 hover:border-sky-400 hover:shadow-lg"
                : "border-border/80 hover:border-indigo-500/50 hover:shadow-lg",
        borderClass,
      )}
      onDoubleClick={handleOpenConfig}
    >
      {/* Handles for connections and extensions */}
      <Handle
        type="target"
        position={Position.Left}
        id="types-in"
        className={cn(
          CANVAS_HANDLE_CLASS,
          CANVAS_HANDLE_LEFT_OFFSET_CLASS,
          "!border-2 !border-background hover:scale-125 transition-all",
          hasInstallError
            ? "!bg-red-500"
            : isPackageNode
              ? "!bg-emerald-400"
              : isServiceDerived
                ? "!bg-sky-400"
                : "!bg-indigo-400",
        )}
        style={{ top: "24px", transform: "translateY(-50%)" }}
        title="Incoming Type Reference"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="types-out"
        className={cn(
          CANVAS_HANDLE_CLASS,
          CANVAS_HANDLE_RIGHT_OFFSET_CLASS,
          "!border-2 !border-background hover:scale-125 transition-all",
          hasInstallError
            ? "!bg-red-500"
            : isPackageNode
              ? "!bg-emerald-400"
              : isServiceDerived
                ? "!bg-sky-400"
                : "!bg-indigo-400",
        )}
        style={{ top: "24px", transform: "translateY(-50%)" }}
        title="Outgoing Type Reference"
      />

      {/* Header: Icon, Tags, Label input/view, Node actions */}
      <TypesNodeHeader
        id={id}
        data={data}
        name={name}
        setName={setName}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        isPackageNode={isPackageNode}
        isServiceDerived={isServiceDerived}
        sourceServiceName={sourceServiceName}
        hasInstallError={hasInstallError}
        isRefreshing={isRefreshing}
        totalCount={totalCount}
        inputRef={inputRef}
        onSave={handleSave}
        onDeleteNode={() => deleteNode(id)}
        onRefresh={handleRefresh}
        onAddType={handleAddType}
        onOpenConfig={handleOpenConfig}
        onDelete={handleDelete}
      />

      {/* Missing node_modules Alert Banner */}
      {hasInstallError && (
        <TypesNodeInstallBanner
          packageName={data.packageName}
          installError={data.installError}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      )}

      {/* Entity-derived Schema Warning Banner */}
      {isEntityDerived && !isBannerDismissed && (
        <TypesNodeEntityWarningBanner
          sourceEntityName={sourceEntityName}
          sourceEntityId={sourceEntityId}
          affectedNodes={downstreamAffectedNodes}
          updatedAt={data.entityUpdatedAt}
          onViewEntity={sourceEntityId ? handleViewEntity : undefined}
          onDismiss={() => setIsBannerDismissed(true)}
        />
      )}

      {/* Types list (Pinned extended types + Collapsible rest) */}
      <TypesNodeList
        nodeId={id}
        isPackageNode={isPackageNode}
        connectedTypes={connectedTypes}
        restTypes={restTypes}
        totalCount={totalCount}
        shouldCollapse={shouldCollapse}
        isListCollapsed={isListCollapsed}
        setIsListCollapsed={setIsListCollapsed}
        hasIncomingEdge={hasIncomingEdge}
        hasOutgoingEdge={hasOutgoingEdge}
        onOpenConfigForType={handleOpenConfigForType}
        onExtendType={(typeId) => createExtendedTypeNode(id, typeId)}
        onDeleteType={handleDeleteType}
        onAddType={handleAddType}
      />
    </div>
  );
};

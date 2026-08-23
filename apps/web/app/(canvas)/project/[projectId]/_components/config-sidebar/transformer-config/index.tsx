"use client";

import React from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Shuffle } from "lucide-react";
import { Parameter } from "@/types/canvas";
import { toVarName } from "@/lib/compiler/utils";
import { RequestBodyMode } from "../RequestBodyEditor";
import { LocalTargetSection } from "./LocalTargetSection";
import { GlobalTargetSection } from "./GlobalTargetSection";
import { InputSchemaSection } from "./InputSchemaSection";
import { LogicSection } from "./LogicSection";
import { ReturnSchemaSection } from "./ReturnSchemaSection";

export interface TransformerConfigProps {
  id: string;
  nodeId: string;
}

export const TransformerConfig: React.FC<TransformerConfigProps> = ({
  id,
  nodeId,
}) => {
  const rawNode = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === (nodeId || id)),
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);
  const deleteEdge = useBackendCanvasStore((s) => s.deleteEdge);
  const addNode = useBackendCanvasStore((s) => s.addNode);
  const deleteNode = useBackendCanvasStore((s) => s.deleteNode);
  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const allEdges = useBackendCanvasStore((s) => s.edges);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);

  const node = React.useMemo(() => {
    if (!rawNode) return null;
    if (rawNode.type === "transformer_ref" && rawNode.data?.transformerRef) {
      const master = allNodes.find(
        (n) =>
          n.type === "transformer" &&
          (n.id === rawNode.data.transformerRef ||
            n.data?.functionName === rawNode.data.transformerRef ||
            n.data?.label === rawNode.data.transformerRef),
      );
      return master || rawNode;
    }
    return rawNode;
  }, [rawNode, allNodes]);

  if (!node) return null;

  const data = node.data;
  const targetServiceNodes = allNodes.filter((n) => n.type === "service");

  // Inferred connected service if not explicitly set
  const connectedServiceId = React.useMemo(() => {
    if (data.targetServiceId) return data.targetServiceId;
    const edge = allEdges.find(
      (e) => e.source === node.id || e.target === node.id,
    );
    if (!edge) return targetServiceNodes[0]?.id;
    const otherId = edge.source === node.id ? edge.target : edge.source;
    const other = allNodes.find((n) => n.id === otherId && n.type === "service");
    return other?.id || targetServiceNodes[0]?.id;
  }, [data.targetServiceId, allEdges, allNodes, node.id, targetServiceNodes]);

  const activeServiceId = data.targetServiceId || connectedServiceId;

  const currentServiceEndpoints = React.useMemo(() => {
    if (!activeServiceId) return [];
    return endpoints.filter((e) => e.nodeId === activeServiceId);
  }, [endpoints, activeServiceId]);

  const currentServiceConsumedEvents = React.useMemo(() => {
    if (!activeServiceId) return [];
    const activeService = allNodes.find((n) => n.id === activeServiceId);
    return ((activeService?.data as any)?.consumedEvents as any[]) || [];
  }, [allNodes, activeServiceId]);

  const selectedEndpointIds: string[] = React.useMemo(() => {
    if (Array.isArray(data.targetEndpointIds)) return data.targetEndpointIds;
    if (data.targetEndpointId) return [data.targetEndpointId];
    return [];
  }, [data.targetEndpointIds, data.targetEndpointId]);

  const selectedEventIds: string[] = React.useMemo(() => {
    if (Array.isArray((data as any).targetEventIds))
      return (data as any).targetEventIds;
    if ((data as any).targetEventId) return [(data as any).targetEventId];
    return [];
  }, [(data as any).targetEventIds, (data as any).targetEventId]);

  const inputSchema: Parameter[] = React.useMemo(() => {
    const raw = data.inputSchema || [];
    return raw.map((f, idx) => ({
      ...f,
      id: f.id || `in_${idx}_${f.name || "field"}`,
      required: f.required ?? true,
    }));
  }, [data.inputSchema]);

  const returnSchema: Parameter[] = React.useMemo(() => {
    const raw = data.returnSchema || [];
    return raw.map((f, idx) => ({
      ...f,
      id: f.id || `out_${idx}_${f.name || "field"}`,
      required: f.required ?? true,
    }));
  }, [data.returnSchema]);

  const logicMode = data.logicMode || "code";
  const scope = data.scope || "local";
  const functionName = data.functionName || data.label || "transformData";

  const inputSchemaMode: RequestBodyMode =
    data.inputSchemaMode ??
    (data.inputSchemaRawJson ? "raw_json" : "field_builder");
  const returnSchemaMode: RequestBodyMode =
    data.returnSchemaMode ??
    (data.returnSchemaRawJson ? "raw_json" : "field_builder");

  const updateData = (patch: Partial<typeof data>) => {
    updateNode(node.id, {
      data: {
        ...data,
        ...patch,
      },
    });
  };

  /**
   * Synchronizes edges from this local transformer node to the selected service endpoints and consumed events.
   */
  const syncLocalEdges = (
    serviceId: string | undefined,
    endpointIds: string[],
    eventIds: string[],
  ) => {
    const currentEdges = useBackendCanvasStore.getState().edges;
    const existingEdgesFromNode = currentEdges.filter(
      (e) => e.source === node.id,
    );

    if (!serviceId || (endpointIds.length === 0 && eventIds.length === 0)) {
      existingEdgesFromNode.forEach((e) => deleteEdge(e.id));
      return;
    }

    const desiredHandleSet = new Set([
      ...endpointIds.map((id) => `endpoint-in-${id}`),
      ...eventIds.map((id) => `consumedEvents-in-${id}`),
    ]);

    existingEdgesFromNode.forEach((edge) => {
      if (
        edge.target !== serviceId ||
        !edge.targetHandle ||
        !desiredHandleSet.has(edge.targetHandle)
      ) {
        deleteEdge(edge.id);
      }
    });

    endpointIds.forEach((epId) => {
      const targetHandle = `endpoint-in-${epId}`;
      const exists = existingEdgesFromNode.some(
        (e) => e.target === serviceId && e.targetHandle === targetHandle,
      );
      if (!exists) {
        addEdge({
          id: `edge-transformer-${node.id}-${epId}-${Date.now()}`,
          source: node.id,
          target: serviceId,
          sourceHandle: "transformer-out",
          targetHandle,
          type: "connection",
        });
      }
    });

    eventIds.forEach((evId) => {
      const targetHandle = `consumedEvents-in-${evId}`;
      const exists = existingEdgesFromNode.some(
        (e) => e.target === serviceId && e.targetHandle === targetHandle,
      );
      if (!exists) {
        addEdge({
          id: `edge-transformer-${node.id}-${evId}-${Date.now()}`,
          source: node.id,
          target: serviceId,
          sourceHandle: "transformer-out",
          targetHandle,
          type: "connection",
        });
      }
    });
  };

  const handleToggleLocalEndpoint = (epId: string) => {
    const next = selectedEndpointIds.includes(epId)
      ? selectedEndpointIds.filter((id) => id !== epId)
      : [...selectedEndpointIds, epId];

    updateData({
      targetServiceId: activeServiceId,
      targetEndpointIds: next,
      targetEndpointId: next[0] || undefined,
    });

    syncLocalEdges(activeServiceId, next, selectedEventIds);
  };

  const handleToggleLocalEvent = (evId: string) => {
    const next = selectedEventIds.includes(evId)
      ? selectedEventIds.filter((id) => id !== evId)
      : [...selectedEventIds, evId];

    updateData({
      targetServiceId: activeServiceId,
      targetEventIds: next,
      targetEventId: next[0] || undefined,
    } as any);

    syncLocalEdges(activeServiceId, selectedEndpointIds, next);
  };

  const handleSelectAllLocalEndpoints = () => {
    const allIds = currentServiceEndpoints.map((ep) => ep.id);
    updateData({
      targetServiceId: activeServiceId,
      targetEndpointIds: allIds,
      targetEndpointId: allIds[0] || undefined,
    });
    syncLocalEdges(activeServiceId, allIds, selectedEventIds);
  };

  const handleClearAllLocalEndpoints = () => {
    updateData({
      targetServiceId: activeServiceId,
      targetEndpointIds: [],
      targetEndpointId: undefined,
    });
    syncLocalEdges(activeServiceId, [], selectedEventIds);
  };

  const handleSelectAllLocalEvents = () => {
    const allIds = currentServiceConsumedEvents.map((ev) => ev.id);
    updateData({
      targetServiceId: activeServiceId,
      targetEventIds: allIds,
      targetEventId: allIds[0] || undefined,
    } as any);
    syncLocalEdges(activeServiceId, selectedEndpointIds, allIds);
  };

  const handleClearAllLocalEvents = () => {
    updateData({
      targetServiceId: activeServiceId,
      targetEventIds: [],
      targetEventId: undefined,
    } as any);
    syncLocalEdges(activeServiceId, selectedEndpointIds, []);
  };

  const handleServiceChange = (serviceId: string) => {
    const existingEdgesFromNode = allEdges.filter((e) => e.source === node.id);
    existingEdgesFromNode.forEach((e) => deleteEdge(e.id));

    updateData({
      targetServiceId: serviceId,
      targetEndpointId: undefined,
      targetEndpointIds: [],
      targetEventId: undefined,
      targetEventIds: [],
    } as any);
  };

  const handleScopeChange = (nextScope: "global" | "local") => {
    if (nextScope === "global") {
      const existingEdgesFromNode = allEdges.filter((e) => e.source === node.id);
      existingEdgesFromNode.forEach((e) => deleteEdge(e.id));
      updateData({
        scope: "global",
        targetServiceId: undefined,
        targetEndpointId: undefined,
        targetEndpointIds: [],
        targetEventId: undefined,
        targetEventIds: [],
      } as any);
    } else {
      updateData({
        scope: "local",
      });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // GLOBAL SCOPE: Multi-server helpers & edge synchronization with TransformerRef
  // ─────────────────────────────────────────────────────────────────────────────
  const getGlobalServiceConnections = React.useCallback(
    (serviceId: string) => {
      const refNode = allNodes.find(
        (n) =>
          n.type === "transformer_ref" &&
          (n.data?.transformerRef === node.id ||
            n.data?.transformerRef === functionName ||
            n.data?.label?.startsWith(functionName)) &&
          allEdges.some((e) => e.source === n.id && e.target === serviceId),
      );

      if (!refNode) {
        return {
          refNode: undefined,
          endpointIds: [] as string[],
          eventIds: [] as string[],
        };
      }

      const connectedEdges = allEdges.filter(
        (e) => e.source === refNode.id && e.target === serviceId,
      );

      const endpointIds = connectedEdges
        .filter((e) => e.targetHandle?.startsWith("endpoint-in-"))
        .map((e) => e.targetHandle!.replace("endpoint-in-", ""));

      const eventIds = connectedEdges
        .filter((e) => e.targetHandle?.startsWith("consumedEvents-in-"))
        .map((e) => e.targetHandle!.replace("consumedEvents-in-", ""));

      return { refNode, endpointIds, eventIds };
    },
    [allNodes, allEdges, node.id, functionName],
  );

  const syncGlobalServiceEdges = (
    refNodeId: string,
    serviceId: string,
    nextEpIds: string[],
    nextEvIds: string[],
  ) => {
    const currentEdges = useBackendCanvasStore.getState().edges;
    const existingEdgesFromRef = currentEdges.filter(
      (e) => e.source === refNodeId && e.target === serviceId,
    );

    if (nextEpIds.length === 0 && nextEvIds.length === 0) {
      existingEdgesFromRef.forEach((e) => deleteEdge(e.id));
      const remainingEdgesFromRef = currentEdges.filter(
        (e) => e.source === refNodeId && e.target !== serviceId,
      );
      if (remainingEdgesFromRef.length === 0) {
        deleteNode(refNodeId);
      }
      return;
    }

    const desiredHandles = new Set([
      ...nextEpIds.map((id) => `endpoint-in-${id}`),
      ...nextEvIds.map((id) => `consumedEvents-in-${id}`),
    ]);

    existingEdgesFromRef.forEach((edge) => {
      if (!edge.targetHandle || !desiredHandles.has(edge.targetHandle)) {
        deleteEdge(edge.id);
      }
    });

    nextEpIds.forEach((epId) => {
      const targetHandle = `endpoint-in-${epId}`;
      if (!existingEdgesFromRef.some((e) => e.targetHandle === targetHandle)) {
        addEdge({
          id: `edge-ref-${refNodeId}-${epId}-${Date.now()}`,
          source: refNodeId,
          target: serviceId,
          sourceHandle: "transformer-out",
          targetHandle,
          type: "connection",
        });
      }
    });

    nextEvIds.forEach((evId) => {
      const targetHandle = `consumedEvents-in-${evId}`;
      if (!existingEdgesFromRef.some((e) => e.targetHandle === targetHandle)) {
        addEdge({
          id: `edge-ref-${refNodeId}-${evId}-${Date.now()}`,
          source: refNodeId,
          target: serviceId,
          sourceHandle: "transformer-out",
          targetHandle,
          type: "connection",
        });
      }
    });
  };

  const handleToggleGlobalEndpoint = (serviceId: string, epId: string) => {
    const serviceNode = allNodes.find((n) => n.id === serviceId);
    if (!serviceNode) return;

    const { refNode, endpointIds, eventIds } =
      getGlobalServiceConnections(serviceId);
    const isAdding = !endpointIds.includes(epId);
    const nextEpIds = isAdding
      ? [...endpointIds, epId]
      : endpointIds.filter((id) => id !== epId);

    let refNodeId = refNode?.id;

    if (isAdding && !refNodeId) {
      refNodeId = crypto.randomUUID();
      const serviceX = serviceNode.position?.x ?? 0;
      const serviceY = serviceNode.position?.y ?? 0;
      addNode({
        id: refNodeId,
        type: "transformer_ref",
        position: {
          x: Math.max(0, serviceX - 300),
          y: serviceY + 40,
        },
        data: {
          label: `${functionName} (Ref)`,
          transformerRef: node.id,
        },
      });
    }

    if (refNodeId) {
      syncGlobalServiceEdges(refNodeId, serviceId, nextEpIds, eventIds);
    }
  };

  const handleToggleGlobalEvent = (serviceId: string, evId: string) => {
    const serviceNode = allNodes.find((n) => n.id === serviceId);
    if (!serviceNode) return;

    const { refNode, endpointIds, eventIds } =
      getGlobalServiceConnections(serviceId);
    const isAdding = !eventIds.includes(evId);
    const nextEvIds = isAdding
      ? [...eventIds, evId]
      : eventIds.filter((id) => id !== evId);

    let refNodeId = refNode?.id;

    if (isAdding && !refNodeId) {
      refNodeId = crypto.randomUUID();
      const serviceX = serviceNode.position?.x ?? 0;
      const serviceY = serviceNode.position?.y ?? 0;
      addNode({
        id: refNodeId,
        type: "transformer_ref",
        position: {
          x: Math.max(0, serviceX - 300),
          y: serviceY + 40,
        },
        data: {
          label: `${functionName} (Ref)`,
          transformerRef: node.id,
        },
      });
    }

    if (refNodeId) {
      syncGlobalServiceEdges(refNodeId, serviceId, endpointIds, nextEvIds);
    }
  };

  const handleSelectAllGlobalForService = (serviceId: string) => {
    const serviceNode = allNodes.find((n) => n.id === serviceId);
    if (!serviceNode) return;

    const serviceEndpoints = endpoints.filter((e) => e.nodeId === serviceId);
    const serviceConsumedEvents =
      ((serviceNode.data as any)?.consumedEvents as any[]) || [];

    const epIds = serviceEndpoints.map((e) => e.id);
    const evIds = serviceConsumedEvents.map((e) => e.id);

    const { refNode } = getGlobalServiceConnections(serviceId);
    let refNodeId = refNode?.id;

    if (!refNodeId && (epIds.length > 0 || evIds.length > 0)) {
      refNodeId = crypto.randomUUID();
      const serviceX = serviceNode.position?.x ?? 0;
      const serviceY = serviceNode.position?.y ?? 0;
      addNode({
        id: refNodeId,
        type: "transformer_ref",
        position: {
          x: Math.max(0, serviceX - 300),
          y: serviceY + 40,
        },
        data: {
          label: `${functionName} (Ref)`,
          transformerRef: node.id,
        },
      });
    }

    if (refNodeId) {
      syncGlobalServiceEdges(refNodeId, serviceId, epIds, evIds);
    }
  };

  const handleClearGlobalForService = (serviceId: string) => {
    const { refNode } = getGlobalServiceConnections(serviceId);
    if (refNode) {
      syncGlobalServiceEdges(refNode.id, serviceId, [], []);
    }
  };

  return (
    <div className="flex flex-col gap-6 mt-6 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col gap-2 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-purple-500/15 text-purple-400 rounded border border-purple-500/20 shadow-sm flex items-center gap-1">
            <Shuffle size={11} />
            TRANSFORMER
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground font-mono">
            {functionName}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          Configure reusable data transformation function parameters, schemas, and logic.
        </span>
      </div>

      {/* Row 1: Function Name & Scope */}
      <div className="grid grid-cols-2 gap-4">
        {/* Function name */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Function Name
          </Label>
          <Input
            className="h-8 text-xs font-mono bg-background/60 border-border/60"
            value={functionName}
            onChange={(e) => {
              const val = toVarName(e.target.value);
              updateData({
                label: val,
                functionName: val,
              });
            }}
            placeholder="e.g. slugifyProductInput"
          />
        </div>

        {/* Scope */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Scope
          </Label>
          <Select
            value={scope}
            onValueChange={(v) => {
              if (v === "global" || v === "local") {
                handleScopeChange(v);
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs bg-background/60 border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local" className="text-xs">
                Local (Service-specific)
              </SelectItem>
              <SelectItem value="global" className="text-xs">
                Global (Shared Package)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Target service & Target endpoints */}
      {scope === "local" ? (
        <LocalTargetSection
          nodeId={node.id}
          activeServiceId={activeServiceId}
          targetServiceNodes={targetServiceNodes}
          currentServiceEndpoints={currentServiceEndpoints}
          currentServiceConsumedEvents={currentServiceConsumedEvents}
          selectedEndpointIds={selectedEndpointIds}
          selectedEventIds={selectedEventIds}
          onServiceChange={handleServiceChange}
          onToggleEndpoint={handleToggleLocalEndpoint}
          onToggleEvent={handleToggleLocalEvent}
          onSelectAllEndpoints={handleSelectAllLocalEndpoints}
          onClearAllEndpoints={handleClearAllLocalEndpoints}
          onSelectAllEvents={handleSelectAllLocalEvents}
          onClearAllEvents={handleClearAllLocalEvents}
        />
      ) : (
        <GlobalTargetSection
          targetServiceNodes={targetServiceNodes}
          endpoints={endpoints}
          getGlobalServiceConnections={getGlobalServiceConnections}
          onToggleGlobalEndpoint={handleToggleGlobalEndpoint}
          onToggleGlobalEvent={handleToggleGlobalEvent}
          onSelectAllGlobalForService={handleSelectAllGlobalForService}
          onClearGlobalForService={handleClearGlobalForService}
        />
      )}

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Description (optional)
        </Label>
        <Input
          className="h-8 text-xs bg-background/60 border-border/60"
          value={data.description || ""}
          onChange={(e) => updateData({ description: e.target.value })}
          placeholder="e.g. Sanitizes input parameters and generates slug"
        />
      </div>

      {/* 1. INPUT SCHEMA SECTION */}
      <InputSchemaSection
        nodeId={node.id}
        inputSchemaMode={inputSchemaMode}
        inputSchema={inputSchema}
        rawJson={data.inputSchemaRawJson || ""}
        onModeChange={(mode) => updateData({ inputSchemaMode: mode })}
        onSchemaChange={(fields, rawJson) =>
          updateData({ inputSchema: fields, inputSchemaRawJson: rawJson })
        }
      />

      {/* 2. TRANSFORMATION LOGIC SECTION */}
      <LogicSection
        logicMode={logicMode}
        prompt={data.prompt || ""}
        code={data.code || ""}
        isAsync={data.isAsync}
        onModeChange={(mode) => updateData({ logicMode: mode })}
        onPromptChange={(prompt) => updateData({ prompt })}
        onCodeChange={(code) => updateData({ code })}
        onAsyncChange={(isAsync) => updateData({ isAsync })}
      />

      {/* 3. RETURN SCHEMA SECTION */}
      <ReturnSchemaSection
        nodeId={node.id}
        returnSchemaMode={returnSchemaMode}
        returnSchema={returnSchema}
        rawJson={data.returnSchemaRawJson || ""}
        onModeChange={(mode) => updateData({ returnSchemaMode: mode })}
        onSchemaChange={(fields, rawJson) =>
          updateData({ returnSchema: fields, returnSchemaRawJson: rawJson })
        }
      />
    </div>
  );
};
export default TransformerConfig;

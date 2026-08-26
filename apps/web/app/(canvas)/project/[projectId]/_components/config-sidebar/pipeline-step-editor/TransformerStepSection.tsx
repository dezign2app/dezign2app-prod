"use client";

import React, { useMemo } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Shuffle, Plus, Sparkles, ExternalLink } from "lucide-react";
import {
  PipelineStepDraft,
  AvailableTransformer,
  ExpectedArg,
} from "./types";
import { generateId } from "./utils";
import { toVarName } from "@/lib/compiler/utils";


export interface TransformerStepSectionProps {
  step: PipelineStepDraft;
  availableTransformers: AvailableTransformer[];
  serviceNodeId?: string;
  endpointId?: string;
  expectedArgs?: ExpectedArg[];
  onChange: (updated: PipelineStepDraft) => void;
  onAutoMapArguments?: () => void;
  children?: React.ReactNode;
}

export const TransformerStepSection = ({
  step,
  availableTransformers,
  serviceNodeId,
  endpointId,
  expectedArgs,
  onChange,
  onAutoMapArguments,
  children,
}: TransformerStepSectionProps) => {
  const serviceTransformers = useMemo(
    () => availableTransformers.filter((t) => t.sourceType === "service_helper"),
    [availableTransformers],
  );

  const canvasTransformers = useMemo(
    () => availableTransformers.filter((t) => t.sourceType === "canvas_node"),
    [availableTransformers],
  );

  const selectedTransformer = useMemo(() => {
    return availableTransformers.find(
      (t) =>
        t.name === step.functionRef?.name ||
        t.id === step.functionRef?.name,
    );
  }, [step.functionRef?.name, availableTransformers]);

  const selectedTransformerOptionId = useMemo(() => {
    if (selectedTransformer) return selectedTransformer.id;
    return undefined;
  }, [selectedTransformer]);

  const handleSelectTransformer = (transformerId: string) => {
    const t = availableTransformers.find((tr) => tr.id === transformerId || tr.name === transformerId);
    if (!t) return;

    const defaultOutputVar =
      step.outputVariable && !step.outputVariable.startsWith("step")
        ? step.outputVariable
        : `${toVarName(t.name)}Result`;

    const isGlobal = t.scope === "global";
    const store = useBackendCanvasStore.getState();
    const allNodes = store.nodes;
    const allEdges = store.edges;

    let effectiveTransformerNodeId = t.nodeId || t.id;

    if (isGlobal && serviceNodeId && endpointId) {
      const serviceNode = allNodes.find((n) => n.id === serviceNodeId);
      const masterTransformerNode = allNodes.find(
        (n) =>
          n.type === "transformer" &&
          (n.id === t.nodeId ||
            n.id === t.id ||
            n.data?.functionName === t.name ||
            n.data?.label === t.name),
      );
      const masterId = masterTransformerNode?.id || t.nodeId || t.id;

      // 1 Ref per service rule: Check if a transformer_ref node already exists on canvas for this service
      const existingRefNode = allNodes.find(
        (n) =>
          n.type === "transformer_ref" &&
          (n.data?.targetServiceId === serviceNodeId ||
            allEdges.some((e) => e.source === n.id && e.target === serviceNodeId)),
      );

      let refNodeId = existingRefNode?.id;

      if (!refNodeId) {
        // Automatically add 1 new transformer_ref node for this service
        refNodeId = crypto.randomUUID();
        const serviceX = serviceNode?.position?.x ?? 0;
        const serviceY = serviceNode?.position?.y ?? 0;

        store.addNode({
          id: refNodeId,
          type: "transformer_ref",
          position: {
            x: Math.max(0, serviceX - 300),
            y: serviceY + 40,
          },
          data: {
            label: `${t.name} (Ref)`,
            transformerRef: masterId,
            targetServiceId: serviceNodeId,
            targetEndpointId: endpointId,
            targetEndpointIds: [endpointId],
          },
        });
      } else {
        // Reuse the single transformer_ref for this service, updating targetEndpointIds
        const currentLiveRef = store.nodes.find((n) => n.id === refNodeId);
        if (currentLiveRef?.data) {
          const currentEpIds: string[] =
            currentLiveRef.data.targetEndpointIds ||
            (currentLiveRef.data.targetEndpointId ? [currentLiveRef.data.targetEndpointId] : []);
          const nextEpIds = currentEpIds.includes(endpointId)
            ? currentEpIds
            : [...currentEpIds, endpointId];

          store.updateNode(refNodeId, {
            data: {
              ...currentLiveRef.data,
              transformerRef: currentLiveRef.data.transformerRef || masterId,
              targetServiceId: serviceNodeId,
              targetEndpointIds: nextEpIds,
              targetEndpointId: nextEpIds[0],
            },
          });
        }
      }

      effectiveTransformerNodeId = refNodeId;

      // Ensure reference edge from master global transformer to transformer_ref node
      if (masterTransformerNode) {
        const refEdgeExists = store.edges.some(
          (e) =>
            (e.type === "transformer-reference" || e.type === "reference") &&
            e.source === masterTransformerNode.id &&
            e.target === refNodeId,
        );
        if (!refEdgeExists) {
          store.addEdge({
            id: `edge-ref-link-${masterTransformerNode.id}-${refNodeId}`,
            source: masterTransformerNode.id,
            target: refNodeId,
            sourceHandle: "transformer-out",
            targetHandle: "transformer-in",
            type: "transformer-reference",
          });
        }

        // Clean up any direct edge from master global transformer to this service endpoint
        const directEdges = store.edges.filter(
          (e) =>
            e.source === masterTransformerNode.id &&
            e.target === serviceNodeId &&
            (e.targetHandle === `endpoint-in-${endpointId}` ||
              e.targetHandle === `consumedEvents-in-${endpointId}` ||
              e.targetHandle === endpointId),
        );
        directEdges.forEach((e) => store.deleteEdge(e.id));
      }

      // Draw edge between transformer_ref and service endpoint / consumer
      const targetHandle = endpointId.startsWith("consumedEvents-in-")
        ? endpointId
        : endpointId.startsWith("endpoint-in-")
        ? endpointId
        : `endpoint-in-${endpointId}`;
      const edgeExists = store.edges.some(
        (e) =>
          e.source === refNodeId &&
          e.target === serviceNodeId &&
          e.targetHandle === targetHandle,
      );
      if (!edgeExists) {
        store.addEdge({
          id: `edge-ref-${refNodeId}-${endpointId}-${Date.now()}`,
          source: refNodeId,
          target: serviceNodeId,
          sourceHandle: "transformer-out",
          targetHandle,
          type: "connection",
        });
      }
    } else if (!isGlobal && t.nodeId && serviceNodeId && endpointId) {
      // Local transformer: connect directly to service endpoint
      const targetHandle = endpointId.startsWith("consumedEvents-in-")
        ? endpointId
        : endpointId.startsWith("endpoint-in-")
        ? endpointId
        : `endpoint-in-${endpointId}`;
      const edgeExists = store.edges.some(
        (e) =>
          e.source === t.nodeId &&
          e.target === serviceNodeId &&
          e.targetHandle === targetHandle,
      );
      if (!edgeExists) {
        store.addEdge({
          id: `edge-transformer-${t.nodeId}-${endpointId}-${Date.now()}`,
          source: t.nodeId,
          target: serviceNodeId,
          sourceHandle: "transformer-out",
          targetHandle,
          type: "connection",
        });
      }

      const tNode = store.nodes.find((n) => n.id === t.nodeId);
      if (tNode?.data) {
        const currentEpIds: string[] =
          tNode.data.targetEndpointIds ||
          (tNode.data.targetEndpointId ? [tNode.data.targetEndpointId] : []);
        if (!currentEpIds.includes(endpointId)) {
          const nextEpIds = [...currentEpIds, endpointId];
          store.updateNode(t.nodeId, {
            data: {
              ...tNode.data,
              targetServiceId: serviceNodeId,
              targetEndpointIds: nextEpIds,
              targetEndpointId: nextEpIds[0],
            },
          });
        }
      }
    }

    onChange({
      ...step,
      name: defaultOutputVar,
      outputVariable: defaultOutputVar,
      transformerNodeId: effectiveTransformerNodeId,
      functionRef: {
        name: t.name,
        importPath: t.importPath,
        isGlobal,
        inputSchema: t.inputSchema,
        returnSchema: t.returnSchema,
      },
      outputSchema: t.returnSchema.map((r) => ({
        name: r.name,
        type: r.type,
        required: r.required,
      })),
    });
  };

  /**
   * Directly creates a new Transformer node on the canvas and opens its configuration sidebar.
   */
  const handleCreateTransformerNode = () => {
    const store = useBackendCanvasStore.getState();
    const serviceNode = store.nodes.find((n) => n.id === serviceNodeId);

    const position = serviceNode?.position
      ? { x: serviceNode.position.x + 360, y: serviceNode.position.y + 40 }
      : { x: 250, y: 250 };

    const id = generateId();
    const existingTransformersCount = store.nodes.filter((n) => n.type === "transformer").length;
    const fnName = `transformData${existingTransformersCount + 1}`;

    // 1. Add transformer node to canvas
    store.addNode({
      id,
      type: "transformer",
      position,
      data: {
        label: fnName,
        functionName: fnName,
        description: `Transformer for ${serviceNode?.data?.label || "Service"}`,
        scope: "local",
        targetServiceId: serviceNodeId,
        targetEndpointId: endpointId,
        targetEndpointIds: endpointId ? [endpointId] : [],
        inputSchema: [{ id: "param-input", name: "input", type: "string", required: true }],
        returnSchema: [{ id: "param-result", name: "result", type: "string", required: true }],
        logicMode: "code",
        code: "return {\n  result: String(input)\n};",
        isAsync: false,
      },
    });

    // 2. Add connection edge to endpoint if service and endpoint exist
    if (serviceNodeId && endpointId) {
      store.addEdge({
        id: `edge-transformer-${id}-${endpointId}-${Date.now()}`,
        source: id,
        target: serviceNodeId,
        sourceHandle: "transformer-out",
        targetHandle: `endpoint-in-${endpointId}`,
        type: "connection",
      });
    }

    // 3. Bind current pipeline step to this new transformer
    const defaultOutputVar = `${fnName}Result`;
    onChange({
      ...step,
      name: defaultOutputVar,
      outputVariable: defaultOutputVar,
      transformerNodeId: id,
      functionRef: {
        name: fnName,
        importPath: `./transformers/${fnName}`,
      },
      outputSchema: [{ name: "result", type: "string", required: true }],
    });

    // 3. Immediately open the transformer configuration sidebar
    store.setActiveConfigItem({
      type: "transformer",
      id,
      nodeId: id,
    });
  };

  const handleOpenTransformerConfig = () => {
    if (!selectedTransformer?.nodeId) return;
    useBackendCanvasStore.getState().setActiveConfigItem({
      type: "transformer",
      id: selectedTransformer.nodeId,
      nodeId: selectedTransformer.nodeId,
    });
  };

  return (
    <div className="flex flex-col gap-2.5 p-2.5 rounded-lg border border-purple-500/25 bg-purple-500/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
          <Shuffle size={13} />
          <span>Data Transformer Function</span>
        </div>
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] text-purple-300 hover:text-purple-200 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 px-2 py-0.5 rounded transition-colors"
          onClick={handleCreateTransformerNode}
          title="Add a Transformer node to canvas and configure it"
        >
          <Plus size={10} />
          Create Transformer
        </button>
      </div>

      {/* Transformer Selector */}
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Shuffle size={10} /> Select Transformer
        </Label>
        <Select
          value={selectedTransformerOptionId || ""}
          onValueChange={handleSelectTransformer}
        >
          <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
            <SelectValue placeholder="Choose a transformer..." />
          </SelectTrigger>
          <SelectContent>
            {serviceTransformers.length > 0 && (
              <div className="px-2 py-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                Service Helpers
              </div>
            )}
            {serviceTransformers.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-xs font-mono">
                <span className="font-semibold text-purple-300">{t.name}</span>
                <span className="text-[8px] ml-1.5 px-1 py-0.2 rounded font-sans uppercase text-muted-foreground/80 bg-muted/60">
                  {t.scope}
                </span>
                <span className="text-[9px] text-muted-foreground/60 ml-1">
                  ({t.inputSchema.length} in → {t.returnSchema.length} out)
                </span>
              </SelectItem>
            ))}

            {canvasTransformers.length > 0 && (
              <div className="px-2 py-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                Canvas Transformer Nodes
              </div>
            )}
            {canvasTransformers.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-xs font-mono">
                <span className="font-semibold text-purple-300">{t.name}</span>
                <span className="text-[8px] ml-1.5 px-1 py-0.2 rounded font-sans uppercase text-muted-foreground/80 bg-muted/60">
                  Node ({t.scope})
                </span>
                <span className="text-[9px] text-muted-foreground/60 ml-1">
                  ({t.inputSchema.length} in → {t.returnSchema.length} out)
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selected Transformer Info Card */}
      {selectedTransformer && (
        <div className="flex flex-col gap-1.5 p-2 rounded bg-background/60 border border-purple-500/20 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-purple-300 font-semibold">
                {selectedTransformer.name}
              </span>
              <span
                className={`text-[8px] font-mono px-1 py-0.2 rounded font-medium ${
                  selectedTransformer.scope === "global"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                }`}
              >
                {selectedTransformer.scope.toUpperCase()}
              </span>

              {selectedTransformer.nodeId && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-[9px] text-purple-300 hover:text-purple-200 hover:underline ml-1"
                  onClick={handleOpenTransformerConfig}
                  title="Open node config sidebar"
                >
                  <ExternalLink size={9} />
                  <span>Configure Node</span>
                </button>
              )}
            </div>
            <span className="text-[9px] font-mono text-muted-foreground/70">
              import from &quot;{selectedTransformer.importPath}&quot;
            </span>
          </div>

          {selectedTransformer.description && (
            <p className="text-[10px] text-muted-foreground/80 italic">
              {selectedTransformer.description}
            </p>
          )}

          {/* Return Schema Summary */}
          {selectedTransformer.returnSchema.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-0.5">
              <span className="text-[9px] text-muted-foreground/70">Returns:</span>
              <div className="flex flex-wrap gap-1">
                {selectedTransformer.returnSchema.map((f) => (
                  <span
                    key={f.name}
                    className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20"
                  >
                    {f.name}: {f.type}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expected arguments preview & quick mapping buttons */}
      {expectedArgs && expectedArgs.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-purple-500/15">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span>Expected args:</span>
              <div className="flex flex-wrap gap-1">
                {expectedArgs.map((arg) => (
                  <span
                    key={arg.name}
                    className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-background/80 border border-border/50 text-foreground/80"
                    title={`Type: ${arg.type}${arg.required ? " (required)" : ""}`}
                  >
                    {arg.name}
                    <span className="text-muted-foreground/60 text-[8px] ml-0.5">
                      :{arg.type}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 transition-colors"
                onClick={onAutoMapArguments}
                title="Smart map missing arguments from route params, query, request body, and prior steps while preserving existing bindings"
              >
                <Sparkles size={10} />
                Auto-map arguments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Argument Bindings (Inputs for this Transformer) */}
      {children}
    </div>
  );
};

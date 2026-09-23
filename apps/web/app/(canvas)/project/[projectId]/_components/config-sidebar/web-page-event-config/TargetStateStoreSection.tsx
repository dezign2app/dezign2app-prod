"use client";

import React from "react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import { BackendNode, UIEventItem } from "@/types/canvas";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Database, CheckCircle2, Info, Zap, Sparkles, Layers, Sliders } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";

function toPascalCase(str: string): string {
  const clean = str.trim();
  if (!clean) return "";
  if (/[\s\-_]/.test(clean)) {
    return clean
      .split(/[\s\-_]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export interface TargetStateStoreSectionProps {
  nodeId: string;
  actionId: string;
  actionName: string;
  actionEvent?: string;
  storeBinding?: UIEventItem["storeActionBinding"];
  stateStoreNodes: BackendNode[];
  isEndpointConnected: boolean;
  connectedEndpointName?: string;
  onUpdateStoreBinding: (binding?: UIEventItem["storeActionBinding"]) => void;
}

export const TargetStateStoreSection: React.FC<TargetStateStoreSectionProps> = ({
  nodeId,
  actionId,
  actionName,
  actionEvent,
  storeBinding,
  stateStoreNodes,
  isEndpointConnected,
  connectedEndpointName,
  onUpdateStoreBinding,
}) => {
  const edges = useBackendCanvasStore((s) => s.edges);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);
  const deleteEdge = useBackendCanvasStore((s) => s.deleteEdge);

  const selectedStoreNode = stateStoreNodes.find(
    (n) => n.id === storeBinding?.storeNodeId,
  );

  const fields = selectedStoreNode?.data?.fields || [];
  const customActions = selectedStoreNode?.data?.actions || [];

  const isPageLoad = actionEvent === "pageLoad" || actionName === "pageLoad";
  const isSse = actionEvent === "sse" || actionEvent === "sseMessage";
  const isWebsocket = actionEvent === "websocket" || actionEvent === "ws" || actionEvent === "websocketMessage";
  const isWebrtc = actionEvent === "webrtc";

  const webTargetHandle = isPageLoad
    ? `pageload-in-${actionId}`
    : isSse
    ? `sse-in-${actionId}`
    : isWebsocket
    ? `websocket-in-${actionId}`
    : isWebrtc
    ? `webrtc-in-${actionId}`
    : `event-in-${actionId}`;

  // Helper to sync canvas edge from State Store (source) to WebPage action (target)
  const syncStoreEdge = (
    storeNodeId: string | undefined,
    storeSourceHandle: string = "mutate-out",
    storeName?: string,
    actionDisplayName?: string,
  ) => {
    // 1. Remove any existing store action edges for this action (checking both directions)
    const existingEdges = edges.filter(
      (e) =>
        ((e.target === nodeId && (e.targetHandle === webTargetHandle || e.targetHandle === `events-${actionId}` || e.targetHandle?.endsWith(`-${actionId}`))) ||
         (e.source === nodeId && (e.sourceHandle === `events-${actionId}` || e.sourceHandle === webTargetHandle))) &&
        stateStoreNodes.some((sn) => sn.id === e.source || sn.id === e.target),
    );
    existingEdges.forEach((e) => deleteEdge(e.id));

    // 2. If a store is selected, add the edge FROM StateStoreNode TO WebPageNode!
    if (storeNodeId) {
      addEdge({
        id: `edge-store-action-${storeNodeId}-${actionId}-${nodeId}`,
        source: storeNodeId,
        target: nodeId,
        sourceHandle: storeSourceHandle,
        targetHandle: webTargetHandle,
        type: "connection",
        data: {
          isStoreAction: true,
          isStoreActionBinding: true,
          storeName: storeName || "Store",
          actionName: actionDisplayName || "action",
        },
      });
    }
  };

  const handleStoreChange = (storeId: string) => {
    if (storeId === "none" || !storeId) {
      syncStoreEdge(undefined);
      onUpdateStoreBinding(undefined);
      return;
    }

    const sn = stateStoreNodes.find((s) => s.id === storeId);
    if (!sn) return;

    const storeName = sn.data?.storeName || sn.data?.label || "App";
    const storeFields = sn.data?.fields || [];
    const storeActions = sn.data?.actions || [];

    // Default to first field setter, or populate, or first custom action
    let defaultActionId = "builtin-populate";
    let defaultActionName = "populate";
    let defaultActionType: any = "populate";
    let defaultTargetFieldId: string | undefined = undefined;
    let defaultTargetFieldName: string | undefined = undefined;
    let storeSourceHandle = "populate-out";

    if (storeFields.length > 0) {
      const firstField = storeFields[0]!;
      defaultActionId = `setter-${firstField.id}`;
      defaultActionName = `set${toPascalCase(firstField.name)}`;
      defaultActionType = "set";
      defaultTargetFieldId = firstField.id;
      defaultTargetFieldName = firstField.name;
      storeSourceHandle = "mutate-out";
    } else if (storeActions.length > 0) {
      const firstAct = storeActions[0]!;
      defaultActionId = firstAct.id;
      defaultActionName = firstAct.name;
      defaultActionType = firstAct.actionType || "custom";
      storeSourceHandle = `store-action-out-${firstAct.id}`;
    }

    const defaultSource = isEndpointConnected ? "response" : "payload";

    const nextBinding: NonNullable<UIEventItem["storeActionBinding"]> = {
      storeNodeId: storeId,
      storeName,
      actionId: defaultActionId,
      actionName: defaultActionName,
      actionType: defaultActionType,
      targetFieldId: defaultTargetFieldId,
      targetFieldName: defaultTargetFieldName,
      updateSource: defaultSource,
    };

    syncStoreEdge(storeId, storeSourceHandle, storeName, defaultActionName);
    onUpdateStoreBinding(nextBinding);
  };

  const handleActionChange = (actionKey: string) => {
    if (!storeBinding || !selectedStoreNode) return;
    const storeName = selectedStoreNode.data?.storeName || selectedStoreNode.data?.label || "App";

    let storeSourceHandle = "mutate-out";
    let updatedBinding: NonNullable<UIEventItem["storeActionBinding"]>;

    if (actionKey === "builtin-populate") {
      storeSourceHandle = "populate-out";
      updatedBinding = {
        ...storeBinding,
        actionId: "builtin-populate",
        actionName: "populate",
        actionType: "populate",
        targetFieldId: undefined,
        targetFieldName: undefined,
        updateSource: isEndpointConnected ? "response" : "payload",
      };
    } else if (actionKey === "builtin-reset") {
      storeSourceHandle = "reset-out";
      updatedBinding = {
        ...storeBinding,
        actionId: "builtin-reset",
        actionName: "reset",
        actionType: "reset",
        targetFieldId: undefined,
        targetFieldName: undefined,
        updateSource: "direct",
      };
    } else if (actionKey.startsWith("setter-")) {
      storeSourceHandle = "mutate-out";
      const fieldId = actionKey.replace("setter-", "");
      const matchedField = fields.find((f: any) => f.id === fieldId);
      const fieldName = matchedField?.name || "field";
      const setterName = `set${toPascalCase(fieldName)}`;
      updatedBinding = {
        ...storeBinding,
        actionId: actionKey,
        actionName: setterName,
        actionType: "set",
        targetFieldId: fieldId,
        targetFieldName: fieldName,
        updateSource: isEndpointConnected ? "response" : "payload",
      };
    } else {
      // Custom action
      const matchedAct = customActions.find((a: any) => a.id === actionKey);
      storeSourceHandle = `store-action-out-${actionKey}`;
      updatedBinding = {
        ...storeBinding,
        actionId: actionKey,
        actionName: matchedAct?.name || "action",
        actionType: matchedAct?.actionType || "custom",
        targetFieldId: matchedAct?.targetFieldId,
        targetFieldName: undefined,
        updateSource: isEndpointConnected ? "response" : "payload",
      };
    }

    syncStoreEdge(storeBinding.storeNodeId, storeSourceHandle, storeName, updatedBinding.actionName);
    onUpdateStoreBinding(updatedBinding);
  };

  const handleUpdateSourceChange = (src: any) => {
    if (!storeBinding) return;
    onUpdateStoreBinding({
      ...storeBinding,
      updateSource: src,
    });
  };

  const handleValuePathChange = (path: string) => {
    if (!storeBinding) return;
    onUpdateStoreBinding({
      ...storeBinding,
      valuePath: path,
    });
  };

  const handleCustomValueChange = (val: string) => {
    if (!storeBinding) return;
    onUpdateStoreBinding({
      ...storeBinding,
      customValue: val,
    });
  };

  const isResetAction = storeBinding?.actionType === "reset";
  const targetField = fields.find((f: any) => f.id === storeBinding?.targetFieldId || f.name === storeBinding?.targetFieldName);

  return (
    <AccordionItem
      value="store_action_binding"
      className="border rounded-xl overflow-hidden bg-card"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/20 transition-colors [&>svg]:shrink-0">
        <div className="flex items-center justify-between w-full pr-2">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-indigo-500" />
            <span className="text-xs font-semibold">
              Target State Store &amp; Mutation
            </span>
          </div>
          {storeBinding && (
            <Badge
              variant="secondary"
              className="text-[10px] font-mono font-medium bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
            >
              {storeBinding.storeName}.{storeBinding.actionName}()
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-5 pt-2">
        <div className="flex flex-col gap-4">
          {/* Target State Store Selector */}
          <div className="flex flex-col gap-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Database size={10} />
              Target State Store
            </Label>
            <Select
              value={storeBinding?.storeNodeId || "none"}
              onValueChange={handleStoreChange}
            >
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="Choose state store to update…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs text-muted-foreground">
                  None (No Store Mutation)
                </SelectItem>
                {stateStoreNodes.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                          s.data?.scope === "global"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-sky-500/15 text-sky-500",
                        )}
                      >
                        {s.data?.scope || "GLOBAL"}
                      </span>
                      <span className="font-semibold text-foreground">
                        {s.data?.storeName || s.data?.label || "Store"}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ({(s.data?.fields || []).length} fields, {(s.data?.actions || []).length} actions)
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {stateStoreNodes.length === 0 && (
              <p className="text-[11px] text-amber-500 flex items-center gap-1.5 mt-1">
                <Info size={11} className="shrink-0" />
                No State Store nodes on canvas. Add a State Store from the node palette to manage reactive client state.
              </p>
            )}
          </div>

          {/* Store Mutation / Action Selector */}
          {selectedStoreNode && storeBinding && (
            <div className="flex flex-col gap-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Zap size={10} />
                Store Mutation / Action to Call
              </Label>
              <Select
                value={storeBinding.actionId || "builtin-populate"}
                onValueChange={handleActionChange}
              >
                <SelectTrigger className="h-9 text-xs bg-background font-mono">
                  <SelectValue placeholder="Select mutation or action…" />
                </SelectTrigger>
                <SelectContent>
                  {/* Built-in Manipulators */}
                  <SelectGroup>
                    <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                      Standard Manipulators
                    </SelectLabel>
                    <SelectItem value="builtin-populate" className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="font-semibold">populate(data)</span>
                        <span className="text-[10px] text-muted-foreground font-sans">
                          - Bulk load store state
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="builtin-reset" className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span className="font-semibold">reset()</span>
                        <span className="text-[10px] text-muted-foreground font-sans">
                          - Reset to initial state
                        </span>
                      </div>
                    </SelectItem>
                  </SelectGroup>

                  {/* Field Setters */}
                  {fields.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground mt-1">
                        Field Setters (Mutate State)
                      </SelectLabel>
                      {fields.map((f: any) => {
                        const setterName = `set${toPascalCase(f.name)}`;
                        return (
                          <SelectItem key={`setter-${f.id}`} value={`setter-${f.id}`} className="text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                              <span className="font-semibold font-mono">{setterName}(value)</span>
                              <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                                {f.type}
                              </Badge>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  )}

                  {/* Custom Store Actions */}
                  {customActions.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground mt-1">
                        Custom Actions
                      </SelectLabel>
                      {customActions.map((act: any) => (
                        <SelectItem key={act.id} value={act.id} className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                            <span className="font-semibold font-mono">{act.name}()</span>
                            <Badge variant="secondary" className="text-[9px] py-0 px-1 uppercase font-mono">
                              {act.actionType || "action"}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Input Values / Parameter Mapping Section */}
          {selectedStoreNode && storeBinding && (
            <div className="flex flex-col gap-3 p-3 rounded-lg bg-secondary/20 border border-border/60">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sliders size={11} className="text-indigo-500" />
                  Input Values &amp; Argument Mapping
                </span>
                {targetField && (
                  <Badge variant="outline" className="text-[9px] font-mono">
                    Target: {targetField.name} ({targetField.type})
                  </Badge>
                )}
              </div>

              {isResetAction ? (
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <Info size={12} className="shrink-0 text-muted-foreground" />
                  <span>The <code className="font-mono text-foreground font-semibold">reset()</code> function requires no arguments. It restores all store fields to their initial defaults.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Target Store Field Selector */}
                  {fields.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium flex items-center justify-between">
                        <span>Target Store Field / Property</span>
                        {storeBinding.targetFieldName && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            state.{storeBinding.targetFieldName}
                          </span>
                        )}
                      </Label>
                      <Select
                        value={storeBinding.targetFieldName || (storeBinding.actionType === "populate" ? "auto" : fields[0]?.name || "auto")}
                        onValueChange={(val) => {
                          if (val === "auto") {
                            onUpdateStoreBinding({
                              ...storeBinding,
                              targetFieldId: undefined,
                              targetFieldName: undefined,
                            });
                          } else {
                            const matched = fields.find((f: any) => f.name === val || f.id === val);
                            onUpdateStoreBinding({
                              ...storeBinding,
                              targetFieldId: matched?.id,
                              targetFieldName: matched?.name || val,
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background font-mono">
                          <SelectValue placeholder="Auto-detect / Bulk Hydrate" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto" className="text-xs">
                            <span className="font-semibold text-muted-foreground font-sans">
                              {storeBinding.actionType === "populate"
                                ? "Auto-Detect / Bulk Hydrate All Matching Fields"
                                : "Default Field"}
                            </span>
                          </SelectItem>
                          {fields.map((f: any) => (
                            <SelectItem key={f.id} value={f.name} className="text-xs font-mono">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{f.name}</span>
                                <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                                  {f.type}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-[10px] text-muted-foreground">
                        {storeBinding.targetFieldName
                          ? `The response value will be mapped directly to state.${storeBinding.targetFieldName}.`
                          : "Auto-maps matching fields or automatically unwraps collection responses (e.g. { data: [...] })."}
                      </span>
                    </div>
                  )}

                  {/* Value Source Selector */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">Input Value Source</Label>
                    <Select
                      value={storeBinding.updateSource || (isEndpointConnected ? "response" : "payload")}
                      onValueChange={handleUpdateSourceChange}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {isEndpointConnected && (
                          <>
                            <SelectItem value="response" className="text-xs">
                              <span className="font-semibold">Full API Response</span>
                              <span className="text-muted-foreground font-mono text-[10px] ml-1.5">(res.data)</span>
                            </SelectItem>
                            <SelectItem value="response_property" className="text-xs">
                              <span className="font-semibold">Nested Response Property</span>
                              <span className="text-muted-foreground font-mono text-[10px] ml-1.5">(res.data[property])</span>
                            </SelectItem>
                          </>
                        )}
                        <SelectItem value="payload" className="text-xs">
                          <span className="font-semibold">Action / Form Input Payload</span>
                          <span className="text-muted-foreground font-mono text-[10px] ml-1.5">(payloadBody)</span>
                        </SelectItem>
                        <SelectItem value="static" className="text-xs">
                          <span className="font-semibold">Static Constant Value</span>
                          <span className="text-muted-foreground font-mono text-[10px] ml-1.5">(hardcoded literal)</span>
                        </SelectItem>
                        <SelectItem value="direct" className="text-xs">
                          <span className="font-semibold">Direct Trigger (No Arguments)</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Nested Property Path Input */}
                  {(storeBinding.updateSource === "response_property" || (isEndpointConnected && storeBinding.valuePath)) && (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium flex items-center justify-between">
                        <span>Response Property Path</span>
                        <div className="flex items-center gap-1">
                          {["data", "items", "results"].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                onUpdateStoreBinding({
                                  ...storeBinding,
                                  updateSource: "response_property",
                                  valuePath: p,
                                });
                              }}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted-foreground/20 font-mono text-muted-foreground"
                            >
                              +{p}
                            </button>
                          ))}
                        </div>
                      </Label>
                      <Input
                        className="h-8 text-xs bg-background font-mono"
                        placeholder="e.g. data, items, user.id, data.conversations"
                        value={storeBinding.valuePath || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateStoreBinding({
                            ...storeBinding,
                            updateSource: val ? "response_property" : storeBinding.updateSource,
                            valuePath: val,
                          });
                        }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        Extracts <code className="font-mono">{storeBinding.valuePath ? `response.${storeBinding.valuePath}` : "res"}</code> from the API response to pass into <code className="font-mono">{storeBinding.actionName}()</code>.
                      </span>
                    </div>
                  )}

                  {/* Static Value Input */}
                  {storeBinding.updateSource === "static" && (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium">Static Constant Value</Label>
                      <Input
                        className="h-8 text-xs bg-background font-mono"
                        placeholder="e.g. true, 10, 'completed', { active: true }"
                        value={storeBinding.customValue || ""}
                        onChange={(e) => handleCustomValueChange(e.target.value)}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        Hardcoded value passed into the store mutation whenever triggered.
                      </span>
                    </div>
                  )}

                  {/* Helpful context text */}
                  {storeBinding.updateSource === "response" && (
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      When <code className="font-mono text-foreground font-semibold">{actionName || "action"}</code> triggers, the API request will execute first, and upon success, its response payload will automatically populate <code className="font-mono text-foreground font-semibold">{storeBinding.storeName}.{storeBinding.actionName}()</code>.
                    </p>
                  )}
                  {storeBinding.updateSource === "payload" && (
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      When <code className="font-mono text-foreground font-semibold">{actionName || "action"}</code> triggers, input form fields or action arguments will be passed directly into <code className="font-mono text-foreground font-semibold">{storeBinding.storeName}.{storeBinding.actionName}()</code>.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active Connection Badge Card */}
          {selectedStoreNode && storeBinding && (
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/25">
              <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <CheckCircle2 size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Active State Store Mutation
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <Badge
                  variant="secondary"
                  className="text-[10px] gap-1 px-2 py-0.5 font-semibold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
                >
                  <Database size={9} />
                  {storeBinding.storeName}
                </Badge>
                <span className="text-muted-foreground text-xs">→</span>
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 px-2 py-0.5 font-mono border-indigo-500/40 text-foreground"
                >
                  <span className="font-bold text-indigo-500">{storeBinding.actionName}()</span>
                  <span className="text-[8px] text-muted-foreground uppercase font-sans">
                    [{storeBinding.actionType || "mutate"}]
                  </span>
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Canvas connection edge automatically wired to <code className="font-mono text-foreground">{storeBinding.storeName}</code> node.
              </span>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Database,
  ArrowRight,
  Sparkles,
  Layers,
  Plus,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  RefreshCw,
  ExternalLink,
  Table,
  CreditCard,
  Tag,
} from "lucide-react";
import {
  BackendNode,
  Endpoint,
  PageSection,
  SectionComponentBinding,
  ComponentElementBinding,
  UIEventItem,
  StoreActionBinding,
  GlobalStoreField,
  GlobalStoreAction,
  PageStateObject,
  ComponentBindingType,
} from "@/types/canvas";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Label } from "@workspace/ui/components/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@workspace/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { toast } from "sonner";
import { toPascalCase, toCamelCase, toHumanLabel } from "@/lib/utils";
import {
  extractEndpointResponseFields,
  ExtractedEndpointResponseField,
} from "@/lib/utils/endpointFormGenerator";
import { cn } from "@workspace/ui/lib/utils";

export interface ComponentResponseMappingCardProps {
  nodeId: string; // WebPageNode ID
  sectionId?: string;
  componentBinding: SectionComponentBinding;
  activeElement?: ComponentElementBinding;
  availableActions: UIEventItem[];
  stateStores: BackendNode[];
  onUpdateComponent: (changes: Partial<SectionComponentBinding>) => void;
  onUpdateElements: (elements: ComponentElementBinding[]) => void;
}

export const ComponentResponseMappingCard: React.FC<ComponentResponseMappingCardProps> = ({
  nodeId,
  sectionId,
  componentBinding,
  activeElement,
  availableActions,
  stateStores,
  onUpdateComponent,
  onUpdateElements,
}) => {
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);

  const parentNode = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId]);
  const sections: PageSection[] = parentNode?.data?.sections || [];
  const targetSection =
    sections.find((s) => (s.componentBindings || []).some((c) => c.id === componentBinding.id)) ||
    sections.find((s) => s.id === sectionId) ||
    sections[0];

  // 1. Identify target action
  const currentActionId = activeElement?.actionId || componentBinding.actionId;
  const currentAction = useMemo(() => {
    if (!currentActionId) return undefined;
    return (targetSection?.actions || []).find((a) => a.id === currentActionId);
  }, [targetSection?.actions, currentActionId]);

  // 2. Identify connected endpoint via canvas edge or manual selection
  const connectedEdge = useMemo(() => {
    if (!currentAction) return undefined;
    return edges.find(
      (e) =>
        e.source === nodeId &&
        e.sourceHandle === `events-${currentAction.id}` &&
        (e.targetHandle?.startsWith("endpoint-in-") || e.targetHandle?.includes("endpoint")),
    );
  }, [edges, nodeId, currentAction]);

  const autoDetectedEndpoint = useMemo(() => {
    if (!connectedEdge) return undefined;
    const epId = connectedEdge.targetHandle?.replace(/^endpoint-in-/, "");
    return endpoints.find((ep) => ep.id === epId || connectedEdge.targetHandle?.includes(ep.id));
  }, [connectedEdge, endpoints]);

  const [selectedEndpointId, setSelectedEndpointId] = useState<string>("");

  const activeEndpoint = useMemo(() => {
    if (autoDetectedEndpoint) return autoDetectedEndpoint;
    if (selectedEndpointId) {
      return endpoints.find((ep) => ep.id === selectedEndpointId);
    }
    return undefined;
  }, [autoDetectedEndpoint, selectedEndpointId, endpoints]);

  // 3. Extract response fields from endpoint schema
  const responseFields = useMemo(() => {
    if (!activeEndpoint) return [];
    return extractEndpointResponseFields(activeEndpoint);
  }, [activeEndpoint]);

  // 4. Default target store node
  const defaultStoreNode = useMemo(() => {
    if (componentBinding.valueStoreName) {
      const match = stateStores.find(
        (st) =>
          st.data?.label === componentBinding.valueStoreName ||
          st.data?.storeName === componentBinding.valueStoreName,
      );
      if (match) return match;
    }
    return stateStores[0];
  }, [stateStores, componentBinding.valueStoreName]);

  const [selectedStoreNodeId, setSelectedStoreNodeId] = useState<string>(
    defaultStoreNode?.id || "",
  );

  const activeStoreNode = useMemo(() => {
    return stateStores.find((st) => st.id === (selectedStoreNodeId || defaultStoreNode?.id));
  }, [stateStores, selectedStoreNodeId, defaultStoreNode]);

  const activeStoreName = activeStoreNode?.data?.storeName || activeStoreNode?.data?.label || "AppStore";
  const activeStoreFields = useMemo(() => activeStoreNode?.data?.fields || [], [activeStoreNode]);
  const activeStoreActions = useMemo(() => activeStoreNode?.data?.actions || [], [activeStoreNode]);

  // 5. Existing storeActionBindings on current action
  const currentActionBindings: StoreActionBinding[] = useMemo(() => {
    if (!currentAction) return [];
    if (Array.isArray(currentAction.storeActionBindings) && currentAction.storeActionBindings.length > 0) {
      return currentAction.storeActionBindings;
    }
    if (currentAction.storeActionBinding) {
      return [currentAction.storeActionBinding];
    }
    return [];
  }, [currentAction]);

  // Elements currently inside this component
  const currentElements: ComponentElementBinding[] = useMemo(() => {
    if (componentBinding.elements && componentBinding.elements.length > 0) {
      return componentBinding.elements;
    }
    return [
      {
        id: `el-${componentBinding.id}`,
        name: componentBinding.name || "MainElement",
        elementType: componentBinding.componentType || "button",
        label: componentBinding.label || componentBinding.name || "Main Element",
        valueStateName: componentBinding.valueStateName,
        valueStoreName: componentBinding.valueStoreName,
        actionId: componentBinding.actionId,
        actionName: componentBinding.actionName,
      },
    ];
  }, [componentBinding]);

  // Helper to update action's storeActionBindings
  const persistStoreActionBindings = useCallback(
    (newBindings: StoreActionBinding[]) => {
      if (!currentAction || !parentNode || !targetSection) return;

      const updatedActions = (targetSection.actions || []).map((a) => {
        if (a.id !== currentAction.id) return a;
        return {
          ...a,
          storeActionBinding: newBindings[0] || undefined,
          storeActionBindings: newBindings,
        };
      });

      const updatedSections = sections.map((sec) =>
        sec.id === targetSection.id ? { ...sec, actions: updatedActions } : sec,
      );

      updateNode(nodeId, {
        data: {
          ...parentNode.data,
          sections: updatedSections,
        },
      });
    },
    [currentAction, parentNode, targetSection, sections, nodeId, updateNode],
  );

  // Helper to ensure target state variable exists in Zustand store and section stateObjects
  const ensureStoreVariable = useCallback(
    (fieldName: string, fieldType: string = "string") => {
      if (!activeStoreNode) return;

      const cleanName = toCamelCase(fieldName);
      const setterName = `set${toPascalCase(cleanName)}`;

      const existingFields: GlobalStoreField[] = activeStoreNode.data?.fields || [];
      const existingActions: GlobalStoreAction[] = activeStoreNode.data?.actions || [];

      let storeUpdated = false;
      const nextFields = [...existingFields];
      const nextActions = [...existingActions];

      // Add field if missing
      let targetFieldId = existingFields.find((f) => f.name === cleanName)?.id;
      if (!targetFieldId) {
        targetFieldId = `f-${Date.now()}-${cleanName}`;
        nextFields.push({
          id: targetFieldId,
          name: cleanName,
          type: fieldType,
          defaultValue: fieldType === "boolean" ? false : fieldType === "number" ? 0 : "",
        });
        storeUpdated = true;
      }

      // Add setter if missing
      const hasSetter = existingActions.some((a) => a.name === setterName);
      if (!hasSetter) {
        nextActions.push({
          id: `act-${Date.now()}-${setterName}`,
          name: setterName,
          actionType: "set",
          targetFieldId,
          targetFieldName: cleanName,
          defaultManipulatorType: "setter",
        });
        storeUpdated = true;
      }

      if (storeUpdated) {
        updateNode(activeStoreNode.id, {
          data: {
            ...activeStoreNode.data,
            fields: nextFields,
            actions: nextActions,
          },
        });
      }

      // Ensure section subscribes to state object
      if (parentNode && targetSection) {
        const existingObjs: PageStateObject[] = targetSection.stateObjects || [];
        if (!existingObjs.some((s) => s.name === cleanName && s.storeName === activeStoreName)) {
          const nextObjs = [
            ...existingObjs,
            {
              id: `st-obj-${Date.now()}-${cleanName}`,
              name: cleanName,
              type: fieldType,
              storeName: activeStoreName,
              storeId: activeStoreNode.id,
            },
          ];
          const updatedSections = sections.map((sec) =>
            sec.id === targetSection.id ? { ...sec, stateObjects: nextObjs } : sec,
          );
          updateNode(nodeId, {
            data: {
              ...parentNode.data,
              sections: updatedSections,
            },
          });
        }
      }
    },
    [activeStoreNode, activeStoreName, parentNode, targetSection, sections, nodeId, updateNode],
  );

  // Map single response field to store variable
  const handleMapField = useCallback(
    (responseFieldName: string, targetStoreFieldName: string) => {
      if (!activeStoreNode || !currentAction) {
        toast.error("Please connect an action and select a State Store first.");
        return;
      }

      const cleanTarget = toCamelCase(targetStoreFieldName);
      const rfDef = responseFields.find((f) => f.name === responseFieldName);
      ensureStoreVariable(cleanTarget, rfDef?.type || "string");

      const nextBindings = currentActionBindings.filter(
        (b) => b.valuePath !== responseFieldName && b.targetFieldName !== cleanTarget,
      );

      nextBindings.push({
        id: `bind-${Date.now()}-${cleanTarget}`,
        storeNodeId: activeStoreNode.id,
        storeName: activeStoreName,
        actionName: `set${toPascalCase(cleanTarget)}`,
        actionType: "set",
        targetFieldName: cleanTarget,
        updateSource: "response_property",
        valuePath: responseFieldName,
      });

      persistStoreActionBindings(nextBindings);
      toast.success(`Mapped response.${responseFieldName} -> ${activeStoreName}.${cleanTarget}`);
    },
    [
      activeStoreNode,
      activeStoreName,
      currentAction,
      responseFields,
      currentActionBindings,
      ensureStoreVariable,
      persistStoreActionBindings,
    ],
  );

  // Unmap response field
  const handleUnmapField = useCallback(
    (responseFieldName: string) => {
      const nextBindings = currentActionBindings.filter((b) => b.valuePath !== responseFieldName);
      persistStoreActionBindings(nextBindings);
      toast.success(`Removed mapping for response.${responseFieldName}`);
    },
    [currentActionBindings, persistStoreActionBindings],
  );

  // Toggle UI Display Element inside the component
  const handleToggleUiElement = useCallback(
    (
      fieldName: string,
      renderType: ComponentBindingType | "none",
      fieldType: string = "string",
    ) => {
      const cleanVar = toCamelCase(fieldName);

      if (renderType === "none") {
        const nextElements = currentElements.filter((el) => el.valueStateName !== cleanVar);
        if (nextElements.length === 0) {
          toast.error("Component must have at least one element.");
          return;
        }
        onUpdateElements(nextElements);
        toast.success(`Removed UI display element for "${cleanVar}".`);
        return;
      }

      // Check if element already exists
      const existingEl = currentElements.find((el) => el.valueStateName === cleanVar);
      if (existingEl) {
        const nextElements = currentElements.map((el) =>
          el.valueStateName === cleanVar
            ? { ...el, elementType: renderType, variant: renderType === "badge" ? "secondary" : undefined }
            : el,
        );
        onUpdateElements(nextElements);
        toast.success(`Updated display type to <${renderType}>`);
        return;
      }

      // Add new display element
      const newEl: ComponentElementBinding = {
        id: `el-res-${Date.now()}-${cleanVar}`,
        name: `${toPascalCase(cleanVar)}Display`,
        elementType: renderType,
        label: toHumanLabel(cleanVar),
        valueStateName: cleanVar,
        valueStoreName: activeStoreName,
        valueSourceType: "store",
        variant: renderType === "badge" ? "secondary" : undefined,
        propMappings: {
          valueBinding: cleanVar,
          readOnly: true,
        },
      };

      const nextElements = [...currentElements, newEl];
      onUpdateElements(nextElements);

      // Upgrade compound componentType to card if multiple elements
      if (componentBinding.componentType === "button" && nextElements.length > 1) {
        onUpdateComponent({ componentType: "card" });
      }

      toast.success(`Added <${renderType}> display for "${cleanVar}"!`);
    },
    [currentElements, activeStoreName, componentBinding.componentType, onUpdateElements, onUpdateComponent],
  );

  // 1-Click: Auto-Map All Response Fields into Store & UI
  const handleAutoMapAll = useCallback(() => {
    if (!activeStoreNode || !activeEndpoint || responseFields.length === 0) {
      toast.error("No response fields found in endpoint schema.");
      return;
    }

    if (!currentAction) {
      toast.error("Please connect an action to this component first.");
      return;
    }

    const nextBindings: StoreActionBinding[] = [...currentActionBindings];
    const elementsToAdd: ComponentElementBinding[] = [];

    responseFields.forEach((rf, idx) => {
      const cleanVar = toCamelCase(rf.name);
      ensureStoreVariable(cleanVar, rf.type || "string");

      if (!nextBindings.some((b) => b.valuePath === rf.name)) {
        nextBindings.push({
          id: `bind-${Date.now()}-${idx}-${cleanVar}`,
          storeNodeId: activeStoreNode.id,
          storeName: activeStoreName,
          actionName: `set${toPascalCase(cleanVar)}`,
          actionType: "set",
          targetFieldName: cleanVar,
          updateSource: "response_property",
          valuePath: rf.name,
        });
      }

      // Check if UI element already exists
      const hasEl = currentElements.some((el) => el.valueStateName === cleanVar);
      if (!hasEl) {
        const isBool = rf.type === "boolean";
        const cType: ComponentBindingType = isBool ? "badge" : "card";
        elementsToAdd.push({
          id: `el-res-${Date.now()}-${idx}-${cleanVar}`,
          name: `${toPascalCase(cleanVar)}Display`,
          elementType: cType,
          label: toHumanLabel(cleanVar),
          valueStateName: cleanVar,
          valueStoreName: activeStoreName,
          valueSourceType: "store",
          variant: isBool ? "secondary" : undefined,
          propMappings: {
            valueBinding: cleanVar,
            readOnly: true,
          },
        });
      }
    });

    persistStoreActionBindings(nextBindings);

    if (elementsToAdd.length > 0) {
      const updatedElements = [...currentElements, ...elementsToAdd];
      onUpdateElements(updatedElements);
      if (componentBinding.componentType === "button" && updatedElements.length > 1) {
        onUpdateComponent({ componentType: "card" });
      }
    }

    toast.success(
      `Successfully mapped ${responseFields.length} response fields into ${activeStoreName} and UI!`,
    );
  }, [
    activeStoreNode,
    activeEndpoint,
    responseFields,
    currentAction,
    currentActionBindings,
    currentElements,
    activeStoreName,
    componentBinding.componentType,
    ensureStoreVariable,
    persistStoreActionBindings,
    onUpdateElements,
    onUpdateComponent,
  ]);

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <Database size={13} className="text-cyan-500" />
            <span>API Response &amp; State Store Mapping</span>
          </CardTitle>
          {activeEndpoint && responseFields.length > 0 && (
            <Badge variant="outline" className="text-[10px] text-cyan-600 dark:text-cyan-400 border-cyan-500/30">
              {responseFields.length} Properties
            </Badge>
          )}
        </div>
        <CardDescription className="text-[11px]">
          Store incoming API response properties into Zustand State Store variables and auto-bind UI display elements
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 pt-1 space-y-3.5 text-xs">
        {/* Source Endpoint Selector / Detector */}
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Source API Endpoint</span>
            {autoDetectedEndpoint ? (
              <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                <CheckCircle2 size={11} />
                Connected from Action Edge
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/80">Select Endpoint</span>
            )}
          </Label>

          {autoDetectedEndpoint ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/60">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-mono font-bold uppercase",
                    autoDetectedEndpoint.type === "GET"
                      ? "text-emerald-500 border-emerald-500/30"
                      : "text-blue-500 border-blue-500/30",
                  )}
                >
                  {autoDetectedEndpoint.type}
                </Badge>
                <span className="font-mono text-xs font-medium">{autoDetectedEndpoint.name}</span>
              </div>
              <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                {autoDetectedEndpoint.summary || "Endpoint"}
              </span>
            </div>
          ) : (
            <Select
              value={selectedEndpointId || "__none__"}
              onValueChange={(val) => setSelectedEndpointId(val === "__none__" ? "" : val)}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Choose an endpoint to map..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (Select endpoint)</SelectItem>
                {endpoints.map((ep) => (
                  <SelectItem key={ep.id} value={ep.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[10px] uppercase text-muted-foreground">
                        {ep.type}
                      </span>
                      <span className="font-mono text-xs">{ep.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Target Zustand Store Selector */}
        {activeEndpoint && (
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Target Zustand State Store</span>
              <span className="text-[10px] text-purple-500 font-medium">Reactive Store</span>
            </Label>
            <Select
              value={selectedStoreNodeId || defaultStoreNode?.id || "__none__"}
              onValueChange={(val) => setSelectedStoreNodeId(val === "__none__" ? "" : val)}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Choose target state store..." />
              </SelectTrigger>
              <SelectContent>
                {stateStores.map((st) => (
                  <SelectItem key={st.id} value={st.id}>
                    <div className="flex items-center gap-1.5">
                      <Database size={12} className="text-purple-500" />
                      <span>{st.data?.label || st.data?.storeName || "Store"}</span>
                      <span className="text-[10px] text-muted-foreground">
                        ({st.data?.fields?.length || 0} fields)
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 1-Click Auto Map All Action Button */}
        {activeEndpoint && responseFields.length > 0 && activeStoreNode && (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-cyan-500/[0.07] border border-cyan-500/20">
            <div className="text-[11px]">
              <span className="font-semibold text-foreground">Quick Setup:</span>
              <span className="text-muted-foreground ml-1">
                Auto-map all {responseFields.length} properties to {activeStoreName} &amp; UI
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAutoMapAll}
              className="h-6 text-[11px] px-2.5 bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer font-medium"
            >
              <Sparkles size={11} className="mr-1" />
              Auto-Map All
            </Button>
          </div>
        )}

        {/* Response Properties List */}
        {activeEndpoint && responseFields.length > 0 ? (
          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Response Field</span>
              <span>Store Var &amp; UI Binding</span>
            </div>

            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-0.5">
              {responseFields.map((rf) => {
                const mappedBinding = currentActionBindings.find(
                  (b) => b.valuePath === rf.name,
                );
                const boundVarName = mappedBinding?.targetFieldName;
                const boundElement = currentElements.find(
                  (el) => el.valueStateName === boundVarName || el.valueStateName === rf.name,
                );

                return (
                  <div
                    key={rf.name}
                    className={cn(
                      "p-2.5 rounded-lg border text-xs transition-colors",
                      mappedBinding
                        ? "bg-muted/30 border-cyan-500/30 dark:border-cyan-500/20"
                        : "bg-background border-border/60 hover:border-border",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-semibold text-xs text-foreground truncate">
                          res.{rf.name}
                        </span>
                        <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 capitalize text-muted-foreground">
                          {rf.type}
                        </Badge>
                      </div>

                      {mappedBinding ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 font-mono">
                            <CheckCircle2 size={10} />
                            {activeStoreName}.{mappedBinding.targetFieldName}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUnmapField(rf.name)}
                            className="h-5 w-5 text-muted-foreground hover:text-destructive cursor-pointer"
                            title="Remove mapping"
                          >
                            <Trash2 size={11} />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleMapField(rf.name, rf.name)}
                          className="h-6 text-[11px] px-2 border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 cursor-pointer"
                        >
                          <Plus size={10} className="mr-1" />
                          Map to Store
                        </Button>
                      )}
                    </div>

                    {/* UI Display Component Binding Selector */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-[11px]">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Eye size={11} className="text-muted-foreground/70" />
                        <span>Render on UI:</span>
                      </span>

                      <div className="flex items-center gap-1">
                        <Select
                          value={boundElement?.elementType || "none"}
                          onValueChange={(val) =>
                            handleToggleUiElement(
                              boundVarName || rf.name,
                              val as ComponentBindingType | "none",
                              rf.type,
                            )
                          }
                        >
                          <SelectTrigger className="h-6 text-[10px] px-2 min-w-[110px] bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None (Store Only)</SelectItem>
                            <SelectItem value="card">Display Card</SelectItem>
                            <SelectItem value="badge">Badge Pill</SelectItem>
                            <SelectItem value="progress">Progress Bar</SelectItem>
                            <SelectItem value="alert">Alert Box</SelectItem>
                          </SelectContent>
                        </Select>

                        {boundElement && (
                          <Badge variant="outline" className="text-[9px] text-primary border-primary/30">
                            Visible
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeEndpoint ? (
          <div className="p-4 rounded-lg border border-dashed border-border text-center text-muted-foreground space-y-1">
            <AlertCircle className="w-5 h-5 mx-auto text-amber-500" />
            <div className="text-xs font-medium text-foreground">No Response Schema Declared</div>
            <p className="text-[11px]">
              This endpoint doesn&apos;t have fields in <code>responseBody</code> yet. Define response fields in EndpointConfig first.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-lg border border-dashed border-border text-center text-muted-foreground space-y-1">
            <Database className="w-5 h-5 mx-auto text-muted-foreground/60" />
            <div className="text-xs font-medium text-foreground">No Endpoint Selected</div>
            <p className="text-[11px]">
              Connect an action to an endpoint or select an endpoint above to map its response properties.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

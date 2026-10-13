"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  Sparkles,
  Server,
  Database,
  ArrowRight,
  Layers,
  Zap,
  CheckCircle2,
  AlertCircle,
  FormInput,
  ToggleLeft,
  ChevronDownSquare,
  SquareCheck,
} from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { toast } from "sonner";
import { toPascalCase, toCamelCase, toHumanLabel } from "@/lib/utils";
import {
  extractEndpointFields,
  extractEndpointResponseFields,
  inferDefaultButtonLabel,
  inferDefaultComponentName,
  generateFormFromEndpoint,
  ExtractedEndpointField,
  ExtractedEndpointResponseField,
} from "@/lib/utils/endpointFormGenerator";
import { Endpoint, BackendNode, ComponentBindingType } from "@/types/canvas";

export interface GenerateFormFromEndpointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId: string; // WebPageNode ID
  sectionId?: string; // Target section ID
  existingComponentId?: string; // If filling active component
  onSuccess?: (componentId: string) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  PUT: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  PATCH: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  DELETE: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

interface FieldConfigItem extends ExtractedEndpointField {
  enabled: boolean;
  stateVarName: string;
}

interface ResponseFieldConfigItem extends ExtractedEndpointResponseField {
  enabled: boolean;
}

export const GenerateFormFromEndpointDialog: React.FC<GenerateFormFromEndpointDialogProps> = ({
  open,
  onOpenChange,
  nodeId,
  sectionId,
  existingComponentId,
  onSuccess,
}) => {
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const addNode = useBackendCanvasStore((s) => s.addNode);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);

  const webPageNode = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId]);
  const sections = webPageNode?.data?.sections || [];
  const targetSection =
    sections.find((s) => s.id === sectionId) ||
    sections.find((s) => (s.componentBindings || []).some((c) => c.id === existingComponentId)) ||
    sections[0];

  // Find all endpoints in the project
  const allEndpoints = useMemo(() => {
    const list: Array<{
      endpoint: Endpoint;
      serviceNode: BackendNode;
      isConnected: boolean;
    }> = [];

    endpoints.forEach((ep) => {
      const sNode = nodes.find((n) => n.id === ep.nodeId);
      if (!sNode) return;

      const isConnected = edges.some(
        (e) =>
          e.source === nodeId &&
          e.target === sNode.id &&
          (e.targetHandle === `endpoint-in-${ep.id}` || e.targetHandle?.includes(ep.id)),
      );

      list.push({ endpoint: ep, serviceNode: sNode, isConnected });
    });

    // Sort: connected endpoints first, then by route
    return list.sort((a, b) => {
      if (a.isConnected && !b.isConnected) return -1;
      if (!a.isConnected && b.isConnected) return 1;
      return (a.endpoint.name || "").localeCompare(b.endpoint.name || "");
    });
  }, [endpoints, nodes, edges, nodeId]);

  // State Stores in project
  const stateStoreNodes = useMemo(() => {
    return nodes.filter((n) => n.type === "state_store");
  }, [nodes]);

  // Form Configuration State
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>("");
  const [formName, setFormName] = useState<string>("");
  const [submitButtonLabel, setSubmitButtonLabel] = useState<string>("Submit");
  const [targetStoreNodeId, setTargetStoreNodeId] = useState<string>("");
  const [newStoreName, setNewStoreName] = useState<string>("");
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfigItem[]>([]);
  const [responseFieldConfigs, setResponseFieldConfigs] = useState<ResponseFieldConfigItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-select initial endpoint
  useEffect(() => {
    if (open && allEndpoints.length > 0) {
      if (!selectedEndpointId || !allEndpoints.some((e) => e.endpoint.id === selectedEndpointId)) {
        const defaultEp = allEndpoints[0]!;
        setSelectedEndpointId(defaultEp.endpoint.id);
      }
    }
  }, [open, allEndpoints, selectedEndpointId]);

  const selectedItem = useMemo(() => {
    return allEndpoints.find((e) => e.endpoint.id === selectedEndpointId);
  }, [allEndpoints, selectedEndpointId]);

  // When endpoint changes, extract fields and reset names
  useEffect(() => {
    if (!selectedItem) {
      setFieldConfigs([]);
      setResponseFieldConfigs([]);
      return;
    }

    const ep = selectedItem.endpoint;
    const extracted = extractEndpointFields(ep);
    const extractedResponses = extractEndpointResponseFields(ep);
    const hasInputs = extracted.length > 0;

    const initialConfigs: FieldConfigItem[] = extracted.map((f) => ({
      ...f,
      enabled: true,
      stateVarName: toCamelCase(f.name),
    }));

    setFieldConfigs(initialConfigs);
    setResponseFieldConfigs(
      extractedResponses.map((rf) => ({
        ...rf,
        enabled: true,
      })),
    );

    // Derive smart default names
    const smartFormName = inferDefaultComponentName(ep, hasInputs);
    const smartButtonLabel = inferDefaultButtonLabel(ep, hasInputs);
    setFormName(smartFormName);
    setSubmitButtonLabel(smartButtonLabel);

    // Set default store
    const rawRoute = ep.name.replace(/^\/api\/(?:v\d+\/)?/, "").replace(/[^a-zA-Z0-9]/g, " ");
    const entityName = toPascalCase(rawRoute) || "Data";
    if (stateStoreNodes.length > 0) {
      const matchStore = stateStoreNodes.find(
        (s) =>
          (s.data?.storeName || "").toLowerCase().includes(entityName.toLowerCase()) ||
          (s.data?.label || "").toLowerCase().includes(entityName.toLowerCase()),
      );
      setTargetStoreNodeId(matchStore ? matchStore.id : stateStoreNodes[0]!.id);
    } else {
      setTargetStoreNodeId("__new__");
      setNewStoreName(`${entityName}Store`);
    }
  }, [selectedItem, stateStoreNodes]);

  const enabledCount = useMemo(() => {
    return fieldConfigs.filter((f) => f.enabled).length;
  }, [fieldConfigs]);

  const requiredCount = useMemo(() => {
    return fieldConfigs.filter((f) => f.required).length;
  }, [fieldConfigs]);

  const enabledResponseCount = useMemo(() => {
    return responseFieldConfigs.filter((rf) => rf.enabled).length;
  }, [responseFieldConfigs]);

  const hasInputFields = fieldConfigs.length > 0;

  const handleToggleAll = useCallback(
    (checked: boolean) => {
      setFieldConfigs((prev) => prev.map((f) => ({ ...f, enabled: checked })));
    },
    [],
  );

  const handleFieldChange = useCallback(
    (idx: number, changes: Partial<FieldConfigItem>) => {
      setFieldConfigs((prev) => {
        const copy = [...prev];
        if (copy[idx]) {
          copy[idx] = { ...copy[idx]!, ...changes };
        }
        return copy;
      });
    },
    [],
  );

  const handleResponseFieldToggle = useCallback((idx: number, enabled: boolean) => {
    setResponseFieldConfigs((prev) => {
      const copy = [...prev];
      if (copy[idx]) {
        copy[idx] = { ...copy[idx]!, enabled };
      }
      return copy;
    });
  }, []);

  const handleGenerate = async () => {
    if (!selectedItem || !webPageNode || !targetSection) return;

    const enabledFields = fieldConfigs.filter((f) => f.enabled);
    const enabledResponseFields = responseFieldConfigs
      .filter((rf) => rf.enabled)
      .map((rf) => rf.name);

    setIsSubmitting(true);
    try {
      const result = generateFormFromEndpoint({
        endpoint: selectedItem.endpoint,
        serviceNode: selectedItem.serviceNode,
        webPageNode,
        sectionId: targetSection.id,
        formName:
          formName.trim() ||
          inferDefaultComponentName(selectedItem.endpoint, enabledFields.length > 0),
        submitButtonLabel:
          submitButtonLabel.trim() ||
          inferDefaultButtonLabel(selectedItem.endpoint, enabledFields.length > 0),
        stateStorageMode: "store",
        targetStoreNodeId,
        newStoreName,
        selectedFields: enabledFields.map((f) => ({
          name: f.name,
          source: f.source,
          type: f.type,
          required: f.required,
          componentType: f.suggestedComponentType,
          inputType: f.suggestedInputType,
          label: f.label,
          placeholder: f.placeholder,
          stateVarName: f.stateVarName,
        })),
        responseFieldsToStore: enabledResponseFields,
        existingComponentId,
        nodes,
        edges,
      });

      // 1. If brand new store node was created, add it
      if (result.newStoreNode) {
        addNode(result.newStoreNode);
      }

      // 2. If existing store node was updated, update it
      if (result.updatedStoreNode) {
        updateNode(result.updatedStoreNode.id, {
          data: result.updatedStoreNode.data,
        });
      }

      // 3. Add any new edges (store connection & endpoint connection)
      result.newEdges.forEach((e) => {
        addEdge(e);
      });

      // 4. Update the WebPage node with new section component bindings & states
      updateNode(webPageNode.id, {
        data: result.updatedWebPageNode.data,
      });

      toast.success(result.summaryMessage);
      onSuccess?.(result.createdComponentBindingId);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Failed to generate form from endpoint:", err);
      toast.error(err?.message || "Failed to generate form from endpoint");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden font-sans border-border/80 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border/50 bg-gradient-to-r from-card to-secondary/20">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-500 border border-indigo-500/25 shrink-0 shadow-xs">
              <Sparkles size={16} />
            </div>
            <div className="flex flex-col gap-0.5">
              <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Generate Form &amp; State Store from Endpoint</span>
                <Badge variant="outline" className="text-[9px] font-mono border-indigo-500/30 text-indigo-500">
                  1-Click Automation
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Auto-generate matching form UI inputs, two-way state bindings, and Zustand state store variables from an endpoint contract.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* 1. Endpoint Selector */}
          <div className="space-y-2 p-3.5 rounded-xl border bg-secondary/15">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Server size={13} className="text-primary" />
                <span>Source API Endpoint</span>
              </Label>
              {selectedItem?.isConnected && (
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={11} />
                  <span>Connected on Canvas</span>
                </span>
              )}
            </div>

            {allEndpoints.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground rounded bg-background/50 border border-dashed">
                No endpoints found on this canvas. Create a Service or External endpoint first.
              </div>
            ) : (
              <Select value={selectedEndpointId} onValueChange={setSelectedEndpointId}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="Select an endpoint..." />
                </SelectTrigger>
                <SelectContent className="max-h-[260px]">
                  {allEndpoints.map((item) => {
                    const method = item.endpoint.type || "POST";
                    const methodColor = METHOD_COLORS[method] || METHOD_COLORS.POST;
                    return (
                      <SelectItem key={item.endpoint.id} value={item.endpoint.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border",
                              methodColor,
                            )}
                          >
                            {method}
                          </span>
                          <span className="font-mono text-xs text-foreground font-semibold">
                            {item.endpoint.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ({item.serviceNode.data?.label || "Service"})
                          </span>
                          {item.isConnected && (
                            <Badge
                              variant="outline"
                              className="text-[8px] px-1 py-0 border-emerald-500/30 text-emerald-500 ml-auto"
                            >
                              Connected
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}

            {selectedItem?.endpoint.summary && (
              <p className="text-[11px] text-muted-foreground italic pl-1">
                &ldquo;{selectedItem.endpoint.summary}&rdquo;
              </p>
            )}
          </div>

          {/* 2. Zustand State Store Destination */}
          <div className="space-y-3 p-3.5 rounded-xl border bg-secondary/15">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Database size={13} className="text-purple-500" />
                <span>Zustand State Store</span>
              </Label>
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 font-medium"
              >
                ⚡ Global Store
              </Badge>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Select value={targetStoreNodeId} onValueChange={setTargetStoreNodeId}>
                  <SelectTrigger className="h-8 text-xs bg-background flex-1">
                    <SelectValue placeholder="Select target store..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stateStoreNodes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-1.5">
                          <Database size={11} className="text-purple-500" />
                          <span>{s.data?.label || s.data?.storeName || "Store"}</span>
                          <span className="text-[10px] text-muted-foreground">
                            ({(s.data?.fields || []).length} fields)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__">
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        + Create New State Store
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {targetStoreNodeId === "__new__" && (
                  <Input
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    placeholder="e.g. UserStore"
                    className="h-8 text-xs bg-background w-44 font-mono font-medium"
                  />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                All form fields and typed setter actions (e.g. <code className="text-foreground">setEmail()</code>) are stored in this Zustand store, avoiding local useState.
              </p>
            </div>
          </div>

          {/* 3. Fields or Action Button Details */}
          {!hasInputFields ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-blue-500/25 bg-blue-500/[0.05] space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <div className="p-1 rounded bg-blue-500/10 text-blue-500">
                    <Sparkles size={13} />
                  </div>
                  <span>Trigger Action Button (0 Input Parameters)</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-500/30 text-blue-500 font-mono ml-auto">
                    {selectedItem?.endpoint.type || "GET"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  This endpoint does not require any request body or parameters. 
                  Generating will create a standalone <strong>Action Button</strong> wired directly to trigger this request.
                </p>
              </div>

              {responseFieldConfigs.length > 0 && (
                <div className="space-y-2 p-3 rounded-xl border bg-secondary/15">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Database size={13} className="text-purple-500" />
                      <span>Response Variables (Zustand Store)</span>
                    </Label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ({enabledResponseCount}/{responseFieldConfigs.length} selected)
                    </span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground">
                    Save response fields returned by this endpoint into your Zustand store:
                  </p>
                  <div className="border border-border/70 rounded-lg overflow-hidden divide-y divide-border/40 bg-card">
                    {responseFieldConfigs.map((rf, idx) => (
                      <div
                        key={rf.id}
                        className={cn(
                          "p-2 flex items-center justify-between text-xs transition-colors",
                          rf.enabled ? "bg-background/80" : "bg-muted/15 opacity-60",
                        )}
                      >
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={rf.enabled}
                            onCheckedChange={(chk) => handleResponseFieldToggle(idx, Boolean(chk))}
                          />
                          <span className="font-mono text-foreground font-medium text-xs">{rf.name}</span>
                        </label>
                        <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 border-muted">
                          {rf.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Layers size={13} className="text-indigo-500" />
                    <span>Fields to Include in Form</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    ({enabledCount}/{fieldConfigs.length} selected, {requiredCount} required)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleAll(true)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-muted-foreground/40">•</span>
                  <button
                    type="button"
                    onClick={() => handleToggleAll(false)}
                    className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="border border-border/70 rounded-xl overflow-hidden divide-y divide-border/40 max-h-[260px] overflow-y-auto bg-card">
                {fieldConfigs.map((f, idx) => (
                  <div
                    key={`${f.source}-${f.name}`}
                    className={cn(
                      "p-2.5 flex items-center justify-between gap-3 transition-colors",
                      f.enabled ? "bg-background/80" : "bg-muted/15 opacity-60",
                    )}
                  >
                    {/* Left: Checkbox & Name */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Checkbox
                        checked={f.enabled}
                        onCheckedChange={(c) => handleFieldChange(idx, { enabled: Boolean(c) })}
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-foreground truncate">
                            {f.name}
                          </span>
                          {f.required ? (
                            <Badge
                              variant="outline"
                              className="text-[8.5px] px-1 py-0 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-medium"
                            >
                              Required
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[8.5px] px-1 py-0 text-muted-foreground">
                              Optional
                            </Badge>
                          )}
                          <span className="text-[9px] text-muted-foreground/70 font-mono">
                            [{f.source}]
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate">{f.label}</span>
                      </div>
                    </div>

                    {/* Right: Component Type Override & State Var */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Select
                        value={f.suggestedComponentType}
                        onValueChange={(val) =>
                          handleFieldChange(idx, { suggestedComponentType: val as ComponentBindingType })
                        }
                      >
                        <SelectTrigger className="h-7 text-[11px] bg-background w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="input">
                            <div className="flex items-center gap-1.5">
                              <FormInput size={11} />
                              <span>Input</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="switch">
                            <div className="flex items-center gap-1.5">
                              <ToggleLeft size={11} />
                              <span>Switch</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="checkbox">
                            <div className="flex items-center gap-1.5">
                              <SquareCheck size={11} />
                              <span>Checkbox</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="select">
                            <div className="flex items-center gap-1.5">
                              <ChevronDownSquare size={11} />
                              <span>Select</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        value={f.stateVarName}
                        onChange={(e) => handleFieldChange(idx, { stateVarName: e.target.value })}
                        placeholder="varName"
                        className="h-7 text-[11px] font-mono bg-background w-28"
                        title="State variable name"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Form/Button Name & Button Label */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">
                {hasInputFields ? "Form Component Name" : "Button Component Name"}
              </Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={hasInputFields ? "e.g. UserForm" : "e.g. HealthButton"}
                className="h-8 text-xs bg-background font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">
                {hasInputFields ? "Submit Button Label" : "Button Display Label"}
              </Label>
              <Input
                value={submitButtonLabel}
                onChange={(e) => setSubmitButtonLabel(e.target.value)}
                placeholder={hasInputFields ? "e.g. Create Account" : "e.g. Check Health"}
                className="h-8 text-xs bg-background"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/50 bg-secondary/10 flex items-center justify-between sm:justify-between">
          <div className="text-[11px] text-muted-foreground">
            {hasInputFields && enabledCount > 0 ? (
              <span>
                Will generate <strong className="text-foreground">{enabledCount} inputs</strong> +{" "}
                <strong className="text-foreground">1 submit button</strong>
              </span>
            ) : hasInputFields && enabledCount === 0 ? (
              <span>
                Will generate <strong className="text-foreground">1 trigger button</strong> (no inputs)
              </span>
            ) : (
              <span className="text-foreground flex items-center gap-1.5 font-medium">
                <Sparkles size={12} className="text-blue-500" />
                Will generate <strong>{submitButtonLabel || "Action"}</strong> button wired to{" "}
                <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">
                  {selectedItem?.endpoint.type} {selectedItem?.endpoint.name}
                </code>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSubmitting || !selectedItem}
              onClick={handleGenerate}
              className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium cursor-pointer shadow-xs gap-1.5"
            >
              <Sparkles size={12} />
              <span>
                {isSubmitting
                  ? "Generating..."
                  : hasInputFields && enabledCount > 0
                    ? "Generate Form & Store"
                    : "Generate Button & Store"}
              </span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

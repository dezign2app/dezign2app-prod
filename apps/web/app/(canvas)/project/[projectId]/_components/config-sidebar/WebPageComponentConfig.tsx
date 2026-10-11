"use client";

import React, { useMemo, useCallback } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useShallow } from "zustand/react/shallow";
import {
  Layers,
  Sparkles,
  Play,
  ArrowRight,
  Database,
  Zap,
  Sliders,
  ChevronLeft,
  Plus,
  Trash2,
  AlertCircle,
  MousePointerClick,
  FormInput,
  Layout,
  ToggleLeft,
  Table,
  BadgeAlert,
  ChevronDownSquare,
  Eye,
  CheckCircle2,
} from "lucide-react";
import {
  PageSection,
  SectionComponentBinding,
  ComponentBindingType,
  BackendNode,
  UIEventItem,
} from "@workspace/canvas";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";

export interface WebPageComponentConfigProps {
  id: string; // Component binding ID
  nodeId: string; // WebPageNode ID
  sectionId?: string; // Section ID
}

const COMPONENT_TYPES: Array<{
  id: ComponentBindingType;
  label: string;
  icon: React.ElementType;
  description: string;
}> = [
  { id: "button", label: "Button", icon: MousePointerClick, description: "Clickable button to trigger actions" },
  { id: "input", label: "Text Input", icon: FormInput, description: "Text/number field for user entries" },
  { id: "card", label: "Card", icon: Layout, description: "Displays formatted data or summary metric" },
  { id: "switch", label: "Switch", icon: ToggleLeft, description: "Toggle switch for boolean state" },
  { id: "badge", label: "Badge", icon: BadgeAlert, description: "Small status indicator pill" },
  { id: "table", label: "Data Table", icon: Table, description: "Displays list or array collection" },
  { id: "select", label: "Select Dropdown", icon: ChevronDownSquare, description: "Dropdown menu to select an option" },
];

const isComponentBindingType = (val: string): val is ComponentBindingType => {
  return COMPONENT_TYPES.some((c) => c.id === val);
};

export const WebPageComponentConfig: React.FC<WebPageComponentConfigProps> = ({
  id,
  nodeId,
  sectionId,
}) => {
  const parentNode = useBackendCanvasStore(
    useCallback((s) => s.nodes.find((n) => n.id === nodeId), [nodeId]),
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);

  // All state store nodes for state binding dropdowns
  const stateStores = useBackendCanvasStore(
    useShallow((s) => s.nodes.filter((n) => n.type === "state_store")),
  );

  const sections: PageSection[] = parentNode?.data?.sections || [];

  // Target section containing this component
  const targetSection =
    sections.find((s) => (s.componentBindings || []).some((c) => c.id === id)) ||
    sections.find((s) => s.id === sectionId) ||
    sections[0];

  const componentBinding: SectionComponentBinding | undefined =
    targetSection?.componentBindings?.find((c) => c.id === id);

  // Helper to persist updates to component binding
  const handleUpdate = useCallback(
    (changes: Partial<SectionComponentBinding>) => {
      if (!parentNode || !targetSection || !componentBinding) return;

      const currentBindings = targetSection.componentBindings || [];
      const updatedBindings = currentBindings.map((c) =>
        c.id === id ? { ...c, ...changes } : c,
      );

      const updatedSections = sections.map((sec) =>
        sec.id === targetSection.id
          ? { ...sec, componentBindings: updatedBindings }
          : sec,
      );

      updateNode(nodeId, {
        data: {
          ...parentNode.data,
          sections: updatedSections,
        },
      });
    },
    [parentNode, targetSection, componentBinding, sections, nodeId, id, updateNode],
  );

  // Available state variables across section and state stores
  const storeFields = useMemo(() => {
    return stateStores.flatMap((st) => {
      const sName = st.data?.label || st.data?.storeName || "Store";
      return (st.data?.fields || []).map((f) => ({
        id: `${st.id}-${f.name}`,
        storeId: st.id,
        storeName: sName,
        fieldName: f.name,
        type: f.type || "string",
        label: `${sName}.${f.name}`,
      }));
    });
  }, [stateStores]);

  const localStates = useMemo(() => {
    const list: Array<{ name: string; type?: string }> = [];
    (targetSection?.stateObjects || []).forEach((st) => {
      if (st.name && !st.storeName) {
        list.push({ name: st.name, type: st.type });
      }
    });
    (targetSection?.states || []).forEach((st) => {
      if (st.name && !list.some((existing) => existing.name === st.name)) {
        list.push({ name: st.name, type: st.type });
      }
    });
    return list;
  }, [targetSection]);

  const booleanStates = useMemo(() => {
    const list: Array<{ label: string; fieldName: string; storeName?: string }> = [];
    storeFields
      .filter((f) => f.type === "boolean" || f.fieldName.toLowerCase().startsWith("is") || f.fieldName.toLowerCase().startsWith("has"))
      .forEach((f) => {
        list.push({ label: f.label, fieldName: f.fieldName, storeName: f.storeName });
      });
    localStates
      .filter((s) => s.type === "boolean" || s.name.toLowerCase().startsWith("is") || s.name.toLowerCase().startsWith("has"))
      .forEach((s) => {
        list.push({ label: `Local: ${s.name}`, fieldName: s.name });
      });
    return list;
  }, [storeFields, localStates]);

  const availableActions: UIEventItem[] = targetSection?.actions || [];

  const handleCreateAction = () => {
    if (!parentNode || !targetSection || !componentBinding) return;
    const newActId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const actionName = `${componentBinding.label || componentBinding.name || "trigger"}Action`;

    const newAction: UIEventItem = {
      id: newActId,
      name: actionName,
      event: componentBinding.triggerEvent || "click",
      actionSteps: [],
    };

    const updatedActions = [...(targetSection.actions || []), newAction];
    const updatedBindings = (targetSection.componentBindings || []).map((c) =>
      c.id === id
        ? { ...c, actionId: newActId, actionName }
        : c,
    );

    const updatedSections = sections.map((sec) =>
      sec.id === targetSection.id
        ? { ...sec, actions: updatedActions, componentBindings: updatedBindings }
        : sec,
    );

    updateNode(nodeId, {
      data: {
        ...parentNode.data,
        sections: updatedSections,
      },
    });

    toast.success(`Created action "${actionName}"!`);
  };

  const handleOpenActionFlow = (actionId: string) => {
    setActiveConfigItem({
      type: "pageEvent",
      id: actionId,
      nodeId,
      sectionId: targetSection?.id,
      initialTab: "simulate",
    });
  };

  if (!parentNode || !targetSection || !componentBinding) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-3">
        <AlertCircle className="w-8 h-8 text-amber-500" />
        <div className="text-sm font-medium text-foreground">Component Binding Not Found</div>
        <p className="text-xs">
          The selected UI component could not be found in this section.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveConfigItem(null)}
          className="mt-2"
        >
          Close
        </Button>
      </div>
    );
  }

  const selectedCompType = COMPONENT_TYPES.find((c) => c.id === componentBinding.componentType) || COMPONENT_TYPES[0]!;

  return (
    <div className="flex flex-col gap-5 font-sans text-foreground pb-12">
      {/* 1. Breadcrumbs & Header Banner */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-purple-500/[0.05] border border-purple-500/20">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              onClick={() => setActiveConfigItem({ type: "webPage", id: nodeId, nodeId })}
              className="hover:text-foreground cursor-pointer transition-colors"
            >
              {parentNode.data?.label || "Page"}
            </span>
            <span>/</span>
            <span
              onClick={() =>
                setActiveConfigItem({
                  type: "pageSection",
                  id: targetSection.id,
                  nodeId,
                })
              }
              className="hover:text-foreground cursor-pointer transition-colors"
            >
              {targetSection.name}
            </span>
            <span>/</span>
            <span className="text-purple-600 dark:text-purple-400 font-semibold">
              {componentBinding.label || componentBinding.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <Layers size={14} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground">
                {componentBinding.label || componentBinding.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                UI Component, State Binding &amp; Action Trigger
              </span>
            </div>
          </div>
        </div>

        <Badge
          variant="outline"
          className="text-[10px] font-mono px-2 py-0.5 text-purple-600 dark:text-purple-400 border-purple-500/30 uppercase"
        >
          &lt;{componentBinding.componentType} /&gt;
        </Badge>
      </div>

      {/* 2. Live Interactive Component Preview */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Eye size={13} className="text-primary" />
              <span>Live Component Preview</span>
            </CardTitle>
            <Badge variant="secondary" className="text-[9px] font-mono">
              Interactive
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <div className="p-6 rounded-lg bg-muted/25 border border-border/40 flex flex-col items-center justify-center gap-2">
            {componentBinding.componentType === "button" ? (
              <Button
                variant={
                  componentBinding.variant === "secondary"
                    ? "secondary"
                    : componentBinding.variant === "outline"
                    ? "outline"
                    : componentBinding.variant === "destructive"
                    ? "destructive"
                    : "default"
                }
                size="sm"
                onClick={() => {
                  if (componentBinding.actionId) {
                    toast.success(`Simulated trigger: ${componentBinding.actionName || "Action"}`);
                  } else {
                    toast.info(`Button clicked: "${componentBinding.label || "Button"}"`);
                  }
                }}
                className="cursor-pointer shadow-xs gap-1.5"
              >
                <MousePointerClick size={12} />
                <span>{componentBinding.label || "Click Me"}</span>
              </Button>
            ) : componentBinding.componentType === "input" ? (
              <div className="flex flex-col gap-1 w-full max-w-xs">
                <Label className="text-[10px] text-muted-foreground font-mono">
                  {componentBinding.label || "Input Label"}
                </Label>
                <Input
                  placeholder={componentBinding.label || "Type here..."}
                  className="h-8 text-xs bg-background"
                  readOnly
                />
              </div>
            ) : componentBinding.componentType === "card" ? (
              <div className="p-3.5 rounded-lg border bg-card text-card-foreground shadow-xs w-full max-w-xs">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {componentBinding.label || "Data Card"}
                </div>
                <div className="text-sm font-bold font-mono mt-1 text-foreground">
                  {componentBinding.valueStateName ? `{${componentBinding.valueStateName}}` : "Sample Value"}
                </div>
              </div>
            ) : (
              <Badge variant="outline" className="text-xs py-1 px-3">
                {componentBinding.label || componentBinding.name}
              </Badge>
            )}

            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              {componentBinding.actionId ? (
                <span className="text-amber-500 font-medium">
                  Triggers &quot;{componentBinding.actionName || "action"}&quot; on {componentBinding.triggerEvent || "click"}
                </span>
              ) : (
                <span className="italic">No action connected yet</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Component Definition Settings */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <Sliders size={13} className="text-primary" />
            <span>Component Identity &amp; Type</span>
          </CardTitle>
          <CardDescription className="text-[11px]">
            Choose the UI component type and display label
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-3 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">UI Component Type</Label>
            <Select
              value={componentBinding.componentType}
              onValueChange={(val) => {
                if (isComponentBindingType(val)) {
                  handleUpdate({ componentType: val });
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPONENT_TYPES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <c.icon size={12} className="text-purple-500" />
                      <span>{c.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Component Label / Text</Label>
              <Input
                value={componentBinding.label ?? ""}
                onChange={(e) => handleUpdate({ label: e.target.value })}
                placeholder="e.g. Send Message, Search"
                className="h-8 text-xs bg-background"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Style Variant</Label>
              <Select
                value={componentBinding.variant || "default"}
                onValueChange={(val) => handleUpdate({ variant: val })}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (Primary)</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="outline">Outline</SelectItem>
                  <SelectItem value="destructive">Destructive (Red)</SelectItem>
                  <SelectItem value="ghost">Ghost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. State Variable Mappings (Value & Guard) */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <Database size={13} className="text-cyan-500" />
            <span>State Variable Mappings</span>
          </CardTitle>
          <CardDescription className="text-[11px]">
            Bind values from Zustand stores or local page state
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-3 text-xs">
          {/* Value / Data Binding */}
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Main Data / Value Binding</span>
              <span className="text-[10px] text-muted-foreground/70 font-normal">
                (value, children, or data source)
              </span>
            </Label>
            <Select
              value={
                componentBinding.valueStateName
                  ? componentBinding.valueStoreName
                    ? `${componentBinding.valueStoreName}.${componentBinding.valueStateName}`
                    : `local.${componentBinding.valueStateName}`
                  : "__none__"
              }
              onValueChange={(val) => {
                if (val === "__none__") {
                  handleUpdate({
                    valueStateName: undefined,
                    valueStoreName: undefined,
                    valueSourceType: undefined,
                  });
                } else if (val.startsWith("local.")) {
                  const stateName = val.replace("local.", "");
                  handleUpdate({
                    valueStateName: stateName,
                    valueStoreName: undefined,
                    valueSourceType: "local",
                  });
                } else {
                  const [sName, fName] = val.split(".");
                  handleUpdate({
                    valueStateName: fName,
                    valueStoreName: sName,
                    valueSourceType: "store",
                  });
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background font-mono">
                <SelectValue placeholder="Select state variable..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">-- None (Static component) --</SelectItem>
                {storeFields.map((f) => (
                  <SelectItem key={f.id} value={`${f.storeName}.${f.fieldName}`} className="font-mono text-xs">
                    ⚡ {f.label} ({f.type})
                  </SelectItem>
                ))}
                {localStates.map((s) => (
                  <SelectItem key={s.name} value={`local.${s.name}`} className="font-mono text-xs">
                    📄 Page State: {s.name} ({s.type || "state"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Disabled Guard Binding */}
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Disabled State Guard</span>
              <span className="text-[10px] text-rose-500/80 font-normal">
                (e.g. disabled when isLoading)
              </span>
            </Label>
            <Select
              value={
                componentBinding.disabledStateName
                  ? componentBinding.disabledStoreName
                    ? `${componentBinding.disabledStoreName}.${componentBinding.disabledStateName}`
                    : `local.${componentBinding.disabledStateName}`
                  : "__none__"
              }
              onValueChange={(val) => {
                if (val === "__none__") {
                  handleUpdate({
                    disabledStateName: undefined,
                    disabledStoreName: undefined,
                  });
                } else if (val.startsWith("local.")) {
                  const stateName = val.replace("local.", "");
                  handleUpdate({
                    disabledStateName: stateName,
                    disabledStoreName: undefined,
                  });
                } else {
                  const [sName, fName] = val.split(".");
                  handleUpdate({
                    disabledStateName: fName,
                    disabledStoreName: sName,
                  });
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background font-mono">
                <SelectValue placeholder="Select boolean state guard..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">-- Never Disabled --</SelectItem>
                {booleanStates.map((b) => (
                  <SelectItem
                    key={b.storeName ? `${b.storeName}.${b.fieldName}` : `local.${b.fieldName}`}
                    value={b.storeName ? `${b.storeName}.${b.fieldName}` : `local.${b.fieldName}`}
                    className="font-mono text-xs"
                  >
                    🔒 {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 5. Action / Event Trigger Mapping */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Zap size={13} className="text-amber-500" />
              <span>Action / Trigger Binding</span>
            </CardTitle>
            <button
              type="button"
              onClick={handleCreateAction}
              className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <Plus size={10} />
              <span>New Action</span>
            </button>
          </div>
          <CardDescription className="text-[11px]">
            Action executed when user interacts with this component
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Trigger Event</Label>
              <Select
                value={componentBinding.triggerEvent || "click"}
                onValueChange={(val) => handleUpdate({ triggerEvent: val })}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="click">onClick</SelectItem>
                  <SelectItem value="change">onChange</SelectItem>
                  <SelectItem value="submit">onSubmit</SelectItem>
                  <SelectItem value="select">onSelect</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Target Section Action</Label>
              <Select
                value={componentBinding.actionId || "__none__"}
                onValueChange={(val) => {
                  if (val === "__none__") {
                    handleUpdate({ actionId: undefined, actionName: undefined });
                  } else {
                    const act = availableActions.find((a) => a.id === val);
                    handleUpdate({
                      actionId: val,
                      actionName: act?.name || "action",
                    });
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-background font-mono">
                  <SelectValue placeholder="Choose action..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- No Action Attached --</SelectItem>
                  {availableActions.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="font-mono text-xs">
                      ⚡ {a.name} ({a.event})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {componentBinding.actionId && (
            <div className="p-2.5 rounded-lg bg-amber-500/[0.04] border border-amber-500/25 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <ArrowRight size={11} className="text-amber-500" />
                <span className="text-muted-foreground">Flow:</span>
                <span className="font-bold text-foreground">
                  {componentBinding.actionName || "Action"}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleOpenActionFlow(componentBinding.actionId!)}
                className="h-7 text-[11px] gap-1 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
              >
                <Play size={10} />
                <span>Configure Steps &amp; Simulate</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WebPageComponentConfig;

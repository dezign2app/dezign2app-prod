"use client";

import React, { useMemo, useCallback } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useShallow } from "zustand/react/shallow";
import {
  Layers,
  Play,
  ArrowRight,
  Zap,
  ChevronLeft,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import {
  PageSection,
  SectionComponentBinding,
  BackendNode,
  UIEventItem,
  JSONValue,
  StateRenderComponent,
  StateRenderConfig,
  ComponentPropMappings,
} from "@workspace/canvas";
import {
  StateComponentPreview,
  ComponentSelector,
  ComponentPropMappingsSection,
  COMPONENT_OPTIONS,
  DEFAULT_COMPONENT_OPTION,
  ComponentOption,
} from "./web-page-state-config";
import { Button } from "@workspace/ui/components/button";
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

export interface WebPageComponentConfigProps {
  id: string; // Component binding ID
  nodeId: string; // WebPageNode ID
  sectionId?: string; // Section ID
}

const toStateRenderComponent = (val: string): StateRenderComponent => {
  switch (val) {
    case "badge":
    case "card":
    case "button":
    case "switch":
    case "checkbox":
    case "progress":
    case "input":
    case "alert":
    case "avatar":
    case "skeleton":
    case "table":
    case "code":
    case "text":
      return val;
    default:
      return "input";
  }
};

const toValidVariant = (val?: string): NonNullable<StateRenderConfig["variant"]> => {
  if (val === "secondary" || val === "outline" || val === "destructive") {
    return val;
  }
  return "default";
};

const toClickAction = (actId?: string): NonNullable<StateRenderConfig["clickAction"]> => {
  if (actId) return "trigger_event";
  return "none";
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

  const availableStateVars = useMemo(() => {
    const list: Array<{ name: string; type?: string; source: "store" | "local" }> = [];
    storeFields.forEach((f) => {
      list.push({ name: f.label, type: f.type, source: "store" });
    });
    localStates.forEach((s) => {
      list.push({ name: s.name, type: s.type, source: "local" });
    });
    return list;
  }, [storeFields, localStates]);

  const availableActions: UIEventItem[] = targetSection?.actions || [];

  const handleCreateAction = useCallback(
    (name?: string, eventType?: string) => {
      if (!parentNode || !targetSection || !componentBinding) return;
      const newActId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const actionName = name || `${componentBinding.label || componentBinding.name || "trigger"}Action`;

      const newAction: UIEventItem = {
        id: newActId,
        name: actionName,
        event: eventType || componentBinding.triggerEvent || "click",
        actionSteps: [],
      };

      const updatedActions = [...(targetSection.actions || []), newAction];
      const updatedBindings = (targetSection.componentBindings || []).map((c) =>
        c.id === id
          ? {
              ...c,
              actionId: newActId,
              actionName,
              propMappings: {
                ...(c.propMappings || {}),
                onChangeActionId: newActId,
              },
            }
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
    },
    [parentNode, targetSection, componentBinding, id, sections, nodeId, updateNode],
  );

  const handleOpenActionFlow = useCallback(
    (actionId: string) => {
      setActiveConfigItem({
        type: "pageEvent",
        id: actionId,
        nodeId,
        sectionId: targetSection?.id,
        initialTab: "simulate",
      });
    },
    [setActiveConfigItem, nodeId, targetSection?.id],
  );

  const currentRenderComponent = toStateRenderComponent(
    componentBinding?.componentType || "input",
  );

  const selectedOption: ComponentOption = useMemo(() => {
    const found = COMPONENT_OPTIONS.find((opt) => opt.id === currentRenderComponent);
    return found || DEFAULT_COMPONENT_OPTION;
  }, [currentRenderComponent]);

  const selectedStore = useMemo(() => {
    if (!componentBinding?.valueStoreName) return undefined;
    return stateStores.find(
      (st) =>
        st.data?.label === componentBinding.valueStoreName ||
        st.data?.storeName === componentBinding.valueStoreName,
    );
  }, [componentBinding?.valueStoreName, stateStores]);

  const bindingStateType = useMemo(() => {
    if (!componentBinding) return undefined;
    if (componentBinding.valueStoreName && componentBinding.valueStateName) {
      const match = storeFields.find(
        (f) =>
          f.storeName === componentBinding.valueStoreName &&
          f.fieldName === componentBinding.valueStateName,
      );
      if (match) return match.type;
    }
    if (componentBinding.valueStateName) {
      const match = localStates.find((s) => s.name === componentBinding.valueStateName);
      if (match) return match.type;
    }
    return undefined;
  }, [componentBinding, storeFields, localStates]);

  const propMappings: ComponentPropMappings = useMemo(() => {
    return componentBinding?.propMappings || {};
  }, [componentBinding?.propMappings]);

  const handleUpdatePropMapping = useCallback(
    (changes: Partial<ComponentPropMappings>) => {
      if (!componentBinding) return;
      const currentProps = componentBinding.propMappings || {};
      const updatedProps: ComponentPropMappings = {
        ...currentProps,
        ...changes,
      };

      const topLevelUpdates: Partial<SectionComponentBinding> = {
        propMappings: updatedProps,
      };

      if (changes.valueBinding && !componentBinding.valueStateName) {
        topLevelUpdates.valueStateName = changes.valueBinding;
      }
      if (changes.onChangeActionId) {
        topLevelUpdates.actionId = changes.onChangeActionId;
        const matched = availableActions.find((a) => a.id === changes.onChangeActionId);
        if (matched) {
          topLevelUpdates.actionName = matched.name;
        }
      }
      if (changes.disabledBinding) {
        topLevelUpdates.disabledStateName = changes.disabledBinding;
      }
      if (changes.disabledStoreName) {
        topLevelUpdates.disabledStoreName = changes.disabledStoreName;
      }

      handleUpdate(topLevelUpdates);
    },
    [componentBinding, availableActions, handleUpdate],
  );

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

  const boundStateObj = targetSection?.stateObjects?.find(
    (s) => s.name === componentBinding?.valueStateName,
  );
  const sampleValue: JSONValue | undefined = boundStateObj?.defaultValue;

  const displayLabel = componentBinding.label || componentBinding.name || "Component";
  const stateName = componentBinding.valueStateName || componentBinding.name || "value";

  const formattedPreviewValue = String(
    sampleValue !== undefined && sampleValue !== null
      ? typeof sampleValue === "object"
        ? JSON.stringify(sampleValue)
        : sampleValue
      : componentBinding.valueStateName || displayLabel,
  );

  return (
    <div className="flex flex-col gap-5 font-sans text-foreground pb-12">
      {/* 1. Breadcrumbs & Header Banner */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-purple-500/[0.05] border border-purple-500/20">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setActiveConfigItem({
                  type: "pageSection",
                  id: targetSection.id,
                  nodeId,
                })
              }
              className="h-5 px-1 text-muted-foreground hover:text-foreground -ml-1 gap-1 cursor-pointer"
            >
              <ChevronLeft size={12} />
              <span>Back</span>
            </Button>
            <span>/</span>
            <span
              onClick={() =>
                setActiveConfigItem({
                  type: "webPage",
                  id: nodeId,
                  nodeId,
                })
              }
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
              {displayLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <Layers size={14} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground">
                {displayLabel}
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

      {/* 2. Live Component Preview Sandbox */}
      <StateComponentPreview
        currentComponent={currentRenderComponent}
        currentVariant={toValidVariant(componentBinding.variant)}
        currentClickAction={toClickAction(componentBinding.actionId)}
        displayLabel={displayLabel}
        customLabel={componentBinding.label}
        formattedPreviewValue={formattedPreviewValue}
        sampleValue={sampleValue}
        propMappings={propMappings}
        stateName={stateName}
        copyToastMessage={`Copied ${stateName} to clipboard!`}
        targetActionId={componentBinding.actionId}
      />

      {/* 3. Searchable Component Selector Combobox */}
      <ComponentSelector
        currentComponent={currentRenderComponent}
        selectedOption={selectedOption}
        stateType={bindingStateType}
        onSelectComponent={(componentId) => handleUpdate({ componentType: componentId })}
      />

      <Separator className="bg-border/50" />

      {/* 4. Component Prop Mappings Section */}
      <ComponentPropMappingsSection
        currentComponent={currentRenderComponent}
        selectedOption={selectedOption}
        displayLabel={displayLabel}
        stateName={stateName}
        stateType={bindingStateType}
        storeName={componentBinding.valueStoreName}
        storeId={selectedStore?.id}
        availableActions={availableActions}
        availableStateVars={availableStateVars}
        stateStoreNodes={stateStores}
        propMappings={propMappings}
        onUpdatePropMapping={handleUpdatePropMapping}
        onOpenEventConfig={handleOpenActionFlow}
        onCreateAction={(name, eventType) => handleCreateAction(name, eventType || "change")}
      />

      <Separator className="bg-border/50" />

      {/* 5. Event & Action Trigger Binding */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Zap size={13} className="text-amber-500" />
              <span>Event &amp; Action Trigger Binding</span>
            </span>
            {componentBinding.actionId && (
              <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30">
                Wired
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-[11px]">
            Execute section actions and workflows when interacting with this component
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-3 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Trigger Event</span>
              <span className="text-[10px] text-muted-foreground/70 font-normal">
                DOM or interaction event
              </span>
            </Label>
            <Select
              value={componentBinding.triggerEvent || "click"}
              onValueChange={(val) => handleUpdate({ triggerEvent: val })}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="click">onClick (Button click / tap)</SelectItem>
                <SelectItem value="change">onChange (Input change / toggle)</SelectItem>
                <SelectItem value="submit">onSubmit (Form submission)</SelectItem>
                <SelectItem value="select">onSelect (Dropdown option chosen)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">Target Action Workflow</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleCreateAction()}
                className="h-6 text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-700 p-0 hover:bg-transparent flex items-center gap-1 cursor-pointer"
              >
                <Plus size={11} />
                <span>New Action</span>
              </Button>
            </div>
            <Select
              value={componentBinding.actionId || "__none__"}
              onValueChange={(val) => {
                if (val === "__none__") {
                  handleUpdate({ actionId: undefined, actionName: undefined });
                } else {
                  const act = availableActions.find((a) => a.id === val);
                  handleUpdate({
                    actionId: val,
                    actionName: act?.name || "Action",
                  });
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="No Action Bound" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (No Action)</SelectItem>
                {availableActions.map((act) => (
                  <SelectItem key={act.id} value={act.id || ""}>
                    <div className="flex items-center gap-1.5">
                      <Zap size={11} className="text-amber-500" />
                      <span>{act.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        ({act.actionSteps?.length || 0} steps)
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {componentBinding.actionId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (componentBinding.actionId) {
                  handleOpenActionFlow(componentBinding.actionId);
                }
              }}
              className="w-full h-8 text-xs flex items-center justify-between border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Play size={12} className="text-purple-500" />
                <span>Open Action Flow Editor</span>
              </span>
              <ArrowRight size={12} />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 6. Delete Component Binding Button */}
      <div className="pt-2 border-t border-border/40 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const currentBindings = targetSection.componentBindings || [];
            const updatedBindings = currentBindings.filter((c) => c.id !== id);
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
            setActiveConfigItem(null);
            toast.success("Component binding removed");
          }}
          className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center gap-1.5 cursor-pointer"
        >
          <Trash2 size={12} />
          <span>Delete Component Binding</span>
        </Button>
      </div>
    </div>
  );
};

"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useShallow } from "zustand/react/shallow";
import { Trash2, AlertCircle, SlidersHorizontal } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import {
  PageSection,
  SectionComponentBinding,
  ComponentElementBinding,
  ComponentBindingType,
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
import {
  ComponentBreadcrumbsHeader,
  ComponentIdentityCard,
  ComponentEventActionCard,
  GenerateFormFromEndpointDialog,
  ComponentResponseMappingCard,
} from "./web-page-component-config";
import { Button } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";
import { toast } from "sonner";
import { toPascalCase } from "@/lib/utils";
import { Badge } from "@workspace/ui/components/badge";
import { Sparkles } from "lucide-react";

export { toPascalCase };

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
      const currentParent = useBackendCanvasStore
        .getState()
        .nodes.find((n) => n.id === nodeId);
      if (!currentParent) return;

      const currentSections: PageSection[] = currentParent.data?.sections || [];
      const currentTargetSec =
        currentSections.find((s) => (s.componentBindings || []).some((c) => c.id === id)) ||
        currentSections.find((s) => s.id === sectionId) ||
        currentSections[0];
      if (!currentTargetSec) return;

      // CRITICAL: component name must never be empty!
      if (changes.name !== undefined) {
        const pascal = toPascalCase(changes.name);
        if (!pascal) return;
      }

      const currentBindings = currentTargetSec.componentBindings || [];
      const updatedBindings = currentBindings.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...changes };
        if (changes.name !== undefined) {
          const pascal = toPascalCase(changes.name);
          next.name = pascal;
          if (changes.label !== undefined || !next.label) {
            next.label = pascal;
          }
        }
        return next;
      });

      const updatedSections = currentSections.map((sec) =>
        sec.id === currentTargetSec.id
          ? { ...sec, componentBindings: updatedBindings }
          : sec,
      );

      updateNode(nodeId, {
        data: {
          ...currentParent.data,
          sections: updatedSections,
        },
      });
    },
    [nodeId, id, sectionId, updateNode],
  );

  // Auto-normalize component name and label to PascalCase
  useEffect(() => {
    if (!componentBinding) return;
    const currentName = componentBinding.name || componentBinding.label;
    if (currentName) {
      const pascal = toPascalCase(currentName);
      if (pascal && (componentBinding.name !== pascal || componentBinding.label !== pascal)) {
        handleUpdate({ name: pascal, label: pascal });
      }
    }
  }, [componentBinding?.name, componentBinding?.label, handleUpdate]);

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
      const currentParent = useBackendCanvasStore
        .getState()
        .nodes.find((n) => n.id === nodeId);
      if (!currentParent) return;

      const currentSections: PageSection[] = currentParent.data?.sections || [];
      const currentTargetSec =
        currentSections.find((s) => (s.componentBindings || []).some((c) => c.id === id)) ||
        currentSections.find((s) => s.id === sectionId) ||
        currentSections[0];
      if (!currentTargetSec) return;

      const currentBinding = currentTargetSec.componentBindings?.find((c) => c.id === id);
      if (!currentBinding) return;

      const newActId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const actionName = name || `${currentBinding.name || currentBinding.label || "trigger"}Action`;

      const newAction: UIEventItem = {
        id: newActId,
        name: actionName,
        event: eventType || currentBinding.triggerEvent || "click",
        actionSteps: [],
      };

      const updatedActions = [...(currentTargetSec.actions || []), newAction];
      const updatedBindings = (currentTargetSec.componentBindings || []).map((c) =>
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

      const updatedSections = currentSections.map((sec) =>
        sec.id === currentTargetSec.id
          ? { ...sec, actions: updatedActions, componentBindings: updatedBindings }
          : sec,
      );

      updateNode(nodeId, {
        data: {
          ...currentParent.data,
          sections: updatedSections,
        },
      });

      toast.success(`Created action "${actionName}"!`);
    },
    [id, nodeId, sectionId, updateNode],
  );

  const handleCreateComponentAction = useCallback(
    (name?: string, eventType?: string) => {
      handleCreateAction(name, eventType || "change");
    },
    [handleCreateAction],
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

  // Normalized multiple Shadcn UI elements within this component
  const currentElements: ComponentElementBinding[] = useMemo(() => {
    if (componentBinding?.elements && componentBinding.elements.length > 0) {
      return componentBinding.elements;
    }
    if (!componentBinding) return [];
    return [
      {
        id: `el-${componentBinding.id}`,
        name: componentBinding.name || "Element1",
        elementType: componentBinding.componentType || "input",
        label: componentBinding.label || componentBinding.name || "Element 1",
        variant: componentBinding.variant,
        valueStateName: componentBinding.valueStateName,
        valueStoreName: componentBinding.valueStoreName,
        valueSourceType: componentBinding.valueSourceType,
        actionId: componentBinding.actionId,
        actionName: componentBinding.actionName,
        triggerEvent: componentBinding.triggerEvent || "click",
        disabledStateName: componentBinding.disabledStateName,
        disabledStoreName: componentBinding.disabledStoreName,
        propMappings: componentBinding.propMappings,
      },
    ];
  }, [componentBinding]);

  const [activeElementId, setActiveElementId] = useState<string>("");
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);

  useEffect(() => {
    if (!currentElements.some((e) => e.id === activeElementId) && currentElements[0]) {
      setActiveElementId(currentElements[0].id);
    }
  }, [currentElements, activeElementId]);

  const handleUpdateElements = useCallback(
    (nextElements: ComponentElementBinding[]) => {
      const first = nextElements[0];
      handleUpdate({
        elements: nextElements,
        componentType: first?.elementType || componentBinding?.componentType || "button",
        valueStateName: first?.valueStateName,
        valueStoreName: first?.valueStoreName,
        valueSourceType: first?.valueSourceType,
        actionId: first?.actionId,
        actionName: first?.actionName,
        triggerEvent: first?.triggerEvent,
      });
    },
    [handleUpdate, componentBinding?.componentType],
  );

  const handleAddElement = useCallback(
    (type: StateRenderComponent = "input") => {
      const elIndex = currentElements.length + 1;
      const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
      const newElName = `${typeLabel}${elIndex}`;
      const newElId = `el-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const newElement: ComponentElementBinding = {
        id: newElId,
        name: newElName,
        elementType: type,
        label: `${typeLabel} ${elIndex}`,
        placeholder: type === "input" ? `Enter ${newElName.toLowerCase()}...` : undefined,
        variant: type === "button" ? "default" : type === "badge" ? "secondary" : undefined,
        triggerEvent: type === "button" ? "click" : "change",
      };

      const updated = [...currentElements, newElement];
      handleUpdateElements(updated);
      setActiveElementId(newElId);
      toast.success(`Added ${typeLabel} component!`);
    },
    [currentElements, handleUpdateElements],
  );

  const handleUpdateElement = useCallback(
    (elId: string, changes: Partial<ComponentElementBinding>) => {
      const updated = currentElements.map((el) => {
        if (el.id !== elId) return el;
        const next = { ...el, ...changes };
        if (changes.name) {
          const pascal = toPascalCase(changes.name);
          if (pascal) {
            next.name = pascal;
            if (!next.label || changes.label !== undefined) next.label = pascal;
          }
        }
        return next;
      });
      handleUpdateElements(updated);
    },
    [currentElements, handleUpdateElements],
  );

  const handleChangeElementType = useCallback(
    (elId: string, type: StateRenderComponent) => {
      const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
      handleUpdateElement(elId, {
        elementType: type,
        variant: type === "button" ? "default" : type === "badge" ? "secondary" : undefined,
        triggerEvent: type === "button" ? "click" : "change",
      });
      toast.success(`Changed to ${typeLabel}`);
    },
    [handleUpdateElement],
  );

  const handleDeleteElement = useCallback(
    (elId: string) => {
      if (currentElements.length <= 1) {
        toast.error("Component must contain at least one UI component.");
        return;
      }
      const updated = currentElements.filter((el) => el.id !== elId);
      handleUpdateElements(updated);
      if (activeElementId === elId) {
        setActiveElementId(updated[0]?.id || "");
      }
      toast.success("Component removed");
    },
    [currentElements, activeElementId, handleUpdateElements],
  );

  const handleMoveElement = useCallback(
    (index: number, direction: "up" | "down") => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= currentElements.length) return;
      const copy = [...currentElements];
      const temp = copy[index]!;
      copy[index] = copy[targetIndex]!;
      copy[targetIndex] = temp;
      handleUpdateElements(copy);
    },
    [currentElements, handleUpdateElements],
  );

  const activeElement: ComponentElementBinding = useMemo(() => {
    return (
      currentElements.find((e) => e.id === activeElementId) ||
      currentElements[0] || {
        id: `el-${componentBinding?.id || "default"}`,
        name: componentBinding?.name || "Component",
        elementType: componentBinding?.componentType || "input",
        label: componentBinding?.label || componentBinding?.name || "Component",
      }
    );
  }, [currentElements, activeElementId, componentBinding]);

  const activeRenderComponent = toStateRenderComponent(
    activeElement.elementType || "input",
  );

  const activeOption: ComponentOption = useMemo(() => {
    const found = COMPONENT_OPTIONS.find((opt) => opt.id === activeRenderComponent);
    return found || DEFAULT_COMPONENT_OPTION;
  }, [activeRenderComponent]);

  const activeSelectedStore = useMemo(() => {
    if (!activeElement.valueStoreName) return undefined;
    return stateStores.find(
      (st) =>
        st.data?.label === activeElement.valueStoreName ||
        st.data?.storeName === activeElement.valueStoreName,
    );
  }, [activeElement.valueStoreName, stateStores]);

  const activeBindingStateType = useMemo(() => {
    if (activeElement.valueStoreName && activeElement.valueStateName) {
      const match = storeFields.find(
        (f) =>
          f.storeName === activeElement.valueStoreName &&
          f.fieldName === activeElement.valueStateName,
      );
      if (match) return match.type;
    }
    if (activeElement.valueStateName) {
      const match = localStates.find((s) => s.name === activeElement.valueStateName);
      if (match) return match.type;
    }
    return undefined;
  }, [activeElement.valueStoreName, activeElement.valueStateName, storeFields, localStates]);

  const activePropMappings: ComponentPropMappings = useMemo(() => {
    return activeElement.propMappings || {};
  }, [activeElement.propMappings]);

  const handleUpdateActivePropMapping = useCallback(
    (changes: Partial<ComponentPropMappings>) => {
      const currentProps = activeElement.propMappings || {};
      const updatedProps: ComponentPropMappings = {
        ...currentProps,
        ...changes,
      };

      const elementChanges: Partial<ComponentElementBinding> = {
        propMappings: updatedProps,
      };

      if (changes.valueBinding !== undefined) {
        elementChanges.valueStateName = changes.valueBinding;
      }
      if (changes.onChangeActionId !== undefined) {
        elementChanges.actionId = changes.onChangeActionId;
        const matched = availableActions.find((a) => a.id === changes.onChangeActionId);
        if (matched) {
          elementChanges.actionName = matched.name;
        }
      }
      if (changes.disabledBinding !== undefined) {
        elementChanges.disabledStateName = changes.disabledBinding;
      }
      if (changes.disabledStoreName !== undefined) {
        elementChanges.disabledStoreName = changes.disabledStoreName;
      }

      handleUpdateElement(activeElement.id, elementChanges);
    },
    [activeElement, availableActions, handleUpdateElement],
  );

  const handleCreateActionForElement = useCallback(
    (elId: string, defaultName?: string, eventType?: string) => {
      const currentParent = useBackendCanvasStore
        .getState()
        .nodes.find((n) => n.id === nodeId);
      if (!currentParent) return;

      const currentSections: PageSection[] = currentParent.data?.sections || [];
      const currentTargetSec =
        currentSections.find((s) => (s.componentBindings || []).some((c) => c.id === id)) ||
        currentSections.find((s) => s.id === sectionId) ||
        currentSections[0];
      if (!currentTargetSec) return;

      const targetEl = currentElements.find((e) => e.id === elId);
      const actionName = defaultName || `${targetEl?.name || "button"}Action`;
      const newActId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const newAction: UIEventItem = {
        id: newActId,
        name: actionName,
        event: eventType || targetEl?.triggerEvent || "click",
        actionSteps: [],
      };

      const updatedActions = [...(currentTargetSec.actions || []), newAction];
      const updatedElements = currentElements.map((el) =>
        el.id === elId
          ? {
              ...el,
              actionId: newActId,
              actionName,
            }
          : el,
      );

      const updatedBindings = (currentTargetSec.componentBindings || []).map((c) =>
        c.id === id
          ? {
              ...c,
              elements: updatedElements,
              actionId: updatedElements[0]?.actionId,
              actionName: updatedElements[0]?.actionName,
            }
          : c,
      );

      const updatedSections = currentSections.map((sec) =>
        sec.id === currentTargetSec.id
          ? { ...sec, actions: updatedActions, componentBindings: updatedBindings }
          : sec,
      );

      updateNode(nodeId, {
        data: {
          ...currentParent.data,
          sections: updatedSections,
        },
      });

      toast.success(`Created and wired action "${actionName}"!`);
    },
    [currentElements, nodeId, id, sectionId, updateNode],
  );

  const handleCreateActiveElementAction = useCallback(
    (name?: string, eventType?: string) => {
      handleCreateActionForElement(activeElement.id, name, eventType);
    },
    [activeElement.id, handleCreateActionForElement],
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

  const rawName = componentBinding.name || componentBinding.label || "";
  const displayLabel = toPascalCase(rawName) || "Component";
  const stateName = componentBinding.valueStateName || displayLabel || "value";

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
      <ComponentBreadcrumbsHeader
        pageLabel={parentNode.data?.label || "Page"}
        sectionId={targetSection.id}
        sectionName={targetSection.name}
        displayLabel={displayLabel}
        nodeId={nodeId}
        onNavigateBack={() =>
          setActiveConfigItem({
            type: "pageSection",
            id: targetSection.id,
            nodeId,
          })
        }
        onNavigateToPage={() =>
          setActiveConfigItem({
            type: "webPage",
            id: nodeId,
            nodeId,
          })
        }
        onNavigateToSection={() =>
          setActiveConfigItem({
            type: "pageSection",
            id: targetSection.id,
            nodeId,
          })
        }
      />

      {/* 2. Component Identity & Naming */}
      <ComponentIdentityCard
        componentId={componentBinding.id}
        name={componentBinding.name}
        label={componentBinding.label}
        displayLabel={displayLabel}
        description={componentBinding.description}
        onUpdate={handleUpdate}
      />

      {/* 2.5 Quick Auto-Generate / Sync from Endpoint */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/[0.06] border border-purple-500/20">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
            <Sparkles size={15} />
          </div>
          <div>
            <div className="text-xs font-semibold text-foreground">Sync with Endpoint Contract</div>
            <div className="text-[11px] text-muted-foreground">
              Auto-populate fields and Zustand state variables from an API schema
            </div>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setGenerateDialogOpen(true)}
          className="h-7 text-xs font-medium border-purple-500/30 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 cursor-pointer shrink-0 ml-2"
        >
          <Sparkles size={11} className="mr-1.5" />
          Auto-Generate Form
        </Button>
      </div>

      {/* 3. Live Component Preview Sandbox */}
      <StateComponentPreview
        currentComponent={activeRenderComponent}
        currentVariant={toValidVariant(activeElement.variant || componentBinding.variant)}
        currentClickAction={toClickAction(activeElement.actionId || componentBinding.actionId)}
        displayLabel={displayLabel}
        customLabel={activeElement.label || activeElement.name || displayLabel}
        formattedPreviewValue={formattedPreviewValue}
        sampleValue={sampleValue}
        propMappings={activePropMappings}
        stateName={activeElement.valueStateName || stateName}
        copyToastMessage={`Copied ${stateName} to clipboard!`}
        targetActionId={activeElement.actionId || componentBinding.actionId}
        elements={currentElements}
        activeElementId={activeElement.id}
        onSelectElement={setActiveElementId}
      />

      {/* 4. Select Shadcn Component (Supports Multiple Components, Adding, and Type Switching) */}
      <ComponentSelector
        elements={currentElements}
        activeElementId={activeElement.id}
        onSelectActiveElement={setActiveElementId}
        onAddComponent={handleAddElement}
        onChangeComponentType={handleChangeElementType}
        onDeleteElement={handleDeleteElement}
        stateType={activeBindingStateType}
        currentComponent={activeRenderComponent}
        selectedOption={activeOption}
      />

      <Separator className="bg-border/50" />

      {/* 5. Component Prop Mappings Section with Switcher between Selected Components */}
      <div className="flex flex-col gap-3">
        {currentElements.length > 1 && (
          <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-muted/20 border border-border/50">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <SlidersHorizontal size={13} className="text-primary" />
                <span>Switch Component to Map:</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {currentElements.findIndex((e) => e.id === activeElement.id) + 1} of {currentElements.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {currentElements.map((el, idx) => {
                const isActive = el.id === activeElement.id;
                const opt =
                  COMPONENT_OPTIONS.find((o) => o.id === toStateRenderComponent(el.elementType)) ||
                  DEFAULT_COMPONENT_OPTION;
                const Icon = opt.icon;
                return (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => setActiveElementId(el.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                      isActive
                        ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40 shadow-xs font-semibold ring-1 ring-cyan-500/30"
                        : "bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50",
                    )}
                  >
                    <Icon size={13} className={isActive ? "text-cyan-500" : "text-muted-foreground"} />
                    <span>{el.label || el.name || `Component ${idx + 1}`}</span>
                    <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 capitalize border-current/30">
                      {el.elementType}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <ComponentPropMappingsSection
          currentComponent={activeRenderComponent}
          selectedOption={activeOption}
          displayLabel={activeElement.label || activeElement.name || displayLabel}
          stateName={activeElement.valueStateName || activeElement.label || stateName}
          stateType={activeBindingStateType}
          storeName={activeElement.valueStoreName}
          storeId={activeSelectedStore?.id}
          availableActions={availableActions}
          availableStateVars={availableStateVars}
          stateStoreNodes={stateStores}
          propMappings={activePropMappings}
          onUpdatePropMapping={handleUpdateActivePropMapping}
          onOpenEventConfig={handleOpenActionFlow}
          onCreateAction={handleCreateActiveElementAction}
        />
      </div>

      <Separator className="bg-border/50" />

      {/* 6. Event & Action Trigger Binding for Active Component */}
      <ComponentEventActionCard
        triggerEvent={activeElement.triggerEvent || (activeElement.elementType === "button" ? "click" : "change")}
        actionId={activeElement.actionId}
        actionName={activeElement.actionName}
        availableActions={availableActions}
        onUpdate={(changes) => handleUpdateElement(activeElement.id, changes)}
        onCreateAction={handleCreateActiveElementAction}
        onOpenActionFlow={handleOpenActionFlow}
      />

      <Separator className="bg-border/50" />

      {/* 6.5 API Response & State Store Mapping */}
      <ComponentResponseMappingCard
        nodeId={nodeId}
        sectionId={targetSection.id}
        componentBinding={componentBinding}
        activeElement={activeElement}
        availableActions={availableActions}
        stateStores={stateStores}
        onUpdateComponent={handleUpdate}
        onUpdateElements={handleUpdateElements}
      />


      {/* 7. Delete Component Binding Button */}
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

      {/* 7. Generate Form Dialog */}
      {generateDialogOpen && (
        <GenerateFormFromEndpointDialog
          open={generateDialogOpen}
          onOpenChange={setGenerateDialogOpen}
          nodeId={nodeId}
          sectionId={targetSection?.id}
          existingComponentId={componentBinding.id}
          onSuccess={() => {
            setGenerateDialogOpen(false);
          }}
        />
      )}
    </div>
  );
};

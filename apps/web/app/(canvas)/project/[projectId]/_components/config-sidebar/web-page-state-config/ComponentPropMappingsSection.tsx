"use client";

import React from "react";
import {
  SlidersHorizontal,
  Timer,
  Zap,
  ArrowRight,
  CornerDownLeft,
  Sparkles,
  XCircle,
  X,
  Type,
  MousePointerClick,
  CheckCircle2,
  Lock,
  Ban,
  Database,
  Plus,
  ToggleLeft,
  SquareCheck,
  Tag,
  PanelLeft,
  PanelRight,
  LayoutDashboard,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { StateRenderComponent, ComponentPropMappings, UIEventItem, BackendNode } from "@/types/canvas";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useShallow } from "zustand/react/shallow";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { LocalInput } from "../../backend-nodes/graph-nodes/shared";
import { Switch } from "@workspace/ui/components/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  ComponentOption,
  isInputType,
  isButtonSize,
  isOnChangeMode,
  isSidebarCollapsible,
  isSidebarVariant,
  isSidebarSide,
} from "./constants";
import { StateStoreVariablePicker } from "./StateStoreVariablePicker";

export interface ComponentPropMappingsSectionProps {
  currentComponent: StateRenderComponent;
  selectedOption: ComponentOption;
  displayLabel: string;
  stateName: string;
  stateType?: string;
  storeName?: string;
  storeId?: string;
  availableActions?: UIEventItem[];
  availableStateVars?: Array<{ name: string; type?: string; source: "store" | "local" }>;
  stateStoreNodes?: BackendNode[];
  propMappings: ComponentPropMappings;
  onUpdatePropMapping: (changes: Partial<ComponentPropMappings>) => void;
  onOpenEventConfig?: (actionId: string) => void;
  onCreateAction?: (name?: string, eventType?: string) => void;
  onCreateNavStateVariable?: (preferredStoreId?: string) => void;
}

export const ComponentPropMappingsSection: React.FC<ComponentPropMappingsSectionProps> = React.memo(({
  currentComponent,
  selectedOption,
  displayLabel,
  stateName,
  stateType,
  storeName,
  storeId,
  availableActions = [],
  availableStateVars = [],
  stateStoreNodes,
  propMappings: rawPropMappings,
  onUpdatePropMapping: rawOnUpdatePropMapping,
  onOpenEventConfig,
  onCreateAction,
  onCreateNavStateVariable,
}) => {
  // Local optimistic state for prop mappings so all switches, selectors and inputs react instantaneously with 0ms lag
  const [optimisticProps, setOptimisticProps] = React.useState<ComponentPropMappings>(rawPropMappings);

  React.useEffect(() => {
    setOptimisticProps(rawPropMappings);
  }, [rawPropMappings]);

  // Combined current properties: optimistic changes take immediate visual effect
  const propMappings = React.useMemo(() => ({
    ...rawPropMappings,
    ...optimisticProps,
  }), [rawPropMappings, optimisticProps]);

  const onUpdatePropMapping = React.useCallback(
    (changes: Partial<ComponentPropMappings>) => {
      // 1. Immediately apply optimistic change locally (0ms instantaneous visual feedback)
      setOptimisticProps((prev) => ({
        ...prev,
        ...changes,
      }));
      // 2. Dispatch to backend canvas store
      rawOnUpdatePropMapping(changes);
    },
    [rawOnUpdatePropMapping],
  );
  const effectiveStoreName = propMappings.valueStoreName || storeName;
  const effectiveStoreId = propMappings.valueStoreId || storeId;

  const capitalizedState = stateName
    ? stateName.charAt(0).toUpperCase() + stateName.slice(1)
    : "State";
  const activeBoundVar = propMappings.valueBinding || stateName;
  const capitalizedBoundVar = activeBoundVar
    ? activeBoundVar.charAt(0).toUpperCase() + activeBoundVar.slice(1)
    : capitalizedState;
  const defaultSetterName = `set${capitalizedBoundVar}`;
  const onChangeMode = propMappings.onChangeMode || (propMappings.readOnly ? "custom" : "two_way");
  const isDebounceEnabled = Boolean(propMappings.debounceUpdate);
  const debounceMs = propMappings.debounceMs ?? 300;

  // Canvas state store nodes (fallback to backend canvas store if not provided in props)
  const canvasStoreNodes = useBackendCanvasStore(
    useShallow((s) => s.nodes.filter((n) => n.type === "state_store")),
  );
  const actualStoreNodes = stateStoreNodes && stateStoreNodes.length > 0 ? stateStoreNodes : canvasStoreNodes;

  const stateStores = React.useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      scope?: string;
      fields: Array<{ id: string; name: string; type?: string }>;
    }> = [];

    (actualStoreNodes || []).forEach((n) => {
      const sName = n.data?.storeName || n.data?.label || "Store";
      const fields = (n.data?.fields || []).map((f: { id: string; name: string; type?: string }) => ({
        id: f.id,
        name: f.name,
        type: f.type,
      }));
      list.push({
        id: n.id,
        name: sName,
        scope: n.data?.scope,
        fields,
      });
    });

    if (storeId && storeName && !list.some((s) => s.id === storeId)) {
      list.push({
        id: storeId,
        name: storeName,
        fields: [],
      });
    }

    return list;
  }, [actualStoreNodes, storeId, storeName]);

  const isReadOnlyActive = Boolean(
    propMappings.readOnly || propMappings.readOnlyMode === "state_binding"
  );

  const selectedReadOnlyStore = React.useMemo(() => {
    if (propMappings.readOnlyStoreId) {
      return stateStores.find((s) => s.id === propMappings.readOnlyStoreId);
    }
    if (propMappings.readOnlyStoreName) {
      return stateStores.find((s) => s.name === propMappings.readOnlyStoreName);
    }
    if (propMappings.readOnlyMode === "state_binding" && propMappings.readOnlyBinding) {
      return stateStores.find((s) => s.fields.some((f) => f.name === propMappings.readOnlyBinding));
    }
    return undefined;
  }, [stateStores, propMappings.readOnlyStoreId, propMappings.readOnlyStoreName, propMappings.readOnlyMode, propMappings.readOnlyBinding]);

  const readOnlyComboboxValue =
    propMappings.readOnlyMode === "state_binding" && selectedReadOnlyStore
      ? selectedReadOnlyStore.id
      : "__always__";

  const isDisabledActive = Boolean(
    propMappings.disabled || propMappings.disabledMode === "state_binding"
  );

  const selectedDisabledStore = React.useMemo(() => {
    if (propMappings.disabledStoreId) {
      return stateStores.find((s) => s.id === propMappings.disabledStoreId);
    }
    if (propMappings.disabledStoreName) {
      return stateStores.find((s) => s.name === propMappings.disabledStoreName);
    }
    if (propMappings.disabledMode === "state_binding" && propMappings.disabledBinding) {
      return stateStores.find((s) => s.fields.some((f) => f.name === propMappings.disabledBinding));
    }
    return undefined;
  }, [stateStores, propMappings.disabledStoreId, propMappings.disabledStoreName, propMappings.disabledMode, propMappings.disabledBinding]);

  const disabledComboboxValue =
    propMappings.disabledMode === "state_binding" && selectedDisabledStore
      ? selectedDisabledStore.id
      : "__always__";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <SlidersHorizontal size={13} className="text-primary" />
          <span>Component Prop Mappings</span>
        </Label>
        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-cyan-600 dark:text-cyan-400 border-cyan-500/30">
          &lt;{selectedOption.label} /&gt; props
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-1.5">
        Configure component attributes and variable bindings for {selectedOption.label}.
      </p>

      {/* Input Component Props */}
      {currentComponent === "input" && (
        <div className="flex flex-col gap-3.5 p-3.5 rounded-xl bg-muted/20 border border-border/50">
          {/* Header pill / store indicator */}
          <div className="flex items-center justify-between pb-2 border-b border-border/40 text-[11px]">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Type size={13} className="text-primary" />
              <span>Input Field Configuration</span>
            </div>
            {effectiveStoreName ? (
              <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Bound to {effectiveStoreName.endsWith("Store") ? effectiveStoreName : `${effectiveStoreName}Store`}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 text-muted-foreground">
                Unbound Component
              </Badge>
            )}
          </div>

          {/* 1. Value Binding */}
          <StateStoreVariablePicker
            label="Value Binding"
            propName="value"
            valueBinding={propMappings.valueBinding ?? stateName}
            storeName={effectiveStoreName}
            storeId={effectiveStoreId}
            mode={propMappings.valueMode}
            stateStores={stateStores}
            expectedType={stateType === "number" ? "number" : stateType === "boolean" ? "boolean" : "any"}
            placeholder={stateName}
            onChange={(res) => {
              onUpdatePropMapping({
                valueBinding: res.valueBinding,
                valueStoreName: res.storeName,
                valueStoreId: res.storeId,
                valueMode: res.mode,
                targetSetterName: res.suggestedSetterName || propMappings.targetSetterName,
                ...(res.varType === "number" && !propMappings.inputType ? { inputType: "number" } : {}),
              });
            }}
          />

          {/* 2. Input Field Label (with Enable/Disable switch & StateStore mapping) */}
          {(() => {
            const isLabelEnabled = propMappings.hasLabel !== false;
            return (
              <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-background/80 border border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Tag size={12} className="text-primary" />
                    <Label htmlFor="input-label-toggle" className="text-[11px] font-semibold text-foreground cursor-pointer flex items-center gap-1">
                      <span>Input Field Label</span>
                      <code className="font-mono text-[10px] text-cyan-500 font-medium">label</code>
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {isLabelEnabled ? "Enabled" : "Hidden"}
                    </span>
                    <Switch
                      id="input-label-toggle"
                      checked={isLabelEnabled}
                      onCheckedChange={(checked) => {
                        onUpdatePropMapping({
                          hasLabel: checked,
                          ...(checked && !propMappings.labelBinding ? { labelBinding: displayLabel } : {}),
                        });
                      }}
                      className="scale-80 origin-right"
                    />
                  </div>
                </div>

                {isLabelEnabled && (
                  <StateStoreVariablePicker
                    label="Label Text / Mapping"
                    propName="label"
                    valueBinding={propMappings.labelBinding ?? displayLabel}
                    storeName={propMappings.labelStoreName}
                    storeId={propMappings.labelStoreId}
                    mode={propMappings.labelMode}
                    stateStores={stateStores}
                    placeholder={displayLabel || "Input Label"}
                    description="Text or dynamic StateStore variable displayed above the input field."
                    onChange={(res) => {
                      onUpdatePropMapping({
                        labelBinding: res.valueBinding,
                        labelStoreName: res.storeName,
                        labelStoreId: res.storeId,
                        labelMode: res.mode,
                        hasLabel: true,
                      });
                    }}
                  />
                )}
              </div>
            );
          })()}

          {/* 3. Input Type */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-medium text-foreground flex items-center gap-1">
              <span>Input Type</span>
              <code className="font-mono text-[10px] text-cyan-500">type</code>
            </Label>
            <Select
              value={propMappings.inputType || (stateType === "number" ? "number" : "text")}
              onValueChange={(val) => {
                if (isInputType(val)) {
                  onUpdatePropMapping({ inputType: val });
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">text (Standard text)</SelectItem>
                <SelectItem value="search">search (Search input)</SelectItem>
                <SelectItem value="number">number (Numeric counter)</SelectItem>
                <SelectItem value="password">password (Masked secret)</SelectItem>
                <SelectItem value="email">email (Email format)</SelectItem>
                <SelectItem value="tel">tel (Phone / mobile)</SelectItem>
                <SelectItem value="url">url (Web address URL)</SelectItem>
                <SelectItem value="date">date (Date picker)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 3. Placeholder Mapping */}
          <StateStoreVariablePicker
            label="Placeholder"
            propName="placeholder"
            valueBinding={propMappings.placeholder || ""}
            storeName={propMappings.placeholderStoreName}
            storeId={propMappings.placeholderStoreId}
            mode={propMappings.placeholderMode}
            stateStores={stateStores}
            placeholder={`Enter ${displayLabel}...`}
            description="Static text or dynamic variable token for input placeholder."
            onChange={(res) => {
              onUpdatePropMapping({
                placeholder: res.valueBinding,
                placeholderStoreName: res.storeName,
                placeholderStoreId: res.storeId,
                placeholderMode: res.mode,
              });
            }}
          />

          {/* 3. onChange Handling Mode */}
          <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                <MousePointerClick size={12} className="text-primary" />
                <span>Change Handler (<code className="font-mono text-[10px] text-cyan-500">onChange</code>)</span>
              </Label>
              <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 uppercase">
                {onChangeMode.replace("_", " ")}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <Button
                type="button"
                variant={onChangeMode === "two_way" ? "default" : "outline"}
                size="sm"
                onClick={() => onUpdatePropMapping({ onChangeMode: "two_way", readOnly: false })}
                className="h-7 text-[10px] px-1 font-medium cursor-pointer"
              >
                Two-Way Sync
              </Button>
              <Button
                type="button"
                variant={onChangeMode === "action" ? "default" : "outline"}
                size="sm"
                onClick={() => onUpdatePropMapping({ onChangeMode: "action", readOnly: false })}
                className="h-7 text-[10px] px-1 font-medium cursor-pointer"
              >
                Trigger Action
              </Button>
              <Button
                type="button"
                variant={onChangeMode === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => onUpdatePropMapping({ onChangeMode: "custom" })}
                className="h-7 text-[10px] px-1 font-medium cursor-pointer"
              >
                Custom Code
              </Button>
            </div>

            {/* Two-Way Mode Details */}
            {onChangeMode === "two_way" && (
              <div className="p-2 rounded-lg bg-background/80 border border-border/40 text-[11px] space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 size={12} />
                  <span>Direct State Mutation Wired</span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {effectiveStoreName
                    ? `Calls ${effectiveStoreName.endsWith("Store") ? effectiveStoreName : `${effectiveStoreName}Store`}.${propMappings.targetSetterName || defaultSetterName}(e.target.value)`
                    : `Calls ${propMappings.targetSetterName || defaultSetterName}(e.target.value)`}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                    Setter Name:
                  </span>
                  <LocalInput
                    value={propMappings.targetSetterName || defaultSetterName}
                    onChange={(e) => onUpdatePropMapping({ targetSetterName: e.target.value })}
                    placeholder={defaultSetterName}
                    className="h-6 text-[11px] font-mono bg-background"
                  />
                </div>
              </div>
            )}

            {/* Action Trigger Mode Details */}
            {onChangeMode === "action" && (
              <div className="p-2.5 rounded-lg bg-background/80 border border-border/40 text-[11px] space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground font-medium">Select Section Action to Dispatch</Label>
                  {onCreateAction && (
                    <button
                      type="button"
                      onClick={() => onCreateAction(`on${capitalizedState}Change`, "change")}
                      className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                    >
                      <Plus size={10} />
                      New Action
                    </button>
                  )}
                </div>
                {availableActions.length > 0 ? (
                  <div className="space-y-2">
                    <Select
                      value={propMappings.onChangeActionId || availableActions[0]?.id || ""}
                      onValueChange={(val) => onUpdatePropMapping({ onChangeActionId: val })}
                    >
                      <SelectTrigger className="h-7 text-xs bg-background font-mono">
                        <SelectValue placeholder="Select target action..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableActions.map((act) => (
                          <SelectItem key={act.id} value={act.id} className="text-xs font-mono">
                            {act.name} ({act.event || "action"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Button to navigate directly to Action Flow Editor */}
                    {onOpenEventConfig && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-[11px] flex items-center justify-between font-normal text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10 cursor-pointer"
                        onClick={() => {
                          const targetId = propMappings.onChangeActionId || availableActions[0]?.id;
                          if (targetId) onOpenEventConfig(targetId);
                        }}
                      >
                        <span className="flex items-center gap-1.5">
                          <Zap size={12} className="text-amber-500" />
                          Configure Action Flow & Mappings
                        </span>
                        <ArrowRight size={12} />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-amber-500 bg-amber-500/10 p-1.5 rounded">
                      No section actions configured yet. Add an action to this page section to dispatch events.
                    </div>
                    {onCreateAction && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-[11px] flex items-center justify-center gap-1.5 border-dashed border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 cursor-pointer"
                        onClick={() => onCreateAction(`on${capitalizedState}Change`, "change")}
                      >
                        <Zap size={12} className="text-amber-500" />
                        + Create & Configure Change Action
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Custom Code Mode Details */}
            {onChangeMode === "custom" && (
              <div className="p-2 rounded-lg bg-background/80 border border-border/40 text-[11px] space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Custom onChange Expression</Label>
                <LocalInput
                  value={propMappings.customOnChange || ""}
                  onChange={(e) => onUpdatePropMapping({ customOnChange: e.target.value })}
                  placeholder="(e) => handleCustom(e.target.value)"
                  className="h-7 text-[11px] font-mono bg-background"
                />
              </div>
            )}
          </div>

          {/* 4. Debounced Updates Section (Left to right 1-liner) */}
          <div className="flex items-center gap-3 px-2.5 py-1.5 rounded-lg bg-background/90 border border-indigo-500/20">
            {/* Left: Debounce toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="p-1 rounded-md bg-indigo-500/15 text-indigo-500 shrink-0">
                <Timer size={12} />
              </div>
              <Label
                htmlFor="debounce-enable-toggle"
                className="text-[11px] font-semibold text-foreground cursor-pointer whitespace-nowrap"
              >
                Debounce
              </Label>
              <Switch
                id="debounce-enable-toggle"
                checked={isDebounceEnabled}
                onCheckedChange={(checked) => onUpdatePropMapping({ debounceUpdate: checked })}
                className="scale-75 origin-left"
              />
            </div>

            {/* Inline options (Delay input, Enter, Blur in single line) */}
            {isDebounceEnabled && (
              <>
                <div className="h-4 w-px bg-border/60 shrink-0" />
                <div className="flex items-center gap-2.5 shrink-0">
                  {/* Delay number input with clean ms badge */}
                  <div className="flex items-center gap-1 bg-muted/40 px-2 py-0.5 rounded-md border border-border/40 shrink-0">
                    <LocalInput
                      type="number"
                      min={0}
                      step={50}
                      value={propMappings.debounceMs ?? 300}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        onUpdatePropMapping({
                          debounceMs: isNaN(val) ? 300 : Math.max(0, val),
                        });
                      }}
                      placeholder="300"
                      className="h-5 w-12 text-[10px] font-mono bg-transparent border-none p-0 text-right focus-visible:ring-0 shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[9px] font-mono text-muted-foreground select-none">
                      ms
                    </span>
                  </div>

                  {/* Commit on Enter */}
                  <div className="flex items-center gap-1 shrink-0" title="Commit on Enter">
                    <Label
                      htmlFor="commit-on-enter-toggle"
                      className="text-[9px] font-medium cursor-pointer text-muted-foreground flex items-center gap-0.5 select-none"
                    >
                      <CornerDownLeft size={9} />
                      <span>Enter</span>
                    </Label>
                    <Switch
                      id="commit-on-enter-toggle"
                      checked={propMappings.commitOnEnter !== false}
                      onCheckedChange={(checked) => onUpdatePropMapping({ commitOnEnter: checked })}
                      className="scale-70 origin-left"
                    />
                  </div>

                  {/* Commit on Blur */}
                  <div className="flex items-center gap-1 shrink-0" title="Commit on Blur">
                    <Label
                      htmlFor="commit-on-blur-toggle"
                      className="text-[9px] font-medium cursor-pointer text-muted-foreground select-none"
                    >
                      <span>Blur</span>
                    </Label>
                    <Switch
                      id="commit-on-blur-toggle"
                      checked={propMappings.commitOnBlur !== false}
                      onCheckedChange={(checked) => onUpdatePropMapping({ commitOnBlur: checked })}
                      className="scale-70 origin-left"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 5. Access & State Guards (Read-Only & Disabled) */}
          <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-background/90 border border-border/40">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                <Lock size={12} className="text-primary" />
                <span>State Guards & Access</span>
              </span>
              <div className="flex items-center gap-1">
                {isReadOnlyActive && (
                  <Badge variant="outline" className="text-[8px] font-mono px-1 py-0 text-cyan-400 border-cyan-500/30">
                    RO: {propMappings.readOnlyMode === "state_binding" ? (propMappings.readOnlyInverted ? `!${propMappings.readOnlyBinding}` : propMappings.readOnlyBinding) : "always"}
                  </Badge>
                )}
                {isDisabledActive && (
                  <Badge variant="outline" className="text-[8px] font-mono px-1 py-0 text-amber-400 border-amber-500/30">
                    DIS: {propMappings.disabledMode === "state_binding" ? (propMappings.disabledInverted ? `!${propMappings.disabledBinding}` : propMappings.disabledBinding) : "always"}
                  </Badge>
                )}
              </div>
            </div>

            {/* Read-Only Row */}
            <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-muted/20 border border-border/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Lock size={11} className="text-muted-foreground" />
                  <span className="text-[10px] font-medium text-foreground">Read-Only</span>
                  <span className="text-[9px] text-muted-foreground font-mono">(readOnly)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground font-mono">
                    {isReadOnlyActive
                      ? propMappings.readOnlyMode === "state_binding"
                        ? `${selectedReadOnlyStore?.name || "Store"}.${propMappings.readOnlyInverted ? "!" : ""}${propMappings.readOnlyBinding || "field"}`
                        : "Always"
                      : "Off"}
                  </span>
                  <Switch
                    checked={isReadOnlyActive}
                    onCheckedChange={(checked) => {
                      if (!checked) {
                        onUpdatePropMapping({
                          readOnly: false,
                          readOnlyMode: "static",
                          readOnlyBinding: undefined,
                          readOnlyStoreId: undefined,
                          readOnlyStoreName: undefined,
                          readOnlyInverted: false,
                        });
                      } else {
                        // Default it should be true!
                        onUpdatePropMapping({
                          readOnly: true,
                          readOnlyMode: "static",
                          readOnlyBinding: undefined,
                          readOnlyStoreId: undefined,
                          readOnlyStoreName: undefined,
                          readOnlyInverted: false,
                        });
                      }
                    }}
                    className="scale-75 origin-right"
                  />
                </div>
              </div>

              {/* Dynamic Combobox: Always + State Store Nodes List */}
              {isReadOnlyActive && (
                <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/30 flex-wrap">
                  <Select
                    value={readOnlyComboboxValue}
                    onValueChange={(val) => {
                      if (val === "__always__") {
                        onUpdatePropMapping({
                          readOnly: true,
                          readOnlyMode: "static",
                          readOnlyBinding: undefined,
                          readOnlyStoreId: undefined,
                          readOnlyStoreName: undefined,
                          readOnlyInverted: false,
                        });
                      } else {
                        const targetStore = stateStores.find((s) => s.id === val);
                        const firstField = targetStore?.fields?.[0]?.name;
                        onUpdatePropMapping({
                          readOnly: false,
                          readOnlyMode: "state_binding",
                          readOnlyStoreId: val,
                          readOnlyStoreName: targetStore?.name,
                          readOnlyBinding: firstField || "",
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="h-6 flex-1 min-w-[120px] text-[10px] bg-background">
                      <SelectValue placeholder="Always" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__always__" className="text-xs font-medium">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 size={11} className="text-primary" />
                          <span>Always (True)</span>
                        </span>
                      </SelectItem>
                      {stateStores.length > 0 && (
                        <div className="px-2 py-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider border-t border-border/30 mt-1 pt-1">
                          State Store Nodes
                        </div>
                      )}
                      {stateStores.map((st) => (
                        <SelectItem key={st.id} value={st.id} className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <Database size={11} className="text-sky-500 shrink-0" />
                            <span className="font-semibold text-foreground">{st.name}</span>
                            {st.scope && (
                              <span className="text-[8px] uppercase px-1 py-0.2 rounded bg-muted text-muted-foreground">
                                {st.scope}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                      {stateStores.length === 0 && (
                        <SelectItem value="__no_stores__" disabled className="text-xs text-muted-foreground italic">
                          (No State Stores on canvas)
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  {/* When state store node is selected: Show option to select the field! */}
                  {propMappings.readOnlyMode === "state_binding" && selectedReadOnlyStore && (
                    <>
                      <Select
                        value={propMappings.readOnlyBinding || ""}
                        onValueChange={(fieldName) => {
                          onUpdatePropMapping({
                            readOnlyBinding: fieldName,
                          });
                        }}
                      >
                        <SelectTrigger className="h-6 flex-1 min-w-[110px] text-[10px] bg-background font-mono truncate">
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedReadOnlyStore.fields.length > 0 ? (
                            selectedReadOnlyStore.fields.map((f) => (
                              <SelectItem key={f.id} value={f.name} className="text-xs font-mono">
                                ⚡ {f.name} <span className="text-[10px] text-muted-foreground font-sans">({f.type || "state"})</span>
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__no_fields__" disabled className="text-xs text-muted-foreground italic">
                              (No fields in store)
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>

                      <Button
                        type="button"
                        variant={propMappings.readOnlyInverted ? "default" : "outline"}
                        size="sm"
                        onClick={() => onUpdatePropMapping({ readOnlyInverted: !propMappings.readOnlyInverted })}
                        title="Invert condition (!NOT)"
                        className="h-6 px-1.5 font-mono text-[9px] cursor-pointer shrink-0"
                      >
                        ! NOT
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Disabled Row */}
            <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-muted/20 border border-border/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Ban size={11} className="text-muted-foreground" />
                  <span className="text-[10px] font-medium text-foreground">Disabled</span>
                  <span className="text-[9px] text-muted-foreground font-mono">(disabled)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground font-mono">
                    {isDisabledActive
                      ? propMappings.disabledMode === "state_binding"
                        ? `${selectedDisabledStore?.name || "Store"}.${propMappings.disabledInverted ? "!" : ""}${propMappings.disabledBinding || "field"}`
                        : "Always"
                      : "Off"}
                  </span>
                  <Switch
                    checked={isDisabledActive}
                    onCheckedChange={(checked) => {
                      if (!checked) {
                        onUpdatePropMapping({
                          disabled: false,
                          disabledMode: "static",
                          disabledBinding: undefined,
                          disabledStoreId: undefined,
                          disabledStoreName: undefined,
                          disabledInverted: false,
                        });
                      } else {
                        // Default it should be true!
                        onUpdatePropMapping({
                          disabled: true,
                          disabledMode: "static",
                          disabledBinding: undefined,
                          disabledStoreId: undefined,
                          disabledStoreName: undefined,
                          disabledInverted: false,
                        });
                      }
                    }}
                    className="scale-75 origin-right"
                  />
                </div>
              </div>

              {/* Dynamic Combobox: Always + State Store Nodes List */}
              {isDisabledActive && (
                <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/30 flex-wrap">
                  <Select
                    value={disabledComboboxValue}
                    onValueChange={(val) => {
                      if (val === "__always__") {
                        onUpdatePropMapping({
                          disabled: true,
                          disabledMode: "static",
                          disabledBinding: undefined,
                          disabledStoreId: undefined,
                          disabledStoreName: undefined,
                          disabledInverted: false,
                        });
                      } else {
                        const targetStore = stateStores.find((s) => s.id === val);
                        const firstField = targetStore?.fields?.[0]?.name;
                        onUpdatePropMapping({
                          disabled: false,
                          disabledMode: "state_binding",
                          disabledStoreId: val,
                          disabledStoreName: targetStore?.name,
                          disabledBinding: firstField || "",
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="h-6 flex-1 min-w-[120px] text-[10px] bg-background">
                      <SelectValue placeholder="Always" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__always__" className="text-xs font-medium">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 size={11} className="text-primary" />
                          <span>Always (True)</span>
                        </span>
                      </SelectItem>
                      {stateStores.length > 0 && (
                        <div className="px-2 py-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider border-t border-border/30 mt-1 pt-1">
                          State Store Nodes
                        </div>
                      )}
                      {stateStores.map((st) => (
                        <SelectItem key={st.id} value={st.id} className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <Database size={11} className="text-sky-500 shrink-0" />
                            <span className="font-semibold text-foreground">{st.name}</span>
                            {st.scope && (
                              <span className="text-[8px] uppercase px-1 py-0.2 rounded bg-muted text-muted-foreground">
                                {st.scope}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                      {stateStores.length === 0 && (
                        <SelectItem value="__no_stores__" disabled className="text-xs text-muted-foreground italic">
                          (No State Stores on canvas)
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  {/* When state store node is selected: Show option to select the field! */}
                  {propMappings.disabledMode === "state_binding" && selectedDisabledStore && (
                    <>
                      <Select
                        value={propMappings.disabledBinding || ""}
                        onValueChange={(fieldName) => {
                          onUpdatePropMapping({
                            disabledBinding: fieldName,
                          });
                        }}
                      >
                        <SelectTrigger className="h-6 flex-1 min-w-[110px] text-[10px] bg-background font-mono truncate">
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedDisabledStore.fields.length > 0 ? (
                            selectedDisabledStore.fields.map((f) => (
                              <SelectItem key={f.id} value={f.name} className="text-xs font-mono">
                                ⚡ {f.name} <span className="text-[10px] text-muted-foreground font-sans">({f.type || "state"})</span>
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__no_fields__" disabled className="text-xs text-muted-foreground italic">
                              (No fields in store)
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>

                      <Button
                        type="button"
                        variant={propMappings.disabledInverted ? "default" : "outline"}
                        size="sm"
                        onClick={() => onUpdatePropMapping({ disabledInverted: !propMappings.disabledInverted })}
                        title="Invert condition (!NOT)"
                        className="h-6 px-1.5 font-mono text-[9px] cursor-pointer shrink-0"
                      >
                        ! NOT
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 7. Allow Clear Input Reset Toggle */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-background/80 border border-border/40">
            <div className="flex flex-col">
              <Label className="text-[11px] font-medium cursor-pointer flex items-center gap-1">
                <XCircle size={10} className="text-muted-foreground" />
                <span>Allow Clear Input</span>
              </Label>
              <span className="text-[9px] text-muted-foreground">Shows quick reset (✕) icon inside text field when text is entered</span>
            </div>
            <Switch
              checked={Boolean(propMappings.clearable)}
              onCheckedChange={(checked) => onUpdatePropMapping({ clearable: checked })}
            />
          </div>
        </div>
      )}

      {/* Button Component Props */}
      {currentComponent === "button" && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-medium text-foreground">
                Button Size (<code className="font-mono text-[10px] text-cyan-500">size</code>)
              </Label>
              <Select
                value={propMappings.buttonSize || "sm"}
                onValueChange={(val) => {
                  if (isButtonSize(val)) {
                    onUpdatePropMapping({ buttonSize: val });
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Small (sm)</SelectItem>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="lg">Large (lg)</SelectItem>
                  <SelectItem value="icon">Icon only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-background/80 border border-border/40 mt-auto">
              <div className="flex flex-col">
                <Label className="text-[11px] font-medium cursor-pointer">
                  Disabled (<code className="font-mono text-[9px]">disabled</code>)
                </Label>
                <span className="text-[9px] text-muted-foreground">Prevent clicks</span>
              </div>
              <Switch
                checked={Boolean(propMappings.disabled)}
                onCheckedChange={(checked) => onUpdatePropMapping({ disabled: checked })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Card Component Props */}
      {currentComponent === "card" && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
          {/* Card Metric Stat Binding */}
          <StateStoreVariablePicker
            label="Card Metric Stat Value"
            propName="value"
            valueBinding={propMappings.cardValueBinding || propMappings.valueBinding || stateName}
            storeName={propMappings.cardValueStoreName || effectiveStoreName}
            storeId={propMappings.cardValueStoreId || effectiveStoreId}
            mode={propMappings.valueMode}
            stateStores={stateStores}
            placeholder={stateName}
            description="Main numerical or text metric displayed inside the card body."
            onChange={(res) => {
              onUpdatePropMapping({
                cardValueBinding: res.valueBinding,
                cardValueStoreName: res.storeName,
                cardValueStoreId: res.storeId,
                valueBinding: res.valueBinding,
                valueStoreName: res.storeName,
                valueStoreId: res.storeId,
                valueMode: res.mode,
              });
            }}
          />

          {/* Card Title */}
          <StateStoreVariablePicker
            label="Card Title"
            propName="title"
            valueBinding={propMappings.titleBinding || ""}
            storeName={propMappings.titleStoreName}
            storeId={propMappings.titleStoreId}
            mode={propMappings.titleMode}
            stateStores={stateStores}
            placeholder={displayLabel}
            description="Header title text displayed above the stat value."
            onChange={(res) => {
              onUpdatePropMapping({
                titleBinding: res.valueBinding,
                titleStoreName: res.storeName,
                titleStoreId: res.storeId,
                titleMode: res.mode,
              });
            }}
          />

          {/* Card Subtitle / Description */}
          <StateStoreVariablePicker
            label="Card Subtitle / Description"
            propName="description"
            valueBinding={propMappings.descriptionBinding || ""}
            storeName={propMappings.descriptionStoreName}
            storeId={propMappings.descriptionStoreId}
            mode={propMappings.descriptionMode}
            stateStores={stateStores}
            placeholder="e.g. Total count or last 30 days"
            description="Subtitle or supplementary description text in card."
            onChange={(res) => {
              onUpdatePropMapping({
                descriptionBinding: res.valueBinding,
                descriptionStoreName: res.storeName,
                descriptionStoreId: res.storeId,
                descriptionMode: res.mode,
              });
            }}
          />
        </div>
      )}

      {/* Progress Component Props */}
      {currentComponent === "progress" && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
          {/* Progress Value Binding */}
          <StateStoreVariablePicker
            label="Progress Value Binding"
            propName="value"
            valueBinding={propMappings.progressValueBinding || propMappings.valueBinding || stateName}
            storeName={propMappings.progressValueStoreName || effectiveStoreName}
            storeId={propMappings.progressValueStoreId || effectiveStoreId}
            mode={propMappings.valueMode}
            stateStores={stateStores}
            expectedType="number"
            placeholder={stateName}
            description="Numeric StateStore variable feeding the progress bar (0 - 100)."
            onChange={(res) => {
              onUpdatePropMapping({
                progressValueBinding: res.valueBinding,
                progressValueStoreName: res.storeName,
                progressValueStoreId: res.storeId,
                valueBinding: res.valueBinding,
                valueStoreName: res.storeName,
                valueStoreId: res.storeId,
                valueMode: res.mode,
              });
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-medium text-foreground">
                Max Value (<code className="font-mono text-[10px] text-cyan-500">max</code>)
              </Label>
              <LocalInput
                type="number"
                value={propMappings.max ?? 100}
                onChange={(e) => onUpdatePropMapping({ max: Number(e.target.value) || 100 })}
                placeholder="100"
                className="h-8 text-xs font-mono bg-background"
              />
              <span className="text-[10px] text-muted-foreground">Default scale 0 to 100</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-background/80 border border-border/40 mt-auto">
              <div className="flex flex-col">
                <Label className="text-[11px] font-medium cursor-pointer">
                  Show Percentage
                </Label>
                <span className="text-[9px] text-muted-foreground">Display % metric</span>
              </div>
              <Switch
                checked={propMappings.showPercent !== false}
                onCheckedChange={(checked) => onUpdatePropMapping({ showPercent: checked })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Alert Component Props */}
      {currentComponent === "alert" && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
          <StateStoreVariablePicker
            label="Alert Title"
            propName="title"
            valueBinding={propMappings.alertTitle || ""}
            storeName={propMappings.alertTitleStoreName}
            storeId={propMappings.alertTitleStoreId}
            mode={propMappings.alertTitleMode}
            stateStores={stateStores}
            placeholder="e.g. System Notice"
            description="Prominent headline rendered at top of alert banner."
            onChange={(res) => {
              onUpdatePropMapping({
                alertTitle: res.valueBinding,
                alertTitleStoreName: res.storeName,
                alertTitleStoreId: res.storeId,
                alertTitleMode: res.mode,
              });
            }}
          />
        </div>
      )}

      {/* Avatar Component Props */}
      {currentComponent === "avatar" && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
          <StateStoreVariablePicker
            label="Image URL"
            propName="src"
            valueBinding={propMappings.avatarSrc || ""}
            storeName={propMappings.avatarSrcStoreName}
            storeId={propMappings.avatarSrcStoreId}
            mode={propMappings.avatarSrcMode}
            stateStores={stateStores}
            placeholder="https://example.com/avatar.jpg"
            description="Direct image link or leave empty to use initials fallback."
            onChange={(res) => {
              onUpdatePropMapping({
                avatarSrc: res.valueBinding,
                avatarSrcStoreName: res.storeName,
                avatarSrcStoreId: res.storeId,
                avatarSrcMode: res.mode,
              });
            }}
          />

          <StateStoreVariablePicker
            label="Fallback Initials"
            propName="fallback"
            valueBinding={propMappings.avatarFallback || ""}
            storeName={propMappings.avatarFallbackStoreName}
            storeId={propMappings.avatarFallbackStoreId}
            mode={propMappings.avatarFallbackMode}
            stateStores={stateStores}
            placeholder={displayLabel.slice(0, 2).toUpperCase() || "AV"}
            description="Initials rendered when image is loading or fails."
            onChange={(res) => {
              onUpdatePropMapping({
                avatarFallback: res.valueBinding,
                avatarFallbackStoreName: res.storeName,
                avatarFallbackStoreId: res.storeId,
                avatarFallbackMode: res.mode,
              });
            }}
          />
        </div>
      )}

      {/* Skeleton Component Props */}
      {currentComponent === "skeleton" && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-medium text-foreground">
                Width (<code className="font-mono text-[10px] text-cyan-500">className</code>)
              </Label>
              <Select
                value={propMappings.skeletonWidth || "w-28"}
                onValueChange={(val) => onUpdatePropMapping({ skeletonWidth: val })}
              >
                <SelectTrigger className="h-8 text-xs bg-background font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="w-16">w-16 (4rem)</SelectItem>
                  <SelectItem value="w-24">w-24 (6rem)</SelectItem>
                  <SelectItem value="w-28">w-28 (7rem)</SelectItem>
                  <SelectItem value="w-36">w-36 (9rem)</SelectItem>
                  <SelectItem value="w-48">w-48 (12rem)</SelectItem>
                  <SelectItem value="w-full">w-full (100%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-medium text-foreground">
                Height (<code className="font-mono text-[10px] text-cyan-500">className</code>)
              </Label>
              <Select
                value={propMappings.skeletonHeight || "h-7"}
                onValueChange={(val) => onUpdatePropMapping({ skeletonHeight: val })}
              >
                <SelectTrigger className="h-8 text-xs bg-background font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="h-4">h-4 (1rem)</SelectItem>
                  <SelectItem value="h-6">h-6 (1.5rem)</SelectItem>
                  <SelectItem value="h-7">h-7 (1.75rem)</SelectItem>
                  <SelectItem value="h-8">h-8 (2rem)</SelectItem>
                  <SelectItem value="h-10">h-10 (2.5rem)</SelectItem>
                  <SelectItem value="h-12">h-12 (3rem)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Switch & Checkbox Props */}
      {(currentComponent === "switch" || currentComponent === "checkbox") && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
          {/* Header pill / store indicator */}
          <div className="flex items-center justify-between pb-2 border-b border-border/40 text-[11px]">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              {currentComponent === "switch" ? (
                <ToggleLeft size={13} className="text-primary" />
              ) : (
                <SquareCheck size={13} className="text-primary" />
              )}
              <span>{currentComponent === "switch" ? "Switch" : "Checkbox"} Configuration</span>
            </div>
            {effectiveStoreName ? (
              <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Bound to {effectiveStoreName.endsWith("Store") ? effectiveStoreName : `${effectiveStoreName}Store`}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 text-muted-foreground">
                Unbound Component
              </Badge>
            )}
          </div>

          {/* Checked State Binding */}
          <StateStoreVariablePicker
            label="Checked State Binding"
            propName="checked"
            valueBinding={propMappings.checkedBinding || propMappings.valueBinding || stateName}
            storeName={propMappings.checkedStoreName || effectiveStoreName}
            storeId={propMappings.checkedStoreId || effectiveStoreId}
            mode={propMappings.checkedMode}
            stateStores={stateStores}
            expectedType="boolean"
            placeholder={stateName}
            description="Boolean StateStore variable controlling the toggled on/off state."
            onChange={(res) => {
              onUpdatePropMapping({
                checkedBinding: res.valueBinding,
                checkedStoreName: res.storeName,
                checkedStoreId: res.storeId,
                checkedMode: res.mode,
                valueBinding: res.valueBinding,
                valueStoreName: res.storeName,
                valueStoreId: res.storeId,
                targetSetterName: res.suggestedSetterName || propMappings.targetSetterName,
              });
            }}
          />

          {/* Direct State Mutation Wiring preview */}
          <div className="p-2 rounded-lg bg-background/80 border border-border/40 text-[11px] space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 size={12} />
              <span>Toggle Mutation Wired</span>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              {effectiveStoreName
                ? `Calls ${effectiveStoreName.endsWith("Store") ? effectiveStoreName : `${effectiveStoreName}Store`}.${propMappings.targetSetterName || defaultSetterName}(checked)`
                : `Calls ${propMappings.targetSetterName || defaultSetterName}(checked)`}
            </div>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-background/80 border border-border/40">
            <div className="flex flex-col">
              <Label className="text-[11px] font-medium cursor-pointer">
                Disabled (<code className="font-mono text-[9px]">disabled</code>)
              </Label>
              <span className="text-[9px] text-muted-foreground">Prevent user interaction</span>
            </div>
            <Switch
              checked={Boolean(propMappings.disabled)}
              onCheckedChange={(checked) => onUpdatePropMapping({ disabled: checked })}
            />
          </div>
        </div>
      )}

      {/* Badge Component Props */}
      {currentComponent === "badge" && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50 text-xs">
          {/* State Variable Binding */}
          <StateStoreVariablePicker
            label="Badge State Value"
            propName="children"
            valueBinding={propMappings.valueBinding ?? stateName}
            storeName={effectiveStoreName}
            storeId={effectiveStoreId}
            mode={propMappings.valueMode}
            stateStores={stateStores}
            placeholder={stateName}
            description="StateStore variable displayed inside the badge pill."
            onChange={(res) => {
              onUpdatePropMapping({
                valueBinding: res.valueBinding,
                valueStoreName: res.storeName,
                valueStoreId: res.storeId,
                valueMode: res.mode,
              });
            }}
          />
          <span className="text-[10px] text-muted-foreground">
            Badge variant (default, secondary, outline, destructive) can be adjusted in the Formatting section below.
          </span>

        </div>
      )}

      {/* Code / Text Component Props */}
      {(currentComponent === "code" || currentComponent === "text") && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50 text-xs">
          <StateStoreVariablePicker
            label="Rendered State Value"
            propName="children"
            valueBinding={propMappings.valueBinding ?? stateName}
            storeName={effectiveStoreName}
            storeId={effectiveStoreId}
            mode={propMappings.valueMode}
            stateStores={stateStores}
            placeholder={stateName}
            description="StateStore variable whose value is rendered and syntax-formatted."
            onChange={(res) => {
              onUpdatePropMapping({
                valueBinding: res.valueBinding,
                valueStoreName: res.storeName,
                valueStoreId: res.storeId,
                valueMode: res.mode,
              });
            }}
          />
          <span className="text-[10px] text-muted-foreground">
            Renders raw or serialized state value with syntax formatting.
          </span>

        </div>
      )}

      {/* Sidebar Component Props */}
      {currentComponent === "sidebar" && (() => {
        const navMode = propMappings.sidebarNavMode || "dynamic";
        const staticItems = propMappings.sidebarStaticItems ?? [
          { id: "nav-1", name: "Dashboard", link: "/dashboard", icon: "LayoutDashboard" },
          { id: "nav-2", name: "Analytics", link: "/analytics", icon: "BarChart3" },
          { id: "nav-3", name: "Projects", link: "/projects", icon: "Folder" },
          { id: "nav-4", name: "Settings", link: "/settings", icon: "Settings" },
        ];

        const handleAddStaticItem = () => {
          const nextId = `nav-${Date.now()}`;
          const newItem = {
            id: nextId,
            name: `Page ${staticItems.length + 1}`,
            link: `/page-${staticItems.length + 1}`,
            icon: "Circle",
          };
          onUpdatePropMapping({
            sidebarStaticItems: [...staticItems, newItem],
          });
        };

        const handleUpdateStaticItem = (id: string, patch: Partial<typeof staticItems[0]>) => {
          const updated = staticItems.map((item) =>
            item.id === id ? { ...item, ...patch } : item
          );
          onUpdatePropMapping({ sidebarStaticItems: updated });
        };

        const handleDeleteStaticItem = (id: string) => {
          const updated = staticItems.filter((item) => item.id !== id);
          onUpdatePropMapping({ sidebarStaticItems: updated });
        };

        return (
          <div className="flex flex-col gap-3.5 p-3.5 rounded-xl bg-muted/20 border border-border/50 text-xs">
            {/* Header pill / store indicator */}
            <div className="flex items-center justify-between pb-2 border-b border-border/40 text-[11px]">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <PanelLeft size={13} className="text-primary" />
                <span>Sidebar Navigation Setup</span>
              </div>
              {navMode === "dynamic" && effectiveStoreName ? (
                <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Store: {effectiveStoreName.endsWith("Store") ? effectiveStoreName : `${effectiveStoreName}Store`}
                </Badge>
              ) : navMode === "dynamic" ? (
                <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 text-amber-500 border-amber-500/30">
                  Store Unbound
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 text-emerald-500 border-emerald-500/30">
                  Static Mode ({staticItems.length} links)
                </Badge>
              )}
            </div>

            {/* Sidebar Title / Header Brand */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-foreground flex items-center justify-between">
                <span>Sidebar Title / Header</span>
                <span className="text-[9px] text-muted-foreground font-mono">title</span>
              </Label>
              <LocalInput
                value={propMappings.sidebarTitle ?? "Dezign App"}
                onChange={(e) => onUpdatePropMapping({ sidebarTitle: e.target.value })}
                placeholder="Dezign App"
                className="h-8 text-xs bg-background"
              />
            </div>

            {/* Layout & Behavior Selectors (Side, Variant, Collapsible) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-medium text-foreground flex items-center gap-1.5">
                  <SlidersHorizontal size={11} className="text-primary" />
                  <span>Layout & Shadcn Variants</span>
                </Label>
                <code className="text-[9px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                  {`<Sidebar side="${propMappings.sidebarSide || "left"}" variant="${propMappings.sidebarVariant || "sidebar"}" collapsible="${propMappings.sidebarCollapsible || "offcanvas"}" />`}
                </code>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. Placement / Side */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground flex items-center justify-between">
                    <span>Position / Side</span>
                    <span className="font-mono text-[9px] text-cyan-500">side</span>
                  </Label>
                  <Select
                    value={propMappings.sidebarSide || "left"}
                    onValueChange={(val) => {
                      if (isSidebarSide(val)) {
                        onUpdatePropMapping({ sidebarSide: val });
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-[11px] bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left" className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <PanelLeft size={12} className="text-muted-foreground" />
                          <span>Left (Default)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="right" className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <PanelRight size={12} className="text-muted-foreground" />
                          <span>Right (Docked)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Visual Variant */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground flex items-center justify-between">
                    <span>Visual Variant</span>
                    <span className="font-mono text-[9px] text-cyan-500">variant</span>
                  </Label>
                  <Select
                    value={propMappings.sidebarVariant || "sidebar"}
                    onValueChange={(val) => {
                      if (isSidebarVariant(val)) {
                        onUpdatePropMapping({ sidebarVariant: val });
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-[11px] bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sidebar" className="text-xs">Standard (sidebar)</SelectItem>
                      <SelectItem value="floating" className="text-xs">Floating Card (floating)</SelectItem>
                      <SelectItem value="inset" className="text-xs">Inset Panel (inset)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Collapsible Mode */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground flex items-center justify-between">
                    <span>Collapsible Mode</span>
                    <span className="font-mono text-[9px] text-cyan-500">collapsible</span>
                  </Label>
                  <Select
                    value={propMappings.sidebarCollapsible || "offcanvas"}
                    onValueChange={(val) => {
                      if (isSidebarCollapsible(val)) {
                        onUpdatePropMapping({ sidebarCollapsible: val });
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-[11px] bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offcanvas" className="text-xs">Offcanvas (Drawer)</SelectItem>
                      <SelectItem value="icon" className="text-xs">Icon Rail (Rail)</SelectItem>
                      <SelectItem value="none" className="text-xs">None (Fixed)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Navigation Mode Switcher: Dynamic vs Static */}
            <div className="space-y-2 pt-1 border-t border-border/40">
              <Label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                <span>Navigation Items Source</span>
                <span className="text-[9px] text-muted-foreground font-mono">
                  {navMode === "dynamic" ? "Dynamic (Zustand Store)" : "Static (Inline List)"}
                </span>
              </Label>
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/40 border border-border/50 text-xs">
                <button
                  type="button"
                  onClick={() => onUpdatePropMapping({ sidebarNavMode: "dynamic" })}
                  className={`flex-1 py-1 px-2.5 rounded-md text-center text-xs font-medium transition-colors cursor-pointer ${
                    navMode === "dynamic"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ⚡ Dynamic (State Store)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdatePropMapping({ sidebarNavMode: "static" })}
                  className={`flex-1 py-1 px-2.5 rounded-md text-center text-xs font-medium transition-colors cursor-pointer ${
                    navMode === "static"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Static Navigation
                </button>
              </div>
            </div>

            {/* Dynamic Navigation Mode */}
            {navMode === "dynamic" && (
              <div className="flex flex-col gap-3 pt-1">
                {/* 1-Click State Store Shortcut Banner */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-sky-500/[0.08] border border-sky-500/25">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400 shrink-0">
                      <Zap size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">
                        ⚡ Quick-Create "navItems" Variable
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Auto-provisions NavItem[] typed schema with sample routes in your State Store & TypesNode
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onCreateNavStateVariable?.(effectiveStoreId)}
                    className="h-7 text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white cursor-pointer shrink-0 ml-2 shadow-xs"
                  >
                    <Zap size={11} className="mr-1" />
                    Create & Bind
                  </Button>
                </div>

                {/* State Store Variable Picker */}
                <StateStoreVariablePicker
                  label="Navigation Items State Variable"
                  propName="navItems"
                  valueBinding={propMappings.sidebarNavBinding || propMappings.valueBinding || "navItems"}
                  storeName={propMappings.sidebarNavStoreName || effectiveStoreName}
                  storeId={propMappings.sidebarNavStoreId || effectiveStoreId}
                  mode={propMappings.valueMode || "store_var"}
                  stateStores={stateStores}
                  expectedType="any"
                  placeholder="navItems"
                  description="StateStore variable containing navigation items (NavItem[])."
                  onChange={(res) => {
                    onUpdatePropMapping({
                      sidebarNavBinding: res.valueBinding,
                      sidebarNavStoreName: res.storeName,
                      sidebarNavStoreId: res.storeId,
                      valueBinding: res.valueBinding,
                      valueStoreName: res.storeName,
                      valueStoreId: res.storeId,
                      valueMode: res.mode,
                    });
                  }}
                />

                {/* Field contract hint */}
                <div className="p-2.5 rounded-lg bg-background/80 border border-border/40 text-[11px] space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Expected Item Fields
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground space-y-0.5">
                    <div>• <span className="text-foreground font-semibold">id</span>: string <span className="text-[9px] text-muted-foreground">(unique item key)</span></div>
                    <div>• <span className="text-foreground font-semibold">name</span>: string <span className="text-[9px] text-muted-foreground">(menu label)</span></div>
                    <div>• <span className="text-foreground font-semibold">link</span>: string <span className="text-[9px] text-muted-foreground">(route URL path)</span></div>
                    <div>• <span className="text-foreground font-semibold">icon</span>?: string <span className="text-[9px] text-muted-foreground">(Lucide icon name)</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* Static Navigation Mode */}
            {navMode === "static" && (
              <div className="flex flex-col gap-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-foreground">Navigation Items ({staticItems.length})</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddStaticItem}
                    className="h-6 text-[10px] gap-1 px-2 cursor-pointer"
                  >
                    <Plus size={10} />
                    <span>Add Item</span>
                  </Button>
                </div>

                <div className="space-y-2">
                  {staticItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-2.5 rounded-lg bg-background border border-border/50 flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">
                          #{idx + 1}
                        </span>
                        <LocalInput
                          value={item.name}
                          onChange={(e) => handleUpdateStaticItem(item.id, { name: e.target.value })}
                          placeholder="Label (e.g. Dashboard)"
                          className="h-7 text-xs flex-1 bg-muted/20"
                        />
                        <LocalInput
                          value={item.icon || ""}
                          onChange={(e) => handleUpdateStaticItem(item.id, { icon: e.target.value })}
                          placeholder="Icon (e.g. Folder)"
                          className="h-7 text-xs w-28 font-mono bg-muted/20"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStaticItem(item.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer shrink-0"
                          title="Delete item"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 pl-6">
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">url:</span>
                        <LocalInput
                          value={item.link}
                          onChange={(e) => handleUpdateStaticItem(item.id, { link: e.target.value })}
                          placeholder="/route (e.g. /dashboard)"
                          className="h-6 text-[11px] font-mono flex-1 bg-muted/20"
                        />
                      </div>
                    </div>
                  ))}

                  {staticItems.length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                      No navigation items. Click "+ Add Item" to define your menu.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
});
ComponentPropMappingsSection.displayName = "ComponentPropMappingsSection";

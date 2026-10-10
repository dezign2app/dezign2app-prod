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
import { ComponentOption, isInputType, isButtonSize, isOnChangeMode } from "./constants";

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
}

export const ComponentPropMappingsSection: React.FC<ComponentPropMappingsSectionProps> = ({
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
  const capitalizedState = stateName
    ? stateName.charAt(0).toUpperCase() + stateName.slice(1)
    : "State";
  const defaultSetterName = `set${capitalizedState}`;
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
      const fields = (n.data?.fields || []).map((f: any) => ({
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
            {storeName ? (
              <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Bound to {storeName}Store
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 text-muted-foreground">
                Local Section State
              </Badge>
            )}
          </div>

          {/* 1. Value Binding */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-foreground flex items-center gap-1">
                <span>Value Binding</span>
                <code className="font-mono text-[10px] text-cyan-500">value</code>
              </Label>
              <span className="text-[9px] text-muted-foreground font-mono">
                {propMappings.valueBinding || stateName}
              </span>
            </div>
            <LocalInput
              value={propMappings.valueBinding ?? stateName}
              onChange={(e) => onUpdatePropMapping({ valueBinding: e.target.value })}
              placeholder={stateName}
              className="h-8 text-xs font-mono bg-background"
            />
            <span className="text-[10px] text-muted-foreground">
              Controlled expression feeding into input <code className="font-mono text-[10px]">value</code>. Defaults to <code className="font-mono text-[10px]">{stateName}</code>.
            </span>
          </div>

          {/* 2. Input Type & Placeholder */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-medium text-foreground flex items-center gap-1">
                <span>Type</span>
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

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-medium text-foreground flex items-center gap-1">
                <span>Placeholder</span>
                <code className="font-mono text-[10px] text-cyan-500">placeholder</code>
              </Label>
              <LocalInput
                value={propMappings.placeholder || ""}
                onChange={(e) => onUpdatePropMapping({ placeholder: e.target.value })}
                placeholder={`Enter ${displayLabel}...`}
                className="h-8 text-xs bg-background"
              />
            </div>
          </div>

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
                  {storeName
                    ? `Calls ${storeName}Store.${propMappings.targetSetterName || defaultSetterName}(e.target.value)`
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
              <div className="p-2 rounded-lg bg-background/80 border border-border/40 text-[11px] space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Select Section Action to Dispatch</Label>
                {availableActions.length > 0 ? (
                  <Select
                    value={propMappings.onChangeActionId || availableActions[0]?.id || ""}
                    onValueChange={(val) => onUpdatePropMapping({ onChangeActionId: val })}
                  >
                    <SelectTrigger className="h-7 text-xs bg-background font-mono">
                      <SelectValue placeholder="Select target action..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableActions.map((act) => (
                        <SelectItem key={act.id} value={act.id} className="text-xs">
                          {act.name} ({act.event || "action"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-[10px] text-amber-500 bg-amber-500/10 p-1.5 rounded">
                    No section actions configured yet. Add an action to this page section to dispatch events.
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
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-medium text-foreground">
              Card Title (<code className="font-mono text-[10px] text-cyan-500">title</code>)
            </Label>
            <LocalInput
              value={propMappings.titleBinding || ""}
              onChange={(e) => onUpdatePropMapping({ titleBinding: e.target.value })}
              placeholder={displayLabel}
              className="h-8 text-xs bg-background"
            />
            <span className="text-[10px] text-muted-foreground">
              Header title text displayed above the stat value.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-medium text-foreground">
              Card Subtitle / Description (<code className="font-mono text-[10px] text-cyan-500">description</code>)
            </Label>
            <LocalInput
              value={propMappings.descriptionBinding || ""}
              onChange={(e) => onUpdatePropMapping({ descriptionBinding: e.target.value })}
              placeholder="e.g. Total count or last 30 days"
              className="h-8 text-xs bg-background"
            />
          </div>
        </div>
      )}

      {/* Progress Component Props */}
      {currentComponent === "progress" && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
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
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-medium text-foreground">
              Alert Title (<code className="font-mono text-[10px] text-cyan-500">title</code>)
            </Label>
            <LocalInput
              value={propMappings.alertTitle || ""}
              onChange={(e) => onUpdatePropMapping({ alertTitle: e.target.value })}
              placeholder="e.g. System Notice"
              className="h-8 text-xs bg-background"
            />
            <span className="text-[10px] text-muted-foreground">
              Prominent bold headline rendered at the top of the alert banner.
            </span>
          </div>
        </div>
      )}

      {/* Avatar Component Props */}
      {currentComponent === "avatar" && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-medium text-foreground">
              Image URL (<code className="font-mono text-[10px] text-cyan-500">src</code>)
            </Label>
            <LocalInput
              value={propMappings.avatarSrc || ""}
              onChange={(e) => onUpdatePropMapping({ avatarSrc: e.target.value })}
              placeholder="https://example.com/avatar.jpg"
              className="h-8 text-xs font-mono bg-background"
            />
            <span className="text-[10px] text-muted-foreground">
              Direct image link or leave empty to use initials fallback.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-medium text-foreground">
              Fallback Initials (<code className="font-mono text-[10px] text-cyan-500">fallback</code>)
            </Label>
            <LocalInput
              value={propMappings.avatarFallback || ""}
              onChange={(e) => onUpdatePropMapping({ avatarFallback: e.target.value })}
              placeholder={displayLabel.slice(0, 2).toUpperCase() || "AV"}
              maxLength={4}
              className="h-8 text-xs font-mono bg-background"
            />
          </div>
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
        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-muted/20 border border-border/50 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>State value bound to:</span>
            <Badge variant="outline" className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400 border-cyan-500/30">
              {stateName}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Badge variant (default, secondary, outline, destructive) can be adjusted in the Formatting section below.
          </span>
        </div>
      )}

      {/* Code / Text Component Props */}
      {(currentComponent === "code" || currentComponent === "text") && (
        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-muted/20 border border-border/50 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Value rendered from:</span>
            <Badge variant="outline" className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400 border-cyan-500/30">
              {stateName}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Renders raw or serialized state value with syntax formatting.
          </span>
        </div>
      )}
    </div>
  );
};

"use client";

import React, { useMemo, useState, useRef } from "react";
import {
  Database,
  Zap,
  Code2,
  Type as TypeIcon,
  Sparkles,
  Braces,
} from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@workspace/ui/components/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { LocalInput } from "../../backend-nodes/graph-nodes/shared";
import { toPascalCase } from "@/lib/utils";
import { cn } from "@workspace/ui/lib/utils";

export interface StateStoreVariablePickerProps {
  label?: string;
  propName?: string; // e.g. "value", "placeholder", "title", "description"
  description?: string;

  // Current values
  valueBinding?: string;
  storeName?: string;
  storeId?: string;
  mode?: "store_var" | "inline" | "expression";

  // State Store nodes
  stateStores: Array<{
    id: string;
    name: string;
    scope?: string;
    fields: Array<{ id: string; name: string; type?: string }>;
  }>;
  expectedType?: "string" | "number" | "boolean" | "any";
  placeholder?: string;

  // Callback
  onChange: (result: {
    valueBinding: string;
    storeName?: string;
    storeId?: string;
    mode: "store_var" | "inline" | "expression";
    varType?: string;
    suggestedSetterName?: string;
  }) => void;

  className?: string;
}

export const StateStoreVariablePicker: React.FC<StateStoreVariablePickerProps> = ({
  label,
  propName,
  description,
  valueBinding = "",
  storeName,
  storeId,
  mode: propMode,
  stateStores = [],
  expectedType = "any",
  placeholder,
  onChange,
  className,
}) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Match active store
  const selectedStore = useMemo(() => {
    if (storeId) {
      const match = stateStores.find((s) => s.id === storeId);
      if (match) return match;
    }
    if (storeName) {
      const match = stateStores.find((s) => s.name === storeName);
      if (match) return match;
    }
    if (valueBinding) {
      const match = stateStores.find((s) => s.fields.some((f) => f.name === valueBinding));
      if (match) return match;
    }
    return stateStores[0];
  }, [stateStores, storeId, storeName, valueBinding]);

  // Determine current source ID (matches PipelineStepEditor style)
  const currentSourceId = useMemo(() => {
    if (propMode === "inline") return "inline";
    if (propMode === "expression") return "expression";
    if (propMode === "store_var") {
      return selectedStore ? `store:${selectedStore.id}` : "inline";
    }
    if (storeId) return `store:${storeId}`;
    if (storeName && selectedStore) return `store:${selectedStore.id}`;
    if (valueBinding && /\${|\+|-|\*|\/|\?|:/.test(valueBinding)) {
      return valueBinding.includes("${") ? "inline" : "expression";
    }
    if (selectedStore && valueBinding && selectedStore.fields.some((f) => f.name === valueBinding)) {
      return `store:${selectedStore.id}`;
    }
    return "inline";
  }, [propMode, storeId, storeName, selectedStore, valueBinding]);

  // Available variables for the currently active store
  const availableFields = useMemo(() => {
    return selectedStore?.fields || [];
  }, [selectedStore]);

  // Selected variable type
  const currentVarType = useMemo(() => {
    const found = availableFields.find((f) => f.name === valueBinding);
    return found?.type;
  }, [availableFields, valueBinding]);

  // Collect all insertable variable tokens across all State Stores
  const allInsertableTokens = useMemo(() => {
    const list: Array<{ label: string; token: string; storeName: string; type?: string }> = [];
    const hasMultipleStores = stateStores.length > 1;

    for (const store of stateStores) {
      for (const field of store.fields || []) {
        const token = hasMultipleStores ? `\${${store.name}.${field.name}}` : `\${${field.name}}`;
        list.push({
          label: field.name,
          token,
          storeName: store.name,
          type: field.type,
        });
      }
    }
    return list;
  }, [stateStores]);

  // Handle source switch (Inline | Store | Expression)
  const handleSourceSelect = (selectedId: string) => {
    if (selectedId === "inline") {
      onChange({
        valueBinding: valueBinding || "",
        storeName: undefined,
        storeId: undefined,
        mode: "inline",
        varType: "string",
        suggestedSetterName: undefined,
      });
    } else if (selectedId === "expression") {
      onChange({
        valueBinding: valueBinding || "",
        storeName: undefined,
        storeId: undefined,
        mode: "expression",
        varType: "expression",
        suggestedSetterName: undefined,
      });
    } else if (selectedId.startsWith("store:")) {
      const targetStoreId = selectedId.replace("store:", "");
      const targetStore = stateStores.find((s) => s.id === targetStoreId);
      const firstField = targetStore?.fields[0]?.name || "";
      const fieldObj = targetStore?.fields.find((f) => f.name === firstField);
      const suggestedSetter = firstField ? `set${toPascalCase(firstField)}` : undefined;

      onChange({
        valueBinding: firstField,
        storeName: targetStore?.name,
        storeId: targetStore?.id,
        mode: "store_var",
        varType: fieldObj?.type,
        suggestedSetterName: suggestedSetter,
      });
    }
  };

  // Handle variable change inside a selected Store
  const handleVariableChange = (fieldName: string) => {
    const fieldObj = availableFields.find((f) => f.name === fieldName);
    const suggestedSetter = fieldName ? `set${toPascalCase(fieldName)}` : undefined;

    onChange({
      valueBinding: fieldName,
      storeName: selectedStore?.name,
      storeId: selectedStore?.id,
      mode: "store_var",
      varType: fieldObj?.type,
      suggestedSetterName: suggestedSetter,
    });
  };

  // Handle inline typing
  const handleInlineChange = (inlineVal: string) => {
    onChange({
      valueBinding: inlineVal,
      storeName: undefined,
      storeId: undefined,
      mode: "inline",
      varType: "string",
      suggestedSetterName: undefined,
    });
  };

  // Handle expression typing
  const handleExpressionChange = (expr: string) => {
    onChange({
      valueBinding: expr,
      storeName: undefined,
      storeId: undefined,
      mode: "expression",
      varType: "expression",
      suggestedSetterName: undefined,
    });
  };

  // Insert token at cursor position (same as PipelineStepEditor)
  const handleInsertToken = (token: string) => {
    const currentVal = valueBinding || "";
    const target = inputRef.current;

    if (target && typeof target.selectionStart === "number" && typeof target.selectionEnd === "number") {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newVal = currentVal.substring(0, start) + token + currentVal.substring(end);
      handleInlineChange(newVal);

      setTimeout(() => {
        target.focus();
        const cursor = start + token.length;
        target.setSelectionRange(cursor, cursor);
      }, 0);
    } else {
      const newVal = currentVal ? `${currentVal} ${token}` : token;
      handleInlineChange(newVal);
    }
    setPopoverOpen(false);
  };

  const isStoreMode = currentSourceId.startsWith("store:");
  const isInlineMode = currentSourceId === "inline";
  const isExpressionMode = currentSourceId === "expression";

  return (
    <div className={cn("flex flex-col gap-1.5 w-full min-w-0", className)}>
      {/* Label & Prop name header */}
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-medium text-foreground flex items-center gap-1">
            <span>{label}</span>
            {propName && (
              <code className="font-mono text-[10px] text-cyan-500 font-medium">
                {propName}
              </code>
            )}
          </Label>
          {isStoreMode && currentVarType && (
            <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 text-muted-foreground/80">
              {currentVarType}
            </Badge>
          )}
        </div>
      )}

      {/* Editor Row: Source Select + Target Field/Input + Map Button */}
      <div className="flex gap-1.5 items-center w-full">
        {/* Source Selector (PipelineStepEditor style) */}
        <Select
          value={currentSourceId}
          onValueChange={handleSourceSelect}
        >
          <SelectTrigger className="h-8 w-[125px] sm:w-[140px] text-xs bg-background/80 border-border/60 shrink-0 font-medium">
            <SelectValue placeholder="Source..." />
          </SelectTrigger>
          <SelectContent className="z-[110]">
            <SelectGroup>
              <SelectLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Static & Templates
              </SelectLabel>
              <SelectItem value="inline" className="text-xs">
                <div className="flex items-center gap-1.5">
                  <TypeIcon size={12} className="text-primary" />
                  <span>Inline Text</span>
                </div>
              </SelectItem>
            </SelectGroup>

            {stateStores.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                  State Stores
                </SelectLabel>
                {stateStores.map((st) => (
                  <SelectItem key={st.id} value={`store:${st.id}`} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <Database size={12} className="text-sky-500" />
                      <span className="font-medium text-foreground">{st.name}</span>
                      {st.scope && (
                        <span className="text-[8px] uppercase px-1 py-0.2 rounded bg-muted text-muted-foreground">
                          {st.scope}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            <SelectGroup>
              <SelectLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Advanced
              </SelectLabel>
              <SelectItem value="expression" className="text-xs">
                <div className="flex items-center gap-1.5">
                  <Code2 size={12} className="text-purple-500" />
                  <span>Expression</span>
                </div>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Right side editor: Variable Select for Stores, or Input with Map ${} popover for Inline/Expression */}
        {isStoreMode ? (
          <div className="flex-1 min-w-0">
            <Select
              value={valueBinding || ""}
              onValueChange={handleVariableChange}
            >
              <SelectTrigger className="h-8 text-xs bg-background font-mono w-full">
                <SelectValue placeholder="Select variable..." />
              </SelectTrigger>
              <SelectContent className="z-[110]">
                {availableFields.length > 0 ? (
                  availableFields.map((f) => (
                    <SelectItem key={f.id} value={f.name} className="text-xs font-mono">
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <Zap size={11} className="text-amber-500" />
                          {f.name}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-sans px-1 py-0.2 bg-muted rounded">
                          {f.type || "state"}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__no_fields__" disabled className="text-xs text-muted-foreground italic">
                    (No variables in store)
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="relative flex-1 min-w-0 flex items-center">
            <LocalInput
              ref={inputRef}
              value={valueBinding || ""}
              onChange={(e) => {
                if (isExpressionMode) {
                  handleExpressionChange(e.target.value);
                } else {
                  handleInlineChange(e.target.value);
                }
              }}
              placeholder={placeholder || (isExpressionMode ? "e.g. count > 0 ? 'Active' : 'Empty'" : "Static text or ${store.var}...")}
              className={cn(
                "h-8 text-xs font-mono bg-background border-border/60 w-full pr-16",
                isExpressionMode && "text-purple-400 font-semibold",
              )}
            />

            {/* Map ${} Popover Trigger */}
            <div className="absolute right-1 flex items-center gap-1">
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="h-6 px-1.5 text-[10px] font-mono flex items-center gap-1 rounded border border-border/50 bg-background/90 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
                    title="Insert dynamic variable token ${...}"
                  >
                    <Braces size={11} className="text-primary" />
                    <span>Map</span>
                    <span className="text-[9px] text-muted-foreground font-mono">{`\${}`}</span>
                  </button>
                </PopoverTrigger>

                <PopoverContent
                  align="end"
                  side="bottom"
                  sideOffset={4}
                  className="p-1.5 w-72 max-h-64 overflow-y-auto z-[120] bg-popover border border-border rounded-lg shadow-xl"
                >
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 mb-1 flex items-center gap-1">
                    <Sparkles size={11} className="text-primary" />
                    <span>Insert Variable Token</span>
                  </div>

                  {allInsertableTokens.length === 0 ? (
                    <div className="p-2.5 text-center text-[10px] text-muted-foreground italic">
                      No State Store variables available. Add a State Store node to the canvas.
                    </div>
                  ) : (
                    allInsertableTokens.map((item, idx) => (
                      <button
                        key={`${item.token}-${idx}`}
                        type="button"
                        className="w-full text-left px-2 py-1.5 text-xs font-mono rounded hover:bg-accent text-foreground flex items-center justify-between transition-colors group cursor-pointer"
                        onClick={() => handleInsertToken(item.token)}
                      >
                        <div className="flex flex-col min-w-0 pr-1">
                          <span className="truncate text-[11px] font-semibold text-foreground group-hover:text-primary">
                            + Insert {item.token}
                          </span>
                          <span className="text-[9px] text-muted-foreground truncate">
                            {item.storeName}
                          </span>
                        </div>
                        {item.type && (
                          <span className="text-[9px] text-muted-foreground/60 px-1 py-0.2 rounded bg-muted/40 font-sans shrink-0">
                            {item.type}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </div>

      {/* Description / Helper text */}
      {description && (
        <span className="text-[10px] text-muted-foreground">
          {description}
        </span>
      )}
    </div>
  );
};

"use client";

import React, { useMemo } from "react";
import { MousePointerClick, Copy, Zap, ExternalLink, ArrowRight, Plus, Database } from "lucide-react";
import {
  BackendNode,
  StateRenderConfig,
  UIEventItem,
} from "@/types/canvas";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { LocalInput } from "../../backend-nodes/graph-nodes/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { isClickAction } from "./constants";

export interface ClickInteractivitySectionProps {
  currentClickAction: NonNullable<StateRenderConfig["clickAction"]>;
  copyToastMessage?: string;
  copySourceMode?: "store_var" | "static" | "current";
  copyStaticValue?: string;
  copyStoreId?: string;
  copyStoreName?: string;
  copyStoreVar?: string;
  targetActionId?: string;
  targetRoute?: string;
  targetStoreId?: string;
  targetStoreActionId?: string;
  targetStoreActionName?: string;
  stateName: string;
  availableActions: UIEventItem[];
  availablePages?: BackendNode[];
  stateStoreNodes?: BackendNode[];
  boundStoreId?: string;
  sectionName?: string;
  onUpdateRenderConfig: (changes: Partial<StateRenderConfig>) => void;
  onOpenEventConfig?: (actionId: string) => void;
  onCreateAction?: (name?: string, eventType?: string) => void;
}

export const ClickInteractivitySection: React.FC<ClickInteractivitySectionProps> = ({
  currentClickAction,
  copyToastMessage,
  copySourceMode = "store_var",
  copyStaticValue,
  copyStoreId,
  copyStoreName,
  copyStoreVar,
  targetActionId,
  stateName,
  availableActions,
  stateStoreNodes = [],
  boundStoreId,
  sectionName,
  onUpdateRenderConfig,
  onOpenEventConfig,
  onCreateAction,
}) => {
  // Normalize click action into 3 primary modes: none | trigger_event | copy_to_clipboard
  const normalizedAction =
    currentClickAction === "copy_to_clipboard"
      ? "copy_to_clipboard"
      : currentClickAction === "none"
      ? "none"
      : "trigger_event";

  // Parse available stores and their variables for clipboard mapping
  const stateStores = useMemo(() => {
    return (stateStoreNodes || []).map((n) => ({
      id: n.id,
      name: n.data?.storeName || n.data?.label || "Store",
      scope: n.data?.scope,
      fields: (n.data?.fields || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        type: f.type,
      })),
    }));
  }, [stateStoreNodes]);

  const selectedStore = useMemo(() => {
    if (copyStoreId) return stateStores.find((s) => s.id === copyStoreId);
    if (copyStoreName) return stateStores.find((s) => s.name === copyStoreName);
    if (boundStoreId) return stateStores.find((s) => s.id === boundStoreId);
    return stateStores[0];
  }, [stateStores, copyStoreId, copyStoreName, boundStoreId]);

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <MousePointerClick size={13} className="text-primary" />
        <span>Click Interactivity &amp; Events</span>
      </Label>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] text-muted-foreground">On-Click Action</Label>
          <Select
            value={normalizedAction}
            onValueChange={(val) => {
              if (isClickAction(val)) {
                onUpdateRenderConfig({ clickAction: val });
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Action</SelectItem>
              <SelectItem value="trigger_event">Action</SelectItem>
              <SelectItem value="copy_to_clipboard">Copy to Clipboard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Flow Trigger */}
        {normalizedAction === "trigger_event" && (
          <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-muted/20 border border-border/50">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                <Zap size={11} className="text-primary" />
                <span>Attach Action</span>
              </Label>
              {onCreateAction && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] gap-1 text-primary hover:text-primary hover:bg-primary/10 cursor-pointer"
                  onClick={() => onCreateAction(`${stateName}_click`, "click")}
                >
                  <Plus size={10} />
                  <span>New Action</span>
                </Button>
              )}
            </div>

            {availableActions.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Select
                  value={targetActionId || availableActions[0]?.id || ""}
                  onValueChange={(val) => onUpdateRenderConfig({ targetActionId: val })}
                >
                  <SelectTrigger className="h-8 text-xs font-mono">
                    <SelectValue placeholder="Select an action to attach" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableActions.map((act) => (
                      <SelectItem key={act.id} value={act.id}>
                        {act.name || act.event} ({act.event || "action"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {onOpenEventConfig && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10 cursor-pointer w-full mt-0.5"
                    onClick={() => {
                      const effectiveId = targetActionId || availableActions[0]?.id;
                      if (effectiveId) onOpenEventConfig(effectiveId);
                    }}
                  >
                    <ExternalLink size={12} />
                    <span>Configure Action Flow &amp; Mappings</span>
                    <ArrowRight size={11} className="ml-auto" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2 text-[11px] text-amber-500 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                <span>No interactive actions in section &quot;{sectionName || "Main"}&quot;.</span>
                {onCreateAction && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer w-full"
                    onClick={() => onCreateAction(`${stateName}_click`, "click")}
                  >
                    <Plus size={12} />
                    <span>Create Action Flow for this Component</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Copy to Clipboard: Exactly 2 options */}
        {normalizedAction === "copy_to_clipboard" && (
          <div className="flex flex-col gap-3 p-3 rounded-lg bg-muted/20 border border-border/50 text-[11px]">
            {/* Copy Source: State Store Mapping vs Static Value */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] text-muted-foreground font-medium">Copy Source</Label>
              <Select
                value={copySourceMode === "static" ? "static" : "store_var"}
                onValueChange={(val: "store_var" | "static") => {
                  if (val === "store_var") {
                    const firstStore = selectedStore || stateStores[0];
                    const defaultVar = copyStoreVar || stateName || firstStore?.fields[0]?.name || "";
                    onUpdateRenderConfig({
                      copySourceMode: "store_var",
                      copyStoreId: firstStore?.id,
                      copyStoreName: firstStore?.name,
                      copyStoreVar: defaultVar,
                    });
                  } else {
                    onUpdateRenderConfig({ copySourceMode: "static" });
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store_var">State Store Mapping</SelectItem>
                  <SelectItem value="static">Static Value</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 1. State Store Mapping */}
            {copySourceMode !== "static" && (
              <div className="flex flex-col gap-2 p-2.5 rounded-md bg-background/80 border border-border/40">
                {stateStores.length > 0 ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                        <Database size={10} className="text-primary" />
                        <span>State Store</span>
                      </Label>
                      <Select
                        value={copyStoreId || selectedStore?.id || ""}
                        onValueChange={(val) => {
                          const st = stateStores.find((s) => s.id === val);
                          const firstField = st?.fields[0]?.name || "";
                          onUpdateRenderConfig({
                            copyStoreId: val,
                            copyStoreName: st?.name || "Store",
                            copyStoreVar: firstField,
                          });
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs bg-background">
                          <SelectValue placeholder="Choose store..." />
                        </SelectTrigger>
                        <SelectContent>
                          {stateStores.map((st) => (
                            <SelectItem key={st.id} value={st.id} className="text-xs">
                              {st.name} {st.scope ? `(${st.scope})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedStore && (
                      <div className="flex flex-col gap-1 pt-1">
                        <Label className="text-[10px] text-muted-foreground font-medium">Store Variable</Label>
                        {selectedStore.fields.length > 0 ? (
                          <Select
                            value={copyStoreVar || stateName || selectedStore.fields[0]?.name || ""}
                            onValueChange={(val) => onUpdateRenderConfig({ copyStoreVar: val })}
                          >
                            <SelectTrigger className="h-7 text-xs font-mono bg-background">
                              <SelectValue placeholder="Select variable..." />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedStore.fields.map((f) => (
                                <SelectItem key={f.id || f.name} value={f.name} className="text-xs font-mono">
                                  {f.name} {f.type ? `(${f.type})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-[10px] text-amber-500 bg-amber-500/10 p-1.5 rounded">
                            No state fields found in {selectedStore.name}.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-[10px] text-muted-foreground">
                    Copies reactive variable <code className="text-foreground font-mono font-medium">{stateName}</code>.
                  </div>
                )}
              </div>
            )}

            {/* 2. Static Value */}
            {copySourceMode === "static" && (
              <div className="flex flex-col gap-1 p-2.5 rounded-md bg-background/80 border border-border/40">
                <Label className="text-[10px] text-muted-foreground font-medium">Static Value</Label>
                <LocalInput
                  value={copyStaticValue || ""}
                  onChange={(e) => onUpdateRenderConfig({ copyStaticValue: e.target.value })}
                  placeholder="e.g. https://example.com or PROMO2024"
                  className="h-7 text-xs font-mono"
                />
              </div>
            )}

            {/* Toast Feedback Message */}
            <div className="flex flex-col gap-1 pt-1 border-t border-border/30">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                <Copy size={10} />
                <span>Toast Feedback Message</span>
              </Label>
              <LocalInput
                value={copyToastMessage || ""}
                onChange={(e) => onUpdateRenderConfig({ copyToastMessage: e.target.value })}
                placeholder={`Copied to clipboard!`}
                className="h-7 text-xs"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

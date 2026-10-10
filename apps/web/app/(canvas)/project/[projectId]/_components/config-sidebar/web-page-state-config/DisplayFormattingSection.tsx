"use client";

import React, { useMemo } from "react";
import { Type } from "lucide-react";
import { BackendNode, StateRenderComponent, StateRenderConfig } from "@/types/canvas";
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
import { isVariant, isFormatter } from "./constants";

export interface DisplayFormattingSectionProps {
  label: string;
  labelMode?: "static" | "store_var";
  labelStoreId?: string;
  labelStoreName?: string;
  labelStoreVar?: string;
  stateName: string;
  currentComponent: StateRenderComponent;
  currentVariant: NonNullable<StateRenderConfig["variant"]>;
  formatter: NonNullable<StateRenderConfig["formatter"]>;
  fallbackText: string;
  prefix?: string;
  suffix?: string;
  stateStoreNodes?: BackendNode[];
  boundStoreId?: string;
  onUpdateRenderConfig: (changes: Partial<StateRenderConfig>) => void;
}

export const DisplayFormattingSection: React.FC<DisplayFormattingSectionProps> = ({
  label,
  labelMode = "static",
  labelStoreId,
  labelStoreName,
  labelStoreVar,
  stateName,
  currentComponent,
  currentVariant,
  formatter,
  fallbackText,
  stateStoreNodes = [],
  boundStoreId,
  onUpdateRenderConfig,
}) => {
  // Parse available stores and their variables for label mapping
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
    if (labelStoreId) return stateStores.find((s) => s.id === labelStoreId);
    if (labelStoreName) return stateStores.find((s) => s.name === labelStoreName);
    if (boundStoreId) return stateStores.find((s) => s.id === boundStoreId);
    return stateStores[0];
  }, [stateStores, labelStoreId, labelStoreName, boundStoreId]);

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Type size={13} className="text-primary" />
        <span>Label &amp; Display Formatting</span>
      </Label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Display Label / Title: Mapped to Static or Store Var */}
        <div className="flex flex-col gap-2 sm:col-span-2 p-2.5 rounded-lg bg-muted/20 border border-border/50">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-medium text-foreground">Display Label / Title</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={labelMode === "store_var" ? "outline" : "default"}
                size="sm"
                className="h-6 text-[10px] px-2 font-medium cursor-pointer"
                onClick={() => onUpdateRenderConfig({ labelMode: "static" })}
              >
                Static
              </Button>
              <Button
                type="button"
                variant={labelMode === "store_var" ? "default" : "outline"}
                size="sm"
                className="h-6 text-[10px] px-2 font-medium cursor-pointer"
                onClick={() => {
                  const firstStore = selectedStore || stateStores[0];
                  const firstVar = labelStoreVar || firstStore?.fields[0]?.name || "";
                  onUpdateRenderConfig({
                    labelMode: "store_var",
                    labelStoreId: firstStore?.id,
                    labelStoreName: firstStore?.name,
                    labelStoreVar: firstVar,
                  });
                }}
              >
                Store Var
              </Button>
            </div>
          </div>

          {labelMode !== "store_var" ? (
            <LocalInput
              value={label}
              onChange={(e) => onUpdateRenderConfig({ label: e.target.value })}
              placeholder={stateName}
              className="h-8 text-xs font-medium bg-background"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Select
                value={labelStoreId || selectedStore?.id || ""}
                onValueChange={(val) => {
                  const st = stateStores.find((s) => s.id === val);
                  const firstField = st?.fields[0]?.name || "";
                  onUpdateRenderConfig({
                    labelStoreId: val,
                    labelStoreName: st?.name || "Store",
                    labelStoreVar: firstField,
                  });
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Select Store..." />
                </SelectTrigger>
                <SelectContent>
                  {stateStores.map((st) => (
                    <SelectItem key={st.id} value={st.id} className="text-xs">
                      {st.name} {st.scope ? `(${st.scope})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedStore && (
                <Select
                  value={labelStoreVar || selectedStore.fields[0]?.name || ""}
                  onValueChange={(val) => onUpdateRenderConfig({ labelStoreVar: val })}
                >
                  <SelectTrigger className="h-8 text-xs font-mono bg-background">
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
              )}
            </div>
          )}
        </div>

        {(currentComponent === "badge" || currentComponent === "button") && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] text-muted-foreground">Component Variant</Label>
            <Select
              value={currentVariant}
              onValueChange={(val) => {
                if (isVariant(val)) {
                  onUpdateRenderConfig({ variant: val });
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="secondary">Secondary</SelectItem>
                <SelectItem value="outline">Outline</SelectItem>
                <SelectItem value="destructive">Destructive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] text-muted-foreground">Value Formatter</Label>
          <Select
            value={formatter}
            onValueChange={(val) => {
              if (isFormatter(val)) {
                onUpdateRenderConfig({ formatter: val });
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Raw / Default</SelectItem>
              <SelectItem value="currency">Currency ($ USD)</SelectItem>
              <SelectItem value="number">Formatted Number (1,000)</SelectItem>
              <SelectItem value="json">Pretty JSON</SelectItem>
              <SelectItem value="date">Date / Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] text-muted-foreground">Empty / Fallback Text</Label>
          <LocalInput
            value={fallbackText}
            onChange={(e) => onUpdateRenderConfig({ fallbackText: e.target.value })}
            placeholder="—"
            className="h-8 text-xs font-mono"
          />
        </div>
      </div>
    </div>
  );
};

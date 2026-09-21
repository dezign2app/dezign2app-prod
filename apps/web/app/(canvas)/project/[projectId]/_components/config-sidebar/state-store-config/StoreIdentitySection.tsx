"use client";

import React from "react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Sparkles, Link as LinkIcon } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { StorePreset, STORE_PRESETS } from "./types";

export interface StoreIdentitySectionProps {
  storeName: string;
  description: string;
  scope: "global" | "local";
  storage: "memory" | "localStorage" | "sessionStorage";
  connectedPages: BackendNode[];
  onApplyPreset: (preset: StorePreset) => void;
  onUpdateStoreName: (name: string) => void;
  onUpdateDescription: (description: string) => void;
  onUpdateScope: (scope: "global" | "local") => void;
  onUpdateStorage: (storage: "memory" | "localStorage" | "sessionStorage") => void;
}

export const StoreIdentitySection: React.FC<StoreIdentitySectionProps> = ({
  storeName,
  description,
  scope,
  storage,
  connectedPages,
  onApplyPreset,
  onUpdateStoreName,
  onUpdateDescription,
  onUpdateScope,
  onUpdateStorage,
}) => {
  return (
    <div className="space-y-4">
      {/* Quick Presets */}
      <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-muted/30 border border-border/50">
        <div className="flex items-center gap-1 text-[11px] font-medium text-foreground">
          <Sparkles size={12} className="text-amber-400" />
          <span>Quick Presets</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {STORE_PRESETS.map((preset) => (
            <Button
              key={preset.name}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onApplyPreset(preset)}
              className="h-6 text-[10px] px-2 bg-background/50 hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/30 transition-all cursor-pointer"
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Store Identity */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground">Store Name</Label>
          <Input
            value={storeName}
            onChange={(e) => onUpdateStoreName(e.target.value)}
            placeholder="e.g. Cart, UserPreferences"
            className="h-8 text-xs font-medium"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground">Description</Label>
          <Input
            value={description}
            onChange={(e) => onUpdateDescription(e.target.value)}
            placeholder="Brief purpose of this store..."
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Scope & Storage */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground">Scope</Label>
          <Select value={scope} onValueChange={(val: "global" | "local") => onUpdateScope(val)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">Global (All Web Apps)</SelectItem>
              <SelectItem value="local">Local (Page-Scoped)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground">Storage</Label>
          <Select
            value={storage}
            onValueChange={(val: "memory" | "localStorage" | "sessionStorage") => onUpdateStorage(val)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="memory">Memory (RAM)</SelectItem>
              <SelectItem value="localStorage">Local Storage</SelectItem>
              <SelectItem value="sessionStorage">Session Storage</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Connected Pages */}
      {connectedPages.length > 0 && (
        <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-400">
            <LinkIcon size={12} />
            <span>Connected Pages ({connectedPages.length})</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {connectedPages.map((p) => (
              <Badge
                key={p.id}
                variant="secondary"
                className="text-[10px] bg-background/80 font-mono"
              >
                {p.data?.label || p.data?.path || p.id}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

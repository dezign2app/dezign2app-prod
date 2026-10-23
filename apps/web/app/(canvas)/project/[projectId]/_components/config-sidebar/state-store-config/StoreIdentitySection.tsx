"use client";

import React from "react";
import { LocalInput } from "../../backend-nodes/graph-nodes/shared";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Link as LinkIcon, AlertCircle } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { StorePreset } from "./types";
import { cn } from "@workspace/ui/lib/utils";

export interface StoreIdentitySectionProps {
  storeName: string;
  description: string;
  scope?: "global" | "local";
  storage?: "memory" | "localStorage" | "sessionStorage";
  connectedPages: BackendNode[];
  isDuplicateStoreName?: boolean;
  duplicateStoreMessage?: string;
  onApplyPreset?: (preset: StorePreset) => void;
  onUpdateStoreName: (name: string) => void;
  onUpdateDescription: (description: string) => void;
  onUpdateScope?: (scope: "global" | "local") => void;
  onUpdateStorage?: (storage: "memory" | "localStorage" | "sessionStorage") => void;
}

export const StoreIdentitySection: React.FC<StoreIdentitySectionProps> = ({
  storeName,
  description,
  connectedPages,
  isDuplicateStoreName = false,
  duplicateStoreMessage,
  onUpdateStoreName,
  onUpdateDescription,
}) => {
  return (
    <div className="space-y-4">
      {/* Store Identity */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
            <span>Store Name</span>
            {isDuplicateStoreName && (
              <span className="text-[10px] text-destructive font-semibold">
                Name already exists
              </span>
            )}
          </Label>
          <LocalInput
            value={storeName}
            onChange={(e) => onUpdateStoreName(e.target.value)}
            debounceMs={150}
            placeholder="e.g. Cart, UserPreferences"
            className={cn(
              "h-8 text-xs font-medium",
              isDuplicateStoreName && "border-destructive text-destructive focus-visible:ring-destructive",
            )}
          />
          {isDuplicateStoreName && (
            <div className="flex items-center gap-1.5 text-[11px] text-destructive font-medium mt-0.5">
              <AlertCircle size={12} className="shrink-0" />
              <span>
                {duplicateStoreMessage || `An App Store named "${storeName}" already exists. Store names must be unique.`}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground">Description</Label>
          <LocalInput
            value={description}
            onChange={(e) => onUpdateDescription(e.target.value)}
            debounceMs={150}
            placeholder="Brief purpose of this store..."
            className="h-8 text-xs"
          />
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

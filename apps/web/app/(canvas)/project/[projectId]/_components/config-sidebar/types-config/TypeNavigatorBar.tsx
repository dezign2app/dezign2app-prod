"use client";

import React from "react";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Plus } from "lucide-react";
import type { TypeNavigatorBarProps } from "./types";

export const TypeNavigatorBar: React.FC<TypeNavigatorBarProps> = ({
  types,
  currentTypeId,
  isPackageNode,
  onSelectType,
  onAddType,
}) => {
  return (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border bg-card/50 shadow-sm">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
          Selected Type:
        </span>
        <Select
          value={currentTypeId}
          onValueChange={onSelectType}
        >
          <SelectTrigger className="h-8 text-xs font-mono font-semibold bg-background flex-1 max-w-[220px]">
            <SelectValue placeholder="Select type..." />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-xs font-mono">
                {t.name} ({t.kind})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isPackageNode && (
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-[10px] gap-1 rounded-full px-3 shrink-0 cursor-pointer"
          onClick={onAddType}
        >
          <Plus size={12} /> Add Type
        </Button>
      )}
    </div>
  );
};

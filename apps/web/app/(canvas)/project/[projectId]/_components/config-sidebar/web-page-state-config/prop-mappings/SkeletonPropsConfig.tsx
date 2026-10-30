"use client";

import React from "react";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { ComponentPropMappings } from "@/types/canvas";

export interface SkeletonPropsConfigProps {
  propMappings: ComponentPropMappings;
  onUpdatePropMapping: (changes: Partial<ComponentPropMappings>) => void;
}

export const SkeletonPropsConfig: React.FC<SkeletonPropsConfigProps> = React.memo(({
  propMappings,
  onUpdatePropMapping,
}) => {
  return (
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
  );
});
SkeletonPropsConfig.displayName = "SkeletonPropsConfig";

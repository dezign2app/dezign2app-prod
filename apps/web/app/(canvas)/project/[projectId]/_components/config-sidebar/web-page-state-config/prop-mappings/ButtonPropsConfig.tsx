"use client";

import React from "react";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { ComponentPropMappings } from "@/types/canvas";
import { isButtonSize } from "../constants";

export interface ButtonPropsConfigProps {
  propMappings: ComponentPropMappings;
  onUpdatePropMapping: (changes: Partial<ComponentPropMappings>) => void;
}

export const ButtonPropsConfig: React.FC<ButtonPropsConfigProps> = React.memo(({
  propMappings,
  onUpdatePropMapping,
}) => {
  return (
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
  );
});
ButtonPropsConfig.displayName = "ButtonPropsConfig";

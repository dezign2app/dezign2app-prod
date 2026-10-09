"use client";

import React from "react";
import { Type } from "lucide-react";
import { StateRenderComponent, StateRenderConfig } from "@/types/canvas";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
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
  stateName: string;
  currentComponent: StateRenderComponent;
  currentVariant: NonNullable<StateRenderConfig["variant"]>;
  formatter: NonNullable<StateRenderConfig["formatter"]>;
  fallbackText: string;
  prefix: string;
  suffix: string;
  onUpdateRenderConfig: (changes: Partial<StateRenderConfig>) => void;
}

export const DisplayFormattingSection: React.FC<DisplayFormattingSectionProps> = ({
  label,
  stateName,
  currentComponent,
  currentVariant,
  formatter,
  fallbackText,
  prefix,
  suffix,
  onUpdateRenderConfig,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Type size={13} className="text-primary" />
        <span>Label & Display Formatting</span>
      </Label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] text-muted-foreground">Display Label / Title</Label>
          <Input
            value={label}
            onChange={(e) => onUpdateRenderConfig({ label: e.target.value })}
            placeholder={stateName}
            className="h-8 text-xs font-medium"
          />
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
          <Input
            value={fallbackText}
            onChange={(e) => onUpdateRenderConfig({ fallbackText: e.target.value })}
            placeholder="—"
            className="h-8 text-xs font-mono"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] text-muted-foreground">Prefix</Label>
          <Input
            value={prefix}
            onChange={(e) => onUpdateRenderConfig({ prefix: e.target.value })}
            placeholder="e.g. $"
            className="h-8 text-xs font-mono"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] text-muted-foreground">Suffix</Label>
          <Input
            value={suffix}
            onChange={(e) => onUpdateRenderConfig({ suffix: e.target.value })}
            placeholder="e.g. items, USD, %"
            className="h-8 text-xs font-mono"
          />
        </div>
      </div>
    </div>
  );
};

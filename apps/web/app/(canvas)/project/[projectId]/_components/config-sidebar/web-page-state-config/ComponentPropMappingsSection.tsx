"use client";

import React from "react";
import { SlidersHorizontal } from "lucide-react";
import { StateRenderComponent, ComponentPropMappings } from "@/types/canvas";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Input } from "@workspace/ui/components/input";
import { Switch } from "@workspace/ui/components/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { ComponentOption, isInputType, isButtonSize } from "./constants";

export interface ComponentPropMappingsSectionProps {
  currentComponent: StateRenderComponent;
  selectedOption: ComponentOption;
  displayLabel: string;
  stateName: string;
  propMappings: ComponentPropMappings;
  onUpdatePropMapping: (changes: Partial<ComponentPropMappings>) => void;
}

export const ComponentPropMappingsSection: React.FC<ComponentPropMappingsSectionProps> = ({
  currentComponent,
  selectedOption,
  displayLabel,
  stateName,
  propMappings,
  onUpdatePropMapping,
}) => {
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
        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
          {/* Value Binding */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-foreground">
                Value Binding (<code className="font-mono text-[10px] text-cyan-500">value</code>)
              </Label>
              <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0">
                Bound to State
              </Badge>
            </div>
            <Input
              value={propMappings.valueBinding ?? stateName}
              onChange={(e) => onUpdatePropMapping({ valueBinding: e.target.value })}
              placeholder={stateName}
              className="h-8 text-xs font-mono bg-background"
            />
            <span className="text-[10px] text-muted-foreground">
              Reactive state variable binding. Enter custom expression if needed (e.g. <code className="font-mono">{stateName} || ""</code>).
            </span>
          </div>

          {/* Input Type */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-medium text-foreground">
              Input Type (<code className="font-mono text-[10px] text-cyan-500">type</code>)
            </Label>
            <Select
              value={propMappings.inputType || "text"}
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
                <SelectItem value="text">text (Standard text input)</SelectItem>
                <SelectItem value="number">number (Numeric values & counters)</SelectItem>
                <SelectItem value="password">password (Masked secret)</SelectItem>
                <SelectItem value="email">email (Email address format)</SelectItem>
                <SelectItem value="tel">tel (Telephone / mobile number)</SelectItem>
                <SelectItem value="url">url (Web address URL)</SelectItem>
                <SelectItem value="date">date (Date picker)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Placeholder */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-medium text-foreground">
              Placeholder (<code className="font-mono text-[10px] text-cyan-500">placeholder</code>)
            </Label>
            <Input
              value={propMappings.placeholder || ""}
              onChange={(e) => onUpdatePropMapping({ placeholder: e.target.value })}
              placeholder={`Enter ${displayLabel}...`}
              className="h-8 text-xs bg-background"
            />
            <span className="text-[10px] text-muted-foreground">
              Hint text shown when input field is empty.
            </span>
          </div>

          {/* Behavior Toggles: readOnly, disabled */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div className="flex items-center justify-between p-2 rounded-lg bg-background/80 border border-border/40">
              <div className="flex flex-col">
                <Label className="text-[11px] font-medium cursor-pointer">
                  Read Only (<code className="font-mono text-[9px]">readOnly</code>)
                </Label>
                <span className="text-[9px] text-muted-foreground">Non-editable display</span>
              </div>
              <Switch
                checked={propMappings.readOnly !== false}
                onCheckedChange={(checked) => onUpdatePropMapping({ readOnly: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-background/80 border border-border/40">
              <div className="flex flex-col">
                <Label className="text-[11px] font-medium cursor-pointer">
                  Disabled (<code className="font-mono text-[9px]">disabled</code>)
                </Label>
                <span className="text-[9px] text-muted-foreground">Deactivate input</span>
              </div>
              <Switch
                checked={Boolean(propMappings.disabled)}
                onCheckedChange={(checked) => onUpdatePropMapping({ disabled: checked })}
              />
            </div>
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
            <Input
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
            <Input
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
              <Input
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
            <Input
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
            <Input
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
            <Input
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

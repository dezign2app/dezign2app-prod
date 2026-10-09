"use client";

import React from "react";
import { Sparkles, MousePointerClick, AlertTriangle } from "lucide-react";
import {
  StateRenderComponent,
  StateRenderConfig,
  ComponentPropMappings,
  JSONValue,
} from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Progress } from "@workspace/ui/components/progress";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { toast } from "sonner";

export interface StateComponentPreviewProps {
  currentComponent: StateRenderComponent;
  currentVariant: NonNullable<StateRenderConfig["variant"]>;
  currentClickAction: NonNullable<StateRenderConfig["clickAction"]>;
  displayLabel: string;
  formattedPreviewValue: string;
  sampleValue: JSONValue | undefined;
  propMappings: ComponentPropMappings;
  stateName: string;
  copyToastMessage?: string;
  targetActionId?: string;
}

export const StateComponentPreview: React.FC<StateComponentPreviewProps> = ({
  currentComponent,
  currentVariant,
  currentClickAction,
  displayLabel,
  formattedPreviewValue,
  sampleValue,
  propMappings,
  stateName,
  copyToastMessage,
  targetActionId,
}) => {
  return (
    <Card className="border-cyan-500/30 bg-cyan-500/[0.02] shadow-xs overflow-hidden">
      <CardHeader className="p-3.5 pb-2 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
            <Sparkles size={13} className="text-cyan-500" />
            <span>Live Component Preview</span>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono capitalize">
            {currentComponent}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5 flex flex-col items-center justify-center min-h-[100px] bg-background/50">
        {/* Dynamic Component Preview Rendering */}
        {currentComponent === "badge" && (
          <Badge
            variant={currentVariant}
            className={cn(
              "px-3 py-1 text-xs transition-all",
              currentClickAction !== "none" && "cursor-pointer hover:scale-105 active:scale-95 shadow-sm",
            )}
            onClick={() => {
              if (currentClickAction === "copy_to_clipboard") {
                navigator.clipboard?.writeText(String(sampleValue));
                toast.success(copyToastMessage || `Copied ${stateName} to clipboard!`);
              } else if (currentClickAction === "trigger_event") {
                toast.info(`Simulated: Trigger action "${targetActionId || "action"}"`);
              }
            }}
          >
            <span className="font-semibold mr-1">{displayLabel}:</span>
            <span>{formattedPreviewValue}</span>
          </Badge>
        )}

        {currentComponent === "card" && (
          <div
            className={cn(
              "p-3 rounded-lg bg-card border border-border/70 shadow-xs min-w-[180px] max-w-xs transition-all",
              currentClickAction !== "none" && "cursor-pointer hover:border-cyan-500/60 shadow-sm",
            )}
          >
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {propMappings.titleBinding || displayLabel}
            </div>
            {propMappings.descriptionBinding && (
              <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                {propMappings.descriptionBinding}
              </div>
            )}
            <div className="text-base font-bold text-foreground mt-0.5 font-mono">
              {formattedPreviewValue}
            </div>
          </div>
        )}

        {currentComponent === "button" && (
          <Button
            variant={currentVariant}
            size={propMappings.buttonSize || "sm"}
            disabled={Boolean(propMappings.disabled)}
            className="gap-1.5 shadow-xs"
            onClick={() => {
              if (currentClickAction === "copy_to_clipboard") {
                navigator.clipboard?.writeText(String(sampleValue));
                toast.success(copyToastMessage || `Copied ${stateName} to clipboard!`);
              } else if (currentClickAction === "trigger_event") {
                toast.info(`Simulated: Trigger action "${targetActionId || "action"}"`);
              }
            }}
          >
            <span>{displayLabel}:</span>
            <span className="font-mono">{formattedPreviewValue}</span>
          </Button>
        )}

        {currentComponent === "switch" && (
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/20 border border-border/40">
            <Switch checked={Boolean(sampleValue)} disabled={Boolean(propMappings.disabled)} />
            <Label className="text-xs font-medium cursor-pointer">{displayLabel}</Label>
          </div>
        )}

        {currentComponent === "checkbox" && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border/40">
            <Checkbox checked={Boolean(sampleValue)} disabled={Boolean(propMappings.disabled)} />
            <Label className="text-xs font-medium cursor-pointer">{displayLabel}</Label>
          </div>
        )}

        {currentComponent === "progress" && (
          <div className="w-full max-w-xs flex flex-col gap-1.5 p-2">
            <div className="flex justify-between text-xs font-medium">
              <span>{displayLabel}</span>
              {propMappings.showPercent !== false && (
                <span className="font-mono text-muted-foreground">{formattedPreviewValue}%</span>
              )}
            </div>
            <Progress
              value={Math.min(propMappings.max || 100, Math.max(0, Number(sampleValue) || 45))}
              max={propMappings.max || 100}
            />
            {propMappings.max && propMappings.max !== 100 && (
              <span className="text-[9px] text-muted-foreground font-mono">Max: {propMappings.max}</span>
            )}
          </div>
        )}

        {currentComponent === "input" && (
          <div className="w-full max-w-xs flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">{displayLabel}</Label>
              <span className="text-[10px] font-mono text-muted-foreground/70">
                type="{propMappings.inputType || "text"}"
              </span>
            </div>
            <Input
              type={propMappings.inputType || "text"}
              value={String(formattedPreviewValue)}
              placeholder={propMappings.placeholder || `Enter ${displayLabel}...`}
              readOnly={propMappings.readOnly !== false}
              disabled={Boolean(propMappings.disabled)}
              className="h-8 text-xs bg-muted/20 font-mono shadow-2xs"
            />
            {(propMappings.readOnly !== false || propMappings.disabled) && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                {propMappings.readOnly !== false && (
                  <span className="px-1.5 py-0.2 rounded bg-muted text-[9px] font-mono">readOnly</span>
                )}
                {propMappings.disabled && (
                  <span className="px-1.5 py-0.2 rounded bg-muted text-[9px] font-mono text-amber-500">disabled</span>
                )}
              </div>
            )}
          </div>
        )}

        {currentComponent === "alert" && (
          <Alert className="max-w-sm py-2 px-3 border-cyan-500/30 bg-cyan-500/5">
            <AlertTriangle className="h-4 w-4 text-cyan-500 shrink-0 mt-0.5" />
            <AlertDescription className="text-xs">
              {propMappings.alertTitle && (
                <div className="font-semibold text-foreground mb-0.5">{propMappings.alertTitle}</div>
              )}
              <strong className="mr-1">{displayLabel}:</strong>
              <span>{formattedPreviewValue}</span>
            </AlertDescription>
          </Alert>
        )}

        {currentComponent === "avatar" && (
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9 border border-border">
              {propMappings.avatarSrc ? (
                <img
                  src={propMappings.avatarSrc}
                  alt={displayLabel}
                  className="h-full w-full object-cover rounded-full"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
              <AvatarFallback className="bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold text-xs">
                {propMappings.avatarFallback || (displayLabel ? displayLabel.slice(0, 2).toUpperCase() : "AV")}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-xs font-semibold">{displayLabel}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{formattedPreviewValue}</span>
            </div>
          </div>
        )}

        {currentComponent === "skeleton" && (
          <div className="flex items-center gap-3">
            <Skeleton className={cn(propMappings.skeletonHeight || "h-7", propMappings.skeletonWidth || "w-28", "rounded-md")} />
            <span className="text-xs text-muted-foreground font-mono">({displayLabel} loading...)</span>
          </div>
        )}

        {currentComponent === "code" && (
          <pre className="text-[11px] font-mono p-3 rounded-lg bg-muted/50 border border-border/60 max-w-sm w-full overflow-x-auto text-foreground">
            {typeof sampleValue === "object"
              ? JSON.stringify(sampleValue, null, 2)
              : `${displayLabel}: ${formattedPreviewValue}`}
          </pre>
        )}

        {currentComponent === "text" && (
          <div className="text-xs px-2.5 py-1.5 rounded-md bg-secondary/50 border border-border text-foreground font-mono">
            <span className="text-muted-foreground">{displayLabel}: </span>
            <span>{formattedPreviewValue}</span>
          </div>
        )}

        {currentClickAction !== "none" && (
          <div className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground/80">
            <MousePointerClick size={10} className="text-cyan-500" />
            <span>Click to test interactive action ({currentClickAction})</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

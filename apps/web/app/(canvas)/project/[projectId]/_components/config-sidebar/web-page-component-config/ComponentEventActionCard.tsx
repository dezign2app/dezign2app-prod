"use client";

import React from "react";
import { Zap, Plus, Play, ArrowRight } from "lucide-react";
import { UIEventItem } from "@workspace/canvas";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

export interface ComponentEventActionCardProps {
  triggerEvent?: string;
  actionId?: string;
  actionName?: string;
  availableActions: UIEventItem[];
  onUpdate: (changes: { triggerEvent?: string; actionId?: string; actionName?: string }) => void;
  onCreateAction: (name?: string, eventType?: string) => void;
  onOpenActionFlow?: (actionId: string) => void;
}

export const ComponentEventActionCard: React.FC<ComponentEventActionCardProps> = ({
  triggerEvent = "click",
  actionId,
  actionName,
  availableActions,
  onUpdate,
  onCreateAction,
  onOpenActionFlow,
}) => {
  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Zap size={13} className="text-amber-500" />
            <span>Event &amp; Action Trigger Binding</span>
          </span>
          {actionId && (
            <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30">
              Wired
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-[11px]">
          Execute section actions and workflows when interacting with this component
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-1 space-y-3 text-xs">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Trigger Event</span>
            <span className="text-[10px] text-muted-foreground/70 font-normal">
              DOM or interaction event
            </span>
          </Label>
          <Select
            value={triggerEvent || "click"}
            onValueChange={(val) => onUpdate({ triggerEvent: val })}
          >
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="click">onClick (Button click / tap)</SelectItem>
              <SelectItem value="change">onChange (Input change / toggle)</SelectItem>
              <SelectItem value="submit">onSubmit (Form submission)</SelectItem>
              <SelectItem value="select">onSelect (Dropdown option chosen)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground">Target Action Workflow</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onCreateAction()}
              className="h-6 text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-700 p-0 hover:bg-transparent flex items-center gap-1 cursor-pointer"
            >
              <Plus size={11} />
              <span>New Action</span>
            </Button>
          </div>
          <Select
            value={actionId || "__none__"}
            onValueChange={(val) => {
              if (val === "__none__") {
                onUpdate({ actionId: undefined, actionName: undefined });
              } else {
                const act = availableActions.find((a) => a.id === val);
                onUpdate({
                  actionId: val,
                  actionName: act?.name || "Action",
                });
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue placeholder="No Action Bound" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None (No Action)</SelectItem>
              {availableActions.map((act) => (
                <SelectItem key={act.id} value={act.id || ""}>
                  <div className="flex items-center gap-1.5">
                    <Zap size={11} className="text-amber-500" />
                    <span>{act.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({act.actionSteps?.length || 0} steps)
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {actionId && onOpenActionFlow && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (actionId) {
                onOpenActionFlow(actionId);
              }
            }}
            className="w-full h-8 text-xs flex items-center justify-between border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Play size={12} className="text-purple-500" />
              <span>Open Action Flow Editor</span>
            </span>
            <ArrowRight size={12} />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

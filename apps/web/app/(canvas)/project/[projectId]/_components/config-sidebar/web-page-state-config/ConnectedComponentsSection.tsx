"use client";

import React from "react";
import {
  Layers,
  Plus,
  Settings2,
  MousePointerClick,
  FormInput,
  Layout,
  ToggleLeft,
  BadgeAlert,
  Table,
  ChevronDownSquare,
  Sparkles,
  PanelLeft,
  PanelTop,
} from "lucide-react";
import { SectionComponentBinding } from "@workspace/canvas";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";

export interface ConnectedComponentsSectionProps {
  stateName: string;
  stateId: string;
  componentBindings: SectionComponentBinding[];
  onOpenComponent: (componentId: string) => void;
  onBindNewComponent: () => void;
}

const COMPONENT_ICONS: Record<string, React.ElementType> = {
  button: MousePointerClick,
  input: FormInput,
  card: Layout,
  switch: ToggleLeft,
  badge: BadgeAlert,
  table: Table,
  select: ChevronDownSquare,
  sidebar: PanelLeft,
  topbar: PanelTop,
};

export const ConnectedComponentsSection: React.FC<ConnectedComponentsSectionProps> = ({
  stateName,
  stateId,
  componentBindings,
  onOpenComponent,
  onBindNewComponent,
}) => {
  const matchingComponents = componentBindings.filter(
    (c) =>
      c.valueStateName === stateName ||
      c.valueStateId === stateId ||
      c.disabledStateName === stateName ||
      c.loadingStateName === stateName,
  );

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Layers size={14} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xs font-semibold">Connected UI Components</CardTitle>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                  {matchingComponents.length}
                </Badge>
              </div>
              <CardDescription className="text-[11px] mt-0.5">
                UI elements in this section reading or writing to this state variable
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onBindNewComponent}
            className="h-7 text-[11px] gap-1 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 cursor-pointer"
          >
            <Plus size={11} />
            <span>Bind to Component</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-2">
        {matchingComponents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-4 text-center bg-muted/20">
            <div className="flex justify-center mb-1 text-muted-foreground">
              <Sparkles size={16} className="text-muted-foreground/60" />
            </div>
            <p className="text-xs font-medium text-foreground">No components bound</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs mx-auto">
              This state variable is not currently mapped to any UI component. Click &quot;Bind to Component&quot; to create a button, card, or input linked to this state.
            </p>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={onBindNewComponent}
              className="mt-3 h-7 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
            >
              <Plus size={12} />
              <span>+ Create Component Binding</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {matchingComponents.map((comp) => {
              const IconComp = COMPONENT_ICONS[comp.componentType] || Layout;
              const isValueModel = comp.valueStateName === stateName || comp.valueStateId === stateId;
              const isDisabledGuard = comp.disabledStateName === stateName;
              const isLoadingGuard = comp.loadingStateName === stateName;

              return (
                <div
                  key={comp.id}
                  onClick={() => onOpenComponent(comp.id)}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card hover:bg-accent/40 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 shrink-0">
                      <IconComp size={13} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground truncate">
                          {comp.label || comp.name}
                        </span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase font-mono tracking-wider">
                          &lt;{comp.componentType}&gt;
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {isValueModel && (
                          <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[9px] px-1.5 py-0">
                            Value Model
                          </Badge>
                        )}
                        {isDisabledGuard && (
                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[9px] px-1.5 py-0">
                            Disabled Guard
                          </Badge>
                        )}
                        {isLoadingGuard && (
                          <Badge className="bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30 text-[9px] px-1.5 py-0">
                            Loading Guard
                          </Badge>
                        )}
                        {comp.actionName && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ⚡ {comp.triggerEvent || "click"} → {comp.actionName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground group-hover:text-foreground shrink-0 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenComponent(comp.id);
                    }}
                  >
                    <Settings2 size={12} />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

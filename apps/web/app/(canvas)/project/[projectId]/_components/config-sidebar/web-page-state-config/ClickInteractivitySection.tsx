"use client";

import React from "react";
import { MousePointerClick, Copy } from "lucide-react";
import {
  BackendNode,
  StateRenderConfig,
  UIEventItem,
} from "@/types/canvas";
import { Label } from "@workspace/ui/components/label";
import { LocalInput } from "../../backend-nodes/graph-nodes/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { isClickAction } from "./constants";

export interface ClickInteractivitySectionProps {
  currentClickAction: NonNullable<StateRenderConfig["clickAction"]>;
  copyToastMessage?: string;
  targetActionId?: string;
  targetRoute?: string;
  stateName: string;
  availableActions: UIEventItem[];
  availablePages: BackendNode[];
  sectionName?: string;
  onUpdateRenderConfig: (changes: Partial<StateRenderConfig>) => void;
}

export const ClickInteractivitySection: React.FC<ClickInteractivitySectionProps> = ({
  currentClickAction,
  copyToastMessage,
  targetActionId,
  targetRoute,
  stateName,
  availableActions,
  availablePages,
  sectionName,
  onUpdateRenderConfig,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <MousePointerClick size={13} className="text-primary" />
        <span>Click Interactivity & Events</span>
      </Label>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] text-muted-foreground">On-Click Action</Label>
          <Select
            value={currentClickAction}
            onValueChange={(val) => {
              if (isClickAction(val)) {
                onUpdateRenderConfig({ clickAction: val });
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Static (No Action)</SelectItem>
              <SelectItem value="copy_to_clipboard">Copy to Clipboard</SelectItem>
              <SelectItem value="trigger_event">Trigger Section Action / Event</SelectItem>
              <SelectItem value="navigate">Navigate to Page / Route</SelectItem>
              <SelectItem value="toggle_state">Toggle / Mutate State Value</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sub-setting: Copy to Clipboard */}
        {currentClickAction === "copy_to_clipboard" && (
          <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/20 border border-border/50">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Copy size={11} />
              <span>Toast Feedback Message</span>
            </Label>
            <LocalInput
              value={copyToastMessage || ""}
              onChange={(e) => onUpdateRenderConfig({ copyToastMessage: e.target.value })}
              placeholder={`Copied ${stateName} to clipboard!`}
              className="h-8 text-xs"
            />
            <span className="text-[10px] text-muted-foreground">
              Shows an instant notification when the user clicks this rendered state component.
            </span>
          </div>
        )}

        {/* Sub-setting: Trigger Section Action */}
        {currentClickAction === "trigger_event" && (
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-muted/20 border border-border/50">
            <Label className="text-[11px] text-muted-foreground">Target Action / Event</Label>
            {availableActions.length > 0 ? (
              <Select
                value={targetActionId || ""}
                onValueChange={(val) => onUpdateRenderConfig({ targetActionId: val })}
              >
                <SelectTrigger className="h-8 text-xs font-mono">
                  <SelectValue placeholder="Select an action to trigger" />
                </SelectTrigger>
                <SelectContent>
                  {availableActions.map((act) => (
                    <SelectItem key={act.id} value={act.id}>
                      {act.name || act.event} ({act.event || "action"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-[11px] text-amber-500 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                No interactive actions configured in section "{sectionName || "Main"}". Add an action in the section actions tab to trigger it here.
              </div>
            )}
          </div>
        )}

        {/* Sub-setting: Navigate to Route */}
        {currentClickAction === "navigate" && (
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-muted/20 border border-border/50">
            <Label className="text-[11px] text-muted-foreground">Destination Route</Label>
            <LocalInput
              value={targetRoute || ""}
              onChange={(e) => onUpdateRenderConfig({ targetRoute: e.target.value })}
              placeholder="/dashboard or /login"
              className="h-8 text-xs font-mono"
            />
            {availablePages.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="text-[10px] text-muted-foreground mr-1">Existing pages:</span>
                {availablePages.map((p) => {
                  const route = p.data?.label || "/";
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onUpdateRenderConfig({ targetRoute: route })}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground cursor-pointer transition-colors"
                    >
                      {route}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Sub-setting: Toggle State */}
        {currentClickAction === "toggle_state" && (
          <div className="text-[11px] text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-border/40">
            Clicking this element in the compiled application will toggle the reactive state variable between true and false.
          </div>
        )}
      </div>
    </div>
  );
};

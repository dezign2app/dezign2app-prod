"use client";

import React from "react";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Sliders, Activity, Play } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { StateManipulator } from "./types";

export interface ManipulatorRunnerSectionProps {
  manipulators: StateManipulator[];
  selectedManipulator: StateManipulator | undefined;
  selectedManipulatorId: string;
  onSelectManipulator: (id: string) => void;
  payloadText: string;
  onChangePayloadText: (text: string) => void;
  manipulatorArgInfo: { label: string; placeholder: string };
  isExecuting: boolean;
  onRunManipulator: () => void;
}

export const ManipulatorRunnerSection: React.FC<ManipulatorRunnerSectionProps> = ({
  manipulators,
  selectedManipulator,
  selectedManipulatorId,
  onSelectManipulator,
  payloadText,
  onChangePayloadText,
  manipulatorArgInfo,
  isExecuting,
  onRunManipulator,
}) => {
  return (
    <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/20 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
          <Sliders size={12} className="text-indigo-400" />
          <span>Select State Manipulator</span>
        </Label>
        {selectedManipulator && (
          <Badge
            variant="outline"
            className={cn(
              "text-[9px] uppercase px-1 py-0",
              selectedManipulator.category === "custom_action"
                ? "text-purple-400 border-purple-500/30 bg-purple-500/10"
                : selectedManipulator.category === "auto_setter"
                ? "text-sky-400 border-sky-500/30 bg-sky-500/10"
                : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
            )}
          >
            {selectedManipulator.category.replace("_", " ")}
          </Badge>
        )}
      </div>

      {/* Manipulator Dropdown */}
      <div className="space-y-1">
        <Select value={selectedManipulatorId} onValueChange={onSelectManipulator}>
          <SelectTrigger className="h-8 text-xs bg-background font-mono">
            <SelectValue placeholder="Select state manipulator..." />
          </SelectTrigger>
          <SelectContent>
            {manipulators.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
                <span className="font-semibold text-foreground">{m.name}()</span>
                <span className="text-[10px] text-muted-foreground ml-1">
                  [{m.category.replace("_", " ")}]
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Manipulator Payload / Arguments */}
      {selectedManipulator && selectedManipulator.actionType !== "reset" && (
        <div className="space-y-1 pt-1 border-t border-border/30">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
              <span>
                {manipulatorArgInfo.label} for <code>{selectedManipulator.name}()</code>
              </span>
            </Label>
          </div>
          <Textarea
            value={payloadText}
            onChange={(e) => onChangePayloadText(e.target.value)}
            placeholder={manipulatorArgInfo.placeholder}
            className="h-16 text-[11px] font-mono bg-background resize-y p-2 border-border/70"
          />
        </div>
      )}

      {/* Run Button */}
      <Button
        type="button"
        onClick={onRunManipulator}
        disabled={isExecuting || !selectedManipulator}
        className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm gap-1.5 cursor-pointer"
      >
        {isExecuting ? (
          <Activity size={13} className="animate-spin" />
        ) : (
          <Play size={13} className="fill-white" />
        )}
        <span>Run {selectedManipulator?.name}()</span>
      </Button>
    </div>
  );
};

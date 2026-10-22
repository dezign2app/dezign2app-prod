"use client";

import React from "react";
import { Layers, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { BindingSourceEditor } from "../BindingSourceEditor";
import { LocalInput } from "../BufferedInput";
import { AvailableSource, StepBinding } from "../types";

export interface DeclaredChannel {
  key: string;
  type: string;
  isInputChannel: boolean;
  required?: boolean;
  description?: string;
  stateChannelKey?: string;
}

export interface StateChannelPayloadSectionProps {
  mappedDeclaredChannels: DeclaredChannel[];
  customKeys: string[];
  unmappedDeclaredChannels: DeclaredChannel[];
  hasMemory: boolean;
  availableSources: AvailableSource[];
  serviceNodeId?: string;
  getBindingForChannel: (chOrKey: { key: string; stateChannelKey?: string } | string) => StepBinding;
  onBindingChange: (channelKey: string, updated: StepBinding) => void;
  onRemoveMapping: (channelKey: string) => void;
  onAutoMap: () => void;
  onAddChannel: (channelKey: string) => void;
  newKey: string;
  onNewKeyChange: (val: string) => void;
  newCustomBinding: StepBinding;
  onNewCustomBindingChange: (binding: StepBinding) => void;
  onAddCustomField: () => void;
}

export const StateChannelPayloadSection: React.FC<StateChannelPayloadSectionProps> = ({
  mappedDeclaredChannels,
  customKeys,
  unmappedDeclaredChannels,
  hasMemory,
  availableSources,
  serviceNodeId,
  getBindingForChannel,
  onBindingChange,
  onRemoveMapping,
  onAutoMap,
  onAddChannel,
  newKey,
  onNewKeyChange,
  newCustomBinding,
  onNewCustomBindingChange,
  onAddCustomField,
}) => {
  return (
    <div className="flex flex-col gap-2.5 p-3.5 bg-secondary/15 rounded-xl border border-border/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-primary" />
          <Label className="text-xs font-bold text-foreground">
            State Channel Payload Mapping
          </Label>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onAutoMap}
          className="h-6 text-[10px] font-semibold gap-1 px-2 border-border/60 hover:bg-secondary/40"
          title="Auto-map default payload fields"
        >
          <RefreshCw className="w-3 h-3 text-primary" />
          Auto-map
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Map request parameters or preceding step outputs into the agent state
        channels (e.g. `body.message`, `req.headers[&quot;x-user-id&quot;]`, or
        `step_output`).
      </p>

      <div className="flex flex-col gap-2 mt-1">
        {(mappedDeclaredChannels.length > 0 || customKeys.length > 0) && (
          <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-1">
            <span>State / Input Channel</span>
            <span></span>
            <span>Source & Field</span>
            <span className="w-6 text-right"></span>
          </div>
        )}

        {mappedDeclaredChannels.map((ch, idx) => {
          const binding = getBindingForChannel(ch);

          return (
            <div
              key={`mapped-ch-${ch.key}-${idx}`}
              className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center text-xs bg-background/50 p-1.5 rounded-lg border border-border/40"
            >
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`font-mono font-bold text-[11px] truncate px-1.5 py-0.5 rounded border ${
                      ch.isInputChannel
                        ? "text-blue-300 bg-blue-500/10 border-blue-500/20"
                        : "text-purple-300 bg-purple-500/10 border-purple-500/20"
                    }`}
                    title={ch.description || ch.key}
                  >
                    {ch.key}
                  </span>
                  {ch.required && (
                    <span className="text-red-400 font-bold text-xs" title="Required input channel">
                      *
                    </span>
                  )}
                  <span className="text-[9px] text-muted-foreground font-mono truncate">
                    {ch.type}
                  </span>
                </div>
                {ch.stateChannelKey && (
                  <span className="text-[8.5px] text-muted-foreground font-mono mt-0.5 leading-tight truncate">
                    → state.{ch.stateChannelKey}
                  </span>
                )}
                {ch.key === "messages" && hasMemory && (
                  <span className="text-[8.5px] text-emerald-400/90 font-sans mt-0.5 leading-tight truncate">
                    new input only (history from DB)
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
              <div className="min-w-0">
                <BindingSourceEditor
                  binding={binding}
                  availableSources={availableSources}
                  serviceNodeId={serviceNodeId}
                  onChange={(updated) => onBindingChange(ch.key, updated)}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveMapping(ch.key)}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  title="Remove mapping"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}

        {/* Any custom mappings not in declared channels */}
        {customKeys.map((k) => {
          const binding = getBindingForChannel(k);
          return (
            <div
              key={`custom-${k}`}
              className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center text-xs bg-background/50 p-1.5 rounded-lg border border-border/40"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono font-bold text-primary text-[11px] truncate bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                  {k}
                </span>
                <span className="text-[9px] text-muted-foreground font-mono">
                  (custom)
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
              <div className="min-w-0">
                <BindingSourceEditor
                  binding={binding}
                  availableSources={availableSources}
                  serviceNodeId={serviceNodeId}
                  onChange={(updated) => onBindingChange(k, updated)}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveMapping(k)}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  title="Remove custom mapping"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}

        {mappedDeclaredChannels.length === 0 && customKeys.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/40 p-3 text-center bg-background/30">
            <p className="text-[11px] text-muted-foreground">
              {unmappedDeclaredChannels.length > 0
                ? "No payload channels mapped yet. The agent will run with its default state."
                : "No additional payload channels required. Messages channel and session thread ID are configured in the dedicated sections above."}
            </p>
            {unmappedDeclaredChannels.length === 0 && (
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                If your graph defines custom state variables (e.g. <code className="font-mono text-primary">userId</code>, <code className="font-mono text-primary">cartId</code>), you can map them using the Custom key field below.
              </p>
            )}
          </div>
        )}

        {/* Unmapped state channels quick-add chips */}
        {unmappedDeclaredChannels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 pb-1 border-t border-border/20 text-xs">
            <span className="text-[10px] text-muted-foreground font-medium">
              Available channels:
            </span>
            {unmappedDeclaredChannels.map((ch) => (
              <button
                key={ch.key}
                type="button"
                onClick={() => onAddChannel(ch.key)}
                className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors ${
                  ch.isInputChannel
                    ? "bg-blue-500/10 border-blue-500/25 text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/40"
                    : "bg-purple-500/10 border-purple-500/25 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/40"
                }`}
                title={`Map channel: ${ch.key} (${ch.type})`}
              >
                <Plus className="w-3 h-3 text-primary" />
                <span>{ch.key}</span>
                {ch.required && <span className="text-red-400 font-bold">*</span>}
                <span className="text-[9px] text-muted-foreground font-sans">
                  ({ch.type})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Add custom state field */}
        <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center pt-2 border-t border-border/30">
          <div className="min-w-0">
            <LocalInput
              value={newKey}
              placeholder="Custom key"
              onChange={(e) => onNewKeyChange(e.target.value)}
              className="h-7 text-xs font-mono bg-background/80"
            />
          </div>
          <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
          <div className="min-w-0">
            <BindingSourceEditor
              binding={newCustomBinding}
              availableSources={availableSources}
              serviceNodeId={serviceNodeId}
              onChange={onNewCustomBindingChange}
            />
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="icon"
              onClick={onAddCustomField}
              disabled={!newKey.trim()}
              className="h-7 w-7 text-primary border-border/60 hover:bg-primary/10 shrink-0"
              title="Add state mapping"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

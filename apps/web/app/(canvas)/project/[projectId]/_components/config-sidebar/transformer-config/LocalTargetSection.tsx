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
import { BackendNode, Endpoint } from "@/types/canvas";

interface LocalTargetSectionProps {
  nodeId: string;
  activeServiceId?: string;
  targetServiceNodes: BackendNode[];
  currentServiceEndpoints: Endpoint[];
  currentServiceConsumedEvents: any[];
  selectedEndpointIds: string[];
  selectedEventIds: string[];
  onServiceChange: (serviceId: string) => void;
  onToggleEndpoint: (epId: string) => void;
  onToggleEvent: (evId: string) => void;
  onSelectAllEndpoints: () => void;
  onClearAllEndpoints: () => void;
  onSelectAllEvents: () => void;
  onClearAllEvents: () => void;
}

export const LocalTargetSection: React.FC<LocalTargetSectionProps> = ({
  activeServiceId,
  targetServiceNodes,
  currentServiceEndpoints,
  currentServiceConsumedEvents,
  selectedEndpointIds,
  selectedEventIds,
  onServiceChange,
  onToggleEndpoint,
  onToggleEvent,
  onSelectAllEndpoints,
  onClearAllEndpoints,
  onSelectAllEvents,
  onClearAllEvents,
}) => {
  return (
    <div className="flex flex-col gap-3.5 p-3 rounded-lg border border-border/50 bg-background/40">
      {/* Target Service Selector */}
      <div className="flex flex-col gap-1.5 min-w-0">
        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Target Service
        </Label>
        <Select
          value={activeServiceId || ""}
          onValueChange={onServiceChange}
        >
          <SelectTrigger className="h-8 text-xs bg-background/60 border-border/60 font-mono">
            <SelectValue placeholder="Select target service…" />
          </SelectTrigger>
          <SelectContent>
            {targetServiceNodes.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs font-mono">
                {s.data?.label || s.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Target Endpoints Multi-Select */}
      <div className="flex flex-col gap-2 min-w-0 pt-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <span>Target Endpoints</span>
            {selectedEndpointIds.length > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {selectedEndpointIds.length} connected
              </span>
            )}
          </Label>

          {currentServiceEndpoints.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-[10px] text-purple-400 hover:text-purple-300 hover:underline"
                onClick={onSelectAllEndpoints}
              >
                Select all
              </button>
              <span className="text-muted-foreground/40 text-[10px]">|</span>
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                onClick={onClearAllEndpoints}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {!activeServiceId ? (
          <div className="p-2.5 rounded text-xs text-muted-foreground italic bg-muted/20 border border-dashed border-border/50 text-center">
            Select a target service first to connect endpoints
          </div>
        ) : currentServiceEndpoints.length === 0 ? (
          <div className="p-2.5 rounded text-xs text-muted-foreground italic bg-muted/20 border border-dashed border-border/50 text-center">
            No endpoints found in this service.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 rounded-md bg-background/50 border border-border/40">
            {currentServiceEndpoints.map((ep) => {
              const isChecked = selectedEndpointIds.includes(ep.id);
              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => onToggleEndpoint(ep.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-all border text-left ${
                    isChecked
                      ? "bg-purple-500/15 border-purple-500/40 text-purple-200 shadow-sm ring-1 ring-purple-500/20"
                      : "bg-background/60 border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <span
                    className={`text-[9px] font-bold px-1 py-0.2 rounded ${
                      ep.type === "GET"
                        ? "bg-blue-500/20 text-blue-300"
                        : ep.type === "POST"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : ep.type === "PUT"
                        ? "bg-amber-500/20 text-amber-300"
                        : ep.type === "DELETE"
                        ? "bg-rose-500/20 text-rose-300"
                        : "bg-primary/20 text-primary"
                    }`}
                  >
                    {ep.type}
                  </span>
                  <span className="truncate max-w-[140px]">
                    {ep.name || ep.summary || ep.id}
                  </span>
                  <span
                    className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[10px] ml-0.5 border ${
                      isChecked
                        ? "bg-purple-500 text-white border-purple-400"
                        : "border-border/80 bg-background/40"
                    }`}
                  >
                    {isChecked ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Target Event Consumers Multi-Select */}
      <div className="flex flex-col gap-2 min-w-0 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <span>Event Consumers</span>
            {selectedEventIds.length > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {selectedEventIds.length} connected
              </span>
            )}
          </Label>

          {currentServiceConsumedEvents.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-[10px] text-purple-400 hover:text-purple-300 hover:underline"
                onClick={onSelectAllEvents}
              >
                Select all
              </button>
              <span className="text-muted-foreground/40 text-[10px]">|</span>
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                onClick={onClearAllEvents}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {currentServiceConsumedEvents.length === 0 ? (
          <div className="p-2.5 rounded text-xs text-muted-foreground italic bg-muted/20 border border-dashed border-border/50 text-center">
            No event consumers configured on this service.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 rounded-md bg-background/50 border border-border/40">
            {currentServiceConsumedEvents.map((ev) => {
              const isChecked = selectedEventIds.includes(ev.id);
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onToggleEvent(ev.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-all border text-left ${
                    isChecked
                      ? "bg-purple-500/15 border-purple-500/40 text-purple-200 shadow-sm ring-1 ring-purple-500/20"
                      : "bg-background/60 border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-500/20 text-amber-300">
                    ⚡ CONSUMER
                  </span>
                  <span className="truncate max-w-[140px]">
                    {ev.name || ev.id}
                  </span>
                  <span
                    className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[10px] ml-0.5 border ${
                      isChecked
                        ? "bg-purple-500 text-white border-purple-400"
                        : "border-border/80 bg-background/40"
                    }`}
                  >
                    {isChecked ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/70 italic px-0.5 mt-1">
          Canvas edges are automatically drawn from this transformer to each selected endpoint and event consumer.
        </p>
      </div>
    </div>
  );
};

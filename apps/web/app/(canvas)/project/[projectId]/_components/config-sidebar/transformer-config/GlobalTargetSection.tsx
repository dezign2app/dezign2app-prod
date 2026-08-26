"use client";

import React from "react";
import { Label } from "@workspace/ui/components/label";
import { BackendNode, EndpointWithNode } from "@/types/canvas";

interface GlobalTargetSectionProps {
  targetServiceNodes: BackendNode[];
  endpoints: EndpointWithNode[];
  getGlobalServiceConnections: (serviceId: string) => {
    refNode?: BackendNode;
    endpointIds: string[];
    eventIds: string[];
  };
  onToggleGlobalEndpoint: (serviceId: string, epId: string) => void;
  onToggleGlobalEvent: (serviceId: string, evId: string) => void;
  onSelectAllGlobalForService: (serviceId: string) => void;
  onClearGlobalForService: (serviceId: string) => void;
}

export const GlobalTargetSection: React.FC<GlobalTargetSectionProps> = ({
  targetServiceNodes,
  endpoints,
  getGlobalServiceConnections,
  onToggleGlobalEndpoint,
  onToggleGlobalEvent,
  onSelectAllGlobalForService,
  onClearGlobalForService,
}) => {
  return (
    <div className="flex flex-col gap-3.5 p-3 rounded-lg border border-border/50 bg-background/40">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <span>Target Services & Endpoints</span>
          </Label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Select endpoints or consumers across multiple services. Visual{" "}
          <code className="text-purple-300 font-mono text-[10px]">
            transformer_ref
          </code>{" "}
          nodes and edges are automatically created on the canvas for each
          service.
        </p>
      </div>

      {targetServiceNodes.length === 0 ? (
        <div className="p-3 rounded text-xs text-muted-foreground italic bg-muted/20 border border-dashed border-border/50 text-center">
          No services found on canvas to connect.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {targetServiceNodes.map((srv) => {
            const srvEndpoints = endpoints.filter((e) => e.nodeId === srv.id);
            const srvConsumedEvents =
              srv.data?.consumedEvents || [];
            const { endpointIds: connectedEpIds, eventIds: connectedEvIds } =
              getGlobalServiceConnections(srv.id);
            const totalConnected = connectedEpIds.length + connectedEvIds.length;

            return (
              <div
                key={srv.id}
                className="flex flex-col gap-2.5 p-2.5 rounded-lg border border-border/50 bg-background/60"
              >
                {/* Service Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-xs text-foreground font-mono truncate">
                      {srv.data?.label || srv.id}
                    </span>
                    {totalConnected > 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {totalConnected} connected
                      </span>
                    )}
                  </div>

                  {(srvEndpoints.length > 0 || srvConsumedEvents.length > 0) && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-[10px] text-purple-400 hover:text-purple-300 hover:underline"
                        onClick={() => onSelectAllGlobalForService(srv.id)}
                      >
                        Select all
                      </button>
                      <span className="text-muted-foreground/40 text-[10px]">|</span>
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                        onClick={() => onClearGlobalForService(srv.id)}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Endpoints */}
                {srvEndpoints.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Endpoints
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {srvEndpoints.map((ep) => {
                        const isChecked = connectedEpIds.includes(ep.id);
                        return (
                          <button
                            key={ep.id}
                            type="button"
                            onClick={() => onToggleGlobalEndpoint(srv.id, ep.id)}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono transition-all border text-left ${
                              isChecked
                                ? "bg-purple-500/15 border-purple-500/40 text-purple-200 shadow-sm ring-1 ring-purple-500/20"
                                : "bg-background/60 border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                            }`}
                          >
                            <span
                              className={`text-[8px] font-bold px-1 py-0.2 rounded ${
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
                            <span className="truncate max-w-[120px]">
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
                  </div>
                )}

                {/* Consumers */}
                {srvConsumedEvents.length > 0 && (
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-border/30">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Event Consumers
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {srvConsumedEvents.map((ev) => {
                        const isChecked = connectedEvIds.includes(ev.id);
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => onToggleGlobalEvent(srv.id, ev.id)}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono transition-all border text-left ${
                              isChecked
                                ? "bg-purple-500/15 border-purple-500/40 text-purple-200 shadow-sm ring-1 ring-purple-500/20"
                                : "bg-background/60 border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                            }`}
                          >
                            <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-amber-500/20 text-amber-300">
                              ⚡ CONSUMER
                            </span>
                            <span className="truncate max-w-[120px]">
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
                  </div>
                )}

                {srvEndpoints.length === 0 && srvConsumedEvents.length === 0 && (
                  <span className="text-[11px] text-muted-foreground/60 italic">
                    No endpoints or consumers configured in this service.
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

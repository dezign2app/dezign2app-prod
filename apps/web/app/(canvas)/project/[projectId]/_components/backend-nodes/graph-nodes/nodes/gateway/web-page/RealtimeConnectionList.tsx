import React, { useMemo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Plus, Settings, Trash, Radio, AlertCircle } from "lucide-react";
import { BackendNode, RealtimeConnection, ClientDeliveryProtocol, PipelineStep } from "@workspace/canvas/types";
import { cn } from "@workspace/ui/lib/utils";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { generateId } from "../../../common";

export interface RealtimeConnectionListProps {
  nodeId: string;
  connections?: RealtimeConnection[];
  updateNode: (id: string, changes: Partial<BackendNode>) => void;
  data: BackendNode["data"];
}

interface MergedConnection extends RealtimeConnection {
  isDerived?: boolean;
}

export const RealtimeConnectionList: React.FC<RealtimeConnectionListProps> = ({
  nodeId,
  connections = [],
  updateNode,
  data,
}) => {
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const events = useBackendCanvasStore((s) => s.events);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);

  // Derive any connections targeted at this page via push_to_client pipeline steps
  const derivedConnections = useMemo(() => {
    const derived: MergedConnection[] = [];

    const checkSteps = (
      steps: PipelineStep[] | undefined,
      sourceNodeId: string,
      sourceItemName: string,
      sourceItemId: string,
      sourceItemType: "endpoint" | "event",
    ) => {
      if (!steps) return;
      for (const step of steps) {
        if (
          step.type === "push_to_client" &&
          step.clientDeliveryTargetPageId === nodeId
        ) {
          const sourceNode = nodes.find((n) => n.id === sourceNodeId);
          derived.push({
            id: step.id,
            protocol: (step.clientDeliveryProtocol as ClientDeliveryProtocol) || "SSE",
            eventName: step.clientDeliveryEventName,
            room: step.clientDeliveryRoom,
            description: sourceItemName || step.name,
            sourceServiceNodeId: sourceNodeId,
            sourceServiceLabel: (sourceNode?.data?.label as string) || sourceNode?.type || "Service",
            sourceEventId: sourceItemId,
            sourceItemName,
            sourceItemType,
            isDerived: true,
          });
        }
        if (step.thenSteps) checkSteps(step.thenSteps, sourceNodeId, sourceItemName, sourceItemId, sourceItemType);
        if (step.elseSteps) checkSteps(step.elseSteps, sourceNodeId, sourceItemName, sourceItemId, sourceItemType);
        if (step.trySteps) checkSteps(step.trySteps, sourceNodeId, sourceItemName, sourceItemId, sourceItemType);
        if (step.catchSteps) checkSteps(step.catchSteps, sourceNodeId, sourceItemName, sourceItemId, sourceItemType);
        if (step.loopBody) checkSteps(step.loopBody, sourceNodeId, sourceItemName, sourceItemId, sourceItemType);
        if (step.switchCases) {
          step.switchCases.forEach((c) => checkSteps(c.steps, sourceNodeId, sourceItemName, sourceItemId, sourceItemType));
        }
        if (step.switchDefault) checkSteps(step.switchDefault, sourceNodeId, sourceItemName, sourceItemId, sourceItemType);
        if (step.parallelBranches) {
          step.parallelBranches.forEach((b) => checkSteps(b.steps, sourceNodeId, sourceItemName, sourceItemId, sourceItemType));
        }
      }
    };

    // 1. Check all consumed / published events
    events.forEach((ev) => {
      if (ev.pipelineSteps && ev.nodeId) {
        checkSteps(ev.pipelineSteps as PipelineStep[], ev.nodeId, ev.name || "Event", ev.id, "event");
      }
    });

    // 2. Check all endpoints
    endpoints.forEach((ep) => {
      if (ep.pipelineSteps && ep.nodeId) {
        checkSteps(ep.pipelineSteps as PipelineStep[], ep.nodeId, ep.name || "Endpoint", ep.id, "endpoint");
      }
    });

    return derived;
  }, [nodeId, nodes, events, endpoints]);

  // Merge manual and derived connections, avoiding duplicates with matching IDs
  const allConnections = useMemo(() => {
    const derivedIds = new Set(derivedConnections.map((d) => d.id));
    const manualOnly = connections
      .filter((c) => !derivedIds.has(c.id))
      .map((c) => ({
        ...c,
        isDerived: false,
        sourceServiceNodeId: undefined,
        sourceServiceLabel: undefined,
        sourceItemName: undefined,
        sourceItemType: undefined,
      }));
    return [...derivedConnections, ...manualOnly];
  }, [derivedConnections, connections]);

  const handleAdd = () => {
    const newId = `rtc-${generateId()}`;
    const newConn: RealtimeConnection = {
      id: newId,
      protocol: "SSE",
      eventName: "message",
      description: "Real-time stream listener",
    };
    const nextList = [...connections, newConn];
    updateNode(nodeId, {
      data: {
        ...data,
        realtimeConnections: nextList,
      },
    });
    setActiveConfigItem({
      type: "realtimeConnection",
      id: newId,
      nodeId,
    });
  };

  const handleDelete = (connId: string) => {
    const nextList = connections.filter((c) => c.id !== connId);
    updateNode(nodeId, {
      data: {
        ...data,
        realtimeConnections: nextList,
      },
    });
  };

  const getProtocolBadge = (protocol: string, isConnected = true) => {
    if (!isConnected) {
      return (
        <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-destructive/15 text-destructive border border-destructive/30 shrink-0">
          {protocol}
        </span>
      );
    }
    switch (protocol) {
      case "SSE":
        return (
          <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30 shrink-0">
            SSE
          </span>
        );
      case "WEBSOCKET":
      case "WS":
        return (
          <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-cyan-500/15 text-cyan-500 border border-cyan-500/30 shrink-0">
            WS
          </span>
        );
      case "WEBRTC":
      case "RTC":
        return (
          <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-purple-500/15 text-purple-500 border border-purple-500/30 shrink-0">
            RTC
          </span>
        );
      case "POLLING":
      case "POLL":
        return (
          <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-blue-500/15 text-blue-500 border border-blue-500/30 shrink-0">
            POLL
          </span>
        );
      case "API_PUSH":
      case "PUSH":
        return (
          <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 shrink-0">
            PUSH
          </span>
        );
      default:
        return (
          <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border shrink-0">
            {protocol}
          </span>
        );
    }
  };

  return (
    <>
      <div className="px-3 py-1 bg-secondary/40 border-t border-b text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex justify-between items-center group">
        <div className="flex items-center gap-1.5">
          <Radio size={11} className="text-primary/70" />
          <span>Real-Time Connections</span>
          {allConnections.length > 0 && (
            <span className="text-[9px] bg-primary/10 text-primary px-1 rounded-full font-mono">
              {allConnections.length}
            </span>
          )}
        </div>
        <div
          className="opacity-0 group-hover:opacity-100 cursor-pointer text-muted-foreground hover:text-foreground transition-all"
          onClick={handleAdd}
          title="Add Real-Time Connection"
        >
          <Plus size={12} />
        </div>
      </div>

      <div className="flex flex-col">
        {allConnections.length === 0 ? (
          <div className="px-3 py-2 text-[10px] text-muted-foreground/60 italic">
            No real-time connections. Add listener or target from service pipeline.
          </div>
        ) : (
          allConnections.map((item) => {
            const isConnected = Boolean(item.isDerived);

            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between px-3 py-1.5 border-b text-xs relative group/row transition-colors nodrag",
                  isConnected
                    ? "border-border/40 hover:bg-secondary/20"
                    : "border-destructive/30 bg-destructive/10 hover:bg-destructive/15",
                )}
              >
                {/* Target handle for visualizing real-time push incoming flow */}
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`rtc-in-${item.id}`}
                  className={cn(
                    "w-2 h-2 -left-1 transition-colors",
                    isConnected
                      ? "!bg-violet-500"
                      : "!bg-destructive ring-2 ring-destructive/50 shadow-xs",
                  )}
                  style={{ top: "50%" }}
                />

                <div
                  className="flex items-center gap-1.5 overflow-hidden flex-1 cursor-pointer"
                  onClick={() =>
                    setActiveConfigItem({
                      type: "realtimeConnection",
                      id: item.id,
                      nodeId,
                    })
                  }
                >
                  {getProtocolBadge(item.protocol, isConnected)}
                  {isConnected && item.sourceItemType && (
                    <span
                      className={cn(
                        "text-[8px] font-bold px-1 py-0.2 rounded font-mono uppercase shrink-0",
                        item.sourceItemType === "endpoint"
                          ? "bg-blue-500/15 text-blue-500 border border-blue-500/30"
                          : "bg-amber-500/15 text-amber-500 border border-amber-500/30",
                      )}
                      title={item.sourceItemType === "endpoint" ? "HTTP Endpoint / API Route" : "Consumed Event Listener"}
                    >
                      {item.sourceItemType === "endpoint" ? "API" : "EVENT"}
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-xs truncate",
                      isConnected ? "font-medium text-foreground" : "font-semibold text-destructive",
                    )}
                    title={item.sourceItemName || item.eventName || "message"}
                  >
                    {item.sourceItemName || (item.eventName && item.eventName !== "message" ? item.eventName : undefined) || item.eventName || "message"}
                  </span>
                  {isConnected && item.sourceServiceLabel ? (
                    <span
                      className="text-[9px] px-1 py-0.2 rounded bg-secondary/80 text-muted-foreground font-mono truncate max-w-[100px]"
                      title={`Pushed by ${item.sourceItemType === "endpoint" ? "API" : "Event"} ${item.sourceItemName ? `"${item.sourceItemName}" on ` : ""}${item.sourceServiceLabel}`}
                    >
                      ← {item.sourceServiceLabel}
                    </span>
                  ) : (
                    <span
                      className="text-[8px] font-bold px-1.5 py-0.5 rounded font-mono uppercase bg-destructive/20 text-destructive border border-destructive/40 flex items-center gap-0.5 shrink-0"
                      title="Disconnected / Misconfigured: No backend service pipeline is currently pushing to this connection."
                    >
                      <AlertCircle size={8} /> DISCONNECTED
                    </span>
                  )}
                </div>

              <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-all shrink-0">
                <button
                  type="button"
                  className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveConfigItem({
                      type: "realtimeConnection",
                      id: item.id,
                      nodeId,
                    });
                  }}
                  title="Connection settings"
                >
                  <Settings size={11} />
                </button>
                {!item.isDerived && (
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                    title="Delete connection"
                  >
                    <Trash size={11} />
                  </button>
                )}
              </div>
            </div>
          );
        })
        )}
      </div>
    </>
  );
};

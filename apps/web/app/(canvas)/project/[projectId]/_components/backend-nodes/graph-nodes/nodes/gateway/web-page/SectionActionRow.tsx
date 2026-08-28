import React, { useState } from "react";
import { Position, Handle } from "@xyflow/react";
import { Play, Settings, Trash } from "lucide-react";
import { BackendNode, Endpoint, UIEventItem, PageSection } from "@/types/canvas";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { WEB_PAGE_EVENTS } from "@workspace/canvas";

const EVENT_OPTIONS = [...WEB_PAGE_EVENTS];

export interface SectionActionRowProps {
  nodeId: string;
  sectionId: string;
  action: UIEventItem;
  sections: PageSection[];
  updateSections: (sections: PageSection[]) => void;
  getLinkedEndpoint: (actionId: string) => { targetNode: BackendNode; endpoint: Endpoint } | null;
  onTriggerEvent: (triggerInfo: { event: UIEventItem; targetNode: BackendNode; endpoint: Endpoint }) => void;
}

export const SectionActionRow = ({
  nodeId,
  sectionId,
  action,
  sections,
  updateSections,
  getLinkedEndpoint,
  onTriggerEvent,
}: SectionActionRowProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(action.name || "");
  const [editEvent, setEditEvent] = useState(action.event || "click");
  const [customEvent, setCustomEvent] = useState("");

  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);

  const evtStr = (action.event as string) || "";
  const evtLower = evtStr.toLowerCase();
  const isPageLoad = evtStr === "pageLoad";
  const isSse = evtStr === "sse" || evtStr === "sseMessage" || evtLower === "sse";
  const isWebsocket =
    evtStr === "websocket" ||
    evtStr === "ws" ||
    evtStr === "websocketMessage" ||
    evtLower === "websocket" ||
    evtLower === "ws";
  const isWebrtc = evtStr === "webrtc" || evtLower === "webrtc";
  const isPolling = evtStr === "polling" || evtLower === "polling";

  const link = getLinkedEndpoint(action.id);

  const handleUpdate = (name: string, event: string) => {
    const defaultNavType: "link" | "router" = "link";
    const updatedSections = sections.map((sec) => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        actions: sec.actions.map((act) =>
          act.id === action.id
            ? {
                ...act,
                name,
                event,
                ...(event === "navigateToPage" ? { navigationType: defaultNavType } : {}),
              }
            : act,
        ),
      };
    });
    updateSections(updatedSections);
  };

  const handleDelete = () => {
    const store = useBackendCanvasStore.getState();
    const existingEdge = store.edges.find(
      (e) => e.source === nodeId && e.sourceHandle === `events-${action.id}`,
    );
    if (existingEdge) {
      const targetNode = store.nodes.find((n) => n.id === existingEdge.target);
      store.deleteEdge(existingEdge.id);
      if (targetNode && targetNode.type === "page_ref") {
        const remainingEdges = store.edges.filter(
          (e) => e.target === targetNode.id && e.id !== existingEdge.id,
        );
        if (remainingEdges.length === 0) {
          store.deleteNode(targetNode.id);
        }
      }
    }

    const updatedSections = sections.map((sec) => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        actions: sec.actions.filter((act) => act.id !== action.id),
      };
    });
    updateSections(updatedSections);
  };

  const saveAction = () => {
    const finalEvent = editEvent === "other" ? customEvent : editEvent;
    const finalName = editName.trim() || "Unnamed Action";
    const trimmedEvent = finalEvent.trim();
    handleUpdate(finalName, trimmedEvent);
    setIsEditing(false);

    const store = useBackendCanvasStore.getState();
    const existingEdge = store.edges.find(
      (e) => e.source === nodeId && e.sourceHandle === `events-${action.id}`,
    );

    if (trimmedEvent === "navigateToPage") {
      if (!existingEdge) {
        const currentNode = store.nodes.find((n) => n.id === nodeId);
        const pos = currentNode?.position || { x: 100, y: 100 };
        const newRefId = crypto.randomUUID();

        store.addNode({
          id: newRefId,
          type: "page_ref",
          position: { x: pos.x + 320, y: pos.y + 50 },
          data: {
            label: "Page Ref",
            description: "Target page reference for navigation",
          },
        });

        store.addEdge({
          id: `edge-${Date.now()}`,
          source: nodeId,
          target: newRefId,
          sourceHandle: `events-${action.id}`,
          targetHandle: "page-ref-in",
          type: "connection",
        });
      }
    } else if (existingEdge) {
      const targetNode = store.nodes.find((n) => n.id === existingEdge.target);
      store.deleteEdge(existingEdge.id);
      if (targetNode && targetNode.type === "page_ref") {
        const remainingEdges = store.edges.filter(
          (e) => e.target === targetNode.id && e.id !== existingEdge.id,
        );
        if (remainingEdges.length === 0) {
          store.deleteNode(targetNode.id);
        }
      }
    }
  };

  const getEventBadge = () => {
    if (isSse) {
      return (
        <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">
          SSE
        </span>
      );
    }
    if (isWebsocket) {
      return (
        <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">
          WS
        </span>
      );
    }
    if (isWebrtc) {
      return (
        <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-purple-500/15 text-purple-500 border border-purple-500/30">
          RTC
        </span>
      );
    }
    if (isPolling) {
      return (
        <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-blue-500/15 text-blue-500 border border-blue-500/30">
          POLL
        </span>
      );
    }
    return (
      <span className="text-[8px] text-muted-foreground font-mono truncate">
        {action.event || action.name || "click"}
      </span>
    );
  };

  return (
    <div className="flex flex-col px-3 py-1.5 border-b border-border/40 text-xs relative group/row hover:bg-secondary/20 nodrag">
      {/* Right outgoing event handle */}
      <Handle
        type="source"
        position={Position.Right}
        id={`events-${action.id}`}
        className="w-2 h-2 -right-1"
        style={{ top: "50%" }}
      />

      {/* Protocol / Inbound Left handles */}
      {isPageLoad && (
        <Handle
          type="target"
          position={Position.Left}
          id={`pageload-in-${action.id}`}
          className="w-2 h-2 -left-1 !bg-emerald-500"
          style={{ top: "50%" }}
        />
      )}
      {isSse && (
        <Handle
          type="target"
          position={Position.Left}
          id={`sse-in-${action.id}`}
          className="w-2 h-2 -left-1 !bg-amber-500"
          style={{ top: "50%" }}
        />
      )}
      {isWebsocket && (
        <Handle
          type="target"
          position={Position.Left}
          id={`websocket-in-${action.id}`}
          className="w-2 h-2 -left-1 !bg-cyan-500"
          style={{ top: "50%" }}
        />
      )}
      {isWebrtc && (
        <Handle
          type="target"
          position={Position.Left}
          id={`webrtc-in-${action.id}`}
          className="w-2 h-2 -left-1 !bg-purple-500"
          style={{ top: "50%" }}
        />
      )}

      {isEditing ? (
        <div
          className="flex flex-col gap-1.5 w-full"
          onBlur={(e) => {
            const related = e.relatedTarget as HTMLElement | null;
            if (related?.closest('[role="combobox"]')) return;
            if (related?.closest('[role="listbox"]')) return;
            if (related?.closest("[data-radix-popper-content-wrapper]")) return;

            if (!e.currentTarget.contains(related)) {
              saveAction();
            }
          }}
        >
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Action name (e.g. submitForm)"
            className="h-6 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") saveAction();
              if (e.key === "Escape") setIsEditing(false);
            }}
          />
          <div className="flex items-center gap-1">
            <Select value={editEvent} onValueChange={(v) => setEditEvent(v)}>
              <SelectTrigger className="h-6 text-xs w-full bg-background focus:ring-1 focus:ring-ring focus:ring-offset-0">
                <SelectValue placeholder="Event type" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt} className="text-xs">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {editEvent === "other" && (
              <Input
                value={customEvent}
                onChange={(e) => setCustomEvent(e.target.value)}
                placeholder="Custom event"
                className="h-6 text-xs w-full"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveAction();
                  if (e.key === "Escape") setIsEditing(false);
                }}
              />
            )}
          </div>
        </div>
      ) : (
        <div
          className="flex items-center justify-between w-full cursor-pointer gap-2"
          onClick={() => {
            setIsEditing(true);
            setEditName(action.name || "");
            const evt = action.event || "click";
            const isStandard = (EVENT_OPTIONS as readonly string[]).includes(evt);
            setEditEvent(isStandard ? evt : evt ? "other" : "click");
            setCustomEvent(isStandard ? "" : evt);
          }}
        >
          <div className="flex flex-col gap-0.5 overflow-hidden">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-medium text-xs truncate">{action.name}</span>
              {getEventBadge()}
            </div>
          </div>
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {link && (
              <button
                type="button"
                className="flex items-center justify-center p-1 rounded hover:bg-green-500/10 text-green-500 transition-all cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onTriggerEvent({
                    event: action,
                    targetNode: link.targetNode,
                    endpoint: link.endpoint,
                  });
                }}
                title={`Trigger simulated request: ${link.endpoint.type || "GET"} ${link.endpoint.name}`}
              >
                <Play size={10} className="fill-green-600 text-green-600" />
              </button>
            )}
            <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-all">
              <button
                type="button"
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveConfigItem({
                    type: "pageEvent",
                    id: action.id,
                    nodeId,
                    sectionId,
                  });
                }}
                title="Action configuration"
              >
                <Settings size={11} />
              </button>
              <button
                type="button"
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                title="Delete action"
              >
                <Trash size={11} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

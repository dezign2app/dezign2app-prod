import React from "react";
import { NodeProps, Position, Handle } from "@xyflow/react";
import {
  Globe,
  Lock,
  Pencil,
  Settings,
  AlertCircle,
  Unlink,
} from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useRouter } from "next/navigation";
import {
  NodeHeader,
  useSimulationNodeState,
  getSimulationNodeBorderClass,
} from "../../common";
import { Textarea } from "@workspace/ui/components/textarea";
import { parsePageRoute } from "@workspace/canvas";
import { RealtimeConnection, ClientDeliveryProtocol } from "@workspace/canvas/types";
import { SectionList, RealtimeConnectionList } from "./web-page";
import { NodeDeletionDialog } from "@/app/(canvas)/project/[projectId]/_components/NodeDeletionDialog";

export const WebPageNode = ({
  id,
  data,
  selected,
}: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);
  const simulation = useSimulationNodeState(id);
  const borderClass = getSimulationNodeBorderClass(
    simulation,
    Boolean(selected),
  );
  const router = useRouter();
  const projectId = typeof window !== "undefined"
    ? window.location.pathname.split("/project/")[1]?.split("/")[0] ?? ""
    : "";

  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
  const [pendingRename, setPendingRename] = React.useState<{ oldLabel: string; newLabel: string } | null>(null);

  const handleRequestRename = React.useCallback(
    (newLabel: string) => {
      const oldLabel = data.label || "";
      const cleanNew = parsePageRoute(newLabel) || newLabel.trim();

      if (
        !oldLabel ||
        oldLabel.trim() === "" ||
        oldLabel === "page-server" ||
        oldLabel === "Untitled" ||
        oldLabel === "Page"
      ) {
        updateNode(id, { data: { ...data, label: cleanNew } });
        return;
      }

      const cleanOld = parsePageRoute(oldLabel);

      if (cleanOld === cleanNew) return;

      if (!cleanOld || cleanOld === "page-server" || cleanOld === "Untitled" || cleanOld === "Page") {
        updateNode(id, { data: { ...data, label: cleanNew } });
        return;
      }

      setPendingRename({ oldLabel: cleanOld, newLabel: cleanNew });
      setRenameDialogOpen(true);
    },
    [data, id, updateNode],
  );

  // Find incoming WebApp edge connecting to this page
  const incomingEdge = edges.find((e) => {
    const isTarget = e.target === id;
    const isSource = e.source === id;
    if (!isTarget && !isSource) return false;
    const otherId = isSource ? e.target : e.source;
    const otherNode = nodes.find((n) => n.id === otherId);
    return otherNode?.type === "webApp";
  });

  const connectedWebAppNode = incomingEdge
    ? nodes.find(
        (n) =>
          n.type === "webApp" &&
          (n.id === incomingEdge.source || n.id === incomingEdge.target),
      )
    : null;

  const isDisconnected = !connectedWebAppNode;

  // Find section name from handleId
  let connectedZoneName: string | null = null;
  let isZoneProtected = false;
  if (connectedWebAppNode && incomingEdge) {
    const handleId =
      incomingEdge.source === connectedWebAppNode.id
        ? incomingEdge.sourceHandle
        : incomingEdge.targetHandle;
    const defaultZones = [
      { handleId: "public-in", name: "Public Section", accessType: "public" },
      { handleId: "private-in", name: "Private Section", accessType: "protected" },
    ];
    const zones =
      connectedWebAppNode.data?.zones && connectedWebAppNode.data.zones.length > 0
        ? connectedWebAppNode.data.zones
        : defaultZones;
    const matchedZone = zones.find(
      (z: { handleId: string; name: string; accessType?: string }) =>
        z.handleId === handleId,
    );
    if (matchedZone) {
      connectedZoneName = matchedZone.name;
      isZoneProtected =
        matchedZone.accessType === "protected" ||
        matchedZone.handleId === "private-in" ||
        matchedZone.name.toLowerCase().includes("private") ||
        matchedZone.name.toLowerCase().includes("protect");
    } else if (handleId === "public-in") {
      connectedZoneName = "Public Section";
      isZoneProtected = false;
    } else if (handleId === "private-in") {
      connectedZoneName = "Private Section";
      isZoneProtected = true;
    }
  }

  const isCustomOverride = Boolean(
    data.useZoneDefault === false || data.protectionOverride,
  );

  const isProtected = isCustomOverride
    ? (data.accessType && data.accessType !== "public") ||
      Boolean(data.protectionOverride)
    : connectedWebAppNode
    ? isZoneProtected
    : Boolean(
        connectedZoneName?.toLowerCase().includes("private") ||
          connectedZoneName?.toLowerCase().includes("protected") ||
          (data.accessType && data.accessType !== "public"),
      );

  // Auto-sanitize existing labels with spaces to valid Next.js route format
  React.useEffect(() => {
    if (data.label && (data.label.includes(" ") || data.label !== parsePageRoute(data.label))) {
      const parsed = parsePageRoute(data.label);
      if (parsed !== data.label) {
        updateNode(id, { data: { ...data, label: parsed } });
      }
    }
  }, [id, data.label, updateNode]);

  // One-time migration: safely migrate any legacy SSE/WS/WebRTC/Polling actions from sections to realtimeConnections
  React.useEffect(() => {
    if (!data.sections || data.sections.length === 0) return;
    const rtEventTypes = new Set(["sse", "websocket", "ws", "webrtc", "polling", "ssemessage", "websocketmessage"]);
    let found = false;
    const migrated: RealtimeConnection[] = [...(data.realtimeConnections || [])];

    const nextSections = data.sections.map((sec) => {
      const remainingActions = sec.actions.filter((act) => {
        const evtLower = (act.event || "").toLowerCase();
        if (rtEventTypes.has(evtLower)) {
          found = true;
          let proto: ClientDeliveryProtocol | "POLLING" = "SSE";
          if (evtLower.includes("ws") || evtLower.includes("websocket")) proto = "WEBSOCKET";
          else if (evtLower.includes("webrtc")) proto = "WEBRTC";
          else if (evtLower.includes("polling")) proto = "POLLING";

          if (!migrated.some((m) => m.id === act.id)) {
            migrated.push({
              id: act.id,
              protocol: proto,
              eventName: act.name || "message",
              description: act.description,
            });
          }
          return false;
        }
        return true;
      });
      return { ...sec, actions: remainingActions };
    });

    if (found) {
      updateNode(id, {
        data: {
          ...data,
          sections: nextSections,
          realtimeConnections: migrated,
        },
      });
    }
  }, [id, data, updateNode]);

  const rawLabel = data.label || "";
  const normalizedLabel = parsePageRoute(rawLabel);
  const cleanLabel = normalizedLabel.toLowerCase();
  const isLandingPage =
    data.isRoot === true ||
    cleanLabel === "/";

  const displayRoute = isLandingPage
    ? "/"
    : data.label
      ? data.label.startsWith("/")
        ? data.label
        : `/${data.label}`
      : "/";

  const isLocked = Boolean(data.aiEditing);

  return (
    <div
      className={cn(
        "shadow-md rounded-xl bg-card border-2 min-w-[240px] max-w-[320px] flex flex-col transition-all duration-300 relative",
        isLocked
          ? "border-violet-500/80 ring-2 ring-violet-500/30"
          : isDisconnected
            ? cn(
                "border-destructive/80 ring-1 ring-destructive/30 shadow-destructive/5",
                selected && "ring-2 ring-destructive/60 border-destructive",
              )
            : borderClass,
      )}
    >
      {/* Target handle from WebApp Section */}
      <Handle
        type="target"
        position={Position.Left}
        id="page-in"
        className={cn(
          "w-2.5 h-2.5 rounded-full border-2 border-background -left-1.5",
          isDisconnected ? "!bg-destructive animate-pulse" : "!bg-indigo-500",
        )}
        style={{ top: "18px" }}
        title={isDisconnected ? "Connect to a WebApp node section handle" : "Connected to WebApp"}
      />

      <NodeHeader
        id={id}
        data={data}
        nodeType="webPage"
        icon={Globe}
        title={isLandingPage ? "Landing Page" : "Web Page"}
        selected={selected}
        onSave={handleRequestRename}
        rightElement={
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {isDisconnected && !isLocked && (
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/30 text-[9px] font-semibold shrink-0"
                title="Disconnected: Not attached to any WebApp. Connect to a WebApp node to compile this page."
              >
                <Unlink size={10} className="shrink-0" />
                <span>Disconnected</span>
              </div>
            )}
            {data.pageSourceCode && !isLocked && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                AI-edited
              </span>
            )}
            {isLocked ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateNode(id, { data: { ...data, aiEditing: false } });
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/15 hover:bg-destructive/20 text-violet-600 dark:text-violet-400 hover:text-destructive border border-violet-500/30 text-[10px] font-mono shrink-0 cursor-pointer transition-colors"
                title="Locked: AI is actively editing this page. Click to force unlock."
              >
                <Lock size={10} className="shrink-0" />
                <span className="text-[9px] font-semibold">Locked</span>
              </button>
            ) : isProtected ? (
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-[10px] font-mono shrink-0"
                title="Protected Page (Authentication Required)"
              >
                <Lock size={10} className="shrink-0" />
              </div>
            ) : null}
          </div>
        }
      />

      {/* Disconnected error banner */}
      {isDisconnected && (
        <div className="px-3 py-1.5 bg-destructive/10 border-b border-destructive/25 flex items-center gap-1.5 text-[10px] text-destructive font-medium leading-tight nodrag">
          <AlertCircle size={12} className="shrink-0 text-destructive animate-pulse" />
          <span>Connect to a WebApp node to build</span>
        </div>
      )}

      {/* Edit UI & Page settings button strip */}
      <div className="px-3 py-1.5 border-b bg-muted/30 flex items-center justify-between nodrag">
        <span
          className="text-[10px] text-muted-foreground font-mono truncate"
          title={`Route: ${displayRoute}`}
        >
          {displayRoute}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {/* Page config / settings gear */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveConfigItem({ type: "webPage", id, nodeId: id });
            }}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            title="Page settings & configuration"
          >
            <Settings size={12} />
          </button>

          {/* Edit UI (visual page editor) */}
          <button
            type="button"
            disabled={isLocked}
            onClick={(e) => {
              e.stopPropagation();
              if (projectId) router.push(`/project/${projectId}/pages/${id}`);
            }}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all",
              isLocked
                ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
                : "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 border border-indigo-500/20 cursor-pointer",
            )}
            title={isLocked ? "Locked: AI is actively editing this page" : "Open visual page editor"}
          >
            {isLocked ? <Lock size={10} /> : <Pencil size={10} />}
            {isLocked ? "Locked" : "Edit UI"}
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="px-3 py-2 bg-secondary/5 border-b nodrag">
        <Textarea
          className="min-h-[20px] text-xs bg-transparent border-none shadow-none p-1 resize-none focus-visible:ring-0 placeholder:text-muted-foreground/50 disabled:opacity-60"
          placeholder="description"
          disabled={isLocked}
          value={data.description || ""}
          onChange={(e) =>
            updateNode(id, { data: { ...data, description: e.target.value } })
          }
        />
      </div>

      {/* Parameters Strip */}
      {(Boolean(data.headers?.length) ||
        Boolean(data.queryParams?.length) ||
        Boolean(data.pathParams?.length) ||
        Boolean(data.requestBody?.rawJson || data.requestBody?.fields?.length)) && (
        <div className="px-3 py-1 bg-secondary/15 border-b flex flex-wrap items-center gap-1.5 nodrag text-[9px]">
          {Boolean(data.headers?.length) && (
            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-medium border border-blue-500/20">
              {data.headers!.length} {data.headers!.length === 1 ? "header" : "headers"}
            </span>
          )}
          {Boolean(data.queryParams?.length) && (
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-medium border border-indigo-500/20">
              {data.queryParams!.length} {data.queryParams!.length === 1 ? "query param" : "query params"}
            </span>
          )}
          {Boolean(data.requestBody?.rawJson || data.requestBody?.fields?.length) && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-medium border border-emerald-500/20">
              Body Schema
            </span>
          )}
        </div>
      )}

      {/* Sections & Actions */}
      <SectionList
        nodeId={id}
        sections={data.sections}
        updateNode={updateNode}
        data={data}
        onTriggerEvent={(triggerInfo) =>
          useBackendCanvasStore.getState().setActiveConfigItem({
            type: "eventTesting",
            id: triggerInfo.event.id,
            nodeId: id,
            targetNodeId: triggerInfo.targetNode.id,
            endpointId: triggerInfo.endpoint.id,
            initialTab: "trigger",
          })
        }
      />

      {/* Real-Time Connections (SSE, WebSocket, WebRTC, Polling) */}
      <RealtimeConnectionList
        nodeId={id}
        connections={data.realtimeConnections}
        updateNode={updateNode}
        data={data}
      />

      {/* Page Rename / File Deletion Confirmation Dialog */}
      {pendingRename && (
        <NodeDeletionDialog
          open={renameDialogOpen}
          onOpenChange={(open) => {
            setRenameDialogOpen(open);
            if (!open) setPendingRename(null);
          }}
          projectId={projectId}
          deletionTarget={{
            type: "pageRename",
            nodeId: id,
            oldLabel: pendingRename.oldLabel,
            newLabel: pendingRename.newLabel,
            onConfirm: () => {
              updateNode(id, { data: { ...data, label: pendingRename.newLabel } });
              setPendingRename(null);
            },
          }}
        />
      )}
    </div>
  );
};


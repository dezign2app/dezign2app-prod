import React from "react";
import { NodeProps, Position, Handle } from "@xyflow/react";
import {
  Globe,
  Lock,
  Pencil,
  Loader2,
  Settings2,
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
import { SectionList } from "./web-page";

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
    : isZoneProtected ||
      Boolean(
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

  const rawLabel = data.label || "";
  const normalizedLabel = parsePageRoute(rawLabel);
  const cleanLabel = normalizedLabel.toLowerCase();
  const isLandingPage =
    data.isRoot === true ||
    cleanLabel === "/" ||
    cleanLabel === "home" ||
    cleanLabel === "index" ||
    cleanLabel === "landing" ||
    cleanLabel === "landing-page" ||
    cleanLabel === "root";

  const displayRoute = isLandingPage
    ? "/"
    : data.label
      ? data.label.startsWith("/")
        ? data.label
        : `/${data.label}`
      : "/page-client";

  const isLocked = Boolean(data.aiEditing);

  return (
    <div
      className={cn(
        "shadow-md rounded-xl bg-card border-2 min-w-[240px] max-w-[320px] flex flex-col transition-all duration-300 relative",
        isLocked
          ? "border-violet-500/80 ring-2 ring-violet-500/30"
          : borderClass,
      )}
    >
      {/* Target handle from WebApp Section */}
      <Handle
        type="target"
        position={Position.Left}
        id="page-in"
        className="w-2.5 h-2.5 !bg-indigo-500 rounded-full border-2 border-background -left-1.5"
        style={{ top: "18px" }}
        title="Connect from WebApp section handle"
      />

      {/* Target handle for incoming Hooks / Data layer */}
      <Handle
        type="target"
        position={Position.Left}
        id="hooks-in"
        className="w-2.5 h-2.5 !bg-cyan-500 rounded-full border-2 border-background -left-1.5"
        style={{ top: "36px" }}
        title="Connect Hook / Data Layer"
      />

      {/* Target handle for incoming UI Components / Layout Slots */}
      <Handle
        type="target"
        position={Position.Right}
        id="components-in"
        className="w-2.5 h-2.5 !bg-indigo-500 rounded-full border-2 border-background -right-1.5"
        style={{ top: "36px" }}
        title="Connect UI Component Slot"
      />

      <NodeHeader
        id={id}
        data={data}
        nodeType="webPage"
        icon={Globe}
        title={isLandingPage ? "Landing Page" : "Web Page"}
        selected={selected}
        rightElement={
          <div className="flex items-center gap-1 shrink-0 ml-2">
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
            <Settings2 size={12} />
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
    </div>
  );
};


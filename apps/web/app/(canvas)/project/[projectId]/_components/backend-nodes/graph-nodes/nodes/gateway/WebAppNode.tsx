import React, { useState } from "react";
import { NodeProps, Handle, Position } from "@xyflow/react";
import {
  Globe,
  Lock,
  Settings,
  ShieldCheck,
  Plus,
  Trash,
  LayoutTemplate,
} from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { WebAppZone } from "@workspace/canvas/types";
import { cn } from "@workspace/ui/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { NodeHeader } from "../../common";

const DEFAULT_REDIRECTS = {
  "no-auth": "/login",
  "no-org": "/select-org",
  "wrong-role": "/unauthorized",
  "no-access": "/pricing",
  "wrong-plan": "/pricing",
  default: "/login",
};

const DEFAULT_ZONES: WebAppZone[] = [
  {
    id: "zone-public",
    name: "Public Section",
    handleId: "public-in",
    accessType: "public",
    hasLayout: true,
    layoutDescription: "Public layout with top navigation bar, logo, and auth links",
    rule: {
      id: "rule-public",
      scope: "zone",
      conditions: { kind: "leaf", condition: { type: "auth", op: "signedOut" } },
      redirects: { ...DEFAULT_REDIRECTS },
    },
  },
  {
    id: "zone-private",
    name: "Private Section",
    handleId: "private-in",
    accessType: "protected",
    hasLayout: true,
    layoutDescription: "Protected app layout with sidebar navigation, user profile, and session check",
    rule: {
      id: "rule-private",
      scope: "zone",
      conditions: { kind: "leaf", condition: { type: "auth", op: "signedIn" } },
      redirects: { ...DEFAULT_REDIRECTS },
    },
  },
];

export const WebAppNode = ({
  id,
  data,
  selected,
}: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const setActiveConfigItem = useBackendCanvasStore(
    (s) => s.setActiveConfigItem,
  );
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);
  const deleteEdge = useBackendCanvasStore((s) => s.deleteEdge);
  const [zoneToDelete, setZoneToDelete] = useState<{ id: string; name: string } | null>(null);

  const appSlug =
    data.appSlug ||
    (data.label || "web-app").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const port = data.port || "3000";

  // Find connected Auth Node (via direct edge, handle, or authNodeId)
  const connectedAuthNode =
    (data.authNodeId
      ? nodes.find((n) => n.id === data.authNodeId && n.type === "auth")
      : null) ||
    (() => {
      const edge = edges.find((e) => {
        if (e.target === id) {
          const srcNode = nodes.find((n) => n.id === e.source);
          return (
            srcNode?.type === "auth" ||
            e.targetHandle === "auth-in" ||
            e.sourceHandle === "auth-out"
          );
        }
        if (e.source === id) {
          const tgtNode = nodes.find((n) => n.id === e.target);
          return (
            tgtNode?.type === "auth" ||
            e.sourceHandle === "auth-in" ||
            e.targetHandle === "auth-out"
          );
        }
        return false;
      });
      if (!edge) return null;
      const authId = edge.source === id ? edge.target : edge.source;
      return nodes.find((n) => n.id === authId && n.type === "auth") || null;
    })() ||
    null;

  const isAuthConnected = Boolean(connectedAuthNode);
  const authNodeLabel = connectedAuthNode?.data?.label || "Auth";

  // User-defined zones or default zones
  const zones: WebAppZone[] = Array.isArray(data.zones) ? data.zones : DEFAULT_ZONES;

  const handleDeleteZone = (zoneId: string) => {
    const updatedZones = zones.filter((z) => z.id !== zoneId);
    updateNode(id, { data: { ...data, zones: updatedZones } });

    // Clean up connected edges to this zone handle
    const targetZone = zones.find((z) => z.id === zoneId);
    if (targetZone) {
      const handleId = targetZone.handleId;
      const connectedEdges = edges.filter(
        (e) =>
          (e.target === id && e.targetHandle === handleId) ||
          (e.source === id && e.sourceHandle === handleId),
      );
      connectedEdges.forEach((e) => deleteEdge(e.id));
    }

    // Reset active config item if deleted zone was active
    const activeItem = useBackendCanvasStore.getState().activeConfigItem;
    if (activeItem?.id === zoneId) {
      setActiveConfigItem(null);
    }
  };

  const handleAddZone = () => {
    const newZoneId = `zone-${Date.now()}`;
    const newZone: WebAppZone = {
      id: newZoneId,
      name: `Custom Zone ${zones.length + 1}`,
      handleId: `${newZoneId}-in`,
      accessType: "protected",
      hasLayout: true,
      layoutDescription: "Custom route group layout",
      rule: {
        id: `rule-${newZoneId}`,
        scope: "zone",
        conditions: { kind: "leaf", condition: { type: "auth", op: "signedIn" } },
        redirects: { ...DEFAULT_REDIRECTS },
      },
    };
    updateNode(id, { data: { ...data, zones: [...zones, newZone] } });
  };

  const handleToggleZoneLayout = (zoneId: string, enabled?: boolean) => {
    const updatedZones = zones.map((z) => {
      if (z.id !== zoneId) return z;
      const nextVal = typeof enabled === "boolean" ? enabled : !(z.hasLayout ?? false);
      return {
        ...z,
        hasLayout: nextVal,
      };
    });
    updateNode(id, { data: { ...data, zones: updatedZones } });
  };

  // Helper to find connected WebClient page nodes for a given section handle
  const getConnectedPages = (sectionHandleId: string) => {
    const incomingEdges = edges.filter(
      (e) =>
        (e.target === id && e.targetHandle === sectionHandleId) ||
        (e.source === id && e.sourceHandle === sectionHandleId),
    );
    return incomingEdges
      .map((e) =>
        nodes.find((n) => n.id === (e.source === id ? e.target : e.source)),
      )
      .filter((n): n is BackendNode => Boolean(n));
  };

  return (
    <div
      className={cn(
        "shadow-xl rounded-xl bg-card border-2 min-w-[290px] max-w-[370px] flex flex-col transition-all duration-300 relative",
        selected ? "border-indigo-500" : "border-border",
      )}
    >
      {/* Main Auth Target Handle (Top Left) */}
      <Handle
        type="target"
        position={Position.Left}
        id="auth-in"
        className="w-3 h-3 !bg-indigo-500 rounded-full border-2 border-background -left-1.5"
        style={{ top: "18px" }}
        title="Connect AuthNode to bind backend authentication service"
      />

      {/* Node Header */}
      <NodeHeader
        id={id}
        data={data}
        nodeType="webApp"
        icon={Globe}
        title="Web App"
        selected={selected}
        rightElement={
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveConfigItem({
                  type: "webApp",
                  id,
                  nodeId: id,
                });
              }}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center text-[10px]"
              title="Configure Web App Settings & Packages"
            >
              <Settings size={13} />
            </button>
          </div>
        }
      />

      {/* App Meta Info Bar */}
      <div className="px-3 py-1.5 bg-muted border-b flex items-center justify-between gap-2 nodrag">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-mono text-muted-foreground truncate">
            apps/{appSlug}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono border border-border/50 shrink-0">
            :{port}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              if (connectedAuthNode) {
                setActiveConfigItem({
                  type: "auth",
                  id: connectedAuthNode.id,
                  nodeId: connectedAuthNode.id,
                });
              }
            }}
            className={cn(
              "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border transition-colors",
              isAuthConnected
                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20 cursor-pointer"
                : "bg-muted text-muted-foreground border-border/40",
            )}
            title={isAuthConnected ? `Wired to ${authNodeLabel}` : "No Auth connected"}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>
              {isAuthConnected ? `🔒 ${authNodeLabel}` : "⚠️ No Auth connected"}
            </span>
          </button>

          <button
            onClick={() =>
              setActiveConfigItem({
                type: "webApp",
                id,
                nodeId: id,
              })
            }
            className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="App Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Dynamic Protection Sections Container */}
      <div className="p-2.5 flex flex-col gap-2 bg-muted/60 opacity-100 nodrag">
        {zones.map((zone) => {
          const connectedPages = getConnectedPages(zone.handleId);
          const isPublic = zone.accessType === "public";
          const isLayoutEnabled = Boolean(zone.hasLayout);

          return (
            <div
              key={zone.id}
              className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-card border border-border/80 opacity-100 relative group"
            >
              {/* Dynamic Section Handle (Right) */}
              <Handle
                type="source"
                position={Position.Right}
                id={zone.handleId}
                className={cn(
                  "w-2.5 h-2.5 rounded-full border-2 border-background -right-4 opacity-100 cursor-pointer",
                  isPublic ? "!bg-muted-foreground" : "!bg-indigo-500",
                )}
                style={{ top: "50%" }}
                title={`Connect WebClient pages to ${zone.name}`}
              />

              {/* Zone Top Row */}
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5 truncate min-w-0">
                  {isPublic ? (
                    <Globe className="w-3.5 h-3.5 text-foreground shrink-0" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  )}
                  <span className="truncate">{zone.name}</span>
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Sleek Layout Toggle Switch */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleZoneLayout(zone.id);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-1 py-0.5 rounded text-[10px] font-medium transition-all duration-200 cursor-pointer select-none bg-transparent hover:bg-muted/40",
                      isLayoutEnabled
                        ? "text-indigo-400"
                        : "text-muted-foreground/60 hover:text-muted-foreground",
                    )}
                    title={
                      isLayoutEnabled
                        ? "Layout enabled for this section. Click to disable"
                        : "Layout disabled for this section. Click to enable"
                    }
                  >
                    <LayoutTemplate
                      className={cn(
                        "w-3 h-3 transition-colors",
                        isLayoutEnabled ? "text-indigo-400" : "text-muted-foreground/50",
                      )}
                    />
                    <span className="text-[9px] font-mono leading-none">Layout</span>
                    <span
                      className={cn(
                        "w-5 h-2.5 rounded-full transition-colors duration-200 relative flex items-center px-0.5",
                        isLayoutEnabled ? "bg-indigo-500" : "bg-muted-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full bg-white transition-transform duration-200 ease-in-out shadow-xs",
                          isLayoutEnabled ? "translate-x-2.5" : "translate-x-0",
                        )}
                      />
                    </span>
                  </button>

                  <button
                    onClick={() =>
                      setActiveConfigItem({
                        type: "zone",
                        id: zone.id,
                        nodeId: id,
                      })
                    }
                    className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title={`Configure rules & layout for ${zone.name}`}
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                  {!isPublic && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoneToDelete({ id: zone.id, name: zone.name });
                      }}
                      className="p-1 hover:bg-destructive/15 rounded text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                      title={`Delete ${zone.name}`}
                    >
                      <Trash className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Connected Page Pills */}
              <div className="flex flex-wrap gap-1 mt-1">
                {connectedPages.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground/70 italic">
                    Plug WebClient pages here
                  </span>
                ) : (
                  connectedPages.map((p) => (
                    <span
                      key={p.id}
                      className="text-[10px] px-2 py-0.5 rounded bg-secondary text-foreground font-mono border border-border"
                    >
                      {p.data.label || "Page"}
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}

        {/* Add Custom Section Button */}
        <button
          onClick={handleAddZone}
          className="flex items-center justify-center gap-1.5 p-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground bg-card/60 hover:bg-card border border-dashed border-border/80 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3" /> Add Protected Section
        </button>
      </div>

      {/* Delete Zone Confirmation Dialog */}
      <AlertDialog open={!!zoneToDelete} onOpenChange={(open) => !open && setZoneToDelete(null)}>
        <AlertDialogContent
          onClick={(e) => e.stopPropagation()}
          className="bg-[#111216] border-zinc-800 text-zinc-100 max-w-md shadow-2xl ring-1 ring-white/10"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100 font-semibold">
              Delete Section "{zoneToDelete?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 text-xs leading-relaxed">
              Are you sure you want to delete this access control section? Any connections from WebClient pages to this section handle will be unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setZoneToDelete(null)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 hover:text-zinc-100"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (zoneToDelete) {
                  handleDeleteZone(zoneToDelete.id);
                  setZoneToDelete(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
            >
              Delete Section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

import React from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Checkbox } from "@workspace/ui/components/checkbox";
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
import {
  Globe,
  Lock,
  Layers,
  ShieldCheck,
  Compass,
  Link2,
  ArrowRight,
  Plus,
  Trash2,
  Code2,
  CheckCircle2,
  Route,
  CornerDownRight,
} from "lucide-react";
import { WEB_CLIENT_EVENTS } from "@workspace/canvas";
import { UIEventItem } from "@/types/canvas";

const EVENT_OPTIONS = [...WEB_CLIENT_EVENTS];

export const WebClientConfig = ({
  id,
  nodeId,
}: {
  id: string;
  nodeId: string;
}) => {
  const node = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === nodeId),
  );
  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const allEdges = useBackendCanvasStore((s) => s.edges);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const addNode = useBackendCanvasStore((s) => s.addNode);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);
  const deleteEdge = useBackendCanvasStore((s) => s.deleteEdge);

  if (!node) return null;

  const data = node.data;

  const updateData = (changes: Partial<typeof data>) => {
    updateNode(nodeId, { data: { ...data, ...changes } });
  };

  const appName = data.appName || "Web App";
  const appSlug =
    data.appSlug ||
    appName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const useZoneDefault = data.useZoneDefault !== false;
  const accessType = data.accessType || "public";
  const allowedRoles = data.allowedRoles || [];
  const requiredPlans = data.requiredPlans || [];
  const allowedOrgRoles = data.allowedOrgRoles || [];
  const redirectTo =
    data.redirectTo ||
    (accessType === "payment-gated"
      ? "/pricing"
      : accessType === "org-gated"
      ? "/select-org"
      : "/login");

  const events: UIEventItem[] = data.events || [];

  // Available WebClient page nodes on canvas (excluding self)
  const pageNodes = allNodes.filter(
    (n) => n.type === "webClient" && n.id !== nodeId,
  );

  // Determine connected WebApp section name
  const incomingEdge = allEdges.find(
    (e) => e.target === nodeId || e.source === nodeId,
  );
  const connectedWebApp = incomingEdge
    ? allNodes.find(
        (n) =>
          n.type === "webApp" &&
          (n.id === incomingEdge.source || n.id === incomingEdge.target),
      )
    : null;

  let connectedZoneName: string | null = null;
  if (connectedWebApp && incomingEdge) {
    const handleId =
      incomingEdge.source === connectedWebApp.id
        ? incomingEdge.sourceHandle
        : incomingEdge.targetHandle;
    const zones = connectedWebApp.data?.zones || [];
    const matchedZone = zones.find((z) => z.handleId === handleId);
    if (matchedZone) {
      connectedZoneName = matchedZone.name;
    }
  }

  const handleAddEvent = () => {
    const newEvent: UIEventItem = {
      id: crypto.randomUUID(),
      name: "New Navigation Action",
      event: "navigateToPage",
      navigationType: "link",
      navigationCondition: "direct",
    };
    const updatedEvents = [...events, newEvent];
    updateData({ events: updatedEvents });
  };

  const handleUpdateEvent = (eventId: string, changes: Partial<UIEventItem>) => {
    const updatedEvents = events.map((ev) =>
      ev.id === eventId ? { ...ev, ...changes } : ev,
    );
    updateData({ events: updatedEvents });
  };

  const cleanupPageRefNodeForEvent = (eventId: string) => {
    const store = useBackendCanvasStore.getState();
    const existingEdge = store.edges.find(
      (e) => e.source === nodeId && e.sourceHandle === `events-${eventId}`,
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
  };

  const handleDeleteEvent = (eventId: string) => {
    cleanupPageRefNodeForEvent(eventId);
    const updatedEvents = events.filter((ev) => ev.id !== eventId);
    updateData({ events: updatedEvents });
  };

  const handleSpawnPageRefNode = (eventId: string) => {
    const pos = node.position || { x: 100, y: 100 };
    const newRefId = crypto.randomUUID();

    addNode({
      id: newRefId,
      type: "page_ref",
      position: { x: pos.x + 340, y: pos.y + 60 },
      data: {
        label: "Page Ref",
        description: "Target page reference for navigation",
      },
    });

    addEdge({
      id: `edge-${Date.now()}`,
      source: nodeId,
      target: newRefId,
      sourceHandle: `events-${eventId}`,
      targetHandle: "page-ref-in",
      type: "connection",
    });
  };

  return (
    <div className="flex flex-col gap-6 mt-6 pb-12 text-foreground font-sans">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-500 rounded border border-emerald-500/20 shadow-sm flex items-center gap-1">
            <Globe className="w-3 h-3" /> WEB CLIENT (PAGE)
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            {data.label || "Web Client Page"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure frontend page details, protection rule inheritance, and client routing & navigation conditions.
        </p>
      </div>

      {/* App & Zone Membership Section */}
      <div className="flex flex-col gap-4 p-4 rounded-xl bg-card border border-border/60 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Page & Section Membership</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Page Route Name</Label>
            <Input
              value={data.label || ""}
              onChange={(e) => updateData({ label: e.target.value })}
              placeholder="e.g. /dashboard/settings"
              className="h-8 text-xs bg-background/50 font-mono"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Target Monorepo App</Label>
            <Input
              value={appSlug}
              onChange={(e) => updateData({ appSlug: e.target.value })}
              placeholder="e.g. customer-portal"
              className="h-8 text-xs font-mono bg-background/50"
            />
          </div>
        </div>

        <div className="p-3 bg-muted/40 rounded-lg border border-border/50 flex items-center justify-between text-xs mt-1">
          <span className="text-muted-foreground">Connected WebApp Section:</span>
          <span className="font-mono font-semibold text-foreground">
            {connectedZoneName ? `🔒 ${connectedZoneName}` : "Unattached Page"}
          </span>
        </div>
      </div>

      {/* ── CLIENT NAVIGATION & CONDITIONAL ROUTING SECTION ── */}
      <div className="flex flex-col gap-4 p-4 rounded-xl bg-card border border-border/60 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Compass className="w-4 h-4 text-indigo-500" />
            <span>Page Navigation & Conditional Routing</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
            onClick={handleAddEvent}
          >
            <Plus size={12} className="mr-1 text-indigo-500" />
            Add Navigation Event
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Configure how client actions navigate between pages using static declarative Next.js <code className="font-mono text-indigo-500">&lt;Link&gt;</code> or programmatic/conditional <code className="font-mono text-indigo-500">useRouter().push()</code>.
        </p>

        {events.length === 0 ? (
          <div className="p-4 rounded-lg border border-dashed border-border/70 text-center flex flex-col items-center gap-2 bg-muted/20">
            <Route className="w-6 h-6 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">
              No navigation events configured for this page yet.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs mt-1"
              onClick={handleAddEvent}
            >
              <Plus size={12} className="mr-1" /> Add First Event
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {events.map((ev) => {
              const navType = ev.navigationType || "link";
              const navCond = ev.navigationCondition || "direct";

              // Check if connected to a PageRef node via an edge
              const connectedEdge = allEdges.find(
                (e) => e.source === nodeId && e.sourceHandle === `events-${ev.id}`,
              );
              const connectedPageRefNode = connectedEdge
                ? allNodes.find((n) => n.id === connectedEdge.target && n.type === "page_ref")
                : null;

              return (
                <div
                  key={ev.id}
                  className="flex flex-col gap-3 p-3.5 rounded-lg bg-muted/30 border border-border/60 hover:border-indigo-500/30 transition-all text-xs"
                >
                  {/* Event Name & Event Type */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Input
                        value={ev.name}
                        onChange={(e) =>
                          handleUpdateEvent(ev.id, { name: e.target.value })
                        }
                        placeholder="Action Name (e.g. NavigateToDashboard)"
                        className="h-7 text-xs font-medium bg-background"
                      />
                      <Select
                        value={ev.event || "navigateToPage"}
                        onValueChange={(v) => {
                          const navLinkType: "link" | "router" = "link";
                          handleUpdateEvent(ev.id, {
                            event: v,
                            ...(v === "navigateToPage" ? { navigationType: navLinkType } : {}),
                          });
                          if (v === "navigateToPage") {
                            if (!connectedEdge) {
                              handleSpawnPageRefNode(ev.id);
                            }
                          } else {
                            cleanupPageRefNodeForEvent(ev.id);
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs w-[140px] shrink-0 bg-background">
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
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleDeleteEvent(ev.id)}
                      title="Delete Navigation Event"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>

                  {/* Target Page Selection */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Globe size={10} className="text-indigo-500" /> Target Page / Route
                      </Label>
                      {connectedPageRefNode && (
                        <Badge variant="outline" className="text-[9px] font-mono bg-indigo-500/15 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shrink-0 flex items-center gap-1">
                          <CheckCircle2 size={10} /> Connected PageRef
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={
                          ev.targetPageId ||
                          connectedPageRefNode?.data?.targetPageId ||
                          connectedPageRefNode?.data?.pageRefId ||
                          ev.targetRoute ||
                          ""
                        }
                        onValueChange={(v) => {
                          const selectedP = pageNodes.find((p) => p.id === v);
                          const pageLabel = selectedP?.data?.label || "Page";
                          const cleanLabel = pageLabel.trim().toLowerCase();
                          const isRoot =
                            selectedP?.data?.isRoot === true ||
                            cleanLabel === "/" ||
                            cleanLabel === "home" ||
                            cleanLabel === "index" ||
                            cleanLabel === "landing";
                          const path = selectedP
                            ? isRoot
                              ? "/"
                              : `/${cleanLabel.replace(/\s+/g, "-")}`
                            : v;

                          handleUpdateEvent(ev.id, {
                            targetPageId: selectedP ? v : undefined,
                            targetRoute: path,
                          });

                          if (connectedPageRefNode) {
                            updateNode(connectedPageRefNode.id, {
                              data: {
                                ...connectedPageRefNode.data,
                                targetPageId: v,
                                pageRefId: v,
                                targetPageLabel: pageLabel,
                                label: `Ref: ${isRoot ? "/" : pageLabel}`,
                              },
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background flex-1">
                          <SelectValue placeholder="Select target web page..." />
                        </SelectTrigger>
                        <SelectContent>
                          {pageNodes.map((p) => {
                            const label = p.data?.label || "Untitled Page";
                            return (
                              <SelectItem key={p.id} value={p.id} className="text-xs">
                                📄 {label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>

                      {!connectedPageRefNode && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shrink-0"
                          onClick={() => handleSpawnPageRefNode(ev.id)}
                          title="Spawn & Connect PageRef node on canvas"
                        >
                          <Plus size={11} className="mr-1" /> Connect PageRef
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Protection Rule Inheritance / Override */}
      <div className="flex flex-col gap-4 p-4 rounded-xl bg-card border border-border/60 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Protection Rules</span>
          </div>
          <Select
            value={useZoneDefault ? "zone" : "custom"}
            onValueChange={(val) => updateData({ useZoneDefault: val === "zone" })}
          >
            <SelectTrigger className="h-8 text-xs w-[180px] bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zone" className="text-xs">
                Inherit Section Default Rules
              </SelectItem>
              <SelectItem value="custom" className="text-xs">
                Custom Override for This Page
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {useZoneDefault ? (
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs text-indigo-700 dark:text-indigo-300">
            <p className="font-semibold mb-1">Inheriting Section Rules:</p>
            <p className="text-[11px] text-muted-foreground">
              This page automatically inherits all access conditions and failure redirect routes configured on the parent WebApp Section.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-2 border-t border-border/40">
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Custom Access Type</Label>
              <Select
                value={accessType}
                onValueChange={(
                  val: "public" | "private" | "role-gated" | "payment-gated" | "org-gated",
                ) => {
                  const defaultRedirect =
                    val === "payment-gated"
                      ? "/pricing"
                      : val === "org-gated"
                      ? "/select-org"
                      : "/login";
                  updateData({ accessType: val, redirectTo: defaultRedirect });
                }}
              >
                <SelectTrigger className="h-9 text-xs font-medium bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public" className="text-xs">
                    🌐 Public (Open to anyone)
                  </SelectItem>
                  <SelectItem value="private" className="text-xs">
                    🔒 Private (Authenticated user session required)
                  </SelectItem>
                  <SelectItem value="role-gated" className="text-xs">
                    🛡️ Role-Gated (Specific user roles required)
                  </SelectItem>
                  <SelectItem value="payment-gated" className="text-xs">
                    💳 Payment-Gated (Active paid plan tier required)
                  </SelectItem>
                  <SelectItem value="org-gated" className="text-xs">
                    🏢 Organization-Gated (Active Organization required)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {accessType === "role-gated" && (
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">
                  Allowed Roles (comma-separated)
                </Label>
                <Input
                  value={allowedRoles.join(", ")}
                  onChange={(e) =>
                    updateData({
                      allowedRoles: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="e.g. admin, superadmin"
                  className="h-8 text-xs bg-background/50"
                />
              </div>
            )}

            {accessType === "payment-gated" && (
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">
                  Required Plan Tiers (comma-separated)
                </Label>
                <Input
                  value={requiredPlans.join(", ")}
                  onChange={(e) =>
                    updateData({
                      requiredPlans: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="e.g. pro, enterprise"
                  className="h-8 text-xs bg-background/50"
                />
              </div>
            )}

            {accessType !== "public" && (
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">
                  Unauthorized Redirect Target Route
                </Label>
                <Input
                  value={redirectTo}
                  onChange={(e) => updateData({ redirectTo: e.target.value })}
                  placeholder="e.g. /login, /pricing"
                  className="h-8 text-xs font-mono bg-background/50"
                />
              </div>
            )}
          </div>
        )}

        {/* Auth Page Checkbox */}
        <div className="flex items-center gap-2.5 pt-2 border-t border-border/40">
          <Checkbox
            id="isAuthPage"
            checked={Boolean(data.isAuthPage)}
            onCheckedChange={(val) => updateData({ isAuthPage: Boolean(val) })}
          />
          <Label htmlFor="isAuthPage" className="text-xs font-normal cursor-pointer">
            This page is the Login / Authentication entry page (unauthenticated target)
          </Label>
        </div>
      </div>
    </div>
  );
};

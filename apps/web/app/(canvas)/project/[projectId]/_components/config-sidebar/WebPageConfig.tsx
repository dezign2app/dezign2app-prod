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
  Layers,
  ShieldCheck,
  Compass,
  Plus,
  Trash2,
  CheckCircle2,
  Route,
  Sparkles,
} from "lucide-react";
import { WEB_PAGE_EVENTS, Endpoint } from "@workspace/canvas";
import { UIEventItem, Parameter, Schema, PageSection } from "@/types/canvas";
import { ParameterEditor } from "../backend-nodes/graph-nodes/Editors";
import { AuthAwarenessBanner } from "./AuthAwarenessBanner";
import { RequestBodyEditor, RequestBodyMode } from "./RequestBodyEditor";

const EVENT_OPTIONS = [...WEB_PAGE_EVENTS];

export const WebPageConfig = ({
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

  // Available WebPage nodes on canvas (excluding self)
  const pageNodes = allNodes.filter(
    (n) => (n.type === "webPage") && n.id !== nodeId,
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

  const isProtected =
    data.useZoneDefault === false
      ? data.accessType !== "public"
      : Boolean(
          connectedZoneName?.toLowerCase().includes("private") ||
            connectedZoneName?.toLowerCase().includes("protected") ||
            incomingEdge?.sourceHandle === "private-in" ||
            incomingEdge?.targetHandle === "private-in" ||
            (data.accessType && data.accessType !== "public"),
        );

  // Find connected service endpoint via any edge connected to this WebPage node
  const allEndpoints = useBackendCanvasStore((s) => s.endpoints);
  const connectedServiceEdge = allEdges.find(
    (e) =>
      (e.source === nodeId &&
        allNodes.some((n) => n.id === e.target && n.type === "service")) ||
      (e.target === nodeId &&
        allNodes.some((n) => n.id === e.source && n.type === "service")),
  );

  let connectedEndpoint: Endpoint | null = null;
  if (connectedServiceEdge) {
    const isSource = connectedServiceEdge.source === nodeId;
    const targetNodeId = isSource
      ? connectedServiceEdge.target
      : connectedServiceEdge.source;
    const targetHandle = isSource
      ? connectedServiceEdge.targetHandle
      : connectedServiceEdge.sourceHandle;
    const targetNode = allNodes.find((n) => n.id === targetNodeId);

    if (targetNode) {
      let endpointId = targetHandle
        ? targetHandle.replace(
            /^(endpoint-in-|endpoint-out-|endpoints-in-|endpoints-out-|events-in-|events-out-)/,
            "",
          )
        : undefined;

      if (endpointId && endpointId.includes("-in-")) {
        const parts = endpointId.split("-in-");
        endpointId = parts[parts.length - 1];
      }

      if (endpointId) {
        connectedEndpoint =
          allEndpoints.find(
            (ep) =>
              ep.nodeId === targetNode.id &&
              (ep.id === endpointId || ep.name === endpointId),
          ) ||
          (targetNode.data?.endpoints as Endpoint[] | undefined)?.find(
            (ep) => ep.id === endpointId || ep.name === endpointId,
          ) ||
          null;
      }

      if (!connectedEndpoint) {
        const srvEndpoints = allEndpoints.filter(
          (ep) => ep.nodeId === targetNode.id,
        );
        if (srvEndpoints.length > 0 && srvEndpoints[0]) {
          connectedEndpoint = srvEndpoints[0];
        } else if (
          targetNode.data?.endpoints &&
          (targetNode.data.endpoints as Endpoint[]).length > 0
        ) {
          connectedEndpoint = (targetNode.data.endpoints as Endpoint[])[0] || null;
        }
      }
    }
  }

  // Resolve live page-level parameters and request body
  const resolvedPageEndpointRequestBody: Schema | undefined = connectedEndpoint?.requestBody
    ? {
        id: connectedEndpoint.requestBody.id || crypto.randomUUID(),
        fields:
          connectedEndpoint.requestBody.fields && connectedEndpoint.requestBody.fields.length > 0
            ? connectedEndpoint.requestBody.fields
            : connectedEndpoint.params && connectedEndpoint.params.length > 0
            ? [...connectedEndpoint.params]
            : [],
        rawJson: connectedEndpoint.requestBody.rawJson || connectedEndpoint.body || "",
      }
    : connectedEndpoint?.body
    ? { id: connectedEndpoint.id || crypto.randomUUID(), rawJson: connectedEndpoint.body, fields: [] }
    : connectedEndpoint?.params && connectedEndpoint.params.length > 0
    ? { id: connectedEndpoint.id || crypto.randomUUID(), fields: [...connectedEndpoint.params] }
    : undefined;

  const hasCustomPageRequestBody = Boolean(
    data.requestBody &&
      ((data.requestBody.fields && data.requestBody.fields.length > 0) ||
        Boolean(data.requestBody.rawJson?.trim())),
  );

  const effectiveRequestBody: Schema = hasCustomPageRequestBody
    ? (data.requestBody as Schema)
    : resolvedPageEndpointRequestBody || data.requestBody || { id: crypto.randomUUID(), fields: [] };

  const isAuthEnabled = data.requireAuth !== false;

  const effectiveHeaders: Parameter[] = React.useMemo(() => {
    let baseHeaders =
      data.headers && data.headers.length > 0
        ? [...data.headers]
        : connectedEndpoint?.headers
        ? [...connectedEndpoint.headers]
        : [];

    if (isAuthEnabled) {
      if (!baseHeaders.some((h) => h.name.toLowerCase() === "authorization")) {
        baseHeaders = [
          {
            id: "auth-bearer-header",
            name: "Authorization",
            type: "string",
            required: true,
            description: "Bearer <token>",
            defaultValue: "Bearer <token>",
            key: "Authorization",
            value: "Bearer <token>",
          },
          ...baseHeaders,
        ];
      }
    } else {
      baseHeaders = baseHeaders.filter(
        (h) => h.name.toLowerCase() !== "authorization",
      );
    }
    return baseHeaders;
  }, [data.headers, connectedEndpoint?.headers, isAuthEnabled]);

  const effectivePathParams: Parameter[] =
    data.pathParams && data.pathParams.length > 0
      ? data.pathParams
      : connectedEndpoint?.pathParams || [];

  const effectiveQueryParams: Parameter[] =
    data.queryParams && data.queryParams.length > 0
      ? data.queryParams
      : connectedEndpoint?.queryParams || [];

  const effectiveRequestBodyMode: RequestBodyMode =
    data.requestBodyMode ??
    connectedEndpoint?.requestBodyMode ??
    (effectiveRequestBody.rawJson ? "raw_json" : "field_builder");

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
            <Globe className="w-3 h-3" /> WEB PAGE
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            {data.label || "Web Page"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure frontend page details, client API parameters, and navigation routing.
        </p>
      </div>

      {/* Auth awareness banner & Bearer token switch */}
      <AuthAwarenessBanner
        zoneName={connectedZoneName}
        isProtected={isProtected}
        requireAuth={data.requireAuth !== false}
        onRequireAuthChange={(requireAuth) => updateData({ requireAuth })}
      />

      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Summary
        </Label>
        <Input
          className="bg-background/50 text-xs"
          placeholder="e.g. Fetches or submits client data."
          value={data.summary || data.description || ""}
          onChange={(e) =>
            updateData({ summary: e.target.value, description: e.target.value })
          }
        />
      </div>

      {connectedEndpoint && (
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/50 text-xs">
          <span className="text-[11px] text-muted-foreground">
            synced with{" "}
            <span className="font-mono font-medium text-foreground">
              {connectedEndpoint.type || "GET"} {connectedEndpoint.name}
            </span>
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Synced
          </span>
        </div>
      )}

      <ParameterEditor
        title="Headers"
        parameters={effectiveHeaders}
        onChange={(headers) => updateData({ headers })}
      />
      <ParameterEditor
        title="Path Params"
        parameters={effectivePathParams}
        onChange={(pathParams) => updateData({ pathParams })}
      />
      <ParameterEditor
        title="Query Params"
        parameters={effectiveQueryParams}
        onChange={(queryParams) => updateData({ queryParams })}
      />
      <RequestBodyEditor
        mode={effectiveRequestBodyMode}
        onModeChange={(requestBodyMode) =>
          updateData({ requestBodyMode })
        }
        schema={effectiveRequestBody}
        onSchemaChange={(requestBody) =>
          updateData({ requestBody })
        }
      />

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

      {/* ── AI PAGE PROMPTS & VISUAL STYLE ── */}
      <div className="flex flex-col gap-4 p-4 rounded-xl bg-card border border-border/60 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>AI Page Generation Prompts</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Describe the purpose and visual style of this page to guide AI code generation.
        </p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Page Purpose / Functional Overview</Label>
            <Textarea
              value={data.description || ""}
              onChange={(e) => updateData({ description: e.target.value })}
              placeholder="e.g. Analytics dashboard with interactive charts, real-time KPI metrics, and export capabilities..."
              className="min-h-[80px] text-xs resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Page Theme & Visual Layout Prompt</Label>
            <Textarea
              value={data.uiPrompt || ""}
              onChange={(e) => updateData({ uiPrompt: e.target.value })}
              placeholder="e.g. Modern dark aesthetic with sleek glassmorphic cards, vibrant gradient accents, collapsible navigation sidebar, and responsive metric grid..."
              className="min-h-[90px] text-xs resize-none"
            />
          </div>
        </div>
      </div>

      {/* ── SECTIONS OVERVIEW ── */}
      <div className="flex flex-col gap-4 p-4 rounded-xl bg-card border border-border/60 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Layers className="w-4 h-4 text-indigo-500" />
            <span>Page Sections & Components</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
            onClick={() => {
              const currentSections: PageSection[] = data.sections || [];
              const newSec: PageSection = {
                id: `sec-${crypto.randomUUID()}`,
                name: `Section ${currentSections.length + 1}`,
                renderMode: "client",
                loadStrategy: "eager",
                actions: [],
              };
              updateData({ sections: [...currentSections, newSec] });
            }}
          >
            <Plus size={12} className="mr-1 text-indigo-500" />
            Add Section
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {(data.sections || []).length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed border-border/70 text-center flex flex-col items-center gap-2 bg-muted/20">
              <span className="text-xs text-muted-foreground">
                No sections defined yet. Each section compiles into its own component in <code className="font-mono text-primary">_components/</code>.
              </span>
            </div>
          ) : (
            (data.sections || []).map((sec: PageSection) => (
              <div
                key={sec.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border text-xs"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-foreground truncate">{sec.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {sec.renderMode || "client"} • {sec.loadStrategy || "eager"} • {(sec.actions || []).length} action{(sec.actions || []).length === 1 ? "" : "s"}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    useBackendCanvasStore.getState().setActiveConfigItem({
                      type: "pageSection",
                      id: sec.id,
                      nodeId,
                    })
                  }
                >
                  Configure &rarr;
                </Button>
              </div>
            ))
          )}
        </div>
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

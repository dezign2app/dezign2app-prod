import React, { useState } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  ConditionNode,
  ConditionPrimitive,
  ProtectionRule,
  WebAppZone,
} from "@workspace/canvas";
import {
  DEFAULT_ZONES,
  PRESET_TRIGGER_OPTIONS,
  PublicZoneView,
  ProtectedZoneHeader,
  AccessConditionsSection,
  RedirectMapSection,
  CustomLogicSection,
  MiddlewareCodePreviewSection,
} from "./zone-config";

export const ZoneConfig = ({
  id,
  nodeId,
}: {
  id: string; // zoneId
  nodeId: string; // webApp nodeId
}) => {
  const node = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === nodeId),
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);
  const addNode = useBackendCanvasStore((s) => s.addNode);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);
  const deleteEdge = useBackendCanvasStore((s) => s.deleteEdge);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    conditions: true,
    redirects: true,
    custom: true,
    preview: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (!node) return null;

  const data = node.data;
  const zones: WebAppZone[] =
    data.zones && data.zones.length > 0 ? data.zones : DEFAULT_ZONES;
  const currentZone =
    zones.find((z) => z.id === id) ||
    (id === "zone-public" ? DEFAULT_ZONES[0]! : DEFAULT_ZONES[1]!);

  const rule: ProtectionRule = currentZone.rule || {
    id: `rule-${currentZone.id}`,
    scope: "zone",
    conditions: {
      kind: "group",
      op: "AND",
      children: [{ kind: "leaf", condition: { type: "auth", op: "signedIn" } }],
    },
    redirects: { "no-auth": "/login", default: "/login" },
  };

  const updateZoneRule = (updatedRule: ProtectionRule) => {
    const updatedZone: WebAppZone = { ...currentZone, rule: updatedRule };
    const updatedZones = zones.some((z) => z.id === currentZone.id)
      ? zones.map((z) => (z.id === currentZone.id ? updatedZone : z))
      : [...zones, updatedZone];
    updateNode(nodeId, { data: { ...data, zones: updatedZones } });
  };

  const updateZoneName = (name: string) => {
    const updatedZone: WebAppZone = { ...currentZone, name };
    const updatedZones = zones.map((z) =>
      z.id === currentZone.id ? updatedZone : z,
    );
    updateNode(nodeId, { data: { ...data, zones: updatedZones } });
  };

  const isPublicZone =
    currentZone.accessType === "public" || currentZone.id === "zone-public";
  const allWebClientNodes = nodes.filter((n) => n.type === "webClient");

  // Find connected WebClient pages
  const connectedEdges = edges.filter(
    (e) =>
      (e.target === nodeId && e.targetHandle === currentZone.handleId) ||
      (e.source === nodeId && e.sourceHandle === currentZone.handleId),
  );
  const connectedPages = connectedEdges
    .map((e) =>
      nodes.find((n) => n.id === (e.source === nodeId ? e.target : e.source)),
    )
    .filter((n): n is (typeof nodes)[0] => Boolean(n));

  const handleCreateNewPage = () => {
    const totalWebClients = allWebClientNodes.length;
    const newPageId = `webClient-${Date.now()}`;

    const baseX = node?.position?.x ?? 100;
    const baseY = node?.position?.y ?? 100;

    const pageSuggestions = [
      "Landing Page",
      "Pricing Page",
      "About Page",
      "Docs Page",
      "Contact Page",
    ];
    const suggestedLabel =
      pageSuggestions[connectedPages.length] ||
      `Public Page ${totalWebClients + 1}`;

    const newPageNode = {
      id: newPageId,
      type: "webClient" as const,
      position: {
        x: baseX + 340,
        y: baseY + connectedPages.length * 150,
      },
      data: {
        label: suggestedLabel,
        description: "Unprotected public page (e.g. landing, pricing, about)",
        events: [],
        useZoneDefault: true,
      },
    };

    addNode(newPageNode);

    const newEdgeId = `edge-${nodeId}-${currentZone.handleId}-${newPageId}-page-in`;
    addEdge({
      id: newEdgeId,
      source: nodeId,
      sourceHandle: currentZone.handleId,
      target: newPageId,
      targetHandle: "page-in",
      type: "connection",
    });
  };

  const handleTogglePageConnection = (
    pageNodeId: string,
    isConnected: boolean,
  ) => {
    // Strictly 1 web page belongs to 1 section -> clear all existing section edges for this page
    const sectionEdges = edges.filter((e) => {
      const isTarget = e.target === pageNodeId;
      const isSource = e.source === pageNodeId;
      if (!isTarget && !isSource) return false;
      const otherId = isSource ? e.target : e.source;
      const otherNode = nodes.find((n) => n.id === otherId);
      return otherNode?.type === "webApp";
    });

    if (isConnected) {
      sectionEdges.forEach((e) => deleteEdge(e.id));
    } else {
      sectionEdges.forEach((e) => deleteEdge(e.id));

      const newEdgeId = `edge-${nodeId}-${currentZone.handleId}-${pageNodeId}-page-in`;
      addEdge({
        id: newEdgeId,
        source: nodeId,
        sourceHandle: currentZone.handleId,
        target: pageNodeId,
        targetHandle: "page-in",
        type: "connection",
      });
    }
  };

  // Render Public Section View
  if (isPublicZone) {
    return (
      <PublicZoneView
        currentZone={currentZone}
        connectedPages={connectedPages}
        allWebClientNodes={allWebClientNodes}
        onCreateNewPage={handleCreateNewPage}
        onTogglePageConnection={handleTogglePageConnection}
      />
    );
  }

  // Flatten leaf conditions for simple editing
  const getLeafConditions = (
    condNode: ConditionNode,
  ): ConditionPrimitive[] => {
    if (condNode.kind === "leaf") return [condNode.condition];
    return condNode.children.flatMap(getLeafConditions);
  };

  const leaves = getLeafConditions(rule.conditions);

  const handleAddCondition = (primitiveType: ConditionPrimitive["type"]) => {
    let newPrim: ConditionPrimitive;
    if (primitiveType === "auth") newPrim = { type: "auth", op: "signedIn" };
    else if (primitiveType === "org") newPrim = { type: "org", op: "required" };
    else if (primitiveType === "orgRole")
      newPrim = { type: "orgRole", op: "in", values: ["owner", "admin"] };
    else if (primitiveType === "access")
      newPrim = { type: "access", op: "granted" };
    else if (primitiveType === "subscriptionStatus")
      newPrim = {
        type: "subscriptionStatus",
        op: "statusIn",
        values: ["active", "trialing"],
      };
    else if (primitiveType === "plan")
      newPrim = { type: "plan", op: "in", values: ["pro", "enterprise"] };
    else newPrim = { type: "customClaim", key: "isVip", op: "truthy" };

    const initialChildren: ConditionNode[] =
      rule.conditions.kind === "group"
        ? rule.conditions.children
        : [{ kind: "leaf", condition: rule.conditions.condition }];

    const updatedChildren: ConditionNode[] = [
      ...initialChildren,
      { kind: "leaf", condition: newPrim },
    ];

    updateZoneRule({
      ...rule,
      conditions: { kind: "group", op: "AND", children: updatedChildren },
    });
  };

  const handleRemoveCondition = (index: number) => {
    if (rule.conditions.kind !== "group") return;
    const updatedChildren = rule.conditions.children.filter(
      (_, idx) => idx !== index,
    );
    updateZoneRule({
      ...rule,
      conditions: {
        kind: "group",
        op: "AND",
        children:
          updatedChildren.length > 0
            ? updatedChildren
            : [{ kind: "leaf", condition: { type: "auth", op: "signedIn" } }],
      },
    });
  };

  // Redirect Map CRUD handlers
  const DEFAULT_REDIRECT_MAP: Record<string, string> = {
    "no-auth": "/login",
    "no-org": "/select-org",
    "wrong-role": "/unauthorized",
    "no-access": "/pricing",
    "wrong-plan": "/pricing",
    default: "/login",
  };

  const redirectsMap: Record<string, string> = {
    ...DEFAULT_REDIRECT_MAP,
    ...(rule.redirects || {}),
  };

  const redirectEntries = Object.entries(redirectsMap);

  const handleSelectPresetOrCustomRedirect = (selectedVal: string) => {
    let keyToAdd = selectedVal;
    let defaultPath = "/login";

    if (selectedVal === "custom_key") {
      keyToAdd = `custom_trigger_${Date.now().toString().slice(-4)}`;
      defaultPath = "/login";
    } else {
      const presetOpt = PRESET_TRIGGER_OPTIONS.find(
        (p) => p.value === selectedVal,
      );
      if (presetOpt) defaultPath = presetOpt.defaultRoute;
    }

    const updatedRedirects = {
      default: redirectsMap.default || "/login",
      ...redirectsMap,
      [keyToAdd]: defaultPath,
    };
    updateZoneRule({ ...rule, redirects: updatedRedirects });
  };

  const handleDeleteRedirect = (keyToDelete: string) => {
    const { [keyToDelete]: _removed, ...remaining } = redirectsMap;
    const updatedRedirects = {
      default: remaining.default || "/login",
      ...remaining,
    };
    updateZoneRule({ ...rule, redirects: updatedRedirects });
  };

  const handleUpdateRedirectKey = (oldKey: string, newKey: string) => {
    const cleanNewKey = newKey.trim();
    if (!cleanNewKey || oldKey === cleanNewKey) return;

    const updatedEntries = Object.entries(redirectsMap).map(([k, v]) => [
      k === oldKey ? cleanNewKey : k,
      v,
    ]);

    const updatedRedirects = {
      default: redirectsMap.default || "/login",
      ...Object.fromEntries(updatedEntries),
    };
    updateZoneRule({ ...rule, redirects: updatedRedirects });
  };

  const handleUpdateRedirectRoute = (key: string, route: string) => {
    const updatedRedirects = {
      default: redirectsMap.default || "/login",
      ...redirectsMap,
      [key]: route,
    };
    updateZoneRule({ ...rule, redirects: updatedRedirects });
  };

  return (
    <div className="flex flex-col gap-6 mt-6 pb-12">
      <ProtectedZoneHeader
        currentZone={currentZone}
        onUpdateZoneName={updateZoneName}
      />

      <div className="flex flex-col gap-6">
        <AccessConditionsSection
          isOpen={openSections.conditions ?? true}
          onToggle={() => toggleSection("conditions")}
          leaves={leaves}
          connectedPages={connectedPages}
          onAddCondition={handleAddCondition}
          onRemoveCondition={handleRemoveCondition}
        />

        <RedirectMapSection
          isOpen={openSections.redirects ?? true}
          onToggle={() => toggleSection("redirects")}
          redirectEntries={redirectEntries}
          onSelectPresetOrCustomRedirect={handleSelectPresetOrCustomRedirect}
          onDeleteRedirect={handleDeleteRedirect}
          onUpdateRedirectKey={handleUpdateRedirectKey}
          onUpdateRedirectRoute={handleUpdateRedirectRoute}
        />

        <CustomLogicSection
          isOpen={openSections.custom ?? true}
          onToggle={() => toggleSection("custom")}
          rule={rule}
          onUpdateCustomPrompt={(prompt) =>
            updateZoneRule({
              ...rule,
              customLogic: { mode: "naturalLanguage", prompt },
            })
          }
        />

        <MiddlewareCodePreviewSection
          isOpen={openSections.preview ?? true}
          onToggle={() => toggleSection("preview")}
          currentZone={currentZone}
          rule={rule}
          leaves={leaves}
        />
      </div>
    </div>
  );
};

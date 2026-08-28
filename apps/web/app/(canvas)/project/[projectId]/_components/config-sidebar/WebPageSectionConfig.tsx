"use client";

import React, { useState, useEffect } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { PageSection, UIEventItem, BackendNode, Endpoint } from "@/types/canvas";
import { Button } from "@workspace/ui/components/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@workspace/ui/components/tabs";
import { Layers, Zap, Box, Package, Palette } from "lucide-react";
import {
  SERVER_NODE_TYPES,
  SectionPreset,
  collectEndpoints,
} from "@workspace/canvas";
import { useSectionCollapseStore } from "@/lib/stores/sectionCollapseStore";
import {
  SectionConfigHeader,
  SectionActionsTab,
  SectionGeneralTab,
  SectionDependenciesTab,
  SectionUiDesignTab,
} from "./web-page-section-config";

export interface WebPageSectionConfigProps {
  id: string; // The section ID
  nodeId: string;
}

export const WebPageSectionConfig: React.FC<WebPageSectionConfigProps> = ({ id, nodeId }) => {
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const addNode = useBackendCanvasStore((s) => s.addNode);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);
  const deleteEdge = useBackendCanvasStore((s) => s.deleteEdge);
  const deleteNode = useBackendCanvasStore((s) => s.deleteNode);
  const onConnect = useBackendCanvasStore((s) => s.onConnect);
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);
  const deleteSectionCollapseState = useSectionCollapseStore((s) => s.deleteSectionCollapseState);

  const parentNode = nodes.find((n) => n.id === nodeId);
  const sections: PageSection[] = parentNode?.data?.sections || [];
  const section = sections.find((s) => s.id === id);

  const [activeTab, setActiveTab] = useState("actions");
  const [name, setName] = useState(section?.name || "");
  const [renderMode, setRenderMode] = useState<"server" | "client">(
    section?.renderMode || "server",
  );
  const [loadStrategy, setLoadStrategy] = useState<
    "eager" | "dynamic" | "dynamic-no-ssr"
  >(section?.loadStrategy || "eager");
  const [description, setDescription] = useState(section?.description || "");
  const [uiPrompt, setUiPrompt] = useState(section?.uiPrompt || "");
  const [images, setImages] = useState<string[]>(section?.images || []);
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | undefined>(section?.primaryImageUrl);
  const [libraries, setLibraries] = useState<string[]>(section?.libraries || []);
  const [actionSearch, setActionSearch] = useState("");
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);

  useEffect(() => {
    if (section) {
      setName(section.name || "");
      setRenderMode(section.renderMode || "server");
      setLoadStrategy(section.loadStrategy || "eager");
      setDescription(section.description || "");
      setUiPrompt(section.uiPrompt || "");
      setImages(section.images || []);
      setPrimaryImageUrl(section.primaryImageUrl);
      setLibraries(section.libraries || []);
    }
  }, [section]);

  if (!parentNode || !section) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
          <Layers size={18} />
        </div>
        <p>Section not found. It may have been deleted or renamed.</p>
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => setActiveConfigItem(null)}
        >
          Close Drawer
        </Button>
      </div>
    );
  }

  const handleUpdate = (changes: Partial<PageSection>) => {
    const updated = sections.map((s) => (s.id === id ? { ...s, ...changes } : s));
    updateNode(nodeId, { data: { ...parentNode.data, sections: updated } });
  };

  const handleDeleteSection = () => {
    deleteSectionCollapseState(nodeId, id);
    if (section && section.actions) {
      for (const act of section.actions) {
        const existingEdge = edges.find(
          (edge) =>
            edge.source === nodeId && edge.sourceHandle === `events-${act.id}`,
        );
        if (existingEdge) {
          const targetNode = nodes.find((n) => n.id === existingEdge.target);
          deleteEdge(existingEdge.id);
          if (targetNode && targetNode.type === "page_ref") {
            const remaining = edges.filter(
              (edge) => edge.target === targetNode.id && edge.id !== existingEdge.id,
            );
            if (remaining.length === 0) deleteNode(targetNode.id);
          }
        }
      }
    }
    const updated = sections.filter((s) => s.id !== id);
    updateNode(nodeId, { data: { ...parentNode.data, sections: updated } });
    setActiveConfigItem(null);
  };

  const handleAddLibrary = (libName: string) => {
    const trimmed = libName.trim();
    if (!trimmed || libraries.includes(trimmed)) return;
    const next = [...libraries, trimmed];
    setLibraries(next);
    handleUpdate({ libraries: next });
  };

  const handleRemoveLibrary = (libName: string) => {
    const next = libraries.filter((l) => l !== libName);
    setLibraries(next);
    handleUpdate({ libraries: next });
  };

  // --- ACTIONS MANAGEMENT ---
  const currentActions: UIEventItem[] = section.actions || [];

  const handleAddAction = (actionName = "New Action", eventType = "click") => {
    const newActionId = crypto.randomUUID();
    const newAction: UIEventItem = {
      id: newActionId,
      name: actionName,
      event: eventType,
      ...(eventType === "navigateToPage" ? { navigationType: "link" as const } : {}),
    };

    const nextActions = [...currentActions, newAction];
    handleUpdate({ actions: nextActions });

    if (eventType === "navigateToPage") {
      const pos = parentNode.position || { x: 100, y: 100 };
      const newRefId = crypto.randomUUID();
      addNode({
        id: newRefId,
        type: "page_ref",
        position: { x: pos.x + 340, y: pos.y + 60 },
        data: { label: "Page Ref", description: "Target page reference" },
      });
      addEdge({
        id: `edge-${Date.now()}`,
        source: nodeId,
        target: newRefId,
        sourceHandle: `events-${newActionId}`,
        targetHandle: "page-ref-in",
        type: "connection",
      });
    }

    setExpandedActionId(newActionId);
  };

  const handleUpdateAction = (actionId: string, changes: Partial<UIEventItem>) => {
    const prevAction = currentActions.find((a) => a.id === actionId);
    const nextActions = currentActions.map((act) =>
      act.id === actionId ? { ...act, ...changes } : act,
    );
    handleUpdate({ actions: nextActions });

    if (changes.event && prevAction && prevAction.event !== changes.event) {
      const store = useBackendCanvasStore.getState();
      const existingEdge = store.edges.find(
        (e) => e.source === nodeId && e.sourceHandle === `events-${actionId}`,
      );

      if (changes.event === "navigateToPage" && !existingEdge) {
        const pos = parentNode.position || { x: 100, y: 100 };
        const newRefId = crypto.randomUUID();
        store.addNode({
          id: newRefId,
          type: "page_ref",
          position: { x: pos.x + 340, y: pos.y + 60 },
          data: { label: "Page Ref", description: "Target page reference" },
        });
        store.addEdge({
          id: `edge-${Date.now()}`,
          source: nodeId,
          target: newRefId,
          sourceHandle: `events-${actionId}`,
          targetHandle: "page-ref-in",
          type: "connection",
        });
      } else if (changes.event !== "navigateToPage" && existingEdge) {
        const targetNode = store.nodes.find((n) => n.id === existingEdge.target);
        if (targetNode && targetNode.type === "page_ref") {
          store.deleteEdge(existingEdge.id);
          const remaining = store.edges.filter(
            (e) => e.target === targetNode.id && e.id !== existingEdge.id,
          );
          if (remaining.length === 0) store.deleteNode(targetNode.id);
        }
      }
    }
  };

  const handleDeleteAction = (actionId: string) => {
    const store = useBackendCanvasStore.getState();
    const existingEdge = store.edges.find(
      (e) => e.source === nodeId && e.sourceHandle === `events-${actionId}`,
    );
    if (existingEdge) {
      const targetNode = store.nodes.find((n) => n.id === existingEdge.target);
      store.deleteEdge(existingEdge.id);
      if (targetNode && targetNode.type === "page_ref") {
        const remaining = store.edges.filter(
          (e) => e.target === targetNode.id && e.id !== existingEdge.id,
        );
        if (remaining.length === 0) store.deleteNode(targetNode.id);
      }
    }

    const nextActions = currentActions.filter((act) => act.id !== actionId);
    handleUpdate({ actions: nextActions });
  };

  const handleDuplicateAction = (act: UIEventItem) => {
    const newActionId = crypto.randomUUID();
    const cloned: UIEventItem = {
      ...act,
      id: newActionId,
      name: `${act.name || "Action"} (Copy)`,
    };
    handleUpdate({ actions: [...currentActions, cloned] });
  };

  const handleApplyPreset = (preset: SectionPreset) => {
    setName(preset.label.replace(/[^a-zA-Z0-9]/g, ""));
    setRenderMode(preset.renderMode);
    setLoadStrategy(preset.loadStrategy);
    setDescription(preset.defaultDesc);
    setUiPrompt(preset.defaultUiPrompt);

    const mergedLibs = Array.from(new Set([...libraries, ...preset.libraries]));
    setLibraries(mergedLibs);

    const newActions: UIEventItem[] = preset.defaultActions.map((a) => ({
      id: crypto.randomUUID(),
      name: a.name,
      event: a.event,
    }));

    handleUpdate({
      name: preset.label.replace(/[^a-zA-Z0-9]/g, ""),
      renderMode: preset.renderMode,
      loadStrategy: preset.loadStrategy,
      description: preset.defaultDesc,
      uiPrompt: preset.defaultUiPrompt,
      libraries: mergedLibs,
      actions: [...currentActions, ...newActions],
    });
  };

  const getActionLink = (actionId: string) => {
    const existingEdge = edges.find(
      (e) =>
        (e.source === nodeId && e.sourceHandle === `events-${actionId}`) ||
        (e.target === nodeId && e.targetHandle === `events-${actionId}`),
    );
    if (!existingEdge) return null;

    const isSource = existingEdge.source === nodeId;
    const targetNodeId = isSource ? existingEdge.target : existingEdge.source;
    const targetNode = nodes.find((n) => n.id === targetNodeId);
    if (!targetNode) return null;

    const handle = isSource ? existingEdge.targetHandle : existingEdge.sourceHandle;
    let endpointId = handle ? handle.replace(/^endpoint-in-/, "") : undefined;
    if (endpointId && endpointId.includes("-in-")) {
      endpointId = endpointId.split("-in-").pop();
    }

    let targetEndpoint: Endpoint | undefined;
    if (endpointId) {
      const storeEndpoints = endpoints.filter(
        (ep) => ep.nodeId === targetNodeId && ep.id === endpointId,
      );
      if (storeEndpoints.length > 0) targetEndpoint = storeEndpoints[0];
      if (!targetEndpoint && targetNode.data?.endpoints) {
        targetEndpoint = targetNode.data.endpoints.find((ep: Endpoint) => ep.id === endpointId);
      }
    }

    if (!targetEndpoint) {
      const allTargetEndpoints = collectEndpoints(targetNode, endpoints);
      if (allTargetEndpoints.length > 0) targetEndpoint = allTargetEndpoints[0];
    }

    return { targetNode, endpoint: targetEndpoint };
  };

  const serviceNodes = nodes.filter(
    (n) => n.id !== nodeId && SERVER_NODE_TYPES.includes(n.type),
  );

  const handleActionServiceLink = (actionId: string, serviceId: string, endpointId?: string) => {
    const existingEdge = edges.find(
      (e) =>
        (e.source === nodeId && e.sourceHandle === `events-${actionId}`) ||
        (e.target === nodeId && e.targetHandle === `events-${actionId}`),
    );
    if (existingEdge) deleteEdge(existingEdge.id);

    if (serviceId === "none" || !serviceId) return;
    const targetService = serviceNodes.find((n) => n.id === serviceId);
    if (!targetService) return;

    const endpointsList = collectEndpoints(targetService, endpoints);
    const targetEp = endpointId
      ? endpointsList.find((e) => e.id === endpointId) || endpointsList[0]
      : endpointsList[0];

    if (targetEp) {
      onConnect({
        source: nodeId,
        target: serviceId,
        sourceHandle: `events-${actionId}`,
        targetHandle: `endpoint-in-${targetEp.id}`,
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 mt-6 pb-12 font-sans text-foreground">
      {/* Header Banner */}
      <div className="px-4">
        <SectionConfigHeader
          pageLabel={parentNode.data?.label}
          sectionName={section.name}
          renderMode={renderMode}
          onDelete={handleDeleteSection}
        />
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-4 pb-2 border-b border-border/50 bg-background">
          <TabsList className="grid w-full grid-cols-4 h-8 p-0.5 bg-secondary/50 border border-border/40 rounded-lg">
            <TabsTrigger
              value="actions"
              className="text-xs flex items-center justify-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium"
            >
              <Zap size={12} className="shrink-0" />
              <span>Actions</span>
              {currentActions.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] bg-secondary text-muted-foreground font-mono font-medium">
                  {currentActions.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="general"
              className="text-xs flex items-center justify-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium"
            >
              <Box size={12} className="shrink-0" />
              <span>General</span>
            </TabsTrigger>

            <TabsTrigger
              value="dependencies"
              className="text-xs flex items-center justify-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium"
            >
              <Package size={12} className="shrink-0" />
              <span>Packages</span>
              {libraries.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] bg-secondary text-muted-foreground font-mono font-medium">
                  {libraries.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="ui-design"
              className="text-xs flex items-center justify-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium"
            >
              <Palette size={12} className="shrink-0" />
              <span>UI Design</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 1. Actions Tab */}
        <TabsContent value="actions" className="flex-1 overflow-hidden p-0 m-0 outline-none flex flex-col">
          <SectionActionsTab
            nodeId={nodeId}
            sectionId={id}
            actions={currentActions}
            actionSearch={actionSearch}
            expandedActionId={expandedActionId}
            serviceNodes={serviceNodes}
            endpoints={endpoints}
            getActionLink={getActionLink}
            onSetActionSearch={setActionSearch}
            onSetExpandedActionId={setExpandedActionId}
            onAddAction={handleAddAction}
            onUpdateAction={handleUpdateAction}
            onDeleteAction={handleDeleteAction}
            onDuplicateAction={handleDuplicateAction}
            onServiceLink={handleActionServiceLink}
            onOpenTesting={(actionId, targetNodeId, endpointId) =>
              setActiveConfigItem({
                type: "eventTesting",
                id: actionId,
                nodeId,
                targetNodeId,
                endpointId,
                initialTab: "trigger",
              })
            }
            onOpenEventConfig={(actionId) =>
              setActiveConfigItem({
                type: "pageEvent",
                id: actionId,
                nodeId,
                sectionId: id,
              })
            }
          />
        </TabsContent>

        {/* 2. General Tab */}
        <TabsContent value="general" className="flex-1 overflow-hidden p-0 m-0 outline-none flex flex-col">
          <SectionGeneralTab
            name={name}
            renderMode={renderMode}
            loadStrategy={loadStrategy}
            onUpdateName={(val) => {
              setName(val);
              handleUpdate({ name: val });
            }}
            onUpdateRenderMode={(val) => {
              setRenderMode(val);
              handleUpdate({ renderMode: val });
            }}
            onUpdateLoadStrategy={(val) => {
              setLoadStrategy(val);
              handleUpdate({ loadStrategy: val });
            }}
            onApplyPreset={handleApplyPreset}
            onDelete={handleDeleteSection}
          />
        </TabsContent>

        {/* 3. Dependencies Tab */}
        <TabsContent value="dependencies" className="flex-1 overflow-hidden p-0 m-0 outline-none flex flex-col">
          <SectionDependenciesTab
            libraries={libraries}
            onAddLibrary={handleAddLibrary}
            onRemoveLibrary={handleRemoveLibrary}
          />
        </TabsContent>

        {/* 4. UI Design Tab */}
        <TabsContent value="ui-design" className="flex-1 overflow-hidden p-0 m-0 outline-none flex flex-col">
          <SectionUiDesignTab
            sectionName={section.name}
            actionsCount={currentActions.length}
            uiPrompt={uiPrompt}
            images={images}
            primaryImageUrl={primaryImageUrl}
            onUpdateUiPrompt={(val) => {
              setUiPrompt(val);
              handleUpdate({ uiPrompt: val });
            }}
            onUpdateImages={(nextImages, primaryUrl) => {
              setImages(nextImages);
              setPrimaryImageUrl(primaryUrl);
              handleUpdate({ images: nextImages, primaryImageUrl: primaryUrl });
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

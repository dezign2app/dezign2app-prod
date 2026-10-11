"use client";

import React, { useCallback, useState } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  AlertTriangle,
  Database,
  Type,
  Hash,
  Binary,
  Braces,
  CheckCircle2,
  Sliders,
} from "lucide-react";
import {
  PageSection,
  PageStateObject,
  SectionComponentBinding,
  ComponentBindingType,
  JSONValue,
} from "@/types/canvas";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";
import { Label } from "@workspace/ui/components/label";
import { Separator } from "@workspace/ui/components/separator";
import {
  StateHeaderBanner,
  BoundStoreLink,
  ConnectedComponentsSection,
} from "./web-page-state-config";

export interface WebPageStateConfigProps {
  id: string; // The state object ID
  nodeId: string; // The WebPageNode ID
  sectionId?: string; // Optional section ID
}

export const WebPageStateConfig: React.FC<WebPageStateConfigProps> = ({
  id,
  nodeId,
  sectionId,
}) => {
  const parentNode = useBackendCanvasStore(
    useCallback((s) => s.nodes.find((n) => n.id === nodeId), [nodeId]),
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);

  const sections: PageSection[] = parentNode?.data?.sections || [];

  // Find target section containing this state variable
  const targetSection =
    sections.find((s) => (s.stateObjects || []).some((st) => st.id === id)) ||
    sections.find((s) => s.id === sectionId) ||
    sections[0];

  const stateObj: PageStateObject | undefined = targetSection
    ? (targetSection.stateObjects || []).find((st) => st.id === id)
    : (parentNode?.data?.stateObjects || []).find((st: PageStateObject) => st.id === id);

  // Local draft states for editable fields
  const [defaultValDraft, setDefaultValDraft] = useState<string>(
    stateObj?.defaultValue !== undefined ? JSON.stringify(stateObj.defaultValue) : "",
  );
  const [descriptionDraft, setDescriptionDraft] = useState<string>(
    stateObj?.description || "",
  );
  const [isSaved, setIsSaved] = useState(false);

  // Filter connected UI components in this section
  const sectionBindings: SectionComponentBinding[] = targetSection?.componentBindings || [];
  const matchingComponents = sectionBindings.filter(
    (c) =>
      c.valueStateName === stateObj?.name ||
      c.valueStateId === stateObj?.id ||
      c.disabledStateName === stateObj?.name ||
      c.loadingStateName === stateObj?.name,
  );

  // Helper to persist updates to state object
  const handleSaveState = useCallback(
    (updates: { defaultValue?: JSONValue; description?: string }) => {
      if (!parentNode || !targetSection || !stateObj) return;

      const updatedStateObjects = (targetSection.stateObjects || []).map((st) =>
        st.id === id ? { ...st, ...updates } : st,
      );

      const updatedSections = sections.map((sec) =>
        sec.id === targetSection.id
          ? { ...sec, stateObjects: updatedStateObjects }
          : sec,
      );

      updateNode(nodeId, {
        data: {
          ...parentNode.data,
          sections: updatedSections,
        },
      });

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    },
    [parentNode, targetSection, stateObj, id, sections, nodeId, updateNode],
  );

  // Parse and commit default value change
  const handleCommitDefaultVal = () => {
    let parsed: JSONValue = defaultValDraft;
    try {
      parsed = JSON.parse(defaultValDraft);
    } catch {
      parsed = defaultValDraft;
    }
    handleSaveState({ defaultValue: parsed });
  };

  // Commit description change
  const handleCommitDescription = () => {
    handleSaveState({ description: descriptionDraft });
  };

  // Add a new UI Component directly mapped to this state variable
  const handleBindNewComponent = () => {
    if (!parentNode || !targetSection || !stateObj) return;

    const newCompId = `comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const lowerType = (stateObj.type || "").toLowerCase();
    const defaultCompType: ComponentBindingType = lowerType.includes("bool")
      ? "switch"
      : lowerType.includes("object") || lowerType.includes("array") || lowerType.includes("[]")
        ? "card"
        : "input";

    const isStore = Boolean(stateObj.storeName);

    const newBinding: SectionComponentBinding = {
      id: newCompId,
      name: `${stateObj.name} ${defaultCompType.charAt(0).toUpperCase() + defaultCompType.slice(1)}`,
      componentType: defaultCompType,
      label: stateObj.name,
      variant: "default",
      valueStateName: stateObj.name,
      valueStateId: stateObj.id,
      valueSourceType: isStore ? "store" : "local",
      valueStoreName: stateObj.storeName,
      triggerEvent: defaultCompType === "switch" ? "change" : "click",
    };

    const nextBindings = [...sectionBindings, newBinding];
    const updatedSections = sections.map((sec) =>
      sec.id === targetSection.id
        ? { ...sec, componentBindings: nextBindings }
        : sec,
    );

    updateNode(nodeId, {
      data: {
        ...parentNode.data,
        sections: updatedSections,
      },
    });

    // Immediately open the newly created component binding in the sidebar
    setActiveConfigItem({
      type: "sectionComponent",
      id: newCompId,
      nodeId,
      sectionId: targetSection.id,
    });
  };

  // Open an existing component binding editor
  const handleOpenComponent = (compBindingId: string) => {
    if (!targetSection) return;
    setActiveConfigItem({
      type: "sectionComponent",
      id: compBindingId,
      nodeId,
      sectionId: targetSection.id,
    });
  };

  // Open the connected Zustand store node
  const handleOpenStore = () => {
    if (stateObj?.storeId) {
      setActiveConfigItem({
        type: "state_store",
        id: stateObj.storeId,
        nodeId: stateObj.storeId,
      });
    }
  };

  if (!parentNode || !stateObj) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-3">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <div className="text-sm font-medium text-foreground">State Variable Not Found</div>
        <p className="text-xs">
          The selected state variable could not be located in this page node.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveConfigItem(null)}
          className="mt-2"
        >
          Close
        </Button>
      </div>
    );
  }

  const typeIcon = (stateObj.type || "").toLowerCase().includes("num")
    ? Hash
    : (stateObj.type || "").toLowerCase().includes("bool")
      ? Binary
      : (stateObj.type || "").toLowerCase().includes("obj")
        ? Braces
        : Type;
  const TypeIconComponent = typeIcon;

  return (
    <div className="flex flex-col gap-5 font-sans text-foreground pb-12">
      {/* 1. Header & Breadcrumbs Banner */}
      <StateHeaderBanner
        pageLabel={parentNode.data?.label || "Page"}
        targetSection={targetSection}
        stateObj={stateObj}
        connectedCount={matchingComponents.length}
        onNavigatePage={() => setActiveConfigItem({ type: "webPage", id: nodeId, nodeId })}
        onNavigateSection={
          targetSection
            ? () =>
                setActiveConfigItem({
                  type: "pageSection",
                  id: targetSection.id,
                  nodeId,
                  initialTab: "state",
                })
            : undefined
        }
      />

      {/* 2. State Variable Schema & Details Card */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Sliders size={14} />
              </div>
              <div>
                <CardTitle className="text-xs font-semibold">State Variable Properties</CardTitle>
                <CardDescription className="text-[11px]">
                  Reactive model identity, data type, and initial value
                </CardDescription>
              </div>
            </div>
            {isSaved && (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
                <CheckCircle2 size={10} />
                <span>Saved</span>
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0 space-y-3.5 text-xs">
          {/* Variable Name */}
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Variable Identifier</Label>
            <div className="flex items-center gap-2">
              <Input
                value={stateObj.name}
                readOnly
                className="h-8 text-xs font-mono bg-muted/30 cursor-default"
              />
              <Badge variant="outline" className="h-8 px-2 text-[10px] font-mono shrink-0">
                {stateObj.storeName ? "Zustand Field" : "Local State"}
              </Badge>
            </div>
          </div>

          {/* Data Type */}
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Data Type</Label>
            <div className="flex items-center gap-2 p-2 rounded-lg border border-border/60 bg-muted/20">
              <TypeIconComponent size={14} className="text-cyan-500" />
              <span className="font-mono text-xs font-medium">{stateObj.type || "string"}</span>
            </div>
          </div>

          {/* Default Value */}
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Initial / Default Value</Label>
            <Input
              value={defaultValDraft}
              onChange={(e) => setDefaultValDraft(e.target.value)}
              onBlur={handleCommitDefaultVal}
              placeholder="e.g. 0, true, or {}"
              className="h-8 text-xs font-mono bg-background"
            />
            <p className="text-[10px] text-muted-foreground">
              JSON literal or primitive used as initial state in Zustand / useState.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Notes / Description (Optional)</Label>
            <Textarea
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              onBlur={handleCommitDescription}
              placeholder="Describe purpose of this reactive variable..."
              rows={2}
              className="text-xs resize-none bg-background"
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Bound Zustand Store Link Card (When store-backed) */}
      {stateObj.storeId && (
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Database size={14} />
              </div>
              <div>
                <CardTitle className="text-xs font-semibold">Zustand Store Subscription</CardTitle>
                <CardDescription className="text-[11px]">
                  Synced from canvas state store node
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <BoundStoreLink
              storeId={stateObj.storeId}
              storeName={stateObj.storeName}
              onOpenStore={handleOpenStore}
            />
          </CardContent>
        </Card>
      )}

      <Separator className="bg-border/50" />

      {/* 4. Connected UI Components Section with shortcut to create/bind */}
      <ConnectedComponentsSection
        stateName={stateObj.name}
        stateId={stateObj.id}
        componentBindings={sectionBindings}
        onOpenComponent={handleOpenComponent}
        onBindNewComponent={handleBindNewComponent}
      />
    </div>
  );
};

export default WebPageStateConfig;

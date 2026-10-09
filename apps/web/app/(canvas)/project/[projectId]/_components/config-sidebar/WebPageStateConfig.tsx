"use client";

import React, { useMemo } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";
import {
  BackendNode,
  PageSection,
  PageStateObject,
  StateRenderConfig,
  ComponentPropMappings,
  UIEventItem,
} from "@/types/canvas";
import { Switch } from "@workspace/ui/components/switch";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import {
  ComponentOption,
  COMPONENT_OPTIONS,
  DEFAULT_COMPONENT_OPTION,
  StateHeaderBanner,
  StateComponentPreview,
  ComponentSelector,
  ComponentPropMappingsSection,
  DisplayFormattingSection,
  ClickInteractivitySection,
  BoundStoreLink,
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
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);

  const parentNode = nodes.find((n) => n.id === nodeId);
  const sections: PageSection[] = parentNode?.data?.sections || [];

  // Find target section containing this state variable
  const targetSection =
    sections.find((s) => (s.stateObjects || []).some((st) => st.id === id)) ||
    sections.find((s) => s.id === sectionId) ||
    sections[0];

  const stateObj: PageStateObject | undefined = targetSection
    ? (targetSection.stateObjects || []).find((st) => st.id === id)
    : (parentNode?.data?.stateObjects || []).find((st: PageStateObject) => st.id === id);

  const renderConfig: StateRenderConfig = stateObj?.renderConfig || {};
  const isEnabled = renderConfig.enabled !== false;
  const currentComponent = renderConfig.component || "badge";
  const currentVariant = renderConfig.variant || "secondary";
  const currentClickAction = renderConfig.clickAction || "none";
  const propMappings: ComponentPropMappings = renderConfig.propMappings || {};

  const selectedOption: ComponentOption = useMemo(
    () => COMPONENT_OPTIONS.find((opt) => opt.id === currentComponent) ?? DEFAULT_COMPONENT_OPTION,
    [currentComponent],
  );

  // Section actions available for interactive triggering
  const availableActions: UIEventItem[] = targetSection?.actions || [];

  // All web pages in project for navigation action
  const availablePages = useMemo(
    () => nodes.filter((n) => n.type === "webPage" && n.id !== nodeId),
    [nodes, nodeId],
  );

  // Helper to persist changes
  const handleUpdateRenderConfig = (changes: Partial<StateRenderConfig>) => {
    if (!parentNode || !stateObj) return;

    const nextConfig: StateRenderConfig = {
      ...renderConfig,
      ...changes,
    };

    if (targetSection) {
      const updatedSections = sections.map((sec) => {
        if (sec.id !== targetSection.id) return sec;
        const updatedStateObjects = (sec.stateObjects || []).map((st) => {
          if (st.id !== id) return st;
          return { ...st, renderConfig: nextConfig };
        });
        return { ...sec, stateObjects: updatedStateObjects };
      });

      updateNode(nodeId, {
        data: {
          ...parentNode.data,
          sections: updatedSections,
        },
      });
    } else if (parentNode.data?.stateObjects) {
      const updatedStateObjects = parentNode.data.stateObjects.map((st: PageStateObject) => {
        if (st.id !== id) return st;
        return { ...st, renderConfig: nextConfig };
      });
      updateNode(nodeId, {
        data: {
          ...parentNode.data,
          stateObjects: updatedStateObjects,
        },
      });
    }
  };

  const handleUpdatePropMapping = (changes: Partial<ComponentPropMappings>) => {
    handleUpdateRenderConfig({
      propMappings: {
        ...(renderConfig.propMappings || {}),
        ...changes,
      },
    });
  };

  // Derive sample value for preview
  const sampleValue = useMemo(() => {
    if (!stateObj) return "Sample value";
    if (stateObj.defaultValue !== undefined && stateObj.defaultValue !== null && stateObj.defaultValue !== "") {
      return stateObj.defaultValue;
    }
    const t = (stateObj.type || "").toLowerCase();
    if (t.includes("bool")) return true;
    if (t.includes("num") || t.includes("int") || t.includes("float")) return 42;
    if (t.includes("array") || t.includes("[]")) return ["Item 1", "Item 2"];
    if (t.includes("object")) return { status: "active", count: 10 };
    return "Sample value";
  }, [stateObj]);

  // Formatted string for preview
  const displayLabel = renderConfig.label || stateObj?.name || "State";
  const prefix = renderConfig.prefix || "";
  const suffix = renderConfig.suffix || "";

  const formattedPreviewValue = useMemo(() => {
    if (sampleValue === undefined || sampleValue === null) {
      return renderConfig.fallbackText || "—";
    }
    const formatter = renderConfig.formatter || "none";
    if (formatter === "currency") {
      return `$${Number(sampleValue) || 0}`;
    }
    if (formatter === "number") {
      return Number(sampleValue).toLocaleString();
    }
    if (formatter === "json" || typeof sampleValue === "object") {
      return JSON.stringify(sampleValue);
    }
    return `${prefix}${sampleValue}${suffix}`;
  }, [sampleValue, renderConfig, prefix, suffix]);

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

  return (
    <div className="flex flex-col gap-6 font-sans text-foreground pb-12">
      {/* 1. Header & Breadcrumbs Banner */}
      <StateHeaderBanner
        pageLabel={parentNode.data?.label || "Page"}
        targetSection={targetSection}
        stateObj={stateObj}
        isEnabled={isEnabled}
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

      {/* 2. Render in UI Toggle */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                {isEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
              </div>
              <div>
                <CardTitle className="text-xs font-semibold">Render in UI</CardTitle>
                <CardDescription className="text-[11px]">
                  Controls whether this state variable is rendered into the section JSX
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => handleUpdateRenderConfig({ enabled: checked })}
            />
          </div>
        </CardHeader>
        {!isEnabled && (
          <CardContent className="p-4 pt-0">
            <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40">
              When disabled, this state variable remains reactive and subscribed via Zustand in the component code (e.g. <code>const {stateObj.name} = useStore(...)</code>), but is not displayed visually.
            </div>
          </CardContent>
        )}
      </Card>

      {/* Render Configuration Controls (When Enabled) */}
      {isEnabled && (
        <>
          {/* Live Component Preview */}
          <StateComponentPreview
            currentComponent={currentComponent}
            currentVariant={currentVariant}
            currentClickAction={currentClickAction}
            displayLabel={displayLabel}
            formattedPreviewValue={formattedPreviewValue}
            sampleValue={sampleValue}
            propMappings={propMappings}
            stateName={stateObj.name}
            copyToastMessage={renderConfig.copyToastMessage}
            targetActionId={renderConfig.targetActionId}
          />

          {/* Component Selector */}
          <ComponentSelector
            currentComponent={currentComponent}
            selectedOption={selectedOption}
            stateType={stateObj.type}
            onSelectComponent={(componentId) => handleUpdateRenderConfig({ component: componentId })}
          />

          <Separator className="bg-border/50" />

          {/* Component Prop Mappings */}
          <ComponentPropMappingsSection
            currentComponent={currentComponent}
            selectedOption={selectedOption}
            displayLabel={displayLabel}
            stateName={stateObj.name}
            propMappings={propMappings}
            onUpdatePropMapping={handleUpdatePropMapping}
          />

          <Separator className="bg-border/50" />

          {/* Label & Display Formatting */}
          <DisplayFormattingSection
            label={renderConfig.label || ""}
            stateName={stateObj.name}
            currentComponent={currentComponent}
            currentVariant={currentVariant}
            formatter={renderConfig.formatter || "none"}
            fallbackText={renderConfig.fallbackText || ""}
            prefix={prefix}
            suffix={suffix}
            onUpdateRenderConfig={handleUpdateRenderConfig}
          />

          <Separator className="bg-border/50" />

          {/* Click Interactivity & Events */}
          <ClickInteractivitySection
            currentClickAction={currentClickAction}
            copyToastMessage={renderConfig.copyToastMessage}
            targetActionId={renderConfig.targetActionId}
            targetRoute={renderConfig.targetRoute}
            stateName={stateObj.name}
            availableActions={availableActions}
            availablePages={availablePages}
            sectionName={targetSection?.name}
            onUpdateRenderConfig={handleUpdateRenderConfig}
          />
        </>
      )}

      {/* 3. Bound Store Navigation Link */}
      {stateObj.storeId && (
        <BoundStoreLink
          storeId={stateObj.storeId}
          storeName={stateObj.storeName}
          onOpenStore={() => {
            if (stateObj.storeId) {
              setActiveConfigItem({
                type: "state_store",
                id: stateObj.storeId,
                nodeId: stateObj.storeId,
              });
            }
          }}
        />
      )}
    </div>
  );
};

export default WebPageStateConfig;

"use client";

import React from "react";
import {
  ChevronDown,
  ChevronRight,
  LayoutTemplate,
  Pencil,
  Sparkles,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendNode } from "@/types/canvas";
import { Switch } from "@workspace/ui/components/switch";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { Button } from "@workspace/ui/components/button";
import { WebAppZone, PageSection } from "@workspace/canvas";
import { useRouter } from "next/navigation";
import { ReferralImagesUploader } from "../../backend-nodes/graph-nodes/nodes/gateway/web-app";

interface ZoneLayoutSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  currentZone: WebAppZone;
  webAppNodeId: string;
  onUpdateZone: (updatedZone: WebAppZone) => void;
}

export const ZoneLayoutSection = ({
  isOpen,
  onToggle,
  currentZone,
  webAppNodeId,
  onUpdateZone,
}: ZoneLayoutSectionProps) => {
  const router = useRouter();
  const projectId =
    typeof window !== "undefined"
      ? window.location.pathname.split("/project/")[1]?.split("/")[0] ?? ""
      : "";

  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);
  const addNode = useBackendCanvasStore((s) => s.addNode);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);

  const isLayoutEnabled = currentZone.hasLayout ?? false;
  const isPublic = currentZone.accessType === "public" || currentZone.id === "zone-public";
  const groupSlug =
    currentZone.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || (isPublic ? "public" : "protected");

  const webAppNode = nodes.find((n) => n.id === webAppNodeId);
  const zoneHandleId = currentZone.handleId;

  // Find edge connecting this zone handle to a WebPageNode layout
  const connectedLayoutEdge = edges.find((e) => {
    const isConn =
      (e.source === webAppNodeId && e.sourceHandle === zoneHandleId) ||
      (e.target === webAppNodeId && e.targetHandle === zoneHandleId);
    if (!isConn) return false;
    const otherId = e.source === webAppNodeId ? e.target : e.source;
    const otherNode = nodes.find((n) => n.id === otherId);
    return (
      otherNode?.type === "webPage" &&
      (Boolean(otherNode.data?.isLayout) || otherNode.data?.label?.trim().toLowerCase() === "layout")
    );
  });

  const connectedLayoutNode = connectedLayoutEdge
    ? nodes.find(
        (n) =>
          n.id ===
          (connectedLayoutEdge.source === webAppNodeId
            ? connectedLayoutEdge.target
            : connectedLayoutEdge.source),
      )
    : null;

  const handleCreateLayoutNode = () => {
    const newLayoutId = `webPage-layout-${Date.now()}`;
    const baseX = webAppNode?.position?.x ?? 100;
    const baseY = webAppNode?.position?.y ?? 100;

    const newLayoutNode: BackendNode = {
      id: newLayoutId,
      type: "webPage",
      fractionalIndex: "a0",
      position: {
        x: baseX + 380,
        y: baseY - 120,
      },
      data: {
        label: "layout",
        isLayout: true,
        description:
          currentZone.layoutDescription ||
          `Shared layout wrapper for ${currentZone.name} section (navigation, sidebar & session checks)`,
        sections: [
          {
            id: `sec-header-${Date.now()}`,
            name: "Header Navigation",
            renderMode: "server",
            loadStrategy: "eager",
            actions: [],
          },
          {
            id: `sec-children-${Date.now()}`,
            name: "Page Content ({children})",
            renderMode: "server",
            loadStrategy: "eager",
            actions: [],
          },
        ],
        useZoneDefault: true,
        zoneId: currentZone.id,
      },
    };

    addNode(newLayoutNode);

    const newEdgeId = `edge-${webAppNodeId}-${zoneHandleId}-${newLayoutId}-page-in`;
    addEdge({
      id: newEdgeId,
      source: webAppNodeId,
      sourceHandle: zoneHandleId,
      target: newLayoutId,
      targetHandle: "page-in",
      type: "connection",
    });

    onUpdateZone({
      ...currentZone,
      hasLayout: true,
    });

    toast.success(`Layout node created for ${currentZone.name}`);
  };

  const handleToggleLayout = (checked: boolean) => {
    onUpdateZone({
      ...currentZone,
      hasLayout: checked,
    });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateZone({
      ...currentZone,
      layoutDescription: e.target.value,
    });
  };

  const handleImagesChange = (images: string[], primaryUrl?: string) => {
    onUpdateZone({
      ...currentZone,
      layoutImages: images,
      layoutImageUrl: primaryUrl || images[0] || undefined,
    });
  };

  return (
    <div className="flex flex-col rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm overflow-hidden transition-all">
      {/* Section Accordion Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/40 transition-colors select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="p-0.5 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
            <LayoutTemplate className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                Route Group Layout
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border/50">
                app/({groupSlug})/layout.tsx
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Shared layout wrapper, navigation, sidebar & session checks
            </span>
          </div>
        </div>

        {/* Layout Enable/Disable Switch */}
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Label
            htmlFor="zone-layout-switch"
            className="text-xs font-mono font-medium text-muted-foreground cursor-pointer"
          >
            {isLayoutEnabled ? "Enabled" : "Disabled"}
          </Label>
          <Switch
            id="zone-layout-switch"
            checked={isLayoutEnabled}
            onCheckedChange={handleToggleLayout}
          />
        </div>
      </div>

      {/* Section Content */}
      {isOpen && (
        <div className="p-4 pt-0 border-t border-border/40 flex flex-col gap-4 mt-3">
          {isLayoutEnabled ? (
            <>
              {/* Interactive Canvas Layout Node Status / Action */}
              {connectedLayoutNode ? (
                <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-indigo-500/20 text-indigo-400">
                        <LayoutTemplate className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground">
                            {connectedLayoutNode.data?.label || "layout"}
                          </span>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            app/({groupSlug})/layout.tsx
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Interactive canvas node with buttons and sections
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (projectId) router.push(`/project/${projectId}/pages/${connectedLayoutNode.id}`);
                      }}
                      className="h-7 text-xs bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border-indigo-500/40 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3 mr-1" /> Edit in Studio
                    </Button>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t border-indigo-500/15">
                    <span>
                      Sections: <strong className="text-foreground">{connectedLayoutNode.data?.sections?.length || 0}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Buttons / Actions:{" "}
                      <strong className="text-foreground">
                        {connectedLayoutNode.data?.sections?.reduce(
                          (acc: number, s: PageSection) => acc + (s.actions?.length || 0),
                          0,
                        ) || 0}
                      </strong>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-dashed border-border/70">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-foreground">Interactive Layout Node</span>
                    <span className="text-[11px] text-muted-foreground">
                      Add an interactive canvas node with sections, buttons & Studio editor.
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateLayoutNode}
                    className="h-7 text-xs bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer shrink-0 ml-2"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Create Layout Node
                  </Button>
                </div>
              )}

              {/* Layout Description */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Layout Prompt & Description
                </Label>
                <Textarea
                  value={currentZone.layoutDescription || ""}
                  onChange={handleDescriptionChange}
                  placeholder="Describe the layout structure (e.g. persistent sidebar with collapsible nav links, sticky topbar with user profile and theme switch, footer)..."
                  className="text-xs min-h-[70px] bg-background resize-y leading-relaxed"
                />
                <span className="text-[10px] text-muted-foreground">
                  Used by the compiler and AI code editor to build the shared wrapper.
                </span>
              </div>

              {/* Referral Mockup Images */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border/40">
                <Label className="text-xs font-medium text-muted-foreground">
                  Referral Mockups & Wireframe Images
                </Label>
                <ReferralImagesUploader
                  images={currentZone.layoutImages || []}
                  primaryImageUrl={currentZone.layoutImageUrl}
                  onImagesChange={handleImagesChange}
                  compact={false}
                />
              </div>
            </>
          ) : (
            <div className="py-3 px-3 rounded-lg bg-muted/20 border border-dashed border-border/60 text-center">
              <span className="text-xs text-muted-foreground">
                Group layout is currently disabled. Pages in this section will render directly without a shared <code className="font-mono text-foreground">layout.tsx</code> wrapper.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

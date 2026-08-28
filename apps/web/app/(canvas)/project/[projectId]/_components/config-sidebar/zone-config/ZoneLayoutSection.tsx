"use client";

import React from "react";
import {
  ChevronDown,
  ChevronRight,
  LayoutTemplate,
  Pencil,
  Sparkles,
} from "lucide-react";
import { Switch } from "@workspace/ui/components/switch";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { Button } from "@workspace/ui/components/button";
import { WebAppZone } from "@workspace/canvas";
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

  const isLayoutEnabled = currentZone.hasLayout ?? false;
  const isPublic = currentZone.accessType === "public" || currentZone.id === "zone-public";
  const groupSlug =
    currentZone.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || (isPublic ? "public" : "protected");

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
              {/* Visual Editor Strip */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/60">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Customize layout components and code in Studio</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (projectId) {
                      router.push(`/project/${projectId}/pages/${webAppNodeId}`);
                    }
                  }}
                  className="h-7 text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 border-indigo-500/30 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Edit UI in Editor
                </Button>
              </div>

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

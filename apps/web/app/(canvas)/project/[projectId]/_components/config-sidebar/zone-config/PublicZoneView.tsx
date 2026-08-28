import React, { useState } from "react";
import { Globe, Plus, Trash2 } from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { BackendNode } from "@/types/canvas";
import { WebAppZone } from "@workspace/canvas";
import { ZoneLayoutSection } from "./ZoneLayoutSection";

interface PublicZoneViewProps {
  currentZone: WebAppZone;
  webAppNodeId: string;
  connectedPages: BackendNode[];
  allWebPageNodes: BackendNode[];
  onCreateNewPage: () => void;
  onTogglePageConnection: (pageId: string, isConnected: boolean) => void;
  onUpdateZone: (updatedZone: WebAppZone) => void;
}

export const PublicZoneView = ({
  currentZone,
  webAppNodeId,
  connectedPages,
  allWebPageNodes,
  onCreateNewPage,
  onTogglePageConnection,
  onUpdateZone,
}: PublicZoneViewProps) => {
  const [layoutOpen, setLayoutOpen] = useState(true);
  const unattachedPages = allWebPageNodes.filter(
    (w) => !connectedPages.some((p) => p.id === w.id),
  );

  return (
    <div className="flex flex-col gap-6 mt-6 pb-12">
      <div className="flex flex-col gap-2 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-500 rounded border border-emerald-500/20 shadow-sm flex items-center gap-1">
            <Globe className="w-3.5 h-3.5" /> PUBLIC SECTION
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            {currentZone.name}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          This section is for unprotected pages like landing, pricing, about, etc. No authentication or redirect rules required.
        </span>
      </div>

      {/* Route Group Layout Section */}
      <ZoneLayoutSection
        isOpen={layoutOpen}
        onToggle={() => setLayoutOpen((prev) => !prev)}
        currentZone={currentZone}
        webAppNodeId={webAppNodeId}
        onUpdateZone={onUpdateZone}
      />

      <div className="flex flex-col gap-4 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Managed Web Pages ({connectedPages.length})
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs cursor-pointer"
            onClick={onCreateNewPage}
          >
            <Plus className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Add New Page
          </Button>
        </div>

        <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground font-medium">
              Pick Available Web Page to Attach
            </Label>
            <Select
              onValueChange={(pageId) => {
                if (pageId && pageId !== "_none") {
                  onTogglePageConnection(pageId, false);
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Select a web page on canvas..." />
              </SelectTrigger>
              <SelectContent>
                {unattachedPages.length === 0 ? (
                  <SelectItem value="_none" disabled className="text-xs font-mono text-muted-foreground italic">
                    No available unattached web pages
                  </SelectItem>
                ) : (
                  unattachedPages.map((w) => (
                    <SelectItem key={w.id} value={w.id} className="text-xs font-mono">
                      {w.data?.label || "Web Page"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <Label className="text-xs text-muted-foreground font-medium">
              Currently Connected Public Pages ({connectedPages.length})
            </Label>
            {connectedPages.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">
                No public pages connected yet.
              </span>
            ) : (
              <div className="flex flex-col gap-1.5">
                {connectedPages.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border/50 text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2 font-mono">
                      <Globe className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="font-semibold text-foreground">
                        {p.data?.label || "Page"}
                      </span>
                    </div>
                    <button
                      onClick={() => onTogglePageConnection(p.id, true)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                      title="Detach page"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

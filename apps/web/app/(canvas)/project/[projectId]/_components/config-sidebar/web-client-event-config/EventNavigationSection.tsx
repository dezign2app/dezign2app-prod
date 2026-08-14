import React from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Globe, Plus, CheckCircle2 } from "lucide-react";
import { UIEventItem } from "@/types/canvas";

interface EventNavigationSectionProps {
  eventId: string;
  nodeId: string;
  eventName: string;
  eventType: string;
  customEvent: string;
  item: UIEventItem;
  handleUpdateEvent: (
    name: string,
    finalEvent: string,
    extraChanges?: Partial<UIEventItem>,
  ) => void;
}

export const EventNavigationSection: React.FC<EventNavigationSectionProps> = ({
  eventId,
  nodeId,
  eventName,
  eventType,
  customEvent,
  item,
  handleUpdateEvent,
}) => {
  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const allEdges = useBackendCanvasStore((s) => s.edges);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const addNode = useBackendCanvasStore((s) => s.addNode);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);

  const parentNode = allNodes.find((n) => n.id === nodeId);
  // Available WebClient / Page nodes on canvas (excluding self)
  const pageNodes = allNodes.filter(
    (n) => n.type === "webClient" && n.id !== nodeId,
  );

  // Check if connected to a PageRef node via an edge
  const connectedEdge = allEdges.find(
    (e) => e.source === nodeId && e.sourceHandle === `events-${eventId}`,
  );
  const connectedPageRefNode = connectedEdge
    ? allNodes.find((n) => n.id === connectedEdge.target && n.type === "page_ref")
    : null;

  const handleSpawnPageRefNode = () => {
    if (!parentNode) return;
    const pos = parentNode.position || { x: 100, y: 100 };
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

  const selectedPageId =
    item.targetPageId ||
    connectedPageRefNode?.data?.targetPageId ||
    connectedPageRefNode?.data?.pageRefId ||
    item.targetRoute ||
    "";

  const handleSelectPage = (pageId: string) => {
    const selectedP = pageNodes.find((p) => p.id === pageId);
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
      : pageId;

    // Update event data
    handleUpdateEvent(
      eventName,
      eventType === "other" ? customEvent : eventType,
      {
        targetPageId: selectedP ? pageId : undefined,
        targetRoute: path,
      },
    );

    // If connected to a PageRefNode, sync the target page on the PageRefNode as well
    if (connectedPageRefNode) {
      updateNode(connectedPageRefNode.id, {
        data: {
          ...connectedPageRefNode.data,
          targetPageId: pageId,
          pageRefId: pageId,
          targetPageLabel: pageLabel,
          label: `Ref: ${isRoot ? "/" : pageLabel}`,
        },
      });
    }
  };

  return (
    <AccordionItem
      value="navigation"
      className="border rounded-xl overflow-hidden bg-card"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/20 transition-colors [&>svg]:shrink-0">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-indigo-500" />
          <span className="text-xs font-semibold">
            Target Page Navigation
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-2">
        <div className="flex flex-col gap-3 text-xs">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Globe size={10} className="text-indigo-500" /> Select Target Web Page
            </Label>
            {connectedPageRefNode && (
              <Badge
                variant="outline"
                className="text-[9px] font-mono bg-indigo-500/15 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shrink-0 flex items-center gap-1"
              >
                <CheckCircle2 size={10} /> Connected PageRef Node
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedPageId} onValueChange={handleSelectPage}>
              <SelectTrigger className="h-8 text-xs bg-background flex-1">
                <SelectValue placeholder="Select target web page..." />
              </SelectTrigger>
              <SelectContent>
                {pageNodes.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground italic">
                    No web client pages defined on canvas
                  </div>
                ) : (
                  pageNodes.map((p) => {
                    const label = p.data?.label || "Untitled Page";
                    const clean = label.trim().toLowerCase();
                    const isHome =
                      p.data?.isRoot === true ||
                      clean === "/" ||
                      clean === "home" ||
                      clean === "index";
                    return (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="font-medium truncate">📄 {label}</span>
                          {isHome && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-mono">
                              / (Root)
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>

            {!connectedPageRefNode && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shrink-0"
                onClick={handleSpawnPageRefNode}
                title="Spawn & Connect PageRef node on canvas"
              >
                <Plus size={11} className="mr-1" /> Connect PageRef
              </Button>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { ExternalLink, Compass, Globe, ArrowRight, CornerDownRight } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useShallow } from "zustand/react/shallow";
import { Textarea } from "@workspace/ui/components/textarea";

import {
  NodeHeader,
  useSimulationNodeState,
  getSimulationNodeBorderClass,
} from "../../common";

export const PageRefNode = ({
  id,
  data,
  selected,
}: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const edges = useBackendCanvasStore((s) => s.edges);
  const nodes = useBackendCanvasStore((s) => s.nodes);

  const simulation = useSimulationNodeState(id);
  const borderClass = getSimulationNodeBorderClass(
    simulation,
    Boolean(selected),
  );

  // Available WebPage nodes on canvas
  const pageNodes = useBackendCanvasStore(
    useShallow((s) =>
      s.nodes.filter((n) => n?.type === "webPage"),
    ),
  );

  // Selected target page node
  const selectedPage = pageNodes.find((p) => p.id === (data.targetPageId || data.pageRefId));

  // Find incoming event connections that navigate to this page reference node
  const incomingEdges = edges.filter((e) => e.target === id);
  const callers = incomingEdges
    .map((edge) => {
      const srcNode = nodes.find((n) => n.id === edge.source);
      if (!srcNode) return null;

      const srcLabel = srcNode.data?.label || "Web Page";
      const sourceHandle = edge.sourceHandle || "";
      let eventName = "Navigation Event";

      if (sourceHandle.startsWith("events-")) {
        const eventId = sourceHandle.replace("events-", "");
        const evtItem = srcNode.data?.events?.find((e: { id: string; name?: string; event?: string }) => e.id === eventId);
        if (evtItem) {
          eventName = evtItem.name || evtItem.event || "navigateToPage";
        }
      }

      return {
        id: edge.id,
        srcLabel,
        eventName,
      };
    })
    .filter(
      (x): x is { id: string; srcLabel: string; eventName: string } => x !== null,
    );

  const handlePageSelect = (pageId: string) => {
    const page = pageNodes.find((p) => p.id === pageId);
    const pageLabel = page?.data?.label || "Page";
    const cleanLabel = pageLabel.trim().toLowerCase();
    const isRoot =
      page?.data?.isRoot === true ||
      cleanLabel === "/" ||
      cleanLabel === "home" ||
      cleanLabel === "index" ||
      cleanLabel === "landing";

    updateNode(id, {
      data: {
        ...data,
        targetPageId: pageId,
        pageRefId: pageId,
        targetPageLabel: pageLabel,
        label: `Ref: ${isRoot ? "/" : pageLabel}`,
      },
    });
  };

  const selectedCleanLabel = (selectedPage?.data?.label || "").trim().toLowerCase();
  const isSelectedLanding =
    selectedPage?.data?.isRoot === true ||
    selectedCleanLabel === "/" ||
    selectedCleanLabel === "home" ||
    selectedCleanLabel === "index" ||
    selectedCleanLabel === "landing";

  return (
    <div
      className={cn(
        "shadow-md rounded-xl bg-card border-2 min-w-[210px] max-w-[320px] flex flex-col transition-all duration-300 relative",
        borderClass,
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="page-ref-in"
        className="w-2.5 h-2.5 !bg-indigo-500 rounded-full border-2 border-background -left-1.5"
        style={{ top: "20px" }}
        title="Connect from WebClient event"
      />

      <NodeHeader
        id={id}
        data={data}
        nodeType="page_ref"
        icon={Compass}
        title="Page Reference"
        colorClass="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
        selected={selected}
      />

      {/* Description */}
      <div className="px-3 py-2 bg-secondary/5 border-b nodrag">
        <Textarea
          className="min-h-[20px] text-xs bg-transparent border-none shadow-none p-1 resize-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
          placeholder="description"
          value={data.description || ""}
          onChange={(e) =>
            updateNode(id, { data: { ...data, description: e.target.value } })
          }
        />
      </div>

      {/* Select Page Dropdown */}
      <div className="p-3 flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Globe size={11} className="text-indigo-500" /> Target Page
        </label>
        <Select
          value={data.targetPageId || data.pageRefId || ""}
          onValueChange={handlePageSelect}
        >
          <SelectTrigger className="h-8 text-xs bg-background">
            <SelectValue placeholder="Select target page..." />
          </SelectTrigger>
          <SelectContent>
            {pageNodes.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground italic">
                No pages defined on canvas
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
                      <span className="font-medium truncate">{label}</span>
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
      </div>
    </div>
  );
};

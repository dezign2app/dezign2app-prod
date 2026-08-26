import React from "react";
import { Plus, Layers } from "lucide-react";
import { BackendNode, Endpoint, UIEventItem, PageSection } from "@/types/canvas";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { generateId } from "../../../common";
import { Button } from "@workspace/ui/components/button";
import { SectionBlock } from "./SectionBlock";

export interface SectionListProps {
  nodeId: string;
  sections?: PageSection[];
  updateNode: (id: string, changes: Partial<BackendNode>) => void;
  data: BackendNode["data"];
  onTriggerEvent: (triggerInfo: {
    event: UIEventItem;
    targetNode: BackendNode;
    endpoint: Endpoint;
  }) => void;
}

export const SectionList = ({
  nodeId,
  sections = [],
  updateNode,
  data,
  onTriggerEvent,
}: SectionListProps) => {
  const edges = useBackendCanvasStore((s) => s.edges);
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);

  const getLinkedEndpoint = (
    eventId: string,
    fromNodeId: string = nodeId,
    depth: number = 0,
  ): { targetNode: BackendNode; endpoint: Endpoint } | null => {
    if (depth > 5) return null;

    const edge = edges.find(
      (e) => e.source === fromNodeId && e.sourceHandle === `events-${eventId}`,
    );
    if (!edge || !edge.targetHandle) return null;

    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!targetNode) return null;

    if (
      edge.targetHandle.startsWith("pageload-in-") ||
      edge.targetHandle.startsWith("sse-in-") ||
      edge.targetHandle.startsWith("websocket-in-") ||
      edge.targetHandle.startsWith("webrtc-in-") ||
      edge.targetHandle.startsWith("ws-in-")
    ) {
      const targetEventId = edge.targetHandle.replace(
        /^(pageload|sse|websocket|webrtc|ws)-in-/,
        "",
      );
      return getLinkedEndpoint(targetEventId, edge.target, depth + 1);
    }

    const messagingTypes: string[] = [
      "kafka",
      "sqs",
      "redis-streams",
      "redis-pubsub",
      "pubsub",
      "eventstream",
      "queue",
    ];
    if (messagingTypes.includes(targetNode.type)) {
      const resourceId = edge.targetHandle.includes(":")
        ? edge.targetHandle.split(":").pop()
        : edge.targetHandle.split("-in-").pop();
      const resourceList =
        targetNode.data?.topics ||
        targetNode.data?.queues ||
        targetNode.data?.streams ||
        targetNode.data?.channels ||
        [];
      const resource =
        resourceList.find(
          (r: { id: string; name?: string }) => r.id === resourceId,
        ) || resourceList[0];
      const name = resource?.name || targetNode.data?.label || "Topic";
      const endpoint: Endpoint = {
        id: resource?.id || targetNode.id,
        name: name,
        type: targetNode.type.toUpperCase(),
        summary: `Messaging Topic on ${targetNode.data?.label || "Kafka"}`,
      };
      return { targetNode, endpoint };
    }

    if (
      edge.targetHandle.startsWith("consumedEvents-in-") ||
      edge.targetHandle.startsWith("publishedEvents-out-") ||
      edge.targetHandle.startsWith("publishedEvents-in-")
    ) {
      const eventIdMatch = edge.targetHandle.replace(
        /^(consumedEvents|publishedEvents)-(in|out)-/,
        "",
      );
      const consumedEv = targetNode.data?.consumedEvents?.find(
        (e: { id: string; name?: string }) => e.id === eventIdMatch,
      );
      const publishedEv = targetNode.data?.publishedEvents?.find(
        (e: { id: string; name?: string }) => e.id === eventIdMatch,
      );
      const ev = consumedEv || publishedEv;
      const endpoint: Endpoint = {
        id: ev?.id || eventIdMatch,
        name: ev?.name || "Event Handler",
        type: "EVENT",
      };
      return { targetNode, endpoint };
    }

    const parts = edge.targetHandle.split("-in-");
    const endpointId = parts[parts.length - 1];
    if (!endpointId) return null;

    let endpoint: Endpoint | undefined = endpoints.find(
      (ep) => ep.nodeId === targetNode.id && ep.id === endpointId,
    );

    if (!endpoint)
      endpoint = targetNode.data?.endpoints?.find((ep) => ep.id === endpointId);

    if (!endpoint && targetNode.data?.routeGroups) {
      for (const group of targetNode.data.routeGroups) {
        endpoint = group.endpoints?.find((ep) => ep.id === endpointId);
        if (endpoint) break;
      }
    }

    if (!endpoint) return null;

    return { targetNode, endpoint };
  };

  // Auto-wrap legacy flat events into a default section if sections is not yet initialized
  React.useEffect(() => {
    if ((!sections || sections.length === 0) && data?.events && data.events.length > 0) {
      updateNode(nodeId, {
        data: {
          ...data,
          sections: [
            {
              id: `sec-${generateId()}`,
              name: "Main Section",
              renderMode: "client",
              loadStrategy: "eager",
              actions: data.events,
            },
          ],
        },
      });
    }
  }, [nodeId, sections, data, updateNode]);

  const updateSections = (newSections: PageSection[]) => {
    updateNode(nodeId, { data: { ...data, sections: newSections } });
  };

  const handleAddSection = () => {
    const newSection: PageSection = {
      id: `sec-${generateId()}`,
      name: `Section ${sections.length + 1}`,
      renderMode: "client",
      loadStrategy: "eager",
      actions: [],
    };
    updateSections([...sections, newSection]);
  };

  if (!sections.length) {
    return (
      <div className="bg-secondary/20 p-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border/60 cursor-pointer"
          onClick={handleAddSection}
        >
          <Plus size={12} className="mr-1" /> Add Section
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="px-3 py-1.5 bg-secondary/40 border-t border-b text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex justify-between items-center group">
        <span className="flex items-center gap-1">
          <Layers size={11} /> Sections & Actions
        </span>
        <button
          type="button"
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-[9px] font-medium transition-all cursor-pointer"
          onClick={handleAddSection}
          title="Add new section"
        >
          <Plus size={10} /> Add Section
        </button>
      </div>

      <div className="flex flex-col">
        {sections.map((section) => (
          <SectionBlock
            key={section.id}
            nodeId={nodeId}
            section={section}
            sections={sections}
            updateSections={updateSections}
            getLinkedEndpoint={getLinkedEndpoint}
            onTriggerEvent={onTriggerEvent}
          />
        ))}

        {/* Bottom Add Section quick action */}
        <button
          type="button"
          onClick={handleAddSection}
          className="flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors border-t border-dashed border-border/50 cursor-pointer nodrag"
        >
          <Plus size={11} /> Add Section
        </button>
      </div>
    </>
  );
};

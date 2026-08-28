"use client";

import React from "react";
import { UIEventItem, BackendNode, Endpoint } from "@/types/canvas";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Play,
  Settings,
  Trash,
  Copy,
  Zap,
  Radio,
  Wifi,
  Video,
  RefreshCw,
  MousePointerClick,
  Send,
  Sliders,
  ChevronDown,
  ChevronRight,
  Info,
  Compass,
} from "lucide-react";
import { EVENT_OPTIONS, collectEndpoints } from "@workspace/canvas";
import { cn } from "@workspace/ui/lib/utils";

export interface SectionActionCardProps {
  action: UIEventItem;
  nodeId: string;
  sectionId: string;
  isExpanded: boolean;
  serviceNodes: BackendNode[];
  endpoints: (Endpoint & { nodeId: string })[];
  linkedTargetNode?: BackendNode;
  linkedEndpoint?: Endpoint;
  onToggleExpand: () => void;
  onUpdateAction: (changes: Partial<UIEventItem>) => void;
  onDeleteAction: () => void;
  onDuplicateAction: () => void;
  onServiceLink: (serviceId: string, endpointId?: string) => void;
  onOpenTesting: (targetNodeId: string, endpointId: string) => void;
  onOpenEventConfig: () => void;
}

export const getEventBadge = (evtStr?: string) => {
  const evt = (evtStr || "click").toLowerCase();
  let icon = <MousePointerClick size={10} />;
  let label = evtStr || "click";

  if (evt === "sse" || evt === "ssemessage") {
    icon = <Radio size={10} />;
    label = "SSE";
  } else if (evt === "websocket" || evt === "ws" || evt === "websocketmessage") {
    icon = <Wifi size={10} />;
    label = "WebSocket";
  } else if (evt === "webrtc") {
    icon = <Video size={10} />;
    label = "WebRTC";
  } else if (evt === "polling") {
    icon = <RefreshCw size={10} />;
    label = "Polling";
  } else if (evt === "pageload") {
    icon = <Zap size={10} />;
    label = "PageLoad";
  } else if (evt === "navigatetopage") {
    icon = <Compass size={10} />;
    label = "Navigate";
  } else if (evt === "submit") {
    icon = <Send size={10} />;
    label = "Submit";
  } else if (evt === "change" || evt === "input") {
    icon = <Sliders size={10} />;
    label = "Change";
  }

  return (
    <Badge
      variant="outline"
      className="bg-secondary/50 text-muted-foreground border-border/50 text-[10px] gap-1 font-mono font-normal"
    >
      {icon}
      <span>{label}</span>
    </Badge>
  );
};

export const SectionActionCard: React.FC<SectionActionCardProps> = ({
  action,
  nodeId,
  sectionId,
  isExpanded,
  serviceNodes,
  endpoints,
  linkedTargetNode,
  linkedEndpoint,
  onToggleExpand,
  onUpdateAction,
  onDeleteAction,
  onDuplicateAction,
  onServiceLink,
  onOpenTesting,
  onOpenEventConfig,
}) => {
  const isNavigate = action.event === "navigateToPage";

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border transition-all duration-150 overflow-hidden",
        isExpanded
          ? "border-border bg-secondary/20 shadow-sm"
          : "border-border/50 bg-secondary/10 hover:border-border/80 hover:bg-secondary/20",
      )}
    >
      {/* Action Summary Card Header */}
      <div className="p-3 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={onToggleExpand}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium text-xs text-foreground truncate">
                {action.name || "Unnamed Action"}
              </span>
              {getEventBadge(action.event)}
            </div>

            {/* Connected Target or Navigation status subtitle */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 truncate">
              {isNavigate ? (
                <span className="font-mono flex items-center gap-1 text-muted-foreground">
                  <Compass size={11} /> Target Page Node Connected
                </span>
              ) : linkedTargetNode && linkedEndpoint ? (
                <span className="font-mono flex items-center gap-1 text-muted-foreground">
                  <Zap size={11} /> {linkedTargetNode.data?.label || "Service"} &rarr;{" "}
                  <span className="text-foreground/90 font-medium">
                    {linkedEndpoint.type || "POST"} {linkedEndpoint.name}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground/60 italic flex items-center gap-1">
                  <Info size={11} /> Not connected to endpoint
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Card Quick Action Icons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Test / Simulate Trigger Button */}
          {linkedTargetNode && linkedEndpoint && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary"
              onClick={() => onOpenTesting(linkedTargetNode.id, linkedEndpoint.id)}
              title="Simulate / Test Trigger"
            >
              <Play size={12} />
            </Button>
          )}

          {/* Open Deep Action Configuration */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary gap-1"
            onClick={onOpenEventConfig}
            title="Open Deep Action & Protocol Configuration"
          >
            <Settings size={12} />
            <span>Configure</span>
          </Button>

          {/* Duplicate */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary"
            onClick={onDuplicateAction}
            title="Duplicate Action"
          >
            <Copy size={12} />
          </Button>

          {/* Delete */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={onDeleteAction}
            title="Delete Action"
          >
            <Trash size={12} />
          </Button>
        </div>
      </div>

      {/* Inline Expanded Quick Config Fields */}
      {isExpanded && (
        <div className="p-3.5 border-t border-border/40 bg-secondary/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Action Handler Name */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Action Handler Name
              </Label>
              <Input
                value={action.name}
                onChange={(e) => onUpdateAction({ name: e.target.value })}
                placeholder="e.g. onSubmit, onClickCheckout"
                className="h-7 text-xs font-mono bg-background/50 border-border/50"
              />
            </div>

            {/* Trigger Event Type */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Trigger Event Type
              </Label>
              <Select
                value={action.event || "click"}
                onValueChange={(val) => onUpdateAction({ event: val })}
              >
                <SelectTrigger className="h-7 text-xs bg-background/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt} className="text-xs font-mono">
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Connected Service / Endpoint Selector */}
          {!isNavigate && (
            <div className="space-y-1.5 p-2.5 rounded-lg bg-background/40 border border-border/40">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <Zap size={11} className="text-muted-foreground" />
                  Target Backend Service & Endpoint
                </Label>
                {linkedTargetNode && linkedEndpoint && (
                  <Badge variant="outline" className="bg-secondary/60 text-muted-foreground border-border/50 text-[9px]">
                    Connected
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Service Selector */}
                <Select
                  value={linkedTargetNode?.id || "none"}
                  onValueChange={(srvId) => onServiceLink(srvId)}
                >
                  <SelectTrigger className="h-7 text-xs bg-background/50 border-border/50">
                    <SelectValue placeholder="Select Service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      -- No Service Linked --
                    </SelectItem>
                    {serviceNodes.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.data?.label || s.id} ({s.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Endpoint Selector */}
                {linkedTargetNode && (
                  <Select
                    value={linkedEndpoint?.id || "none"}
                    onValueChange={(epId) => onServiceLink(linkedTargetNode.id, epId)}
                  >
                    <SelectTrigger className="h-7 text-xs bg-background/50 border-border/50">
                      <SelectValue placeholder="Select Endpoint" />
                    </SelectTrigger>
                    <SelectContent>
                      {collectEndpoints(linkedTargetNode, endpoints).map((ep) => (
                        <SelectItem key={ep.id} value={ep.id} className="text-xs font-mono">
                          {ep.type || "POST"} {ep.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          {/* Action Description & AI Trigger Prompt */}
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground font-medium">
                Action Purpose / AI Description
              </Label>
              <Input
                value={action.description || ""}
                onChange={(e) => onUpdateAction({ description: e.target.value })}
                placeholder="e.g. Validates form data and sends authentication payload."
                className="h-7 text-xs bg-background/50 border-border/50"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-muted-foreground">
                Custom headers, parameters, request body, or protocols?
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] text-muted-foreground hover:text-foreground px-2 hover:bg-secondary"
                onClick={onOpenEventConfig}
              >
                Deep Config &rarr;
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

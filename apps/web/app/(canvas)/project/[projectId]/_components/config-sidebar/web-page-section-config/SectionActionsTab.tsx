"use client";

import React from "react";
import { UIEventItem, BackendNode, Endpoint } from "@/types/canvas";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Zap,
  Plus,
  Search,
  Sparkles,
  Send,
  MousePointerClick,
  Compass,
  Radio,
  Wifi,
  RefreshCw,
} from "lucide-react";
import { SectionActionCard } from "./SectionActionCard";

export interface SectionActionsTabProps {
  nodeId: string;
  sectionId: string;
  actions: UIEventItem[];
  actionSearch: string;
  expandedActionId: string | null;
  serviceNodes: BackendNode[];
  endpoints: (Endpoint & { nodeId: string })[];
  getActionLink: (actionId: string) => {
    targetNode: BackendNode;
    endpoint?: Endpoint;
  } | null;
  onSetActionSearch: (query: string) => void;
  onSetExpandedActionId: (id: string | null) => void;
  onAddAction: (name?: string, eventType?: string) => void;
  onUpdateAction: (actionId: string, changes: Partial<UIEventItem>) => void;
  onDeleteAction: (actionId: string) => void;
  onDuplicateAction: (action: UIEventItem) => void;
  onServiceLink: (actionId: string, serviceId: string, endpointId?: string) => void;
  onOpenTesting: (actionId: string, targetNodeId: string, endpointId: string) => void;
  onOpenEventConfig: (actionId: string) => void;
}

export const SectionActionsTab: React.FC<SectionActionsTabProps> = ({
  nodeId,
  sectionId,
  actions,
  actionSearch,
  expandedActionId,
  serviceNodes,
  endpoints,
  getActionLink,
  onSetActionSearch,
  onSetExpandedActionId,
  onAddAction,
  onUpdateAction,
  onDeleteAction,
  onDuplicateAction,
  onServiceLink,
  onOpenTesting,
  onOpenEventConfig,
}) => {
  const filteredActions = actionSearch.trim()
    ? actions.filter(
        (a) =>
          a.name.toLowerCase().includes(actionSearch.toLowerCase()) ||
          (a.event && a.event.toLowerCase().includes(actionSearch.toLowerCase())),
      )
    : actions;

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto m-0 outline-none">
      {/* Actions Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Zap size={13} className="text-muted-foreground" />
            Interactive Actions & Triggers
          </span>
          <span className="text-[11px] text-muted-foreground">
            DOM events, submissions, streams, and navigation handlers.
          </span>
        </div>

        <Button
          size="sm"
          className="h-7 text-xs px-2.5 font-medium gap-1 shrink-0"
          onClick={() => onAddAction(`action_${actions.length + 1}`, "click")}
        >
          <Plus size={12} /> Add Action
        </Button>
      </div>

      {/* Quick Action Presets */}
      <div className="space-y-1.5 p-3 rounded-xl bg-secondary/20 border border-border/50">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
          <Sparkles size={11} className="text-muted-foreground" /> Quick Add Triggers
        </span>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            { label: "Submit Form", event: "submit", name: "onSubmit", icon: Send },
            { label: "Button Click", event: "click", name: "onClickAction", icon: MousePointerClick },
            { label: "Page Navigation", event: "navigateToPage", name: "onNavigate", icon: Compass },
            { label: "SSE Stream", event: "sse", name: "onStreamEvent", icon: Radio },
            { label: "WebSocket", event: "websocket", name: "onWebSocketMessage", icon: Wifi },
            { label: "Polling", event: "polling", name: "onPollData", icon: RefreshCw },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.event}
                type="button"
                onClick={() => onAddAction(item.name, item.event)}
                className="text-[11px] px-2.5 py-1 rounded-md bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/40 hover:border-border transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Icon size={11} className="text-muted-foreground" />
                <span>+ {item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Filter if > 3 actions */}
      {actions.length > 3 && (
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={actionSearch}
            onChange={(e) => onSetActionSearch(e.target.value)}
            placeholder="Search actions or triggers..."
            className="h-7 text-xs pl-8 bg-secondary/20 border-border/50"
          />
        </div>
      )}

      {/* Actions List */}
      <div className="space-y-2.5">
        {actions.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border/70 text-center flex flex-col items-center gap-2.5 bg-secondary/10">
            <div className="p-2.5 rounded-full bg-secondary text-muted-foreground border border-border/60">
              <Zap size={18} />
            </div>
            <div className="flex flex-col gap-0.5 max-w-xs">
              <span className="text-xs font-medium text-foreground">
                No actions declared for this section yet
              </span>
              <span className="text-[11px] text-muted-foreground">
                Connect UI elements to backend service endpoints or navigation.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5 mt-1 border-border/60"
              onClick={() => onAddAction("onActionClick", "click")}
            >
              <Plus size={12} /> Create First Action
            </Button>
          </div>
        ) : filteredActions.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground bg-secondary/20 rounded-lg">
            No actions matching &quot;{actionSearch}&quot;
          </div>
        ) : (
          filteredActions.map((act) => {
            const link = getActionLink(act.id);
            return (
              <SectionActionCard
                key={act.id}
                action={act}
                nodeId={nodeId}
                sectionId={sectionId}
                isExpanded={expandedActionId === act.id}
                serviceNodes={serviceNodes}
                endpoints={endpoints}
                linkedTargetNode={link?.targetNode}
                linkedEndpoint={link?.endpoint}
                onToggleExpand={() =>
                  onSetExpandedActionId(expandedActionId === act.id ? null : act.id)
                }
                onUpdateAction={(changes) => onUpdateAction(act.id, changes)}
                onDeleteAction={() => onDeleteAction(act.id)}
                onDuplicateAction={() => onDuplicateAction(act)}
                onServiceLink={(srvId, epId) => onServiceLink(act.id, srvId, epId)}
                onOpenTesting={(targetNodeId, epId) =>
                  onOpenTesting(act.id, targetNodeId, epId)
                }
                onOpenEventConfig={() => onOpenEventConfig(act.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

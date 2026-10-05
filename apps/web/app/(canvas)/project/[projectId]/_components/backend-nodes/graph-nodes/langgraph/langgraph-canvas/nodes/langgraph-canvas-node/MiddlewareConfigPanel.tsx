import React from "react";
import { Shield, ShieldCheck, Trash2, Plus } from "lucide-react";
import { Switch } from "@workspace/ui/components/switch";
import { Button } from "@workspace/ui/components/button";
import { useReactFlow, type Edge } from "@xyflow/react";
import type {
  LangGraphCanvasNode,
  LangGraphMiddlewareRefNode,
  MiddlewareNode,
} from "@workspace/canvas";

function isMiddlewareRefNode(
  node: LangGraphCanvasNode | undefined,
): node is LangGraphMiddlewareRefNode {
  return node?.type === "langgraph_middleware_ref";
}

function isMiddlewareNode(
  node: LangGraphCanvasNode | undefined,
): node is MiddlewareNode {
  return node?.type === "langgraph_middleware";
}

interface MiddlewareConfigPanelProps {
  middlewareConfig?: {
    enabled?: boolean;
  };
  boundMiddlewares: Edge[];
  handleToggleMiddlewareConfig: (enabled: boolean) => void;
  handleRemoveMiddleware?: (sourceId: string) => void;
  handleAddDefaultMiddleware?: () => void;
}

export const MiddlewareConfigPanel: React.FC<MiddlewareConfigPanelProps> = ({
  middlewareConfig,
  boundMiddlewares,
  handleToggleMiddlewareConfig,
  handleRemoveMiddleware,
  handleAddDefaultMiddleware,
}) => {
  const isEnabled = Boolean(middlewareConfig?.enabled);
  const { getNodes } = useReactFlow<LangGraphCanvasNode>();
  const allNodes = getNodes();

  return (
    <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/20 nodrag">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={`p-1 rounded shrink-0 ${
              isEnabled
                ? "bg-purple-500/20 text-purple-400"
                : "bg-muted/30 text-muted-foreground"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5 truncate">
              Middleware
              {boundMiddlewares.length > 0 ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-mono font-semibold shrink-0">
                  {boundMiddlewares.length} active
                </span>
              ) : isEnabled ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-mono font-semibold shrink-0">
                  Active
                </span>
              ) : null}
            </span>
            <span className="text-[9px] text-muted-foreground font-mono truncate">
              {isEnabled
                ? "Interceptors & guards active"
                : "Middleware pipeline disabled"}
            </span>
          </div>
        </div>

        <div
          className="nodrag shrink-0"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
          onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggleMiddlewareConfig}
            className="scale-90"
          />
        </div>
      </div>

      {isEnabled && (
        <div className="flex flex-col gap-1.5 mt-1 pt-2 border-t border-purple-500/20 nodrag">
          {boundMiddlewares.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase flex items-center justify-between">
                <span>Active Middleware Chain</span>
                <span className="text-[9px] font-mono text-purple-400">
                  {boundMiddlewares.length}{" "}
                  {boundMiddlewares.length === 1 ? "handler" : "handlers"}
                </span>
              </span>

              <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto no-scrollbar">
                {boundMiddlewares.map((edge) => {
                  const sourceNode = allNodes.find((n) => n.id === edge.source);
                  const isRef = isMiddlewareRefNode(sourceNode);
                  let label = edge.source;
                  let mwType = "middleware";

                  if (isMiddlewareRefNode(sourceNode)) {
                    label = sourceNode.data.label;
                  } else if (isMiddlewareNode(sourceNode)) {
                    label = sourceNode.data.name || sourceNode.data.label;
                    mwType = sourceNode.data.type;
                  }

                  return (
                    <div
                      key={edge.id}
                      className="flex items-center justify-between p-1.5 rounded-md bg-background/50 border border-purple-500/20 text-[11px] gap-2 hover:border-purple-500/40 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <ShieldCheck className="w-3 h-3 text-purple-400 shrink-0" />
                        <span className="font-mono font-medium text-foreground truncate">
                          {label}
                        </span>
                        {isRef && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-purple-500/15 border border-purple-500/30 text-purple-400 font-mono font-bold uppercase shrink-0">
                            REF
                          </span>
                        )}
                        <span className="text-[9px] text-muted-foreground font-mono truncate hidden sm:inline">
                          ({mwType})
                        </span>
                      </div>

                      {handleRemoveMiddleware && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 rounded p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMiddleware(edge.source);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Remove middleware reference"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-2 rounded bg-background/30 border border-purple-500/10 text-center">
              <span className="text-[10px] text-muted-foreground italic">
                No middleware connected to this agent node.
              </span>
              {handleAddDefaultMiddleware && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-6 text-[10px] font-mono gap-1 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 border border-purple-500/30 self-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddDefaultMiddleware();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Plus className="w-3 h-3" /> Add Logging & Tracing Ref
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

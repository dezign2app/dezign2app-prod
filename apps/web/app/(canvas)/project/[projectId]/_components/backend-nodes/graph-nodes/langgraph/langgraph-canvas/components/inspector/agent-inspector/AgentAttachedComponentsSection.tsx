import React, { useState, useEffect } from "react";
import {
  Cpu,
  Wrench,
  Shield,
  Database,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import type {
  LangGraphLLMNode,
  LangGraphLLMRefNode,
  ToolNode,
  LangGraphToolRefNode,
  MiddlewareNode,
  LangGraphMiddlewareRefNode,
} from "../../../types";

interface AgentAttachedComponentsSectionProps {
  availableLLMNodes?: (LangGraphLLMNode | LangGraphLLMRefNode)[];
  availableToolNodes?: (ToolNode | LangGraphToolRefNode)[];
  availableMiddlewareNodes?: (MiddlewareNode | LangGraphMiddlewareRefNode)[];
  connectedLLMId?: string | null;
  connectedToolIds?: string[];
  connectedMiddlewareIds?: string[];
  onSelectLLM?: (llmId: string | null) => void;
  onToggleTool?: (toolId: string, connect: boolean) => void;
  onToggleMiddleware?: (mwId: string, connect: boolean) => void;
}

export function AgentAttachedComponentsSection({
  availableLLMNodes = [],
  availableToolNodes = [],
  availableMiddlewareNodes = [],
  connectedLLMId = null,
  connectedToolIds = [],
  connectedMiddlewareIds = [],
  onSelectLLM,
  onToggleTool,
  onToggleMiddleware,
}: AgentAttachedComponentsSectionProps) {
  const [isLlmOpen, setIsLlmOpen] = useState(Boolean(connectedLLMId));
  const [isToolsOpen, setIsToolsOpen] = useState(connectedToolIds.length > 0);
  const [isMiddlewareOpen, setIsMiddlewareOpen] = useState(
    connectedMiddlewareIds.length > 0,
  );

  useEffect(() => {
    setIsLlmOpen(Boolean(connectedLLMId));
  }, [connectedLLMId]);

  useEffect(() => {
    setIsToolsOpen(connectedToolIds.length > 0);
  }, [connectedToolIds.length]);

  useEffect(() => {
    setIsMiddlewareOpen(connectedMiddlewareIds.length > 0);
  }, [connectedMiddlewareIds.length]);

  return (
    <div className="flex flex-col gap-3 p-3 bg-secondary/10 rounded-xl border border-border/50">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Manage Components
      </h3>

      {/* LLM Selection */}
      <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-secondary/20 border border-border/50">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setIsLlmOpen((prev) => !prev)}
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">
              LLM Model
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-muted-foreground font-bold">
              {connectedLLMId ? "Bound" : "Unbound"}
            </span>
            {isLlmOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>
        {isLlmOpen &&
          (availableLLMNodes.length > 0 ? (
            <Select
              value={connectedLLMId || "none"}
              onValueChange={(val) =>
                onSelectLLM?.(val === "none" ? null : val)
              }
            >
              <SelectTrigger className="h-7 text-xs bg-background font-mono">
                <SelectValue placeholder="Select LLM..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Unbound)</SelectItem>
                {availableLLMNodes.map((node) => {
                  const isRef = node.type === "langgraph_llm_ref";
                  const modelSubtitle: string =
                    node.type === "langgraph_llm"
                      ? node.data.model || "custom"
                      : "referenced config";
                  return (
                    <SelectItem key={node.id} value={node.id}>
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono font-medium text-foreground truncate flex items-center gap-1">
                          {isRef && (
                            <span className="text-[8px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-400 font-bold uppercase">
                              REF
                            </span>
                          )}
                          {node.data.label || node.id}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {modelSubtitle}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">
              No LLMs on canvas. Add an LLM from toolbar to connect.
            </p>
          ))}
      </div>

      {/* Tools Multi-Selection */}
      <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-secondary/20 border border-border/50">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setIsToolsOpen((prev) => !prev)}
        >
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">
              Attach Tools
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-muted-foreground font-bold">
              {connectedToolIds.length} selected
            </span>
            {isToolsOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>
        {isToolsOpen &&
          (availableToolNodes.length > 0 ? (
            <div className="flex flex-col gap-1.5 mt-1 max-h-[160px] overflow-y-auto pr-1">
              {availableToolNodes.map((tool) => {
                const isConnected = connectedToolIds.includes(tool.id);
                const isRef = tool.type === "langgraph_tool_ref";
                const toolSubtitle = isRef
                  ? "referenced tool"
                  : `returnType: ${(tool as ToolNode).data.returnType || "string"}`;
                return (
                  <div
                    key={tool.id}
                    className="flex items-center justify-between p-1.5 rounded bg-background/60 border border-border/40 text-xs"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono font-medium text-foreground truncate flex items-center gap-1">
                        {isRef && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase">
                            REF
                          </span>
                        )}
                        {(tool.data as { name?: string; label?: string }).name || tool.data.label}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {toolSubtitle}
                      </span>
                    </div>
                    <Switch
                      checked={isConnected}
                      onCheckedChange={(c) => onToggleTool?.(tool.id, c)}
                      className="scale-75 origin-right"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">
              No Tool Nodes on canvas. Add a Tool node from toolbar to attach.
            </p>
          ))}
      </div>

      {/* Middleware Multi-Selection */}
      <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-secondary/20 border border-border/50">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setIsMiddlewareOpen((prev) => !prev)}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">
              Attach Middleware
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-muted-foreground font-bold">
              {connectedMiddlewareIds.length} active
            </span>
            {isMiddlewareOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>
        {isMiddlewareOpen &&
          (availableMiddlewareNodes.length > 0 ? (
            <div className="flex flex-col gap-1.5 mt-1 max-h-[160px] overflow-y-auto pr-1">
              {availableMiddlewareNodes.map((mw) => {
                const isConnected = connectedMiddlewareIds.includes(mw.id);
                const isRef = mw.type === "langgraph_middleware_ref";
                const mwSubtitle = isRef
                  ? "referenced middleware"
                  : `type: ${(mw as MiddlewareNode).data.type}`;
                return (
                  <div
                    key={mw.id}
                    className="flex items-center justify-between p-1.5 rounded bg-background/60 border border-border/40 text-xs"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono font-medium text-foreground truncate flex items-center gap-1">
                        {isRef && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-400 font-bold uppercase">
                            REF
                          </span>
                        )}
                        {(mw.data as { name?: string; label?: string }).name || mw.data.label}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {mwSubtitle}
                      </span>
                    </div>
                    <Switch
                      checked={isConnected}
                      onCheckedChange={(c) => onToggleMiddleware?.(mw.id, c)}
                      className="scale-75 origin-right"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">
              No Middlewares on canvas. Add a Middleware from toolbar to attach.
            </p>
          ))}
      </div>

      <div className="flex gap-2 p-2 rounded bg-secondary/20 border border-border/50 items-start text-[10px] text-muted-foreground leading-tight">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>
          Selecting nodes or toggling switches automatically draws and updates
          canvas edges to <code>llm_in</code>, <code>tool_in</code>, and{" "}
          <code>middleware_in</code>.
        </p>
      </div>
    </div>
  );
}

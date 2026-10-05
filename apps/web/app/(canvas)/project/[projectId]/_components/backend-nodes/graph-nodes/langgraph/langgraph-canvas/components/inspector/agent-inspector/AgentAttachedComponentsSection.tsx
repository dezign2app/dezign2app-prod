import React, { useState, useEffect, useMemo } from "react";
import {
  Cpu,
  Wrench,
  Shield,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Search,
  Link2,
} from "lucide-react";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@workspace/ui/components/combobox";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";
import type {
  LangGraphLLMNode,
  LangGraphLLMRefNode,
  ToolNode,
  LangGraphToolRefNode,
  MiddlewareNode,
  LangGraphMiddlewareRefNode,
  LangGraphCanvasNode,
} from "../../../types";

interface AgentAttachedComponentsSectionProps {
  availableLLMNodes?: (LangGraphLLMNode | LangGraphLLMRefNode)[];
  availableToolNodes?: (ToolNode | LangGraphToolRefNode)[];
  availableMiddlewareNodes?: (MiddlewareNode | LangGraphMiddlewareRefNode)[];
  masterToolNodes?: ToolNode[];
  masterMiddlewareNodes?: MiddlewareNode[];
  nodes?: LangGraphCanvasNode[];
  agentId?: string;
  connectedLLMId?: string | null;
  connectedToolIds?: string[];
  connectedMiddlewareIds?: string[];
  onAddToolRef?: (masterToolId: string) => void;
  onRemoveToolRef?: (toolRefId: string) => void;
  onAddMiddlewareRef?: (masterMwId: string) => void;
  onRemoveMiddlewareRef?: (mwRefId: string) => void;
  onSelectLLM?: (llmId: string | null) => void;
  onToggleTool?: (toolId: string, connect: boolean) => void;
  onToggleMiddleware?: (mwId: string, connect: boolean) => void;
  embedded?: boolean;
  hideMiddleware?: boolean;
}

interface ToolComboboxOption {
  value: string; // masterTool.id
  label: string; // masterTool name
  returnType: string;
  source: string;
  isAttached: boolean;
}

interface MwComboboxOption {
  value: string; // masterMw.id
  label: string; // masterMw name
  type: string;
  isAttached: boolean;
}

interface LLMComboboxOption {
  value: string; // node.id or "none"
  label: string;
  model: string;
  isRef: boolean;
}

export function AgentAttachedComponentsSection({
  availableLLMNodes = [],
  availableToolNodes = [],
  availableMiddlewareNodes = [],
  masterToolNodes = [],
  masterMiddlewareNodes = [],
  nodes = [],
  agentId = "",
  connectedLLMId = null,
  connectedToolIds = [],
  connectedMiddlewareIds = [],
  onAddToolRef,
  onRemoveToolRef,
  onAddMiddlewareRef,
  onRemoveMiddlewareRef,
  onSelectLLM,
  onToggleTool,
  onToggleMiddleware,
  embedded = false,
  hideMiddleware = false,
}: AgentAttachedComponentsSectionProps) {
  const [isLlmOpen, setIsLlmOpen] = useState(Boolean(connectedLLMId));
  const [isToolsOpen, setIsToolsOpen] = useState(connectedToolIds.length > 0);
  const [isMiddlewareOpen, setIsMiddlewareOpen] = useState(
    connectedMiddlewareIds.length > 0,
  );

  // Combobox selections for adding new refs
  const [selectedMasterToolId, setSelectedMasterToolId] = useState<string>("");
  const [selectedMasterMwId, setSelectedMasterMwId] = useState<string>("");

  // Search filters for long lists (100s of tools/middlewares)
  const [toolSearch, setToolSearch] = useState("");
  const [mwSearch, setMwSearch] = useState("");

  useEffect(() => {
    setIsLlmOpen(Boolean(connectedLLMId));
  }, [connectedLLMId]);

  useEffect(() => {
    setIsToolsOpen(connectedToolIds.length > 0);
  }, [connectedToolIds.length]);

  useEffect(() => {
    setIsMiddlewareOpen(connectedMiddlewareIds.length > 0);
  }, [connectedMiddlewareIds.length]);

  // Resolve attached tool refs
  const attachedToolRefs = useMemo(() => {
    return connectedToolIds
      .map((toolId) => {
        const node =
          nodes.find((n) => n.id === toolId) ||
          availableToolNodes.find((n) => n.id === toolId);
        if (!node) return null;

        const isRef = node.type === "langgraph_tool_ref";
        const masterId = isRef
          ? (node.data as { toolRef?: string })?.toolRef
          : node.id;
        const masterTool =
          masterToolNodes.find((m) => m.id === masterId) ||
          (node.type === "langgraph_tool" ? (node as ToolNode) : undefined);

        return {
          id: node.id,
          isRef,
          label: (node.data as { label?: string })?.label || node.id,
          masterName:
            masterTool?.data?.name ||
            masterTool?.data?.label ||
            (node.data as { label?: string })?.label ||
            node.id,
          masterId,
          returnType: (masterTool?.data as { returnType?: string })?.returnType || "string",
          source: (masterTool?.data as { source?: string })?.source || "inline",
        };
      })
      .filter(Boolean) as Array<{
        id: string;
        isRef: boolean;
        label: string;
        masterName: string;
        masterId?: string;
        returnType: string;
        source: string;
      }>;
  }, [connectedToolIds, nodes, availableToolNodes, masterToolNodes]);

  // Filtered attached tools
  const filteredAttachedTools = useMemo(() => {
    if (!toolSearch.trim()) return attachedToolRefs;
    const q = toolSearch.toLowerCase();
    return attachedToolRefs.filter(
      (t) =>
        t.masterName.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.returnType.toLowerCase().includes(q),
    );
  }, [attachedToolRefs, toolSearch]);

  // Resolve attached middleware refs
  const attachedMwRefs = useMemo(() => {
    return connectedMiddlewareIds
      .map((mwId) => {
        const node =
          nodes.find((n) => n.id === mwId) ||
          availableMiddlewareNodes.find((n) => n.id === mwId);
        if (!node) return null;

        const isRef = node.type === "langgraph_middleware_ref";
        const masterId = isRef
          ? (node.data as { middlewareRef?: string })?.middlewareRef
          : node.id;
        const masterMw =
          masterMiddlewareNodes.find((m) => m.id === masterId) ||
          (node.type === "langgraph_middleware"
            ? (node as MiddlewareNode)
            : undefined);

        return {
          id: node.id,
          isRef,
          label: (node.data as { label?: string })?.label || node.id,
          masterName:
            masterMw?.data?.name ||
            masterMw?.data?.label ||
            (node.data as { label?: string })?.label ||
            node.id,
          masterId,
          type: (masterMw?.data as { type?: string })?.type || "custom",
        };
      })
      .filter(Boolean) as Array<{
        id: string;
        isRef: boolean;
        label: string;
        masterName: string;
        masterId?: string;
        type: string;
      }>;
  }, [connectedMiddlewareIds, nodes, availableMiddlewareNodes, masterMiddlewareNodes]);

  // Filtered attached middlewares
  const filteredAttachedMws = useMemo(() => {
    if (!mwSearch.trim()) return attachedMwRefs;
    const q = mwSearch.toLowerCase();
    return attachedMwRefs.filter(
      (m) =>
        m.masterName.toLowerCase().includes(q) ||
        m.label.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q),
    );
  }, [attachedMwRefs, mwSearch]);

  // Options for LLM Combobox
  const llmOptions = useMemo<LLMComboboxOption[]>(() => {
    const list: LLMComboboxOption[] = [
      {
        value: "none",
        label: "None (Unbound)",
        model: "No LLM connected",
        isRef: false,
      },
    ];
    availableLLMNodes.forEach((node) => {
      const isRef = node.type === "langgraph_llm_ref";
      const modelSubtitle =
        node.type === "langgraph_llm"
          ? node.data.model || "custom"
          : "referenced config";
      list.push({
        value: node.id,
        label: node.data.label || node.id,
        model: modelSubtitle,
        isRef,
      });
    });
    return list;
  }, [availableLLMNodes]);

  const selectedLLMOption = useMemo(() => {
    return (
      llmOptions.find((l) => l.value === (connectedLLMId || "none")) ??
      llmOptions[0]
    );
  }, [llmOptions, connectedLLMId]);

  // Set of master tool IDs that are already attached to this agent
  const attachedMasterToolIds = useMemo(() => {
    return new Set(
      attachedToolRefs.map((r) => r.masterId).filter(Boolean) as string[],
    );
  }, [attachedToolRefs]);

  const isSelectedToolAlreadyAttached = useMemo(() => {
    return selectedMasterToolId
      ? attachedMasterToolIds.has(selectedMasterToolId)
      : false;
  }, [selectedMasterToolId, attachedMasterToolIds]);

  // Options for Tool Combobox - unattached first, attached at bottom and marked isAttached
  const toolOptions = useMemo<ToolComboboxOption[]>(() => {
    const list = masterToolNodes.map((tool) => {
      const name = tool.data.name || tool.data.label || tool.id;
      const isAttached = attachedMasterToolIds.has(tool.id);
      return {
        value: tool.id,
        label: name,
        returnType:
          (tool.data as { returnType?: string })?.returnType || "string",
        source: (tool.data as { source?: string })?.source || "inline",
        isAttached,
      };
    });
    return list.sort((a, b) => {
      if (a.isAttached === b.isAttached) return a.label.localeCompare(b.label);
      return a.isAttached ? 1 : -1;
    });
  }, [masterToolNodes, attachedMasterToolIds]);

  const selectedToolOption = useMemo(() => {
    return toolOptions.find((t) => t.value === selectedMasterToolId) ?? null;
  }, [toolOptions, selectedMasterToolId]);

  // Set of master middleware IDs that are already attached to this agent
  const attachedMasterMwIds = useMemo(() => {
    return new Set(
      attachedMwRefs.map((r) => r.masterId).filter(Boolean) as string[],
    );
  }, [attachedMwRefs]);

  const isSelectedMwAlreadyAttached = useMemo(() => {
    return selectedMasterMwId
      ? attachedMasterMwIds.has(selectedMasterMwId)
      : false;
  }, [selectedMasterMwId, attachedMasterMwIds]);

  // Options for Middleware Combobox - unattached first, attached at bottom and marked isAttached
  const mwOptions = useMemo<MwComboboxOption[]>(() => {
    const list = masterMiddlewareNodes.map((mw) => {
      const name = mw.data.name || mw.data.label || mw.id;
      const isAttached = attachedMasterMwIds.has(mw.id);
      return {
        value: mw.id,
        label: name,
        type: (mw.data as { type?: string })?.type || "custom",
        isAttached,
      };
    });
    return list.sort((a, b) => {
      if (a.isAttached === b.isAttached) return a.label.localeCompare(b.label);
      return a.isAttached ? 1 : -1;
    });
  }, [masterMiddlewareNodes, attachedMasterMwIds]);

  const selectedMwOption = useMemo(() => {
    return mwOptions.find((m) => m.value === selectedMasterMwId) ?? null;
  }, [mwOptions, selectedMasterMwId]);

  return (
    <div
      className={
        embedded
          ? "flex flex-col gap-2.5"
          : "flex flex-col gap-3 p-3 bg-secondary/10 rounded-xl border border-border/50"
      }
    >
      {!embedded && (
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Manage Components
        </h3>
      )}

      {/* ─── 1. LLM Model Selection ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-secondary/20 border border-border/50">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setIsLlmOpen((prev) => !prev)}
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-400" />
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
            <div
              className="relative w-full nodrag"
              onClick={(e) => e.stopPropagation()}
            >
              <Combobox
                items={llmOptions}
                value={selectedLLMOption}
                isItemEqualToValue={(a, b) => a?.value === b?.value}
                onValueChange={(item: LLMComboboxOption | null) => {
                  onSelectLLM?.(
                    !item || item.value === "none" ? null : item.value,
                  );
                }}
              >
                <ComboboxInput
                  placeholder="Select LLM..."
                  className="h-7 w-full text-xs font-mono nodrag bg-background/50 border border-border/50 shadow-none focus-visible:ring-1"
                />
                <ComboboxContent
                  className="w-[280px] p-0 shadow-2xl border border-border/80 bg-popover text-popover-foreground rounded-xl z-50 overflow-hidden"
                  align="start"
                  sideOffset={4}
                >
                  <ComboboxEmpty className="py-4 text-center text-xs text-muted-foreground font-mono">
                    No matching LLMs found.
                  </ComboboxEmpty>
                  <ComboboxList className="max-h-64 overflow-y-auto no-scrollbar p-1 bg-popover text-popover-foreground hide-scrollbar">
                    {(item: LLMComboboxOption) => (
                      <ComboboxItem
                        key={item.value}
                        value={item}
                        className="flex items-center justify-between py-1.5 px-2 pr-7 text-xs font-mono cursor-pointer rounded-md gap-2"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <Cpu className="size-3 text-sky-400 shrink-0" />
                          <span className="truncate font-medium">
                            {item.label}
                          </span>
                          {item.isRef && (
                            <span className="text-[8px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-400 font-bold uppercase shrink-0">
                              REF
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-muted-foreground font-mono shrink-0">
                          {item.model}
                        </span>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">
              No LLMs on canvas. Add an LLM from toolbar to connect.
            </p>
          ))}
      </div>

      {/* ─── 2. Tool References Section (Combobox + Add Button) ─────────────── */}
      <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-secondary/20 border border-border/50">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setIsToolsOpen((prev) => !prev)}
        >
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-foreground">
              Attach Tools
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-300 border-0 font-mono"
            >
              {attachedToolRefs.length} tool{" "}
              {attachedToolRefs.length === 1 ? "ref" : "refs"}
            </Badge>
            {isToolsOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>

        {isToolsOpen && (
          <div className="flex flex-col gap-2 pt-1 border-t border-border/30">
            {/* Combobox + Add Button */}
            <div className="flex items-center gap-1.5">
              <div
                className="flex-1 min-w-0 relative nodrag"
                onClick={(e) => e.stopPropagation()}
              >
                <Combobox
                  items={toolOptions}
                  value={selectedToolOption}
                  isItemEqualToValue={(a, b) => a?.value === b?.value}
                  onValueChange={(item: ToolComboboxOption | null) => {
                    setSelectedMasterToolId(item?.value ?? "");
                  }}
                >
                  <ComboboxInput
                    disabled={masterToolNodes.length === 0}
                    placeholder={
                      masterToolNodes.length === 0
                        ? "No Tool Nodes on canvas"
                        : attachedMasterToolIds.size >= masterToolNodes.length
                          ? "All canvas tools attached"
                          : "Select tool to attach..."
                    }
                    className="h-7 w-full text-xs font-mono nodrag bg-background/50 border border-border/50 shadow-none focus-visible:ring-1"
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        selectedMasterToolId &&
                        !isSelectedToolAlreadyAttached
                      ) {
                        e.preventDefault();
                        onAddToolRef?.(selectedMasterToolId);
                        setSelectedMasterToolId("");
                      }
                    }}
                  />
                  <ComboboxContent
                    className="w-[280px] p-0 shadow-2xl border border-border/80 bg-popover text-popover-foreground rounded-xl z-50 overflow-hidden"
                    align="start"
                    sideOffset={4}
                  >
                    <ComboboxEmpty className="py-4 text-center text-xs text-muted-foreground font-mono">
                      No matching tools found.
                    </ComboboxEmpty>
                    <ComboboxList className="max-h-64 overflow-y-auto no-scrollbar p-1 bg-popover text-popover-foreground hide-scrollbar">
                      {(tool: ToolComboboxOption) => (
                        <ComboboxItem
                          key={tool.value}
                          value={tool}
                          disabled={tool.isAttached}
                          className={cn(
                            "flex items-center justify-between py-1.5 px-2 pr-7 text-xs font-mono rounded-md gap-2",
                            tool.isAttached
                              ? "opacity-50 cursor-not-allowed pointer-events-none"
                              : "cursor-pointer",
                          )}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 truncate">
                            <Wrench className="size-3 text-emerald-400 shrink-0" />
                            <span className="truncate font-medium">
                              {tool.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {tool.isAttached ? (
                              <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium shrink-0">
                                already attached
                              </span>
                            ) : (
                              <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 shrink-0">
                                {tool.returnType}
                              </span>
                            )}
                          </div>
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>

              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 px-2.5 text-xs font-semibold shrink-0 gap-1 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 cursor-pointer disabled:opacity-50"
                disabled={
                  !selectedMasterToolId ||
                  masterToolNodes.length === 0 ||
                  isSelectedToolAlreadyAttached
                }
                onClick={() => {
                  if (!selectedMasterToolId || isSelectedToolAlreadyAttached) return;
                  onAddToolRef?.(selectedMasterToolId);
                  setSelectedMasterToolId("");
                }}
                title={
                  isSelectedToolAlreadyAttached
                    ? "This tool is already attached to this agent"
                    : "Create Tool Ref and connect to agent"
                }
              >
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>

            {/* Filter Search if many tools (> 5) */}
            {attachedToolRefs.length > 5 && (
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-2 text-muted-foreground pointer-events-none" />
                <Input
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                  placeholder={`Search ${attachedToolRefs.length} tool refs...`}
                  className="h-6 text-[11px] pl-6 bg-background/50 font-mono"
                />
              </div>
            )}

            {/* Attached Tool Refs List */}
            {attachedToolRefs.length > 0 ? (
              <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                {filteredAttachedTools.map((toolRef) => (
                  <div
                    key={toolRef.id}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-background/60 border border-border/40 text-xs hover:border-emerald-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-mono font-bold uppercase shrink-0">
                        REF
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono font-medium text-foreground truncate text-xs">
                          {toolRef.masterName}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-mono truncate">
                          id: {toolRef.id} • {toolRef.returnType}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
                      onClick={() => {
                        if (toolRef.isRef) {
                          onRemoveToolRef?.(toolRef.id);
                        } else {
                          onToggleTool?.(toolRef.id, false);
                        }
                      }}
                      title="Disconnect & delete tool ref"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2 rounded bg-background/30 border border-border/30 text-center">
                <p className="text-[10px] text-muted-foreground italic">
                  No tool references attached. Select a master tool above and click "+ Add" to create a tool reference.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 3. Middleware References Section (Combobox + Add Button) ────────── */}
      {!hideMiddleware && (
        <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-secondary/20 border border-border/50">
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setIsMiddlewareOpen((prev) => !prev)}
          >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-foreground">
              Attach Middleware
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0 h-4 bg-purple-500/15 text-purple-300 border-0 font-mono"
            >
              {attachedMwRefs.length} active
            </Badge>
            {isMiddlewareOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>

        {isMiddlewareOpen && (
          <div className="flex flex-col gap-2 pt-1 border-t border-border/30">
            {/* Combobox + Add Button */}
            <div className="flex items-center gap-1.5">
              <div
                className="flex-1 min-w-0 relative nodrag"
                onClick={(e) => e.stopPropagation()}
              >
                <Combobox
                  items={mwOptions}
                  value={selectedMwOption}
                  isItemEqualToValue={(a, b) => a?.value === b?.value}
                  onValueChange={(item: MwComboboxOption | null) => {
                    setSelectedMasterMwId(item?.value ?? "");
                  }}
                >
                  <ComboboxInput
                    disabled={masterMiddlewareNodes.length === 0}
                    placeholder={
                      masterMiddlewareNodes.length === 0
                        ? "No Middleware on canvas"
                        : attachedMasterMwIds.size >= masterMiddlewareNodes.length
                          ? "All canvas middlewares attached"
                          : "Select middleware..."
                    }
                    className="h-7 w-full text-xs font-mono nodrag bg-background/50 border border-border/50 shadow-none focus-visible:ring-1"
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        selectedMasterMwId &&
                        !isSelectedMwAlreadyAttached
                      ) {
                        e.preventDefault();
                        onAddMiddlewareRef?.(selectedMasterMwId);
                        setSelectedMasterMwId("");
                      }
                    }}
                  />
                  <ComboboxContent
                    className="w-[280px] p-0 shadow-2xl border border-border/80 bg-popover text-popover-foreground rounded-xl z-50 overflow-hidden"
                    align="start"
                    sideOffset={4}
                  >
                    <ComboboxEmpty className="py-4 text-center text-xs text-muted-foreground font-mono">
                      No matching middlewares found.
                    </ComboboxEmpty>
                    <ComboboxList className="max-h-64 overflow-y-auto no-scrollbar p-1 bg-popover text-popover-foreground hide-scrollbar">
                      {(mw: MwComboboxOption) => (
                        <ComboboxItem
                          key={mw.value}
                          value={mw}
                          disabled={mw.isAttached}
                          className={cn(
                            "flex items-center justify-between py-1.5 px-2 pr-7 text-xs font-mono rounded-md gap-2",
                            mw.isAttached
                              ? "opacity-50 cursor-not-allowed pointer-events-none"
                              : "cursor-pointer",
                          )}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 truncate">
                            <Shield className="size-3 text-purple-400 shrink-0" />
                            <span className="truncate font-medium">
                              {mw.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {mw.isAttached ? (
                              <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium shrink-0">
                                already attached
                              </span>
                            ) : (
                              <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 shrink-0">
                                {mw.type}
                              </span>
                            )}
                          </div>
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>

              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 px-2.5 text-xs font-semibold shrink-0 gap-1 bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 border border-purple-500/30 cursor-pointer disabled:opacity-50"
                disabled={
                  !selectedMasterMwId ||
                  masterMiddlewareNodes.length === 0 ||
                  isSelectedMwAlreadyAttached
                }
                onClick={() => {
                  if (!selectedMasterMwId || isSelectedMwAlreadyAttached) return;
                  onAddMiddlewareRef?.(selectedMasterMwId);
                  setSelectedMasterMwId("");
                }}
                title={
                  isSelectedMwAlreadyAttached
                    ? "This middleware is already attached to this agent"
                    : "Create Middleware Ref and connect to agent"
                }
              >
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>

            {/* Filter Search if many middlewares (> 5) */}
            {attachedMwRefs.length > 5 && (
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-2 text-muted-foreground pointer-events-none" />
                <Input
                  value={mwSearch}
                  onChange={(e) => setMwSearch(e.target.value)}
                  placeholder={`Search ${attachedMwRefs.length} middlewares...`}
                  className="h-6 text-[11px] pl-6 bg-background/50 font-mono"
                />
              </div>
            )}

            {/* Attached Middleware Refs List */}
            {attachedMwRefs.length > 0 ? (
              <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                {filteredAttachedMws.map((mwRef) => (
                  <div
                    key={mwRef.id}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-background/60 border border-border/40 text-xs hover:border-purple-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/15 border border-purple-500/25 text-purple-400 font-mono font-bold uppercase shrink-0">
                        REF
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono font-medium text-foreground truncate text-xs">
                          {mwRef.masterName}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-mono truncate">
                          id: {mwRef.id} • {mwRef.type}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
                      onClick={() => {
                        if (mwRef.isRef) {
                          onRemoveMiddlewareRef?.(mwRef.id);
                        } else {
                          onToggleMiddleware?.(mwRef.id, false);
                        }
                      }}
                      title="Disconnect & delete middleware ref"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2 rounded bg-background/30 border border-border/30 text-center">
                <p className="text-[10px] text-muted-foreground italic">
                  No middleware references attached. Select a middleware above and click "+ Add".
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Info Tip */}
      <div className="flex gap-2 p-2 rounded-lg bg-secondary/20 border border-border/50 items-start text-[10px] text-muted-foreground leading-tight">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-sky-400" />
        <p>
          {hideMiddleware
            ? "Each attached tool creates a dedicated Reference node on the canvas. Agents connect strictly to Tool References."
            : "Each attached tool or middleware creates a dedicated Reference node on the canvas. Agents connect strictly to Tool and Middleware References."}
        </p>
      </div>
    </div>
  );
}

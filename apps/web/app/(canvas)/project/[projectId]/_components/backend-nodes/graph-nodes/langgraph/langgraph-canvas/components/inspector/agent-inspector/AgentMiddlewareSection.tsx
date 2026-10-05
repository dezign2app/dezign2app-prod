import React, { useState, useMemo } from "react";
import {
  Shield,
  Plus,
  Trash2,
  Search,
  Power,
  AlertCircle,
  ExternalLink,
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
import { Switch } from "@workspace/ui/components/switch";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";
import type {
  MiddlewareNode,
  LangGraphMiddlewareRefNode,
  LangGraphCanvasNode,
} from "@workspace/canvas";

export interface AgentMiddlewareSectionProps {
  agentId?: string;
  isEnabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  connectedMiddlewareIds?: string[];
  availableMiddlewareNodes?: (MiddlewareNode | LangGraphMiddlewareRefNode)[];
  masterMiddlewareNodes?: MiddlewareNode[];
  nodes?: LangGraphCanvasNode[];
  onAddMiddlewareRef?: (masterMwId: string) => void;
  onRemoveMiddlewareRef?: (mwRefId: string) => void;
  onToggleMiddleware?: (mwId: string, connect: boolean) => void;
}

interface MwComboboxOption {
  value: string; // masterMw.id
  label: string; // masterMw name
  type: string;
  isAttached: boolean;
}

interface ResolvedAttachedMiddleware {
  id: string;
  isRef: boolean;
  label: string;
  masterName: string;
  masterId: string;
  type: string;
}

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

export function AgentMiddlewareSection({
  agentId = "",
  isEnabled,
  onToggleEnabled,
  connectedMiddlewareIds = [],
  availableMiddlewareNodes = [],
  masterMiddlewareNodes = [],
  nodes = [],
  onAddMiddlewareRef,
  onRemoveMiddlewareRef,
}: AgentMiddlewareSectionProps) {
  const [selectedMasterMwId, setSelectedMasterMwId] = useState<string>("");
  const [mwSearch, setMwSearch] = useState("");

  // Resolve attached middleware refs with full type safety
  const attachedMwRefs = useMemo<ResolvedAttachedMiddleware[]>(() => {
    const list: ResolvedAttachedMiddleware[] = [];

    for (const mwId of connectedMiddlewareIds) {
      const node =
        nodes.find((n) => n.id === mwId) ||
        availableMiddlewareNodes.find((n) => n.id === mwId);
      if (!node) continue;

      if (isMiddlewareRefNode(node)) {
        const targetMasterId = node.data.middlewareRef ?? "";
        const masterMw = masterMiddlewareNodes.find(
          (m) => m.id === targetMasterId,
        );

        list.push({
          id: node.id,
          isRef: true,
          label: node.data.label,
          masterName:
            masterMw?.data.name || masterMw?.data.label || node.data.label,
          masterId: targetMasterId,
          type: masterMw?.data.type || "middleware",
        });
      } else if (isMiddlewareNode(node)) {
        list.push({
          id: node.id,
          isRef: false,
          label: node.data.label,
          masterName: node.data.name || node.data.label,
          masterId: node.id,
          type: node.data.type,
        });
      }
    }

    return list;
  }, [
    connectedMiddlewareIds,
    nodes,
    availableMiddlewareNodes,
    masterMiddlewareNodes,
  ]);

  // Filter attached middleware list by search
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

  const attachedMasterMwIds = useMemo<Set<string>>(() => {
    const ids = new Set<string>();
    for (const item of attachedMwRefs) {
      if (item.masterId) {
        ids.add(item.masterId);
      }
    }
    return ids;
  }, [attachedMwRefs]);

  const mwOptions: MwComboboxOption[] = useMemo(() => {
    return masterMiddlewareNodes.map((mw) => {
      const label = mw.data.name || mw.data.label || mw.id;
      const type = mw.data.type;
      const isAttached = attachedMasterMwIds.has(mw.id);
      return {
        value: mw.id,
        label,
        type,
        isAttached,
      };
    });
  }, [masterMiddlewareNodes, attachedMasterMwIds]);

  const selectedMwOption = useMemo(() => {
    return mwOptions.find((m) => m.value === selectedMasterMwId) ?? null;
  }, [mwOptions, selectedMasterMwId]);

  const isSelectedMwAlreadyAttached = useMemo(() => {
    if (!selectedMasterMwId) return false;
    return attachedMasterMwIds.has(selectedMasterMwId);
  }, [selectedMasterMwId, attachedMasterMwIds]);

  return (
    <div className="flex flex-col gap-3 font-sans">
      {/* ─── Control Header / Status Banner ─── */}
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-card/60 border border-border/50">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "p-1.5 rounded-md border",
              isEnabled
                ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
                : "bg-muted/40 border-border/50 text-muted-foreground",
            )}
          >
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground">
                Middleware Execution
              </span>
              <Badge
                variant="secondary"
                className={cn(
                  "text-[9px] px-1.5 py-0 h-4 font-mono font-medium border-0",
                  isEnabled
                    ? "bg-purple-500/15 text-purple-300"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {isEnabled
                  ? `${attachedMwRefs.length} active`
                  : "Off"}
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {isEnabled
                ? "Pre- and post-processing interceptors active"
                : "Pipeline execution bypassed"}
            </span>
          </div>
        </div>

        <Switch
          checked={isEnabled}
          onCheckedChange={onToggleEnabled}
          className="scale-90 cursor-pointer"
          title="Toggle Middleware Pipeline ON/OFF"
        />
      </div>

      {/* ─── Disabled State View ─── */}
      {!isEnabled ? (
        <div className="flex flex-col items-center justify-center p-4 rounded-lg border border-dashed border-border/60 bg-secondary/10 text-center gap-2">
          <Shield className="w-6 h-6 text-muted-foreground/40" />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-foreground">
              Middleware Pipeline Disabled
            </span>
            <span className="text-[11px] text-muted-foreground max-w-[260px] leading-relaxed">
              Enable middleware to intercept agent calls with rate limits, telemetry tracing, guardrails, and input filters.
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-1 h-7 text-xs border-purple-500/40 text-purple-300 hover:bg-purple-500/15 gap-1.5 cursor-pointer"
            onClick={() => onToggleEnabled(true)}
          >
            <Power className="w-3.5 h-3.5 text-purple-400" />
            Enable Middleware
          </Button>
        </div>
      ) : (
        /* ─── Enabled State: Attach & Manage Middleware ─── */
        <div className="flex flex-col gap-3">
          {/* Combobox & Add Section */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              Attach Master Middleware
            </label>
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
                          : "Select middleware to attach..."
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
                <Plus className="w-3 h-3" /> Attach
              </Button>
            </div>
          </div>

          {/* Filter Search if > 5 middlewares */}
          {attachedMwRefs.length > 5 && (
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-2 text-muted-foreground pointer-events-none" />
              <Input
                value={mwSearch}
                onChange={(e) => setMwSearch(e.target.value)}
                placeholder={`Search ${attachedMwRefs.length} attached middlewares...`}
                className="h-6 text-[11px] pl-6 bg-background/50 font-mono"
              />
            </div>
          )}

          {/* Attached Middleware Refs List */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              Attached Middleware Chain ({attachedMwRefs.length})
            </span>

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
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="font-mono text-purple-400/80">
                            {mwRef.type}
                          </span>
                          <span>•</span>
                          <span className="font-mono text-[9px]">
                            {mwRef.id}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
                      onClick={() => onRemoveMiddlewareRef?.(mwRef.id)}
                      title="Remove middleware reference"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center rounded-lg border border-dashed border-border/50 bg-secondary/10">
                <span className="text-xs text-muted-foreground font-mono">
                  {masterMiddlewareNodes.length === 0
                    ? "No master middleware nodes found on canvas. Add a Middleware node to connect."
                    : "No middleware attached yet. Select one above and click Attach."}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useCallback } from "react";
import { NodeProps, Handle, Position } from "@xyflow/react";
import {
  Zap, Plus, Trash2, ChevronDown, Sparkles,
  ArrowRight, Globe, Sliders, ChevronsRight,
} from "lucide-react";
import type { StartNode, LangGraphInputChannel, LangGraphStateChannel } from "@workspace/canvas";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";

type InputChannelType = LangGraphInputChannel["type"];

const TYPE_COLORS: Record<InputChannelType, string> = {
  string:   "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  messages: "text-primary bg-primary/10 border-primary/30",
  json:     "text-amber-400 bg-amber-400/10 border-amber-400/30",
  number:   "text-blue-400 bg-blue-400/10 border-blue-400/30",
  boolean:  "text-rose-400 bg-rose-400/10 border-rose-400/30",
  object:   "text-purple-400 bg-purple-400/10 border-purple-400/30",
  array:    "text-orange-400 bg-orange-400/10 border-orange-400/30",
};

// ─── Inline channel row ───────────────────────────────────────────────────────
interface ChannelRowProps {
  ch: LangGraphInputChannel;
  idx: number;
  stateChannels: LangGraphStateChannel[];
  onUpdate: (idx: number, changes: Partial<LangGraphInputChannel>) => void;
  onDelete: (idx: number) => void;
}

function ChannelRow({ ch, idx, stateChannels, onUpdate, onDelete }: ChannelRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const typeColor = TYPE_COLORS[ch.type as InputChannelType] || TYPE_COLORS.string;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (isEditing) {
    return (
      <div
        className="flex flex-col gap-1 px-2.5 py-1.5 bg-secondary/40 border-b border-border/40 nodrag"
        onClick={stop}
      >
        {/* Key + type */}
        <div className="flex items-center gap-1">
          <Input
            className="h-6 text-[10px] font-mono bg-background flex-1 nodrag"
            value={ch.key}
            autoFocus
            onChange={(e) => onUpdate(idx, { key: e.target.value })}
            onBlur={() => setIsEditing(false)}
            placeholder="field_key"
          />
          <Select
            value={ch.type as string}
            onValueChange={(v) => onUpdate(idx, { type: v as InputChannelType })}
          >
            <SelectTrigger className="h-6 w-[72px] text-[9px] font-mono bg-background nodrag">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["string","messages","json","number","boolean","object","array"] as InputChannelType[]).map((t) => (
                <SelectItem key={t} value={t} className="text-xs font-mono">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0 nodrag"
            onMouseDown={(e) => { stop(e); onDelete(idx); setIsEditing(false); }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
        {/* State mapping */}
        <div className="flex items-center gap-1.5 pl-0.5">
          <ChevronsRight className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
          <span className="text-[8px] text-muted-foreground shrink-0">maps to state</span>
          <Select
            value={ch.stateChannelKey || "__none__"}
            onValueChange={(v) => onUpdate(idx, { stateChannelKey: v === "__none__" ? undefined : v })}
          >
            <SelectTrigger className="h-5 flex-1 text-[9px] font-mono bg-background nodrag">
              <SelectValue placeholder="none" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs text-muted-foreground">— none —</SelectItem>
              {stateChannels.map((sc) => (
                <SelectItem key={sc.key} value={sc.key} className="text-xs font-mono">
                  {sc.key}
                  <span className="ml-1 text-[8px] text-muted-foreground">({sc.type})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border/20 hover:bg-secondary/20 transition-colors cursor-pointer group/row nodrag"
      onClick={(e) => { stop(e); setIsEditing(true); }}
    >
      {/* Type badge */}
      <span className={cn(
        "text-[7px] font-mono font-bold px-1 py-0.5 rounded border shrink-0 uppercase leading-none",
        typeColor,
      )}>
        {ch.type.slice(0, 3)}
      </span>

      {/* Key */}
      <span className="flex-1 text-[10px] font-mono text-foreground truncate min-w-0">
        {ch.key || <span className="text-muted-foreground italic">unnamed</span>}
        {ch.required && <span className="text-rose-400 ml-0.5 text-[8px]">*</span>}
      </span>

      {/* State mapping arrow */}
      {ch.stateChannelKey ? (
        <div className="flex items-center gap-0.5 shrink-0">
          <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
          <span className="text-[9px] font-mono text-primary/70 truncate max-w-[56px]">
            {ch.stateChannelKey}
          </span>
        </div>
      ) : (
        <span className="text-[8px] text-muted-foreground/40 shrink-0 italic">unmapped</span>
      )}

      {/* Delete on hover */}
      <Button
        variant="ghost"
        size="icon"
        className="h-4 w-4 text-muted-foreground hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0 nodrag"
        onMouseDown={(e) => { stop(e); onDelete(idx); }}
      >
        <Trash2 className="w-2.5 h-2.5" />
      </Button>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({
  icon, label, count, onAdd, color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  onAdd?: (e: React.MouseEvent) => void;
  color: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 border-b border-border/30", color)}>
      <span className="shrink-0">{icon}</span>
      <span className="text-[9px] font-bold uppercase tracking-wider flex-1">{label}</span>
      <span className="text-[8px] font-mono opacity-50">{count}</span>
      {onAdd && (
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 text-muted-foreground hover:text-foreground nodrag ml-0.5"
          onClick={onAdd}
          title={`Add ${label.toLowerCase()} variable`}
        >
          <Plus className="w-2.5 h-2.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const LangGraphCanvasStartNode = ({
  data,
  selected,
}: NodeProps<StartNode>) => {
  const allChannels    = data.inputChannels || [];
  const stateChannels  = (data.stateChannels || []);
  const suggestedParams = data.suggestedParams;
  const [collapsed, setCollapsed] = useState(false);

  const onAddInputChannel     = data.onAddInputChannel;
  const onAddSuggestedChannel = data.onAddSuggestedChannel;
  const onUpdateInputChannel  = data.onUpdateInputChannel;
  const onDeleteInputChannel  = data.onDeleteInputChannel;
  const onOpenInputsTab       = data.onOpenInputsTab;

  // Split by source
  const requestVars = allChannels.filter((c) => c.source === "request" || (!c.source && suggestedParams?.some((s) => s.key === c.key)));
  const customVars  = allChannels.filter((c) => c.source === "custom" || (!c.source && !suggestedParams?.some((s) => s.key === c.key)));

  // Suggested not yet added
  const pendingSuggestions = (suggestedParams || []).filter(
    (s) => !allChannels.some((c) => c.key === s.key),
  );

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const handleAddCustom = useCallback((e: React.MouseEvent) => {
    stop(e);
    onAddInputChannel?.();
  }, [onAddInputChannel]);

  const handleAddSuggested = useCallback((e: React.MouseEvent, s: typeof pendingSuggestions[0]) => {
    stop(e);
    onAddSuggestedChannel?.({
      key: s.key,
      type: s.type,
      required: s.required ?? true,
      description: s.description || "",
      source: "request",
    });
  }, [onAddSuggestedChannel]);

  // Find global index for a channel (request or custom list index → allChannels index)
  const globalIdx = (ch: LangGraphInputChannel) => allChannels.findIndex((c) => c === ch);

  return (
    <div
      className={cn(
        "rounded-2xl bg-card/95 backdrop-blur-md border-2 w-[300px] flex flex-col shadow-xl transition-all duration-200",
        selected
          ? "border-primary ring-4 ring-primary/20 scale-[1.03]"
          : "border-primary/50 hover:border-primary/80",
      )}
    >
      {/* ── Card header ── */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer nodrag select-none"
        onClick={() => { setCollapsed(!collapsed); onOpenInputsTab?.(); }}
      >
        <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
          <Zap className="w-3.5 h-3.5 text-primary animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-xs tracking-widest text-primary">START</p>
          <p className="text-[9px] text-muted-foreground font-mono">
            {requestVars.length} req · {customVars.length} custom
            {pendingSuggestions.length > 0 && (
              <span className="ml-1 text-amber-400">· {pendingSuggestions.length} new</span>
            )}
          </p>
        </div>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
          collapsed && "rotate-180",
        )} />
      </div>

      {/* ── Body ── */}
      {!collapsed && (
        <div className="flex flex-col border-t border-border/50">

          {/* ── Section 1: Incoming Request Variables ── */}
          <div>
            <SectionHeader
              icon={<Globe className="w-2.5 h-2.5 text-sky-400" />}
              label="Incoming Request"
              count={requestVars.length}
              color="bg-sky-500/5 text-sky-400"
            />

            {requestVars.length === 0 && pendingSuggestions.length === 0 && (
              <div className="px-3 py-2 text-[9px] text-muted-foreground italic text-center">
                No endpoint connected
              </div>
            )}

            {requestVars.map((ch) => (
              <ChannelRow
                key={ch.key + globalIdx(ch)}
                ch={ch}
                idx={globalIdx(ch)}
                stateChannels={stateChannels}
                onUpdate={onUpdateInputChannel ?? (() => {})}
                onDelete={onDeleteInputChannel ?? (() => {})}
              />
            ))}

            {/* Pending suggestions */}
            {pendingSuggestions.length > 0 && (
              <div className="flex flex-col">
                {pendingSuggestions.map((s, i) => {
                  const typeColor = TYPE_COLORS[s.type] || TYPE_COLORS.string;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-sky-500/10 hover:bg-sky-500/5 cursor-pointer group/sug nodrag"
                      onClick={(e) => handleAddSuggested(e, s)}
                      title={`Import "${s.key}" from endpoint`}
                    >
                      <Sparkles className="w-2.5 h-2.5 text-amber-400/60 shrink-0" />
                      <span className={cn(
                        "text-[7px] font-mono font-bold px-1 py-0.5 rounded border shrink-0 uppercase opacity-60",
                        typeColor,
                      )}>
                        {s.type.slice(0, 3)}
                      </span>
                      <span className="flex-1 text-[10px] font-mono text-muted-foreground truncate">
                        {s.key}
                        {s.required && <span className="text-rose-400 ml-0.5">*</span>}
                      </span>
                      <Plus className="w-3 h-3 text-sky-400 opacity-0 group-hover/sug:opacity-100 transition-opacity shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Section 2: Custom Variables ── */}
          <div className="border-t border-border/40">
            <SectionHeader
              icon={<Sliders className="w-2.5 h-2.5 text-violet-400" />}
              label="Custom Variables"
              count={customVars.length}
              onAdd={handleAddCustom}
              color="bg-violet-500/5 text-violet-400"
            />

            {customVars.length === 0 ? (
              <div
                className="flex items-center justify-center gap-1.5 px-3 py-2 cursor-pointer hover:bg-violet-500/5 transition-colors nodrag"
                onClick={handleAddCustom}
              >
                <Plus className="w-2.5 h-2.5 text-violet-400/60" />
                <span className="text-[9px] text-violet-400/60 italic">add a custom variable</span>
              </div>
            ) : (
              customVars.map((ch) => (
                <ChannelRow
                  key={ch.key + globalIdx(ch)}
                  ch={ch}
                  idx={globalIdx(ch)}
                  stateChannels={stateChannels}
                  onUpdate={onUpdateInputChannel ?? (() => {})}
                  onDelete={onDeleteInputChannel ?? (() => {})}
                />
              ))
            )}
          </div>

          {/* ── State mapping legend ── */}
          {stateChannels.length > 0 && allChannels.some((c) => c.stateChannelKey) && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-t border-border/30 bg-primary/3">
              <ArrowRight className="w-2.5 h-2.5 text-primary/40 shrink-0" />
              <span className="text-[8px] text-muted-foreground/60">
                Mapped fields set initial state on invoke
              </span>
            </div>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!bg-primary !w-3.5 !h-3.5 !border-2 !border-background hover:!scale-125 transition-transform"
      />
    </div>
  );
};

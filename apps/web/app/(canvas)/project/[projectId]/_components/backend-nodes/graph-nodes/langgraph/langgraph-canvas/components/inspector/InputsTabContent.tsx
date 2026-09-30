import React from "react";
import { Plus, Trash, Sparkles, Globe, Sliders, ArrowRight } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { LocalInput } from "../../../../common";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import type { LangGraphInputChannel, LangGraphStateChannel } from "@workspace/canvas";
import { cn } from "@workspace/ui/lib/utils";

type SuggestedParam = {
  key: string;
  type: LangGraphInputChannel["type"];
  description?: string;
  required?: boolean;
};

interface InputsTabContentProps {
  inputChannels: LangGraphInputChannel[];
  setInputChannels: React.Dispatch<React.SetStateAction<LangGraphInputChannel[]>>;
  suggestedParams?: SuggestedParam[];
  stateChannels?: LangGraphStateChannel[];
}

const TYPE_COLORS: Record<LangGraphInputChannel["type"], string> = {
  string:   "bg-emerald-500/10 text-emerald-400 border-emerald-400/30",
  messages: "bg-primary/10 text-primary border-primary/30",
  json:     "bg-amber-500/10 text-amber-400 border-amber-400/30",
  number:   "bg-blue-500/10 text-blue-400 border-blue-400/30",
  boolean:  "bg-rose-500/10 text-rose-400 border-rose-400/30",
  object:   "bg-purple-500/10 text-purple-400 border-purple-400/30",
  array:    "bg-orange-500/10 text-orange-400 border-orange-400/30",
};

// Single channel editor row in the inspector
function ChannelEditor({
  input,
  idx,
  stateChannels = [],
  onChange,
  onDelete,
}: {
  input: LangGraphInputChannel;
  idx: number;
  stateChannels?: LangGraphStateChannel[];
  onChange: (idx: number, changes: Partial<LangGraphInputChannel>) => void;
  onDelete: (idx: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 p-3.5 rounded-xl border bg-card/50 shadow-sm text-xs">
      {/* Key + type + delete */}
      <div className="flex items-center gap-2">
        <LocalInput
          className="h-7 text-xs font-mono font-medium bg-background flex-1"
          value={input.key}
          onChange={(e) => onChange(idx, { key: e.target.value })}
          placeholder="field_key"
        />
        <Select
          value={input.type}
          onValueChange={(v) => onChange(idx, { type: v as LangGraphInputChannel["type"] })}
        >
          <SelectTrigger className="h-7 text-xs w-28 bg-background font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["string","messages","json","number","boolean","object","array"] as LangGraphInputChannel["type"][]).map((t) => (
              <SelectItem key={t} value={t} className="text-xs font-mono">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
          onClick={() => onDelete(idx)}
        >
          <Trash className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Description + required */}
      <div className="flex items-center gap-2">
        <LocalInput
          className="h-7 text-xs bg-background/50 flex-1"
          value={input.description || ""}
          onChange={(e) => onChange(idx, { description: e.target.value })}
          placeholder="Description (optional)"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <Label className="text-xs text-muted-foreground">Req</Label>
          <Switch
            checked={input.required ?? false}
            onCheckedChange={(c) => onChange(idx, { required: c })}
          />
        </div>
      </div>

      {/* State channel mapping */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
          <ArrowRight className="w-3 h-3" />
          <span className="text-[10px]">Initial state</span>
        </div>
        <Select
          value={input.stateChannelKey || "__none__"}
          onValueChange={(v) => onChange(idx, { stateChannelKey: v === "__none__" ? undefined : v })}
        >
          <SelectTrigger className="h-7 flex-1 text-xs bg-background font-mono">
            <SelectValue placeholder="— no mapping —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" className="text-xs text-muted-foreground">— no mapping —</SelectItem>
            {stateChannels.map((sc) => (
              <SelectItem key={sc.key} value={sc.key} className="text-xs font-mono">
                {sc.key}
                <span className="ml-1 text-[9px] text-muted-foreground opacity-70">({sc.type})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function InputsTabContent({
  inputChannels,
  setInputChannels,
  suggestedParams = [],
  stateChannels = [],
}: InputsTabContentProps) {
  const pendingSuggestions = suggestedParams.filter(
    (s) => !inputChannels.some((c) => c.key === s.key),
  );

  // Split by source
  const requestVars = inputChannels.filter(
    (c) => c.source === "request" || (!c.source && suggestedParams.some((s) => s.key === c.key)),
  );
  const customVars = inputChannels.filter(
    (c) => c.source === "custom" || (!c.source && !suggestedParams.some((s) => s.key === c.key)),
  );

  const globalIdx = (ch: LangGraphInputChannel) => inputChannels.indexOf(ch);

  const handleChange = (idx: number, changes: Partial<LangGraphInputChannel>) => {
    setInputChannels((prev) => prev.map((c, i) => (i === idx ? { ...c, ...changes } : c)));
  };

  const handleDelete = (idx: number) => {
    setInputChannels((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddCustom = () => {
    setInputChannels((prev) => [
      ...prev,
      { key: `var_${prev.length + 1}`, type: "string", required: false, description: "", source: "custom" },
    ]);
  };

  const handleAddSuggested = (s: SuggestedParam) => {
    setInputChannels((prev) => [
      ...prev,
      { key: s.key, type: s.type, required: s.required ?? true, description: s.description || "", source: "request" },
    ]);
  };

  const handleImportAll = () => {
    const toAdd = pendingSuggestions.map((s) => ({
      key: s.key, type: s.type, required: s.required ?? true, description: s.description || "", source: "request" as const,
    }));
    setInputChannels((prev) => [...prev, ...toAdd]);
  };

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto hide-scrollbar">

      {/* ── Section 1: Incoming Request Variables ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between pb-2 border-b border-sky-500/20">
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
              Incoming Request
            </span>
            <span className="text-[9px] text-muted-foreground font-mono">({requestVars.length})</span>
          </div>
        </div>

        {/* Suggested from endpoint */}
        {pendingSuggestions.length > 0 && (
          <div className="flex flex-col gap-1 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] font-semibold text-amber-400">Available from endpoint</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-5 text-[9px] border-sky-500/30 text-sky-400 hover:bg-sky-500/10 px-2"
                onClick={handleImportAll}
              >
                Import All
              </Button>
            </div>
            {pendingSuggestions.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-sky-500/10 cursor-pointer transition-colors group"
                onClick={() => handleAddSuggested(s)}
              >
                <span className={cn(
                  "text-[8px] font-mono font-bold px-1 py-0.5 rounded border shrink-0 uppercase",
                  TYPE_COLORS[s.type],
                )}>{s.type}</span>
                <span className="flex-1 text-xs font-mono">
                  {s.key}{s.required && <span className="text-rose-400 ml-0.5">*</span>}
                </span>
                {s.description && (
                  <span className="text-[9px] text-muted-foreground truncate max-w-[80px]">{s.description}</span>
                )}
                <Plus className="w-3 h-3 text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            ))}
          </div>
        )}

        {requestVars.map((ch) => (
          <ChannelEditor
            key={ch.key + globalIdx(ch)}
            input={ch}
            idx={globalIdx(ch)}
            stateChannels={stateChannels}
            onChange={handleChange}
            onDelete={handleDelete}
          />
        ))}

        {requestVars.length === 0 && pendingSuggestions.length === 0 && (
          <p className="text-xs text-muted-foreground italic text-center py-2">
            Connect a ServiceNode endpoint to import request params.
          </p>
        )}
      </div>

      {/* ── Section 2: Custom Variables ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Custom Variables
            </span>
            <span className="text-[9px] text-muted-foreground font-mono">({customVars.length})</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] border-violet-500/30 text-violet-400 hover:bg-violet-500/10 px-2 gap-1"
            onClick={handleAddCustom}
          >
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>

        {customVars.map((ch) => (
          <ChannelEditor
            key={ch.key + globalIdx(ch)}
            input={ch}
            idx={globalIdx(ch)}
            stateChannels={stateChannels}
            onChange={handleChange}
            onDelete={handleDelete}
          />
        ))}

        {customVars.length === 0 && (
          <p className="text-xs text-muted-foreground italic text-center py-2">
            Add custom variables like <code className="font-mono not-italic">userId</code>, <code className="font-mono not-italic">sessionId</code> etc.
          </p>
        )}
      </div>

      {/* ── State mapping hint ── */}
      {stateChannels.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10 text-xs text-muted-foreground">
          <ArrowRight className="w-3.5 h-3.5 text-primary/50 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-foreground/70 mb-0.5">Initial State Mapping</p>
            <p>Each field can be mapped to a state channel. On invocation, the mapped state channels will be pre-seeded with the incoming value — e.g. <code className="font-mono">message → messages</code>.</p>
          </div>
        </div>
      )}
    </div>
  );
}

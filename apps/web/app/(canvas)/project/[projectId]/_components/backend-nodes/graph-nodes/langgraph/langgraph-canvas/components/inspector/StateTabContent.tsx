import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Database,
  X,
  GitMerge,
  Code2,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Pencil,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { LocalInput, LocalTextarea } from "../../../../common";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type { LangGraphStateChannel, LangGraphCustomReducer } from "@/types/canvas";
import { isLangGraphChannelType } from "@workspace/canvas";

interface StateTabContentProps {
  stateChannels: LangGraphStateChannel[];
  setStateChannels: React.Dispatch<
    React.SetStateAction<LangGraphStateChannel[]>
  >;
  customReducers?: LangGraphCustomReducer[];
  onAddCustomReducer?: (reducer: LangGraphCustomReducer) => void;
  onUpdateCustomReducer?: (
    idOrName: string,
    changes: Partial<LangGraphCustomReducer>,
  ) => void;
  onDeleteCustomReducer?: (idOrName: string) => void;
  onClose?: () => void;
}

const BUILT_IN_REDUCERS = [
  {
    name: "replace",
    label: "replace (last-value-wins)",
    desc: "Direct assignment, overwriting previous value",
    typeHint: "primitive",
  },
  {
    name: "add_messages",
    label: "add_messages (dedup/append)",
    desc: "LangGraph ID-based dedup and message history append",
    typeHint: "messages",
  },
  {
    name: "append",
    label: "append (array concat)",
    desc: "Appends incoming updates to the existing array",
    typeHint: "array",
  },
  {
    name: "concat_array",
    label: "concat_array (merge lists)",
    desc: "Concatenates array updates",
    typeHint: "array",
  },
  {
    name: "merge_object",
    label: "merge_object (dict merge)",
    desc: "Shallow dictionary merge: { ...prev, ...next }",
    typeHint: "object",
  },
];

export function StateTabContent({
  stateChannels,
  setStateChannels,
  customReducers: externalCustomReducers,
  onAddCustomReducer,
  onUpdateCustomReducer,
  onDeleteCustomReducer,
  onClose,
}: StateTabContentProps) {
  // Discover any custom reducers initialized from state channels or passed externally
  const customReducers = React.useMemo(() => {
    const builtInNames = new Set(BUILT_IN_REDUCERS.map((r) => r.name));
    const list: LangGraphCustomReducer[] = [...(externalCustomReducers || [])];
    stateChannels.forEach((ch) => {
      if (
        ch.reducer &&
        !builtInNames.has(ch.reducer) &&
        !list.some((r) => r.name === ch.reducer)
      ) {
        list.push({
          id: `custom_${ch.reducer}`,
          name: ch.reducer,
          code:
            ch.customReducerCode ||
            "(prev, next) => Array.isArray(prev) ? [...prev, ...next] : next",
          description: `Custom reducer function for ${ch.key}`,
        });
      }
    });
    return list;
  }, [externalCustomReducers, stateChannels]);

  const [isAddingReducer, setIsAddingReducer] = useState(false);
  const [newReducerName, setNewReducerName] = useState("");
  const [newReducerCode, setNewReducerCode] = useState("(prev, next) => Array.isArray(prev) ? [...prev, ...next] : next");
  const [newReducerDesc, setNewReducerDesc] = useState("");
  const [showReducersSection, setShowReducersSection] = useState(true);

  // Edit custom reducer state
  const [editingReducerId, setEditingReducerId] = useState<string | null>(null);
  const [editReducerName, setEditReducerName] = useState("");
  const [editReducerCode, setEditReducerCode] = useState("");
  const [editReducerDesc, setEditReducerDesc] = useState("");

  const handleStartEditCustomReducer = (reducer: LangGraphCustomReducer) => {
    setEditingReducerId(reducer.id);
    setEditReducerName(reducer.name);
    setEditReducerCode(reducer.code);
    setEditReducerDesc(reducer.description || "");
  };

  const handleCancelEditCustomReducer = () => {
    setEditingReducerId(null);
    setEditReducerName("");
    setEditReducerCode("");
    setEditReducerDesc("");
  };

  const handleSaveEditCustomReducer = (reducerId: string) => {
    const trimmedName = editReducerName.trim().replace(/\s+/g, "_");
    if (!trimmedName) return;

    if (onUpdateCustomReducer) {
      onUpdateCustomReducer(reducerId, {
        name: trimmedName,
        code: editReducerCode.trim() || "(prev, next) => next",
        description: editReducerDesc.trim() || undefined,
      });
    } else {
      // Fallback local update
      setStateChannels((prev) =>
        prev.map((c) =>
          c.reducer === editReducerName || c.reducer === reducerId
            ? {
                ...c,
                reducer: trimmedName,
                customReducerCode: editReducerCode.trim() || "(prev, next) => next",
              }
            : c,
        ),
      );
    }

    setEditingReducerId(null);
  };

  const handleAddField = () => {
    const newChannel: LangGraphStateChannel = {
      key: "",
      type: "string",
      reducer: "replace",
      defaultValue: "",
    };
    setStateChannels([...stateChannels, newChannel]);
  };

  const handleDeleteField = (index: number) => {
    setStateChannels(stateChannels.filter((_, i) => i !== index));
  };

  const handleUpdateField = (
    index: number,
    changes: Partial<LangGraphStateChannel>,
  ) => {
    setStateChannels(
      stateChannels.map((c, i) => (i === index ? { ...c, ...changes } : c)),
    );
  };

  const handleCreateCustomReducer = () => {
    const trimmedName = newReducerName.trim().replace(/\s+/g, "_");
    if (!trimmedName) return;

    const newReducer: LangGraphCustomReducer = {
      id: `custom_${Date.now().toString(36)}`,
      name: trimmedName,
      code: newReducerCode.trim() || "(prev, next) => next",
      description: newReducerDesc.trim() || undefined,
    };

    if (onAddCustomReducer) {
      onAddCustomReducer(newReducer);
    }
    setIsAddingReducer(false);
    setNewReducerName("");
    setNewReducerCode("(prev, next) => Array.isArray(prev) ? [...prev, ...next] : next");
    setNewReducerDesc("");
  };

  const handleDeleteCustomReducer = (reducerName: string) => {
    if (onDeleteCustomReducer) {
      onDeleteCustomReducer(reducerName);
    }
    // If any channel was using this custom reducer, revert to 'replace'
    setStateChannels((prev) =>
      prev.map((c) =>
        c.reducer === reducerName
          ? { ...c, reducer: "replace", customReducerCode: undefined }
          : c,
      ),
    );
  };

  return (
    <div className="flex-1 min-h-0 p-4 overflow-y-auto hide-scrollbar m-0 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#006ddd]/10 text-[#006ddd] border border-[#006ddd]/20">
            <Database className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xs text-foreground tracking-wide">
              Global Graph State
            </span>
            <span className="text-[10px] text-muted-foreground">
              {stateChannels.length} channels • {BUILT_IN_REDUCERS.length + customReducers.length} reducers
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-border gap-1 font-semibold hover:border-[#006ddd]/50 hover:bg-[#006ddd]/10 hover:text-[#006ddd]"
            onClick={handleAddField}
          >
            <Plus className="w-3.5 h-3.5" /> Add Field
          </Button>
          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              title="Close Inspector"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* State Channels Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          State Channels ({stateChannels.length})
        </span>

        {stateChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-border rounded-xl gap-2 bg-secondary/10">
            <Database className="w-8 h-8 text-muted-foreground/40" />
            <span className="text-xs font-semibold text-foreground">
              No State Channels Defined
            </span>
            <span className="text-[11px] text-muted-foreground max-w-[220px]">
              State channels hold shared data accessible across all nodes in the graph.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs mt-2 gap-1.5"
              onClick={handleAddField}
            >
              <Plus className="w-3.5 h-3.5" /> Add State Field
            </Button>
          </div>
        ) : (
          stateChannels.map((ch, idx) => {
            const isCustom = !BUILT_IN_REDUCERS.some((r) => r.name === ch.reducer);

            return (
              <div
                key={idx}
                className="flex flex-col gap-3 p-3 rounded-xl border border-border/60 bg-card/60 shadow-sm backdrop-blur-sm text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-1 flex-1">
                    <Label className="text-[10px] text-muted-foreground font-mono">
                      Field Key #{idx + 1}
                    </Label>
                    <LocalInput
                      className="h-7 text-xs font-mono font-medium bg-background"
                      placeholder="e.g. messages, user_query"
                      autoFocus={!ch.key}
                      value={ch.key}
                      onChange={(e) => {
                        handleUpdateField(idx, { key: e.target.value });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
                          e.target.blur();
                        }
                      }}
                    />
                  </div>
                  <div className="self-end pb-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleDeleteField(idx)}
                      title="Delete state field"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">Type</Label>
                    <Select
                      value={ch.type}
                      onValueChange={(v) => {
                        if (isLangGraphChannelType(v)) {
                          const defaultReducer =
                            v === "messages"
                              ? "add_messages"
                              : v === "array"
                                ? "append"
                                : v === "object"
                                  ? "merge_object"
                                  : "replace";
                          handleUpdateField(idx, { type: v, reducer: defaultReducer });
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs bg-background font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="messages">messages</SelectItem>
                        <SelectItem value="string">string</SelectItem>
                        <SelectItem value="number">number</SelectItem>
                        <SelectItem value="boolean">boolean</SelectItem>
                        <SelectItem value="array">array</SelectItem>
                        <SelectItem value="object">object</SelectItem>
                        <SelectItem value="json">json</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] text-muted-foreground">Reducer</Label>
                      {isCustom && (
                        <span className="text-[9px] text-purple-400 font-mono font-bold">
                          custom
                        </span>
                      )}
                    </div>
                    <Select
                      value={ch.reducer}
                      onValueChange={(v) => {
                        const matchedCustom = customReducers.find((r) => r.name === v);
                        handleUpdateField(idx, {
                          reducer: v,
                          customReducerCode: matchedCustom?.code,
                        });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs bg-background font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="font-mono text-xs">
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">
                          Built-in Reducers
                        </div>
                        {BUILT_IN_REDUCERS.map((r) => (
                          <SelectItem key={r.name} value={r.name}>
                            {r.label}
                          </SelectItem>
                        ))}

                        {customReducers.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-t border-border/40 mt-1">
                              Custom Reducers
                            </div>
                            {customReducers.map((r) => (
                              <SelectItem key={r.id} value={r.name}>
                                {r.name} (custom)
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isCustom && ch.customReducerCode && (
                  <div className="p-1.5 rounded bg-secondary/40 border border-purple-500/20 text-[9px] font-mono text-muted-foreground">
                    <span className="text-purple-400 font-bold block mb-0.5">Reducer implementation:</span>
                    <code className="text-purple-300 block truncate">{ch.customReducerCode}</code>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Reducer Functions Section */}
      <div className="flex flex-col gap-2.5 border-t border-border/50 pt-3">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setShowReducersSection((prev) => !prev)}
        >
          <div className="flex items-center gap-1.5">
            <GitMerge className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Reducer Functions
            </span>
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 h-4 text-purple-400 border-purple-500/30 font-mono"
            >
              {BUILT_IN_REDUCERS.length + customReducers.length} total
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 gap-1 font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                setShowReducersSection(true);
                setIsAddingReducer(true);
              }}
            >
              <Plus className="w-3 h-3" /> Add Custom Reducer
            </Button>
            {showReducersSection ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>

        {showReducersSection && (
          <div className="flex flex-col gap-2">
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 px-1">
              <Info className="w-3 h-3 text-purple-400 shrink-0" />
              <span>Reducers merge incoming node updates into state channels.</span>
            </div>

            {/* Custom Reducer Creation Form */}
            {isAddingReducer && (
              <div className="flex flex-col gap-2 p-3 rounded-xl border border-purple-500/40 bg-purple-500/5 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5" /> Define Custom Reducer
                  </span>
                  <button
                    onClick={() => setIsAddingReducer(false)}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground font-mono">
                    Reducer Name
                  </Label>
                  <LocalInput
                    className="h-7 text-xs font-mono font-medium bg-background"
                    placeholder="e.g. sum_scores, dedup_append"
                    value={newReducerName}
                    onChange={(e) => setNewReducerName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground font-mono">
                      Reducer Function Body (JavaScript)
                    </Label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setNewReducerCode("(prev, next) => [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [next])]")}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
                        title="Append array values"
                      >
                        +array
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewReducerCode("(prev, next) => ({ ...(prev || {}), ...(next || {}) })")}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
                        title="Merge object keys"
                      >
                        +merge
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewReducerCode("(prev, next) => (prev || 0) + (next || 0)")}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
                        title="Sum numbers"
                      >
                        +sum
                      </button>
                    </div>
                  </div>
                  <LocalTextarea
                    className="min-h-[72px] text-xs font-mono bg-background leading-relaxed p-2 resize-y"
                    placeholder="(prev, next) => prev + next"
                    value={newReducerCode}
                    onChange={(e) => setNewReducerCode(e.target.value)}
                    debounceMs={150}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground font-mono">
                    Description (optional)
                  </Label>
                  <LocalInput
                    className="h-7 text-xs bg-background"
                    placeholder="Brief description of the reduction logic"
                    value={newReducerDesc}
                    onChange={(e) => setNewReducerDesc(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setIsAddingReducer(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-1"
                    onClick={handleCreateCustomReducer}
                    disabled={!newReducerName.trim()}
                  >
                    <Check className="w-3 h-3" /> Save Reducer
                  </Button>
                </div>
              </div>
            )}

            {/* Custom Reducers List */}
            {customReducers.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 px-1">
                  Custom Reducers ({customReducers.length})
                </span>
                {customReducers.map((r) => {
                  const isEditing = editingReducerId === r.id;

                  if (isEditing) {
                    return (
                      <div
                        key={r.id}
                        className="flex flex-col gap-2 p-2.5 rounded-xl border border-purple-500/50 bg-purple-500/10 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
                            <Code2 className="w-3.5 h-3.5" /> Edit Custom Reducer
                          </span>
                          <button
                            type="button"
                            onClick={handleCancelEditCustomReducer}
                            className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-[9px] text-muted-foreground font-mono">
                            Reducer Name
                          </Label>
                          <LocalInput
                            className="h-7 text-xs font-mono font-medium bg-background"
                            placeholder="reducer_name"
                            value={editReducerName}
                            onChange={(e) => setEditReducerName(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[9px] text-muted-foreground font-mono">
                              Function Body (JavaScript)
                            </Label>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditReducerCode("(prev, next) => [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [next])]")}
                                className="text-[8px] px-1 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
                                title="Append array values"
                              >
                                +array
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditReducerCode("(prev, next) => ({ ...(prev || {}), ...(next || {}) })")}
                                className="text-[8px] px-1 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
                                title="Merge object keys"
                              >
                                +merge
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditReducerCode("(prev, next) => (prev || 0) + (next || 0)")}
                                className="text-[8px] px-1 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
                                title="Sum numbers"
                              >
                                +sum
                              </button>
                            </div>
                          </div>
                          <LocalTextarea
                            className="min-h-[72px] text-xs font-mono bg-background leading-relaxed p-2 resize-y"
                            placeholder="(prev, next) => Array.isArray(prev) ? [...prev, ...next] : next"
                            value={editReducerCode}
                            onChange={(e) => setEditReducerCode(e.target.value)}
                            debounceMs={150}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-[9px] text-muted-foreground font-mono">
                            Description (optional)
                          </Label>
                          <LocalInput
                            className="h-7 text-xs bg-background"
                            placeholder="Description"
                            value={editReducerDesc}
                            onChange={(e) => setEditReducerDesc(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={handleCancelEditCustomReducer}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-6 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-1 cursor-pointer"
                            onClick={() => handleSaveEditCustomReducer(r.id)}
                            disabled={!editReducerName.trim()}
                          >
                            <Check className="w-3 h-3" /> Save Changes
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={r.id}
                      className="flex flex-col gap-1 p-2 rounded-lg bg-purple-500/10 border border-purple-500/25 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-purple-300">{r.name}</span>
                          <Badge variant="secondary" className="text-[8px] h-3.5 px-1 bg-purple-500/20 text-purple-300 border-0">
                            custom
                          </Badge>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleStartEditCustomReducer(r)}
                            className="text-muted-foreground hover:text-purple-300 p-1 rounded transition-colors cursor-pointer"
                            title="Edit custom reducer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomReducer(r.name)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
                            title="Delete custom reducer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <code className="text-[9px] text-purple-200/80 line-clamp-3 whitespace-pre-wrap font-mono bg-background/50 px-1.5 py-1 rounded border border-purple-500/20">
                        {r.code}
                      </code>
                      {r.description && (
                        <span className="text-[9px] text-muted-foreground font-sans">{r.description}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Built-in Reducers Preview */}
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                Standard Built-ins
              </span>
              <div className="grid grid-cols-1 gap-1">
                {BUILT_IN_REDUCERS.map((r) => (
                  <div
                    key={r.name}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-secondary/30 border border-border/40 text-[10px] font-mono"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-foreground">{r.name}</span>
                      <span className="text-[9px] text-muted-foreground truncate">{r.desc}</span>
                    </div>
                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 shrink-0 text-muted-foreground font-mono">
                      {r.typeHint}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { NodeProps } from "@xyflow/react";
import {
  Database,
  Plus,
  Trash2,
  Pencil,
  Check,
  MoreVertical,
  Copy,
  Settings2,
  GitMerge,
  ChevronDown,
  ChevronRight,
  Code2,
  Info,
  X,
} from "lucide-react";
import {
  type StateGlobalNode,
  type LangGraphStateChannel,
  type LangGraphCustomReducer,
  isLangGraphChannelType,
} from "@workspace/canvas";
import { Button } from "@workspace/ui/components/button";
import { LocalInput, LocalTextarea } from "../../../common";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

export const LangGraphCanvasStateNode = ({
  data,
  selected,
}: NodeProps<StateGlobalNode>) => {
  const channels = data.stateChannels || [];
  const customReducers = data.customReducers || [];
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showReducers, setShowReducers] = useState(true);
  const [isAddingCustomReducer, setIsAddingCustomReducer] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCode, setCustomCode] = useState(
    "(prev, next) => Array.isArray(prev) ? [...prev, ...next] : next",
  );
  const [customDesc, setCustomDesc] = useState("");

  const handleSaveCustomReducer = (e: React.MouseEvent) => {
    e.stopPropagation();
    const trimmed = customName.trim().replace(/\s+/g, "_");
    if (!trimmed) return;
    const newReducer: LangGraphCustomReducer = {
      id: `custom_${Date.now().toString(36)}`,
      name: trimmed,
      code: customCode.trim() || "(prev, next) => next",
      description: customDesc.trim() || undefined,
    };
    if (data.onAddCustomReducer) {
      data.onAddCustomReducer(newReducer);
    }
    setIsAddingCustomReducer(false);
    setCustomName("");
    setCustomCode(
      "(prev, next) => Array.isArray(prev) ? [...prev, ...next] : next",
    );
    setCustomDesc("");
  };

  const handleDeleteCustom = (e: React.MouseEvent, idOrName: string) => {
    e.stopPropagation();
    if (data.onDeleteCustomReducer) {
      data.onDeleteCustomReducer(idOrName);
    }
  };

  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [editCustomName, setEditCustomName] = useState("");
  const [editCustomCode, setEditCustomCode] = useState("");
  const [editCustomDesc, setEditCustomDesc] = useState("");

  const handleStartEditCustom = (
    e: React.MouseEvent,
    r: LangGraphCustomReducer,
  ) => {
    e.stopPropagation();
    setEditingCustomId(r.id);
    setEditCustomName(r.name);
    setEditCustomCode(r.code);
    setEditCustomDesc(r.description || "");
  };

  const handleCancelEditCustom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomId(null);
    setEditCustomName("");
    setEditCustomCode("");
    setEditCustomDesc("");
  };

  const handleSaveEditCustom = (e: React.MouseEvent, rId: string) => {
    e.stopPropagation();
    const trimmed = editCustomName.trim().replace(/\s+/g, "_");
    if (!trimmed) return;
    if (data.onUpdateCustomReducer) {
      data.onUpdateCustomReducer(rId, {
        name: trimmed,
        code: editCustomCode.trim() || "(prev, next) => next",
        description: editCustomDesc.trim() || undefined,
      });
    }
    setEditingCustomId(null);
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onAddChannel) {
      data.onAddChannel();
      setEditingIdx(channels.length);
    } else if (data.onOpenStateTab) {
      data.onOpenStateTab();
    }
  };

  const handleUpdate = (
    idx: number,
    updated: Partial<LangGraphStateChannel>,
  ) => {
    if (data.onUpdateChannel) {
      data.onUpdateChannel(idx, updated);
    }
  };

  const handleDelete = (e?: React.MouseEvent, idx?: number) => {
    if (e) e.stopPropagation();
    if (idx !== undefined && data.onDeleteChannel) {
      data.onDeleteChannel(idx);
    }
    if (idx !== undefined && editingIdx === idx) {
      setEditingIdx(null);
    }
  };

  const handleDuplicate = (idx: number) => {
    if (data.onDuplicateChannel) {
      data.onDuplicateChannel(idx);
    } else if (data.onUpdateChannel) {
      const target = channels[idx];
      if (target && data.onAddChannel) {
        data.onAddChannel();
      }
    }
  };

  return (
    <div
      className={`rounded-xl bg-card/95 backdrop-blur-md border-2 border-[#006ddd]/60 w-[300px] p-3 flex flex-col gap-2 transition-all duration-200 shadow-xl relative ${
        selected
          ? "ring-4 ring-[#006ddd]/20 shadow-[#006ddd]/10 scale-105 border-[#006ddd]"
          : "hover:border-[#006ddd]/90"
      }`}
      onClick={() => {
        data.onOpenStateTab?.();
      }}
    >
      {/* Node Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#006ddd]/10 text-[#006ddd] border border-[#006ddd]/20">
            <Database className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xs text-foreground tracking-wide">
              {data.label || "Global Graph State"}
            </span>
            <span className="text-[9px] font-mono text-muted-foreground">
              {channels.length} state fields
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-5 px-1.5 text-[9px] uppercase font-mono font-extrabold bg-[#006ddd]/10 hover:bg-[#006ddd]/20 text-[#006ddd] border-[#006ddd]/20 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            data.onOpenStateTab?.();
          }}
          title="Open State Schema in Inspector"
        >
          State Schema
        </Button>
      </div>

      {/* State Fields List */}
      <div className="flex flex-col gap-1.5 nodrag">
        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1.5 py-0.5 bg-secondary/30 rounded border border-border/30 group">
          <span>State Fields</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            onClick={handleAdd}
            title="Add State Field"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="max-h-[260px] overflow-y-auto pr-0.5 flex flex-col gap-1.5">
          {channels.length === 0 ? (
            <div className="text-[10px] text-muted-foreground italic text-center py-2">
              No state fields. Click + to add.
            </div>
          ) : (
            channels.map((ch, idx) => {
              const isEditing = editingIdx === idx;

              if (isEditing) {
                return (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 p-2.5 rounded-lg bg-secondary/80 border border-[#006ddd]/50 shadow-md nodrag"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1.5">
                      <LocalInput
                        className="h-7 text-xs font-mono font-semibold bg-background flex-1"
                        value={ch.key}
                        placeholder="field_name"
                        autoFocus
                        onChange={(e) =>
                          handleUpdate(idx, { key: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setEditingIdx(null);
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        variant="default"
                        className="h-7 w-7 bg-[#006ddd] hover:bg-[#006ddd]/90 text-white shrink-0"
                        onClick={() => setEditingIdx(null)}
                        title="Done editing"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={(e) => handleDelete(e, idx)}
                        title="Delete state variable"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-muted-foreground font-medium">
                          Type
                        </span>
                        <Select
                          value={ch.type}
                          onValueChange={(val) => {
                            if (isLangGraphChannelType(val)) {
                              const defaultReducer =
                                val === "messages"
                                  ? "add_messages"
                                  : val === "array"
                                    ? "append"
                                    : val === "object"
                                      ? "merge_object"
                                      : "replace";
                              handleUpdate(idx, {
                                type: val,
                                reducer: defaultReducer,
                              });
                            }
                          }}
                        >
                          <SelectTrigger
                            size="sm"
                            className="h-6 text-[10px] bg-background font-mono w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="font-mono text-xs">
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

                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-muted-foreground font-medium">
                          Reducer
                        </span>
                        <Select
                          value={ch.reducer}
                          onValueChange={(val) => {
                            const matchedCustom = customReducers.find((r) => r.name === val);
                            handleUpdate(idx, {
                              reducer: val,
                              customReducerCode: matchedCustom?.code,
                            });
                          }}
                        >
                          <SelectTrigger
                            size="sm"
                            className="h-6 text-[10px] bg-background font-mono w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="font-mono text-xs">
                            <div className="px-2 py-0.5 text-[9px] font-bold text-muted-foreground uppercase">
                              Built-in
                            </div>
                            <SelectItem value="replace">replace</SelectItem>
                            <SelectItem value="add_messages">
                              add_messages
                            </SelectItem>
                            <SelectItem value="append">append</SelectItem>
                            <SelectItem value="concat_array">
                              concat_array
                            </SelectItem>
                            <SelectItem value="merge_object">
                              merge_object
                            </SelectItem>
                            {customReducers.length > 0 && (
                              <>
                                <div className="px-2 py-0.5 text-[9px] font-bold text-purple-400 uppercase border-t border-border/40 mt-1">
                                  Custom
                                </div>
                                {customReducers.map((r) => (
                                  <SelectItem key={r.id} value={r.name}>
                                    {r.name}
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-secondary/40 hover:bg-secondary/70 px-2 py-1.5 rounded-lg text-[10px] font-mono border border-border/40 group transition-all nodrag"
                >
                  <div
                    className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingIdx(idx);
                    }}
                    title="Click to edit field name and configuration"
                  >
                    <span
                      className={`font-bold truncate max-w-[95px] ${
                        !ch.key ? "text-amber-500 italic" : "text-foreground"
                      }`}
                    >
                      {ch.key || "(unnamed)"}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-4 border-border/60 text-muted-foreground font-mono font-normal shrink-0"
                    >
                      {ch.type}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1 py-0 h-4 bg-[#006ddd]/15 text-[#006ddd] border border-[#006ddd]/20 font-mono font-semibold shrink-0"
                    >
                      {ch.reducer}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-0.5 ml-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingIdx(idx);
                      }}
                      title="Edit state variable"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      onClick={(e) => handleDelete(e, idx)}
                      title="Delete state variable"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                          title="More options"
                        >
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-44 text-xs font-sans"
                      >
                        <DropdownMenuItem
                          onClick={() => setEditingIdx(idx)}
                          className="gap-2 text-xs cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit inline
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => data.onOpenStateTab?.()}
                          className="gap-2 text-xs cursor-pointer"
                        >
                          <Settings2 className="w-3.5 h-3.5" /> Open in Inspector
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(idx)}
                          className="gap-2 text-xs cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" /> Duplicate field
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => handleDelete(e, idx)}
                          className="gap-2 text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete field
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Reducer Functions Section (LangGraph Reducer Functions) */}
      <div className="flex flex-col gap-1.5 nodrag border-t border-border/50 pt-2">
        <div
          className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1.5 py-1 bg-secondary/30 hover:bg-secondary/50 rounded border border-border/30 cursor-pointer transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setShowReducers((prev) => !prev);
          }}
        >
          <div className="flex items-center gap-1.5 text-foreground">
            <GitMerge className="w-3.5 h-3.5 text-purple-400" />
            <span>Reducer Functions</span>
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 h-3.5 text-purple-400 border-purple-500/30"
            >
              {5 + customReducers.length} reducers
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-5 px-1.5 text-[9px] uppercase font-mono font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/30 cursor-pointer gap-1"
              onClick={(e) => {
                e.stopPropagation();
                setShowReducers(true);
                setIsAddingCustomReducer((prev) => !prev);
              }}
              title="Add Custom Reducer"
            >
              <Plus className="w-3 h-3" /> Reducer
            </Button>
            {showReducers ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
          </div>
        </div>

        {showReducers && (
          <div className="flex flex-col gap-1 pt-0.5">
            <div className="text-[9px] text-muted-foreground px-1 flex items-center gap-1">
              <Info className="w-3 h-3 text-purple-400 shrink-0" />
              <span>Channels combine node outputs via these reducers:</span>
            </div>

            {/* Inline Custom Reducer Creator */}
            {isAddingCustomReducer && (
              <div
                className="flex flex-col gap-1.5 p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 shadow-md nodrag"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-purple-300 flex items-center gap-1">
                    <Code2 className="w-3 h-3" /> New Custom Reducer
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomReducer(false)}
                    className="text-muted-foreground hover:text-foreground text-[10px]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <LocalInput
                  className="h-6 text-[10px] font-mono bg-background"
                  placeholder="reducer_name (e.g. sum_scores)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  autoFocus
                />
                <LocalTextarea
                  className="min-h-[52px] text-[10px] font-mono bg-background leading-relaxed p-1.5 resize-y"
                  placeholder="(prev, next) => prev + next"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  debounceMs={150}
                />
                <LocalInput
                  className="h-6 text-[10px] bg-background"
                  placeholder="Description (optional)"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                />
                <div className="flex items-center justify-end gap-1 pt-0.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => setIsAddingCustomReducer(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-5 px-2 text-[9px] bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-1 cursor-pointer"
                    onClick={handleSaveCustomReducer}
                    disabled={!customName.trim()}
                  >
                    <Check className="w-3 h-3" /> Save
                  </Button>
                </div>
              </div>
            )}

            {/* Custom Reducers List */}
            {customReducers.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider px-1">
                  Custom Reducers ({customReducers.length})
                </span>
                {customReducers.map((r) => {
                  const isEditing = editingCustomId === r.id;

                  if (isEditing) {
                    return (
                      <div
                        key={r.id}
                        className="flex flex-col gap-1.5 p-2 rounded-lg bg-purple-500/15 border border-purple-500/40 shadow-sm nodrag"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-purple-300 flex items-center gap-1">
                            <Pencil className="w-3 h-3" /> Edit Reducer
                          </span>
                          <button
                            type="button"
                            onClick={handleCancelEditCustom}
                            className="text-muted-foreground hover:text-foreground text-[10px] cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <LocalInput
                          className="h-6 text-[10px] font-mono bg-background"
                          placeholder="reducer_name"
                          value={editCustomName}
                          onChange={(e) => setEditCustomName(e.target.value)}
                          autoFocus
                        />
                        <LocalTextarea
                          className="min-h-[52px] text-[10px] font-mono bg-background leading-relaxed p-1.5 resize-y"
                          placeholder="(prev, next) => Array.isArray(prev) ? [...prev, ...next] : next"
                          value={editCustomCode}
                          onChange={(e) => setEditCustomCode(e.target.value)}
                          debounceMs={150}
                        />
                        <LocalInput
                          className="h-6 text-[10px] bg-background"
                          placeholder="Description (optional)"
                          value={editCustomDesc}
                          onChange={(e) => setEditCustomDesc(e.target.value)}
                        />
                        <div className="flex items-center justify-end gap-1 pt-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={handleCancelEditCustom}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-5 px-2 text-[9px] bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-1 cursor-pointer"
                            onClick={(e) => handleSaveEditCustom(e, r.id)}
                            disabled={!editCustomName.trim()}
                          >
                            <Check className="w-3 h-3" /> Save
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={r.id}
                      className="flex flex-col gap-0.5 p-1.5 rounded bg-purple-500/10 border border-purple-500/25 text-[10px] font-mono group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-purple-300">{r.name}</span>
                          <Badge
                            variant="secondary"
                            className="text-[8px] h-3 px-1 bg-purple-500/20 text-purple-300 border-0"
                          >
                            custom
                          </Badge>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => handleStartEditCustom(e, r)}
                            className="text-muted-foreground hover:text-purple-300 p-0.5 rounded transition-colors cursor-pointer"
                            title="Edit custom reducer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustom(e, r.id)}
                            className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors cursor-pointer"
                            title="Delete custom reducer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <code className="text-[8px] text-purple-200/80 line-clamp-2 whitespace-pre-wrap font-mono bg-background/50 px-1 py-0.5 rounded border border-purple-500/20">
                        {r.code}
                      </code>
                      {r.description && (
                        <span className="text-[8px] text-muted-foreground font-sans truncate">
                          {r.description}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 gap-1">
              <div className="flex items-center justify-between p-1.5 rounded bg-purple-500/10 border border-purple-500/20 text-[10px] font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-purple-300">add_messages</span>
                  <span className="text-[8px] text-muted-foreground">ID dedup + append</span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-[8px] h-3.5 px-1 bg-purple-500/20 text-purple-300 border-0"
                >
                  messages
                </Badge>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-amber-300">append</span>
                  <span className="text-[8px] text-muted-foreground">array.concat</span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-[8px] h-3.5 px-1 bg-amber-500/20 text-amber-300 border-0"
                >
                  array
                </Badge>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-sky-500/10 border border-sky-500/20 text-[10px] font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sky-300">replace</span>
                  <span className="text-[8px] text-muted-foreground">last-value-wins</span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-[8px] h-3.5 px-1 bg-sky-500/20 text-sky-300 border-0"
                >
                  primitive
                </Badge>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-emerald-300">merge_object</span>
                  <span className="text-[8px] text-muted-foreground">&#123;...prev, ...next&#125;</span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-[8px] h-3.5 px-1 bg-emerald-500/20 text-emerald-300 border-0"
                >
                  object
                </Badge>
              </div>
            </div>

            <div className="mt-1 p-1.5 rounded bg-secondary/30 border border-dashed border-border/60 text-[9px] text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Code2 className="w-3 h-3 text-primary shrink-0" />
                <span>State Reducer Ref:</span>
              </span>
              <span className="italic">Attach to nodes to mutate channels</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

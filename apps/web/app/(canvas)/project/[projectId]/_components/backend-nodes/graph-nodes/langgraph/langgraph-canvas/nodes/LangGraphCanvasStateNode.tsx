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
} from "lucide-react";
import type { StateGlobalNode, LangGraphStateChannel } from "@workspace/canvas";
import { Button } from "@workspace/ui/components/button";
import { LocalInput } from "../../../common";
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
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

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
                            const type = val as LangGraphStateChannel["type"];
                            const defaultReducer =
                              type === "messages"
                                ? "add_messages"
                                : type === "array"
                                  ? "append"
                                  : type === "object"
                                    ? "merge_object"
                                    : "replace";
                            handleUpdate(idx, {
                              type,
                              reducer: defaultReducer,
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
                            handleUpdate(idx, {
                              reducer: val as LangGraphStateChannel["reducer"],
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
    </div>
  );
};

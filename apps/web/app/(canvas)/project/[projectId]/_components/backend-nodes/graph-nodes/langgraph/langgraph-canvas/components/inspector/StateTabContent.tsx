import React from "react";
import { Plus, Trash2, Database, X } from "lucide-react";
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
import type { LangGraphStateChannel } from "@/types/canvas";

interface StateTabContentProps {
  stateChannels: LangGraphStateChannel[];
  setStateChannels: React.Dispatch<
    React.SetStateAction<LangGraphStateChannel[]>
  >;
  onClose?: () => void;
}

export function StateTabContent({
  stateChannels,
  setStateChannels,
  onClose,
}: StateTabContentProps) {
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
              {stateChannels.length} state channels configured
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
        stateChannels.map((ch, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-3 p-3.5 rounded-xl border border-border/60 bg-card/60 shadow-sm backdrop-blur-sm text-xs"
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
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
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
                    const type = v as LangGraphStateChannel["type"];
                    const defaultReducer =
                      type === "messages"
                        ? "add_messages"
                        : type === "array"
                          ? "append"
                          : type === "object"
                            ? "merge_object"
                            : "replace";
                    handleUpdateField(idx, { type, reducer: defaultReducer });
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
                <Label className="text-[10px] text-muted-foreground">Reducer</Label>
                <Select
                  value={ch.reducer}
                  onValueChange={(v) => {
                    const reducer = v as LangGraphStateChannel["reducer"];
                    handleUpdateField(idx, { reducer });
                  }}
                >
                  <SelectTrigger className="h-7 text-xs bg-background font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replace">replace (override)</SelectItem>
                    <SelectItem value="add_messages">add_messages</SelectItem>
                    <SelectItem value="append">append (list)</SelectItem>
                    <SelectItem value="concat_array">concat_array</SelectItem>
                    <SelectItem value="merge_object">merge_object</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

import React from "react";
import { Trash2, Code2, Lock } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { LocalInput } from "../../../../../../common";
import { BUILT_IN_REDUCERS } from "../constants";
import { isLangGraphChannelType } from "@workspace/canvas";
import type { LangGraphStateChannel, LangGraphCustomReducer } from "@/types/canvas";

interface StateChannelItemProps {
  channel: LangGraphStateChannel;
  index: number;
  customReducers: LangGraphCustomReducer[];
  onUpdateField: (
    index: number,
    changes: Partial<LangGraphStateChannel>,
  ) => void;
  onDeleteField: (index: number) => void;
}

export function StateChannelItem({
  channel: ch,
  index: idx,
  customReducers,
  onUpdateField,
  onDeleteField,
}: StateChannelItemProps) {
  const isCustom = !BUILT_IN_REDUCERS.some((r) => r.name === ch.reducer);
  const isBuiltin = ch.key === "messages";

  return (
    <div
      className={`flex flex-col gap-3 p-3 rounded-xl border border-border/60 bg-card/60 shadow-sm backdrop-blur-sm text-xs ${
        isBuiltin ? "border-blue-500/30 bg-blue-500/[0.03]" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground font-mono">
              Field Key #{idx + 1}
            </Label>
            {isBuiltin && (
              <div className="flex items-center gap-1 text-[9px] text-blue-400 font-mono">
                <Lock className="w-2.5 h-2.5" />
                <span>Built-in Chat State</span>
              </div>
            )}
          </div>
          <LocalInput
            className={`h-7 text-xs font-mono font-medium bg-background ${
              isBuiltin ? "cursor-not-allowed opacity-80" : ""
            }`}
            placeholder="e.g. messages, user_query"
            autoFocus={!ch.key && !isBuiltin}
            disabled={isBuiltin}
            value={ch.key}
            onChange={(e) => {
              if (!isBuiltin) {
                onUpdateField(idx, { key: e.target.value });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
                e.target.blur();
              }
            }}
          />
        </div>
        {!isBuiltin && (
          <div className="self-end pb-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
              onClick={() => onDeleteField(idx)}
              title="Delete state field"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground">Type</Label>
          <Select
            value={ch.type}
            disabled={isBuiltin}
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
                onUpdateField(idx, { type: v, reducer: defaultReducer });
              }
            }}
          >
            <SelectTrigger
              className={`h-7 text-xs bg-background font-mono ${isBuiltin ? "cursor-not-allowed opacity-80" : ""}`}
            >
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
            disabled={isBuiltin}
            value={
              isBuiltin
                ? "add_messages"
                : ch.reducer === "add_message"
                  ? "add_messages"
                  : ch.reducer
            }
            onValueChange={(v) => {
              const matchedCustom = customReducers.find((r) => r.name === v);
              onUpdateField(idx, {
                reducer: v,
                customReducerCode:
                  v === "custom"
                    ? ch.customReducerCode || "(prev, next) => next"
                    : matchedCustom?.code,
              });
            }}
          >
            <SelectTrigger
              className={`h-7 text-xs bg-background font-mono ${isBuiltin ? "cursor-not-allowed opacity-80" : ""}`}
            >
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

              <div className="px-2 py-1 text-[10px] font-bold text-purple-400 uppercase border-t border-border/40 mt-1">
                Developer Defined
              </div>
              <SelectItem value="custom" className="text-purple-300 font-semibold">
                custom (developer defined inline)
              </SelectItem>

              {customReducers.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] font-bold text-purple-400 uppercase border-t border-border/40 mt-1">
                    Custom Reducers
                  </div>
                  {customReducers.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.name} {r.targetField ? `(tied to ${r.targetField})` : "(custom)"}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isCustom && (
        <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-bold text-purple-300 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-purple-400" />
              Custom Reducer for{" "}
              <span className="font-mono text-foreground font-semibold">
                "{ch.key || "unnamed"}"
              </span>
            </Label>
            <span className="text-[9px] text-muted-foreground font-mono">
              (prev, next) =&gt; combined
            </span>
          </div>
          <LocalInput
            value={ch.customReducerCode ?? "(prev, next) => next"}
            onChange={(e) =>
              onUpdateField(idx, {
                customReducerCode: e.target.value,
              })
            }
            className="font-mono text-xs bg-background h-8 border-purple-500/30 text-purple-200 placeholder:text-muted-foreground"
            placeholder="(prev, next) => Array.isArray(prev) ? [...prev, ...next] : next"
          />
          <p className="text-[9px] text-muted-foreground leading-tight">
            Developer-defined merge function executed whenever this field receives an update.
          </p>
        </div>
      )}

      {(ch.type === "messages" || ch.reducer === "add_messages") && (
        <div className="p-1.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-sans text-muted-foreground flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
          <span>
            Chat history channel:{" "}
            <code className="font-mono text-blue-300 font-semibold">add_messages</code>{" "}
            automatically deduplicates by message ID &amp; appends.
          </span>
        </div>
      )}
    </div>
  );
}

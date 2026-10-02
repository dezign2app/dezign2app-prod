import React from "react";
import { Trash2, Code2, Lock, Play, ArrowDown } from "lucide-react";
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
  onTestChannel?: (channelKey: string, reducerName: string) => void;
  onStartEditCustomReducer?: (reducer: LangGraphCustomReducer) => void;
  onAddCustomReducerForField?: (fieldKey: string) => void;
}

export function StateChannelItem({
  channel: ch,
  index: idx,
  customReducers,
  onUpdateField,
  onDeleteField,
  onTestChannel,
  onStartEditCustomReducer,
  onAddCustomReducerForField,
}: StateChannelItemProps) {
  const isCustom = !BUILT_IN_REDUCERS.some((r) => r.name === ch.reducer);
  const isBuiltin = ch.key === "messages";
  const matchedCustom = customReducers.find(
    (r) => r.name === ch.reducer || r.id === ch.reducer || r.targetField === ch.key,
  );


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
        <div className="self-end pb-0.5 flex items-center gap-0.5">
          {onTestChannel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 shrink-0 cursor-pointer"
              onClick={() => onTestChannel(ch.key, ch.reducer)}
              title={`Test ${ch.key} reducer in testing tab`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </Button>
          )}
          {!isBuiltin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
              onClick={() => onDeleteField(idx)}
              title="Delete state field"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
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
              <span className="text-[9px] text-purple-400 font-mono font-semibold">
                custom
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0">
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
                  if (v === "__CREATE_NEW_CUSTOM__") {
                    onAddCustomReducerForField?.(ch.key);
                    return;
                  }
                  const matched = customReducers.find((r) => r.name === v);
                  onUpdateField(idx, {
                    reducer: v,
                    customReducerCode: matched?.code || ch.customReducerCode,
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

                  {customReducers.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-bold text-purple-400 uppercase border-t border-border/40 mt-1">
                        Custom Reducers
                      </div>
                      {customReducers.map((r) => (
                        <SelectItem key={r.id} value={r.name} className="text-purple-300">
                          {r.name} {r.targetField ? `(tied to ${r.targetField})` : "(custom)"}
                        </SelectItem>
                      ))}
                    </>
                  )}

                  {onAddCustomReducerForField && (
                    <SelectItem
                      value="__CREATE_NEW_CUSTOM__"
                      className="text-purple-400 font-semibold cursor-pointer border-t border-border/30 mt-1"
                    >
                      + Add Custom Reducer...
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {isCustom && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (matchedCustom && onStartEditCustomReducer) {
                    onStartEditCustomReducer(matchedCustom);
                  } else if (onAddCustomReducerForField) {
                    onAddCustomReducerForField(ch.key);
                  }
                }}
                className="h-7 w-7 text-purple-400 hover:text-purple-200 hover:bg-purple-500/20 shrink-0 rounded-md border border-purple-500/30 cursor-pointer"
                title={
                  matchedCustom
                    ? `Edit '${matchedCustom.name}' reducer in the section below`
                    : "Configure custom reducer in the section below"
                }
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </Button>
            )}

            {(ch.reducer === "add_messages" || ch.reducer === "add_message") && !isCustom && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  const el =
                    document.getElementById("core-chat-history-card") ||
                    document.getElementById("reducers-section");
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="h-7 w-7 text-blue-400 hover:text-blue-200 hover:bg-blue-500/20 shrink-0 rounded-md border border-blue-500/30 cursor-pointer"
                title="View core chat history reducer in the section below"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

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

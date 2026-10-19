import React, { useState, useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { Trash2, Lock, Play, ChevronDown, GitMerge, Code2, Braces } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { LocalInput } from "../../../../../../common";
import { BUILT_IN_REDUCERS, getSuggestedReducerCodeForChannelType } from "../constants";
import {
  isLangGraphChannelType,
  isTypesNode,
  isTypesRefNode,
  type LangGraphCanvasNode,
  type LangGraphTypesNode,
  type CustomTypeItem,
} from "@workspace/canvas";
import { ChannelReducerConfig } from "./ChannelReducerConfig";
import type { LangGraphStateChannel, LangGraphCustomReducer } from "@/types/canvas";

export interface StateChannelItemProps {
  channel: LangGraphStateChannel;
  index: number;
  customReducers: LangGraphCustomReducer[];
  onUpdateField: (
    index: number,
    changes: Partial<LangGraphStateChannel>,
  ) => void;
  onDeleteField: (index: number) => void;
  onTestChannel?: (channelKey: string, reducerName: string) => void;
  onAddCustomReducer?: (reducer: LangGraphCustomReducer) => void;
  onUpdateCustomReducer?: (
    idOrName: string,
    changes: Partial<LangGraphCustomReducer>,
  ) => void;
  onDeleteCustomReducer?: (idOrName: string) => void;
}

export function StateChannelItem({
  channel: ch,
  index: idx,
  customReducers,
  onUpdateField,
  onDeleteField,
  onTestChannel,
  onAddCustomReducer,
  onUpdateCustomReducer,
  onDeleteCustomReducer,
}: StateChannelItemProps) {
  const isCustom = !BUILT_IN_REDUCERS.some((r) => r.name === ch.reducer);
  const isBuiltin = ch.key === "messages";
  const matchedCustom = customReducers.find(
    (r) => r.name === ch.reducer || r.id === ch.reducer || r.targetField === ch.key,
  );

  // Collapsible state for this variable's Reducers section (defaults to expanded)
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const { getNodes } = useReactFlow<LangGraphCanvasNode>();
  const allNodes = getNodes();
  const availableCustomTypes = useMemo(() => {
    const types: CustomTypeItem[] = [];
    allNodes.forEach((n) => {
      if (isTypesNode(n) && n.data.types) {
        n.data.types.forEach((t) => {
          if (t && t.name && !types.some((existing) => existing.id === t.id)) {
            types.push(t);
          }
        });
      } else if (isTypesRefNode(n) && n.data.typesRef) {
        const master = allNodes.find(
          (m): m is LangGraphTypesNode => isTypesNode(m) && m.id === n.data.typesRef,
        );
        if (master?.data.types) {
          master.data.types.forEach((t) => {
            if (t && t.name && !types.some((existing) => existing.id === t.id)) {
              types.push(t);
            }
          });
        }
      }
    });
    return types;
  }, [allNodes]);

  return (
    <div
      className={`flex flex-col gap-3 p-3.5 rounded-xl border border-border/70 bg-card/70 shadow-xs backdrop-blur-sm text-xs transition-all ${
        isBuiltin
          ? "border-blue-500/30 bg-blue-500/[0.03]"
          : isCustom
            ? "border-purple-500/30 bg-purple-500/[0.02]"
            : ""
      }`}
    >
      {/* ── State Var Header: Key & Actions ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground font-mono">
              State Variable #{idx + 1}
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
            placeholder="e.g. messages, user_query, count"
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
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 shrink-0 cursor-pointer"
              onClick={() => onTestChannel(ch.key, ch.reducer)}
              title={`Test ${ch.key} in testing tab`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </Button>
          )}
          {!isBuiltin && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
              onClick={() => onDeleteField(idx)}
              title="Delete state variable"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── State Var Type & Summary ── */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/40">
        <div className="flex items-center gap-2 flex-1">
          <Label className="text-[10px] text-muted-foreground font-mono shrink-0">
            Type
          </Label>
          <Select
            value={ch.customTypeId ? `custom:${ch.customTypeId}` : ch.type}
            disabled={isBuiltin}
            onValueChange={(v) => {
              if (v.startsWith("custom:")) {
                const typeId = v.replace("custom:", "");
                const targetType = availableCustomTypes.find((t) => t.id === typeId);
                const suggestedCode = getSuggestedReducerCodeForChannelType("object", targetType);
                const reducerName = `${ch.key || targetType?.name || "state"}_reducer`;
                onUpdateField(idx, {
                  type: "object",
                  reducer: reducerName,
                  customReducerCode: suggestedCode,
                  customTypeId: typeId,
                  customTypeName: targetType?.name,
                  customTypeSchema: targetType,
                });
                if (matchedCustom && onUpdateCustomReducer) {
                  onUpdateCustomReducer(matchedCustom.id, {
                    name: reducerName,
                    code: suggestedCode,
                    targetField: ch.key,
                  });
                }
                return;
              }

              if (isLangGraphChannelType(v)) {
                const suggestedCode = getSuggestedReducerCodeForChannelType(v);
                const reducerName = `${ch.key || v}_reducer`;
                onUpdateField(idx, {
                  type: v,
                  reducer: reducerName,
                  customReducerCode: suggestedCode,
                  customTypeId: undefined,
                  customTypeName: undefined,
                  customTypeSchema: undefined,
                });
                if (matchedCustom && onUpdateCustomReducer) {
                  onUpdateCustomReducer(matchedCustom.id, {
                    name: reducerName,
                    code: suggestedCode,
                    targetField: ch.key,
                  });
                }
              }
            }}
          >
            <SelectTrigger
              className={`h-7 text-xs bg-background font-mono flex-1 ${
                isBuiltin ? "cursor-not-allowed opacity-80" : ""
              }`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="messages">messages</SelectItem>
              <SelectItem value="string">string</SelectItem>
              <SelectItem value="number">number</SelectItem>
              <SelectItem value="boolean">boolean</SelectItem>
              <SelectItem value="array">array</SelectItem>
              <SelectItem value="object">object (generic)</SelectItem>
              {availableCustomTypes.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] uppercase font-bold text-cyan-400 bg-cyan-500/10 rounded-sm my-1 flex items-center gap-1 font-mono">
                    <Braces className="w-3 h-3" /> Custom Types
                  </div>
                  {availableCustomTypes.map((t) => (
                    <SelectItem
                      key={t.id}
                      value={`custom:${t.id}`}
                      className="text-xs font-mono text-cyan-300"
                    >
                      {t.name} ({t.kind})
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          {ch.customTypeName && (
            <Badge
              variant="secondary"
              className="text-[9px] h-5 px-1.5 font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0"
            >
              {ch.customTypeName}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-muted-foreground font-mono">Reducer:</span>
          <Badge
            variant="secondary"
            className="text-[9px] h-5 px-1.5 font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30"
          >
            {ch.reducer || `${ch.key || "state"}_reducer`}
          </Badge>
        </div>
      </div>

      {/* ── Collapsible Reducer Function ── */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 text-left transition-colors cursor-pointer group py-0.5"
          >
            <Code2 className="w-3.5 h-3.5 text-purple-400 group-hover:text-purple-300 transition-colors" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground group-hover:text-primary transition-colors">
              Reducer Function
            </span>
            <Badge
              variant="outline"
              className="text-[8px] h-3.5 px-1 py-0 uppercase font-mono text-purple-300 border-purple-500/40"
            >
              (prev, next) =&gt; merged
            </Badge>
          </button>

          <div className="flex items-center gap-2">
            {onTestChannel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border-emerald-500/30 gap-1 font-medium cursor-pointer"
                onClick={() =>
                  onTestChannel(ch.key, ch.reducer || `${ch.key || "var"}_reducer`)
                }
                title="Test reducer in the testing playground"
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>Test Reducer</span>
              </Button>
            )}

            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5"
            >
              <span>{isExpanded ? "Collapse" : "Expand"}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="animate-in fade-in-50 slide-in-from-top-1 duration-150 pt-1">
            <ChannelReducerConfig
              channel={
                ch.customTypeId || ch.customTypeName
                  ? {
                      ...ch,
                      customTypeSchema:
                        availableCustomTypes.find(
                          (t) =>
                            t.id === ch.customTypeId ||
                            t.name === ch.customTypeName,
                        ) || ch.customTypeSchema,
                    }
                  : ch
              }
              index={idx}
              customReducers={customReducers}
              availableCustomTypes={availableCustomTypes}
              onUpdateField={onUpdateField}
              onTestChannel={onTestChannel}
              onAddCustomReducer={onAddCustomReducer}
              onUpdateCustomReducer={onUpdateCustomReducer}
              onDeleteCustomReducer={onDeleteCustomReducer}
            />
          </div>
        )}
      </div>
    </div>
  );
}

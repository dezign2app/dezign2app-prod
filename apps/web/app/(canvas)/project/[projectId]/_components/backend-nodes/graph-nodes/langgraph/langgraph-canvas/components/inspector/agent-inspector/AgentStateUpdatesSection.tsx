import React from "react";
import { Zap, Plus, Trash } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { LocalInput } from "../../../../../common";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type { LangGraphStateChannel } from "@/types/canvas";
import type { AgentNodeData } from "../../../types";

interface AgentStateUpdatesSectionProps {
  selectedAgentData: AgentNodeData;
  onUpdateAgent: (changes: Partial<AgentNodeData>) => void;
  stateChannels?: LangGraphStateChannel[];
}

type StateUpdateItem = NonNullable<AgentNodeData["stateUpdates"]>[number];

export function AgentStateUpdatesSection({
  selectedAgentData,
  onUpdateAgent,
  stateChannels = [],
}: AgentStateUpdatesSectionProps) {
  const stateUpdates: StateUpdateItem[] = selectedAgentData.stateUpdates || [];

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> Graph State Updates
          </span>
          <span className="text-[10px] text-muted-foreground">
            Mutate channels returned by this node
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-border gap-1"
          onClick={() => {
            const defaultKey =
              stateChannels.find((c) => c.key !== "messages")?.key ||
              stateChannels[0]?.key ||
              "status";
            onUpdateAgent({
              stateUpdates: [
                ...stateUpdates,
                { channelKey: defaultKey, mode: "set", value: "" },
              ],
            });
          }}
        >
          <Plus className="w-3.5 h-3.5" /> Add Update
        </Button>
      </div>

      {stateUpdates.map((su: StateUpdateItem, sIdx: number) => (
        <div
          key={sIdx}
          className="flex flex-col gap-2 p-3 rounded-lg border bg-background/50 text-xs"
        >
          <div className="flex items-center justify-between gap-1.5">
            <Select
              value={su.channelKey}
              onValueChange={(v: string) => {
                const updated = [...stateUpdates];
                const current = updated[sIdx];
                if (current) {
                  updated[sIdx] = { ...current, channelKey: v };
                  onUpdateAgent({ stateUpdates: updated });
                }
              }}
            >
              <SelectTrigger className="h-7 text-xs bg-background font-mono flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stateChannels
                  .filter((ch: LangGraphStateChannel) => Boolean(ch.key?.trim()))
                  .map((ch: LangGraphStateChannel) => (
                    <SelectItem key={ch.key} value={ch.key}>
                      {ch.key}
                    </SelectItem>
                  ))}
                {!stateChannels.some(
                  (c: LangGraphStateChannel) => c.key === su.channelKey,
                ) &&
                  su.channelKey && (
                    <SelectItem value={su.channelKey}>
                      {su.channelKey}
                    </SelectItem>
                  )}
              </SelectContent>
            </Select>

            <Select
              value={su.mode || "set"}
              onValueChange={(v: "set" | "append" | "expression") => {
                const updated = [...stateUpdates];
                const current = updated[sIdx];
                if (current) {
                  updated[sIdx] = { ...current, mode: v };
                  onUpdateAgent({ stateUpdates: updated });
                }
              }}
            >
              <SelectTrigger className="h-7 text-[11px] w-24 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="set">Set / Replace</SelectItem>
                <SelectItem value="append">Append</SelectItem>
                <SelectItem value="expression">Expression</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
              onClick={() => {
                const updated = stateUpdates.filter(
                  (_: StateUpdateItem, i: number) => i !== sIdx,
                );
                onUpdateAgent({ stateUpdates: updated });
              }}
            >
              <Trash className="w-3.5 h-3.5" />
            </Button>
          </div>

          <LocalInput
            className="h-7 text-[11px] bg-background font-mono"
            placeholder="Value / expression (e.g. 'success' or state.count + 1)"
            value={su.value || ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const updated = [...stateUpdates];
              const current = updated[sIdx];
              if (current) {
                updated[sIdx] = { ...current, value: e.target.value };
                onUpdateAgent({ stateUpdates: updated });
              }
            }}
          />
        </div>
      ))}

      {stateUpdates.length === 0 && (
        <div className="p-3 rounded-lg border border-dashed border-border/70 bg-secondary/10 flex flex-col gap-1 text-center">
          <span className="text-xs font-semibold text-foreground/80">
            Default message flow
          </span>
          <span className="text-[11px] text-muted-foreground">
            This node outputs standard <code className="text-amber-500 font-mono">messages</code> to the graph. Click "+ Add Update" above if you want to mutate additional state channels.
          </span>
        </div>
      )}
    </div>
  );
}

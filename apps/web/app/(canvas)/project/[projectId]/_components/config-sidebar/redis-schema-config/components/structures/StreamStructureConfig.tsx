import React from "react";
import { Radio, Plus, Trash2 } from "lucide-react";
import { BackendNode, RedisStreamConsumerGroup } from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";

interface StreamStructureConfigProps {
  streamConfig?: BackendNode["data"]["streamConfig"];
  updateData: (changes: Partial<BackendNode["data"]>) => void;
}

export const StreamStructureConfig: React.FC<StreamStructureConfigProps> = ({
  streamConfig,
  updateData,
}) => {
  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
      <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
        <Radio size={12} className="text-red-500" /> Stream Limits & Consumer Groups (XADD / XREADGROUP)
      </span>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Max Stream Length (MAXLEN)</Label>
          <Input
            type="number"
            value={streamConfig?.maxLen ?? 10000}
            onChange={(e) =>
              updateData({
                streamConfig: {
                  ...(streamConfig || { fields: [] }),
                  maxLen: parseInt(e.target.value) || 10000,
                },
              })
            }
            className="h-7 text-xs font-mono"
          />
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border/30">
          <div className="flex flex-col">
            <Label className="text-xs font-semibold">Approximate Trim (~)</Label>
            <span className="text-[10px] text-muted-foreground">Faster high-throughput trimming</span>
          </div>
          <Switch
            checked={streamConfig?.approximateTrim ?? true}
            onCheckedChange={(checked) =>
              updateData({
                streamConfig: {
                  ...(streamConfig || { fields: [] }),
                  approximateTrim: checked,
                },
              })
            }
            className="scale-90"
          />
        </div>
      </div>

      {/* Consumer Groups List */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            Consumer Groups ({(streamConfig?.consumerGroups || []).length})
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] gap-1"
            onClick={() => {
              const currentGroups = streamConfig?.consumerGroups || [];
              const newGroup: RedisStreamConsumerGroup = {
                name: `group-${currentGroups.length + 1}`,
                description: "Worker group for message processing",
                startId: "$",
              };
              updateData({
                streamConfig: {
                  ...(streamConfig || { fields: [] }),
                  consumerGroups: [...currentGroups, newGroup],
                },
              });
            }}
          >
            <Plus size={12} /> Add Group
          </Button>
        </div>

        {(streamConfig?.consumerGroups || []).map((cg, idx) => (
          <div key={idx} className="flex items-center gap-2 p-2 rounded bg-background/80 border border-border/40">
            <Input
              value={cg.name}
              placeholder="group-name"
              onChange={(e) => {
                const updated = [...(streamConfig?.consumerGroups || [])];
                updated[idx] = { ...updated[idx]!, name: e.target.value };
                updateData({
                  streamConfig: { ...(streamConfig || { fields: [] }), consumerGroups: updated },
                });
              }}
              className="h-7 text-xs font-mono flex-1"
            />
            <Input
              value={cg.description || ""}
              placeholder="description..."
              onChange={(e) => {
                const updated = [...(streamConfig?.consumerGroups || [])];
                updated[idx] = { ...updated[idx]!, description: e.target.value };
                updateData({
                  streamConfig: { ...(streamConfig || { fields: [] }), consumerGroups: updated },
                });
              }}
              className="h-7 text-xs flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => {
                const updated = (streamConfig?.consumerGroups || []).filter((_, i) => i !== idx);
                updateData({
                  streamConfig: { ...(streamConfig || { fields: [] }), consumerGroups: updated },
                });
              }}
            >
              <Trash2 size={12} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

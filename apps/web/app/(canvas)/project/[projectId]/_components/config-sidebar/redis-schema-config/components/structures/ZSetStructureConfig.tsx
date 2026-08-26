import React from "react";
import { ListOrdered } from "lucide-react";
import { BackendNode, isZSetScoreType, isSortOrder } from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

interface ZSetStructureConfigProps {
  zsetConfig?: BackendNode["data"]["zsetConfig"];
  updateData: (changes: Partial<BackendNode["data"]>) => void;
}

export const ZSetStructureConfig: React.FC<ZSetStructureConfigProps> = ({
  zsetConfig,
  updateData,
}) => {
  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
      <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
        <ListOrdered size={12} className="text-red-500" /> Sorted Set Scoring (ZADD / ZRANGE)
      </span>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Member Type</Label>
          <Input
            value={zsetConfig?.memberType || "string"}
            onChange={(e) =>
              updateData({
                zsetConfig: {
                  memberType: e.target.value,
                  scoreType: zsetConfig?.scoreType || "timestamp",
                  sortOrder: zsetConfig?.sortOrder || "asc",
                },
              })
            }
            className="h-7 text-xs font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Score Type</Label>
          <Select
            value={zsetConfig?.scoreType || "timestamp"}
            onValueChange={(val) => {
              if (isZSetScoreType(val)) {
                updateData({
                  zsetConfig: {
                    memberType: zsetConfig?.memberType || "string",
                    scoreType: val,
                    sortOrder: zsetConfig?.sortOrder || "asc",
                  },
                });
              }
            }}
          >
            <SelectTrigger className="h-7 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="timestamp">timestamp (ms)</SelectItem>
              <SelectItem value="number">integer count</SelectItem>
              <SelectItem value="float">floating point</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Sort Order</Label>
          <Select
            value={zsetConfig?.sortOrder || "asc"}
            onValueChange={(val) => {
              if (isSortOrder(val)) {
                updateData({
                  zsetConfig: {
                    memberType: zsetConfig?.memberType || "string",
                    scoreType: zsetConfig?.scoreType || "timestamp",
                    sortOrder: val,
                  },
                });
              }
            }}
          >
            <SelectTrigger className="h-7 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascending (0 → N)</SelectItem>
              <SelectItem value="desc">Descending (High → Low)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

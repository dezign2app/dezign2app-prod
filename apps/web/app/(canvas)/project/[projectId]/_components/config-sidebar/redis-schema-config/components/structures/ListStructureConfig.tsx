import React from "react";
import { List } from "lucide-react";
import { BackendNode, isListOrientation } from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

interface ListStructureConfigProps {
  listConfig?: BackendNode["data"]["listConfig"];
  updateData: (changes: Partial<BackendNode["data"]>) => void;
}

export const ListStructureConfig: React.FC<ListStructureConfigProps> = ({
  listConfig,
  updateData,
}) => {
  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
      <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
        <List size={12} className="text-red-500" /> List Element & Trim Settings (LPUSH / LTRIM)
      </span>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Element Type</Label>
          <Input
            value={listConfig?.elementType || "string"}
            onChange={(e) =>
              updateData({
                listConfig: {
                  elementType: e.target.value,
                  maxLength: listConfig?.maxLength,
                  trimStrategy: listConfig?.trimStrategy || "LTRIM",
                  orientation: listConfig?.orientation || "FIFO",
                },
              })
            }
            className="h-7 text-xs font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Max Length (LTRIM)</Label>
          <Input
            type="number"
            placeholder="Unlimited"
            value={listConfig?.maxLength ?? ""}
            onChange={(e) =>
              updateData({
                listConfig: {
                  elementType: listConfig?.elementType || "string",
                  maxLength: parseInt(e.target.value) || undefined,
                  trimStrategy: "LTRIM",
                  orientation: listConfig?.orientation || "FIFO",
                },
              })
            }
            className="h-7 text-xs font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Orientation</Label>
          <Select
            value={listConfig?.orientation || "FIFO"}
            onValueChange={(val) => {
              if (isListOrientation(val)) {
                updateData({
                  listConfig: {
                    elementType: listConfig?.elementType || "string",
                    maxLength: listConfig?.maxLength,
                    trimStrategy: listConfig?.trimStrategy || "LTRIM",
                    orientation: val,
                  },
                });
              }
            }}
          >
            <SelectTrigger className="h-7 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FIFO">FIFO (Queue: Push Right, Pop Left)</SelectItem>
              <SelectItem value="LIFO">LIFO (Stack: Push Left, Pop Left)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

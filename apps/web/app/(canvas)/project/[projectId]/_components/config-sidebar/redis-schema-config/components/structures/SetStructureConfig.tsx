import React from "react";
import { Share2 } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

interface SetStructureConfigProps {
  setConfig?: BackendNode["data"]["setConfig"];
  updateData: (changes: Partial<BackendNode["data"]>) => void;
}

export const SetStructureConfig: React.FC<SetStructureConfigProps> = ({
  setConfig,
  updateData,
}) => {
  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
      <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
        <Share2 size={12} className="text-red-500" /> Set Membership Settings (SADD / SISMEMBER / SMEMBERS)
      </span>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Member Type</Label>
          <Input
            value={setConfig?.memberType || "string"}
            onChange={(e) =>
              updateData({
                setConfig: {
                  memberType: e.target.value,
                  description: setConfig?.description,
                },
              })
            }
            className="h-7 text-xs font-mono"
            placeholder="string, uuid, or number"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Set Purpose / Description</Label>
          <Input
            value={setConfig?.description || ""}
            onChange={(e) =>
              updateData({
                setConfig: {
                  memberType: setConfig?.memberType || "string",
                  description: e.target.value,
                },
              })
            }
            className="h-7 text-xs"
            placeholder="e.g. Unique visitor IDs"
          />
        </div>
      </div>
    </div>
  );
};

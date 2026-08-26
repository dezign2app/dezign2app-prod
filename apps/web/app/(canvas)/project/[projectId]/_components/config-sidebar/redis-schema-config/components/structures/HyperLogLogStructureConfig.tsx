import React from "react";
import { DatabaseZap } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

interface HyperLogLogStructureConfigProps {
  hyperloglogConfig?: BackendNode["data"]["hyperloglogConfig"];
  updateData: (changes: Partial<BackendNode["data"]>) => void;
}

export const HyperLogLogStructureConfig: React.FC<HyperLogLogStructureConfigProps> = ({
  hyperloglogConfig,
  updateData,
}) => {
  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
      <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
        <DatabaseZap size={12} className="text-red-500" /> HyperLogLog Cardinality Estimation (PFADD / PFCOUNT)
      </span>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Estimated Item Type</Label>
          <Input
            value={hyperloglogConfig?.memberType || "string"}
            onChange={(e) =>
              updateData({
                hyperloglogConfig: {
                  memberType: e.target.value,
                  precision: hyperloglogConfig?.precision || "standard (0.81% error)",
                },
              })
            }
            className="h-7 text-xs font-mono"
            placeholder="e.g. IP Address, User ID"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Estimation Precision</Label>
          <Input
            value={hyperloglogConfig?.precision || "standard (0.81% error)"}
            onChange={(e) =>
              updateData({
                hyperloglogConfig: {
                  memberType: hyperloglogConfig?.memberType || "string",
                  precision: e.target.value,
                },
              })
            }
            className="h-7 text-xs"
          />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        HyperLogLog uses a fixed 12 KB memory footprint to count billions of unique elements with ~0.81% standard error.
      </p>
    </div>
  );
};

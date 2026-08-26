import React from "react";
import { Layers } from "lucide-react";
import { BackendNode, RedisDataStructure } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { REDIS_DATA_STRUCTURE_OPTIONS } from "../../../backend-nodes/entity-node/RedisConfig";

interface DataStructureSelectorProps {
  structure: RedisDataStructure;
  updateData: (changes: Partial<BackendNode["data"]>) => void;
}

export const DataStructureSelector: React.FC<DataStructureSelectorProps> = ({
  structure,
  updateData,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
        <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Layers size={14} className="text-red-500" /> Redis Data Structure
        </span>
      </div>

      {/* Data Structure Selector Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {REDIS_DATA_STRUCTURE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = structure === opt.value;
          return (
            <div
              key={opt.value}
              onClick={() => updateData({ redisDataStructure: opt.value })}
              className={cn(
                "p-2.5 rounded-lg border flex flex-col gap-1 cursor-pointer transition-all",
                isSelected
                  ? "bg-red-500/15 border-red-500 text-foreground font-semibold shadow-sm"
                  : "bg-background/60 border-border/50 text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
              )}
            >
              <div className="flex items-center gap-1.5">
                <Icon
                  size={14}
                  className={isSelected ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}
                />
                <span className="text-xs">{opt.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/80 line-clamp-1">{opt.desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

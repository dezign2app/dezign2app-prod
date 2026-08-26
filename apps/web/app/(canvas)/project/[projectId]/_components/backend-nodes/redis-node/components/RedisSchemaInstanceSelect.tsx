import React from "react";
import { DatabaseZap } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { BackendNode } from "@/types/canvas";

export interface RedisSchemaInstanceSelectProps {
  currentDatabaseId?: string;
  dbThemeColor: string;
  redisInstanceNodes: BackendNode[];
  onInstanceChange: (val: string) => void;
}

export const RedisSchemaInstanceSelect = ({
  currentDatabaseId,
  dbThemeColor,
  redisInstanceNodes,
  onInstanceChange,
}: RedisSchemaInstanceSelectProps) => {
  return (
    <div className="flex items-center justify-between gap-1.5 nodrag pt-1 border-t border-border/40 text-[10px]">
      <span className="text-muted-foreground font-medium shrink-0 flex items-center gap-1">
        <DatabaseZap
          size={10}
          className="text-red-500"
          style={{ color: dbThemeColor }}
        />
        Redis Instance:
      </span>
      <Select
        value={currentDatabaseId || "none"}
        onValueChange={onInstanceChange}
      >
        <SelectTrigger className="h-5 text-[10px] font-semibold bg-background/60 hover:bg-background border-border/40 px-1.5 py-0 shadow-none">
          <SelectValue placeholder="Standalone Redis" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            value="none"
            className="text-xs italic text-muted-foreground"
          >
            Standalone (In-Memory / Env)
          </SelectItem>
          {redisInstanceNodes.map((db) => (
            <SelectItem key={db.id} value={db.id} className="text-xs">
              {db.data.label || "Redis Instance"} (redis)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

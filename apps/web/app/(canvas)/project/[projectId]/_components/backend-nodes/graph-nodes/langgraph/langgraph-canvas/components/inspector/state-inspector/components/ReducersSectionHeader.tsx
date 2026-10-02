import React from "react";
import { GitMerge, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";

interface ReducersSectionHeaderProps {
  customReducerCount: number;
  showReducersSection: boolean;
  onToggleShow: () => void;
  onAddCustomReducerClick: () => void;
}

export function ReducersSectionHeader({
  customReducerCount,
  showReducersSection,
  onToggleShow,
  onAddCustomReducerClick,
}: ReducersSectionHeaderProps) {
  return (
    <div
      className="flex items-center justify-between cursor-pointer"
      onClick={onToggleShow}
    >
      <div className="flex items-center gap-1.5">
        <GitMerge className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Reducer Functions
        </span>
        <Badge
          variant="outline"
          className="text-[9px] px-1.5 py-0 h-4 text-purple-400 border-purple-500/30 font-mono"
        >
          {customReducerCount} custom
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px] px-2 border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 gap-1 font-semibold"
          onClick={(e) => {
            e.stopPropagation();
            onAddCustomReducerClick();
          }}
        >
          <Plus className="w-3 h-3" /> Add Custom Reducer
        </Button>
        {showReducersSection ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

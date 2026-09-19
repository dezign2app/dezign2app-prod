import React from "react";
import { Button } from "@workspace/ui/components/button";
import { Sparkles } from "lucide-react";
import { AuthPagesQuickSetupBannerProps } from "./types";

export const AuthPagesQuickSetupBanner: React.FC<AuthPagesQuickSetupBannerProps> = ({
  missingPages,
  onCreateAll,
}) => {
  if (missingPages.length === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-xs gap-3">
      <div className="flex items-start gap-2.5">
        <div className="p-1.5 rounded-md bg-indigo-500/20 text-indigo-400 mt-0.5 shrink-0">
          <Sparkles className="w-4 h-4 animate-pulse" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">Canvas Auth Pages Setup</span>
          <span className="text-[11px] text-muted-foreground leading-relaxed">
            Missing {missingPages.map((p) => p.label).join(", ")}. Create them on the canvas and wire
            to your WebApp in 1 click.
          </span>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        onClick={onCreateAll}
        className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 cursor-pointer shadow-sm font-medium self-end sm:self-center"
      >
        <Sparkles className="w-3 h-3 mr-1" />
        Create Missing Pages ({missingPages.length})
      </Button>
    </div>
  );
};

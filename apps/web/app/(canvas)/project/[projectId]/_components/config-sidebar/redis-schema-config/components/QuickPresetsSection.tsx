import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";

interface QuickPresetsSectionProps {
  onApplyPreset: (presetName: string) => void;
}

export const QuickPresetsSection: React.FC<QuickPresetsSectionProps> = ({
  onApplyPreset,
}) => {
  const [aiPrompt, setAiPrompt] = useState("");

  const handleGenerate = () => {
    if (aiPrompt.trim()) {
      onApplyPreset("user_profile");
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles size={14} className="text-purple-400" /> AI Schema Generator & Presets
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Input
          className="flex-1 h-8 text-xs bg-background border-border/60 focus-visible:ring-primary/30"
          placeholder="Describe cache (e.g. Cache user profile with email, avatar, 1h TTL, hash tag on user id)"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleGenerate();
            }
          }}
        />
        <Button
          size="sm"
          className="h-8 text-xs shrink-0"
          onClick={handleGenerate}
        >
          Generate
        </Button>
      </div>

      {/* Quick Starter Templates */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1">
        <span className="text-xs text-muted-foreground">Starter Presets:</span>
        <button
          type="button"
          onClick={() => onApplyPreset("user_profile")}
          className="px-2 py-0.5 rounded text-[11px] font-medium bg-background/80 border border-border/50 hover:border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
        >
          User Hash
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset("session_store")}
          className="px-2 py-0.5 rounded text-[11px] font-medium bg-background/80 border border-border/50 hover:border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
        >
          Session String
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset("leaderboard")}
          className="px-2 py-0.5 rounded text-[11px] font-medium bg-background/80 border border-border/50 hover:border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
        >
          ZSet Leaderboard
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset("geo_locations")}
          className="px-2 py-0.5 rounded text-[11px] font-medium bg-background/80 border border-border/50 hover:border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
        >
          GEO Drivers
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset("activity_stream")}
          className="px-2 py-0.5 rounded text-[11px] font-medium bg-background/80 border border-border/50 hover:border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
        >
          Stream Groups
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset("bitfield_counters")}
          className="px-2 py-0.5 rounded text-[11px] font-medium bg-background/80 border border-border/50 hover:border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
        >
          Bitfield Counters
        </button>
      </div>
    </div>
  );
};

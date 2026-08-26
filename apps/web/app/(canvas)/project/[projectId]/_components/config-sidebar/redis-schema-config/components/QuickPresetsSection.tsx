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
    <div className="flex flex-col gap-3 rounded-xl border border-red-500/20 bg-red-500/5 dark:bg-red-950/20 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles size={14} /> AI Schema Generator & Presets
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Input
          className="flex-1 text-xs bg-background"
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
          className="h-8 text-xs shrink-0 bg-red-600 hover:bg-red-700 text-white"
          onClick={handleGenerate}
        >
          Generate
        </Button>
      </div>

      {/* Quick Starter Templates */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1">
        <span className="text-[10px] text-muted-foreground">Starter Presets:</span>
        <button
          type="button"
          onClick={() => onApplyPreset("user_profile")}
          className="px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border/50 hover:border-red-500/40 text-muted-foreground hover:text-foreground transition-all"
        >
          User Hash
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset("session_store")}
          className="px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border/50 hover:border-red-500/40 text-muted-foreground hover:text-foreground transition-all"
        >
          Session String
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset("leaderboard")}
          className="px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border/50 hover:border-red-500/40 text-muted-foreground hover:text-foreground transition-all"
        >
          ZSet Leaderboard
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset("geo_locations")}
          className="px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border/50 hover:border-red-500/40 text-muted-foreground hover:text-foreground transition-all"
        >
          GEO Drivers
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset("activity_stream")}
          className="px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border/50 hover:border-red-500/40 text-muted-foreground hover:text-foreground transition-all"
        >
          Stream Groups
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset("bitfield_counters")}
          className="px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border/50 hover:border-red-500/40 text-muted-foreground hover:text-foreground transition-all"
        >
          Bitfield Counters
        </button>
      </div>
    </div>
  );
};

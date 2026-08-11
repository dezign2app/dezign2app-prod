import React from "react";
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { Textarea } from "@workspace/ui/components/textarea";
import { ProtectionRule } from "@workspace/canvas";

interface CustomLogicSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  rule: ProtectionRule;
  onUpdateCustomPrompt: (prompt: string) => void;
}

export const CustomLogicSection = ({
  isOpen,
  onToggle,
  rule,
  onUpdateCustomPrompt,
}: CustomLogicSectionProps) => {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <div
        onClick={onToggle}
        className="flex items-center justify-between cursor-pointer nodrag"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Custom Logic (AI Prompt)
          </span>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
            Natural Language
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            Describe extra granular security conditions. The prompt result will be ANDed onto the structured access rules.
          </span>
          <Textarea
            className="min-h-[90px] text-xs font-mono bg-background"
            placeholder="e.g. Block POST requests during grace period, allow GET requests..."
            value={rule.customLogic?.prompt || ""}
            onChange={(e) => onUpdateCustomPrompt(e.target.value)}
          />
        </div>
      )}
    </div>
  );
};

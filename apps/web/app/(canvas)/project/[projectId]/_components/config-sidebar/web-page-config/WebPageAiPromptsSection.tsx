import React from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";

interface WebPageAiPromptsSectionProps {
  description?: string;
  uiPrompt?: string;
  isGeneratingAi: boolean;
  onUpdateDescription: (description: string) => void;
  onUpdateUiPrompt: (uiPrompt: string) => void;
  onGenerateAiCode: () => void;
}

export function WebPageAiPromptsSection({
  description,
  uiPrompt,
  isGeneratingAi,
  onUpdateDescription,
  onUpdateUiPrompt,
  onGenerateAiCode,
}: WebPageAiPromptsSectionProps) {
  const hasPrompts = Boolean(description?.trim() || uiPrompt?.trim());

  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl bg-card border border-border/60 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>AI Page Generation Prompts</span>
        </div>

        <Button
          size="sm"
          className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
          onClick={onGenerateAiCode}
          disabled={isGeneratingAi || !hasPrompts}
        >
          {isGeneratingAi ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          <span>{isGeneratingAi ? "Generating..." : "Generate Code & Sync"}</span>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Describe the purpose and visual style of this page. Generating within the app automatically syncs directly to the Convex server file and local repository.
      </p>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Page Purpose / Functional Overview</Label>
          <Textarea
            value={description || ""}
            onChange={(e) => onUpdateDescription(e.target.value)}
            placeholder="e.g. Analytics dashboard with interactive charts, real-time KPI metrics, and export capabilities..."
            className="min-h-[80px] text-xs resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Page Theme & Visual Layout Prompt</Label>
          <Textarea
            value={uiPrompt || ""}
            onChange={(e) => onUpdateUiPrompt(e.target.value)}
            placeholder="e.g. Modern dark aesthetic with sleek glassmorphic cards, vibrant gradient accents, collapsible navigation sidebar, and responsive metric grid..."
            className="min-h-[90px] text-xs resize-none"
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";

export interface SectionAiContextTabProps {
  description: string;
  uiPrompt: string;
  onUpdateDescription: (description: string) => void;
  onUpdateUiPrompt: (uiPrompt: string) => void;
}

const STYLE_CHIPS = [
  "Modern Glassmorphic Dark",
  "Minimal Clean Monochrome",
  "Vibrant Gradient Accents",
  "High-Density Dashboard",
  "Floating Card Grid",
];

export const SectionAiContextTab: React.FC<SectionAiContextTabProps> = ({
  description,
  uiPrompt,
  onUpdateDescription,
  onUpdateUiPrompt,
}) => {
  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto m-0 outline-none">
      <div className="p-3 rounded-xl bg-secondary/20 border border-border/50 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Sparkles size={13} className="text-muted-foreground" />
          AI Component Generation Context
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Instructs the AI generator when assembling TSX layouts, styling rules, subcomponents, and interactive state.
        </p>
      </div>

      {/* Section Description */}
      <div className="space-y-1.5 p-3.5 rounded-xl bg-secondary/20 border border-border/50">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground">
            Functional Purpose & Data Flow
          </Label>
          <span className="text-[10px] text-muted-foreground">
            {description.length} chars
          </span>
        </div>
        <Textarea
          value={description}
          onChange={(e) => onUpdateDescription(e.target.value)}
          placeholder="Describe what this component renders, handles, or computes (e.g. Renders an interactive data grid with search filter and pagination)..."
          className="min-h-[90px] text-xs bg-background/50 border-border/50 resize-none"
        />
        <p className="text-[11px] text-muted-foreground">
          Logical purpose and business logic of this component.
        </p>
      </div>

      {/* UI Visual Style Prompt */}
      <div className="space-y-1.5 p-3.5 rounded-xl bg-secondary/20 border border-border/50">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground">
            Visual Layout & UI Styling Prompt
          </Label>
          <span className="text-[10px] text-muted-foreground">
            {uiPrompt.length} chars
          </span>
        </div>
        <Textarea
          value={uiPrompt}
          onChange={(e) => onUpdateUiPrompt(e.target.value)}
          placeholder="Describe styling, aesthetic, animations, and Tailwind classes (e.g. Clean dark theme with responsive grid layout and hover transitions)..."
          className="min-h-[110px] text-xs bg-background/50 border-border/50 resize-none"
        />

        {/* Theme Quick Chips */}
        <div className="pt-2 space-y-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Quick Style Ideas
          </span>
          <div className="flex flex-wrap gap-1">
            {STYLE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  const updated = uiPrompt ? `${uiPrompt}, ${chip}` : chip;
                  onUpdateUiPrompt(updated);
                }}
                className="text-[10px] px-2 py-0.5 rounded bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground font-mono border border-border/40 transition-colors"
              >
                + {chip}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

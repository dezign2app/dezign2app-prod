"use client";

import React from "react";
import { BusinessLogicBlock } from "../../shared/BusinessLogicBlock";

interface LogicSectionProps {
  logicMode: "natural_language" | "code";
  prompt: string;
  code: string;
  isAsync?: boolean;
  onModeChange: (mode: "natural_language" | "code") => void;
  onPromptChange: (prompt: string) => void;
  onCodeChange: (code: string) => void;
  onAsyncChange: (isAsync: boolean) => void;
}

export const LogicSection: React.FC<LogicSectionProps> = ({
  logicMode,
  prompt,
  code,
  isAsync,
  onModeChange,
  onPromptChange,
  onCodeChange,
  onAsyncChange,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <BusinessLogicBlock
        mode={logicMode}
        onModeChange={onModeChange}
        prompt={prompt || ""}
        onPromptChange={onPromptChange}
        code={code || ""}
        onCodeChange={onCodeChange}
        title="2. Transformation Logic"
        description="Pure TypeScript function body or natural language transformation instructions."
        promptPlaceholder="Describe how the input fields should be mapped and transformed into the return fields..."
        codePlaceholder={`return {\n  result: input.name.toLowerCase().replace(/\\s+/g, '-'),\n};`}
        codeLanguageLabel="TypeScript Function Body"
      />

      <label className="flex items-center gap-2 text-[11px] text-muted-foreground/80 cursor-pointer select-none px-1">
        <input
          type="checkbox"
          className="rounded"
          checked={!!isAsync}
          onChange={(e) => onAsyncChange(e.target.checked)}
        />
        <span>async function (returns Promise)</span>
      </label>
    </div>
  );
};

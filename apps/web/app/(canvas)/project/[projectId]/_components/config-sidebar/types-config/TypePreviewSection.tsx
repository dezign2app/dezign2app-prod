"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@workspace/ui/components/button";
import { Code2, Copy, Check } from "lucide-react";
import { generateTypePreviewCode } from "./utils";
import type { TypePreviewSectionProps } from "./types";

export const TypePreviewSection: React.FC<TypePreviewSectionProps> = ({ currentType }) => {
  const [copied, setCopied] = useState(false);

  const previewCode = useMemo(() => {
    return generateTypePreviewCode(currentType);
  }, [currentType]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(previewCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Code2 size={14} className="text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            TypeScript Preview
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopyCode}
          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-500" />
              <span className="text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </Button>
      </div>

      <pre className="p-3 rounded-lg bg-background/80 border text-[11px] font-mono text-foreground/90 overflow-x-auto max-h-[220px] whitespace-pre hide-scrollbar">
        {previewCode}
      </pre>
    </div>
  );
};

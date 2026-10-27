"use client";

import React from "react";
import { ChevronLeft, Layers, Trash2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";

export interface ComponentBreadcrumbsHeaderProps {
  pageLabel?: string;
  sectionId?: string;
  sectionName?: string;
  displayLabel: string;
  nodeId: string;
  onNavigateBack: () => void;
  onNavigateToPage: () => void;
  onNavigateToSection: () => void;
  onDelete?: () => void;
}

export const ComponentBreadcrumbsHeader: React.FC<ComponentBreadcrumbsHeaderProps> = ({
  pageLabel = "Page",
  sectionName = "Section",
  displayLabel,
  onNavigateBack,
  onNavigateToPage,
  onNavigateToSection,
  onDelete,
}) => {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl bg-purple-500/[0.05] border border-purple-500/20">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigateBack}
            className="h-5 px-1 text-muted-foreground hover:text-foreground -ml-1 gap-1 cursor-pointer"
          >
            <ChevronLeft size={12} />
            <span>Back</span>
          </Button>
          <span>/</span>
          <span
            onClick={onNavigateToPage}
            className="hover:text-foreground cursor-pointer transition-colors"
          >
            {pageLabel}
          </span>
          <span>/</span>
          <span
            onClick={onNavigateToSection}
            className="hover:text-foreground cursor-pointer transition-colors"
          >
            {sectionName}
          </span>
          <span>/</span>
          <span className="text-purple-600 dark:text-purple-400 font-semibold font-mono">
            {displayLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
            <Layers size={14} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-foreground font-mono">
              {displayLabel}
            </span>
            <span className="text-[10px] text-muted-foreground">
              UI Component, State Binding &amp; Action Trigger
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Badge
          variant="outline"
          className="text-[10px] font-mono px-2 py-0.5 text-purple-600 dark:text-purple-400 border-purple-500/30 font-semibold"
        >
          &lt;{displayLabel} /&gt;
        </Badge>
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 cursor-pointer transition-colors"
            title="Delete component"
          >
            <Trash2 size={11} className="text-muted-foreground hover:text-destructive" />
            <span className="hidden sm:inline font-medium">Delete</span>
          </Button>
        )}
      </div>
    </div>
  );
};

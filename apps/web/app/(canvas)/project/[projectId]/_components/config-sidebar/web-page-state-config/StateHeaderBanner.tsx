"use client";

import React from "react";
import { Database, Eye, EyeOff, ChevronRight } from "lucide-react";
import { PageSection, PageStateObject } from "@/types/canvas";
import { Badge } from "@workspace/ui/components/badge";

export interface StateHeaderBannerProps {
  pageLabel: string;
  targetSection?: PageSection;
  stateObj: PageStateObject;
  isEnabled: boolean;
  onNavigatePage: () => void;
  onNavigateSection?: () => void;
}

export const StateHeaderBanner: React.FC<StateHeaderBannerProps> = ({
  pageLabel,
  targetSection,
  stateObj,
  isEnabled,
  onNavigatePage,
  onNavigateSection,
}) => {
  return (
    <div className="flex flex-col gap-2">
      {/* Breadcrumb Header */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
        <span
          className="hover:text-foreground cursor-pointer transition-colors"
          onClick={onNavigatePage}
        >
          {pageLabel || "Page"}
        </span>
        <ChevronRight size={12} className="opacity-50" />
        {targetSection && (
          <>
            <span
              className="hover:text-foreground cursor-pointer transition-colors"
              onClick={onNavigateSection}
            >
              {targetSection.name}
            </span>
            <ChevronRight size={12} className="opacity-50" />
          </>
        )}
        <span className="text-cyan-500 font-mono font-semibold">{stateObj.name}</span>
      </div>

      {/* State Variable Card Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 via-background to-indigo-500/10 border border-cyan-500/20 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 shrink-0">
            <Database size={18} />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate font-mono text-foreground">
                {stateObj.name}
              </span>
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                {stateObj.type}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {stateObj.storeName ? (
                <span className="truncate">
                  Store: <strong className="text-foreground/80">{stateObj.storeName}</strong>
                </span>
              ) : (
                <span>Section State</span>
              )}
              {stateObj.defaultValue !== undefined && (
                <span className="truncate opacity-75 font-mono">
                  = {JSON.stringify(stateObj.defaultValue)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick status pill */}
        <div className="shrink-0">
          {isEnabled ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1 font-medium">
              <Eye size={10} />
              <span>Rendered</span>
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] gap-1 font-medium text-muted-foreground">
              <EyeOff size={10} />
              <span>Hidden</span>
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

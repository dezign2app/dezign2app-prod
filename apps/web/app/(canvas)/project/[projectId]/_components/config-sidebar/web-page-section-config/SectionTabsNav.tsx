"use client";

import React from "react";
import { TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { Box, Package, Zap, Palette, Database, Layers } from "lucide-react";

export interface SectionTabsNavProps {
  packagesCount?: number;
  actionsCount?: number;
  statesCount?: number;
  componentsCount?: number;
}

export const SectionTabsNav: React.FC<SectionTabsNavProps> = ({
  packagesCount = 0,
  actionsCount = 0,
  statesCount = 0,
  componentsCount = 0,
}) => {
  return (
    <div className="px-4 pb-2 border-b border-border/50 bg-background">
      <TabsList className="grid w-full grid-cols-6 h-8 p-0.5 bg-secondary/50 border border-border/40 rounded-lg">
        <TabsTrigger
          value="general"
          className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
        >
          <Box size={11} className="shrink-0" />
          <span>General</span>
        </TabsTrigger>

        <TabsTrigger
          value="dependencies"
          className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
        >
          <Package size={11} className="shrink-0" />
          <span>Pkgs</span>
          {packagesCount > 0 && (
            <span className="ml-0.5 px-1 py-0.2 rounded-full text-[8px] bg-secondary text-muted-foreground font-mono font-medium">
              {packagesCount}
            </span>
          )}
        </TabsTrigger>

        <TabsTrigger
          value="actions"
          className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
        >
          <Zap size={11} className="shrink-0 text-amber-500" />
          <span>Actions</span>
          {actionsCount > 0 && (
            <span className="ml-0.5 px-1 py-0.2 rounded-full text-[8px] bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono font-medium">
              {actionsCount}
            </span>
          )}
        </TabsTrigger>

        <TabsTrigger
          value="state"
          className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
        >
          <Database size={11} className="shrink-0 text-cyan-500" />
          <span>State</span>
          {statesCount > 0 && (
            <span className="ml-0.5 px-1 py-0.2 rounded-full text-[8px] bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-mono font-semibold">
              {statesCount}
            </span>
          )}
        </TabsTrigger>

        <TabsTrigger
          value="components"
          className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
        >
          <Layers size={11} className="shrink-0 text-purple-500" />
          <span>UI Bind</span>
          {componentsCount > 0 && (
            <span className="ml-0.5 px-1 py-0.2 rounded-full text-[8px] bg-purple-500/15 text-purple-600 dark:text-purple-400 font-mono font-semibold">
              {componentsCount}
            </span>
          )}
        </TabsTrigger>

        <TabsTrigger
          value="ui-design"
          className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
        >
          <Palette size={11} className="shrink-0" />
          <span>Theme</span>
        </TabsTrigger>
      </TabsList>
    </div>
  );
};

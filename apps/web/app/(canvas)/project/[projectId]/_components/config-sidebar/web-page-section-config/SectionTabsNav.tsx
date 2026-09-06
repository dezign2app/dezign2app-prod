"use client";

import React from "react";
import { TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { Box, Package, Zap, Palette } from "lucide-react";

export interface SectionTabsNavProps {
  packagesCount?: number;
  actionsCount?: number;
}

export const SectionTabsNav: React.FC<SectionTabsNavProps> = ({
  packagesCount = 0,
  actionsCount = 0,
}) => {
  return (
    <div className="px-4 pb-2 border-b border-border/50 bg-background">
      <TabsList className="grid w-full grid-cols-4 h-8 p-0.5 bg-secondary/50 border border-border/40 rounded-lg">
        <TabsTrigger
          value="general"
          className="text-xs flex items-center justify-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium"
        >
          <Box size={12} className="shrink-0" />
          <span>General</span>
        </TabsTrigger>

        <TabsTrigger
          value="dependencies"
          className="text-xs flex items-center justify-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium"
        >
          <Package size={12} className="shrink-0" />
          <span>Packages</span>
          {packagesCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] bg-secondary text-muted-foreground font-mono font-medium">
              {packagesCount}
            </span>
          )}
        </TabsTrigger>

        <TabsTrigger
          value="actions"
          className="text-xs flex items-center justify-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium"
        >
          <Zap size={12} className="shrink-0" />
          <span>Actions</span>
          {actionsCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] bg-secondary text-muted-foreground font-mono font-medium">
              {actionsCount}
            </span>
          )}
        </TabsTrigger>

        <TabsTrigger
          value="ui-design"
          className="text-xs flex items-center justify-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium"
        >
          <Palette size={12} className="shrink-0" />
          <span>UI Design</span>
        </TabsTrigger>
      </TabsList>
    </div>
  );
};

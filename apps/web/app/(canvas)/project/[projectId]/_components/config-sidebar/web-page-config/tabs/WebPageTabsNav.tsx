import React from "react";
import { TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import {
  Layers,
  Sparkles,
  Shield,
  FileCode,
  Settings,
} from "lucide-react";

interface WebPageTabsNavProps {
  sectionsCount: number;
}

export function WebPageTabsNav({ sectionsCount }: WebPageTabsNavProps) {
  return (
    <div className="border-b border-border/50 pb-2 bg-background">
      <TabsList className="grid w-full grid-cols-5 h-8 p-0.5 bg-secondary/50 border border-border/40 rounded-lg">
        <TabsTrigger
          value="sections"
          className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
        >
          <Layers size={12} className="shrink-0" />
          <span className="truncate">Sections</span>
          {sectionsCount > 0 && (
            <span className="px-1 py-0.2 rounded-full text-[9px] bg-secondary text-muted-foreground font-mono font-medium">
              {sectionsCount}
            </span>
          )}
        </TabsTrigger>

        <TabsTrigger
          value="api"
          className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
        >
          <Settings size={12} className="shrink-0" />
          <span className="truncate">API</span>
        </TabsTrigger>

        <TabsTrigger
          value="code"
          className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
        >
          <FileCode size={12} className="shrink-0" />
          <span className="truncate">Sync</span>
        </TabsTrigger>

        <TabsTrigger
          value="protection"
          className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
        >
          <Shield size={12} className="shrink-0" />
          <span className="truncate">Auth</span>
        </TabsTrigger>

        <TabsTrigger
          value="ai"
          className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
        >
          <Sparkles size={12} className="shrink-0" />
          <span className="truncate">AI</span>
        </TabsTrigger>
      </TabsList>
    </div>
  );
}

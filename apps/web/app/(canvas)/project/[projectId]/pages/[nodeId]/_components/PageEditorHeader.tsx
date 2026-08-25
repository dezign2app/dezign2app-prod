"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Pencil,
  Trash2,
  PanelLeft,
  Code2,
  Globe,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";

interface PageEditorHeaderProps {
  projectId: string;
  projectName: string;
  pageName: string;
  pageRoute: string;
  previewUrl: string;
  hasCustomCode: boolean;
  paletteOpen: boolean;
  aiPanelOpen: boolean;
  onTogglePalette: () => void;
  onToggleAiPanel: () => void;
  onReloadPreview: () => void;
  onReset?: () => void;
}

export function PageEditorHeader({
  projectId,
  projectName,
  pageName,
  pageRoute,
  previewUrl,
  hasCustomCode,
  paletteOpen,
  aiPanelOpen,
  onTogglePalette,
  onToggleAiPanel,
  onReloadPreview,
  onReset,
}: PageEditorHeaderProps) {
  return (
    <header className="h-12 px-3 border-b border-sidebar-border bg-sidebar/80 backdrop-blur-md flex items-center justify-between shrink-0 z-30 select-none">
      {/* Left Side: Back button + Left Sidebar Toggle + Page Title / Breadcrumbs */}
      <div className="flex items-center gap-2 min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link href={`/project/${projectId}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to Canvas</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={paletteOpen ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={onTogglePalette}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{paletteOpen ? "Hide Palette" : "Show Palette"}</TooltipContent>
        </Tooltip>

        <div className="h-4 w-[1px] bg-sidebar-border mx-1 shrink-0" />

        <div className="flex items-center gap-2 truncate text-xs">
          <span className="text-muted-foreground truncate hidden sm:inline">{projectName}</span>
          <span className="text-muted-foreground/60 hidden sm:inline">/</span>
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{pageName}</span>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 font-mono text-muted-foreground border-sidebar-border bg-sidebar-accent shrink-0"
          >
            {pageRoute}
          </Badge>

          {hasCustomCode && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 font-medium text-sidebar-foreground border-sidebar-border bg-sidebar-accent shrink-0 hidden md:inline-flex"
            >
              AI-edited
            </Badge>
          )}
        </div>
      </div>

      {/* Center: Live Preview URL & Quick Actions */}
      <div className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg bg-sidebar-accent/50 border border-sidebar-border text-xs max-w-sm w-full mx-4">
        <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="font-mono text-[11px] text-muted-foreground truncate flex-1">
          {previewUrl}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground rounded"
              onClick={onReloadPreview}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reload Preview</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground rounded"
              asChild
            >
              <a href={previewUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open in New Tab</TooltipContent>
        </Tooltip>
      </div>

      {/* Right Side: Compiler Link, Reset, and AI Assistant Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5 px-2.5 hidden sm:flex"
          asChild
        >
          <Link href={`/project/${projectId}/compiler`}>
            <Code2 className="h-3.5 w-3.5" />
            Compiler
          </Link>
        </Button>

        {hasCustomCode && onReset && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-2"
            onClick={onReset}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Reset</span>
          </Button>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={aiPanelOpen ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs gap-1.5 px-2.5 text-sidebar-foreground"
              onClick={onToggleAiPanel}
            >
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">AI Assistant</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{aiPanelOpen ? "Hide AI Assistant" : "Show AI Assistant"}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

"use client";

import React from "react";
import {
  ZapOff,
  Play,
  RefreshCw,
  ArrowLeft,
  Terminal as TerminalIcon,
  Sparkles,
  ExternalLink,
  Globe,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@workspace/ui/components/button";

interface DevServerOfflineStateProps {
  projectId: string;
  port: string | number;
  pageRoute: string;
  pageName: string;
  isChecking: boolean;
  onRetry: () => void;
  onStartServer: () => void;
}

export function DevServerOfflineState({
  projectId,
  port,
  pageRoute,
  pageName,
  isChecking,
  onRetry,
  onStartServer,
}: DevServerOfflineStateProps) {
  const previewUrl = `http://localhost:${port}${pageRoute}`;

  return (
    <div className="relative w-full h-full bg-background flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden font-sans">
      {/* Subtle depth gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-sidebar/60 via-background to-background pointer-events-none" />

      {/* Main Container Card */}
      <div className="relative z-10 max-w-md w-full bg-sidebar border border-sidebar-border shadow-2xl rounded-2xl p-7 flex flex-col items-center backdrop-blur-md">
        {/* Status Icon */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-sidebar-accent border border-sidebar-border flex items-center justify-center text-amber-400 shadow-inner">
            <ZapOff className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-sidebar"></span>
          </span>
        </div>

        {/* Title & Description */}
        <h3 className="text-lg font-semibold text-sidebar-foreground tracking-tight mb-1.5 flex items-center gap-2">
          <span>Dev Server is Offline</span>
        </h3>

        <p className="text-xs text-muted-foreground leading-relaxed mb-4 max-w-sm">
          The local Next.js preview on port{" "}
          <span className="font-mono text-sidebar-foreground font-semibold px-1.5 py-0.5 rounded bg-sidebar-accent border border-sidebar-border">
            {port}
          </span>{" "}
          is not currently running. Start the dev server to see real-time UI previews and
          hot module reload (HMR).
        </p>

        {/* Target URL Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sidebar-accent/50 border border-sidebar-border text-[11px] font-mono text-muted-foreground mb-6 max-w-full truncate">
          <Globe className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
          <span className="truncate">{previewUrl}</span>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
          <Button
            onClick={onStartServer}
            className="w-full sm:flex-1 h-9 gap-2 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-md rounded-lg transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Dev Server</span>
          </Button>

          <Button
            variant="outline"
            onClick={onRetry}
            disabled={isChecking}
            className="w-full sm:w-auto h-9 gap-1.5 text-xs text-sidebar-foreground border-sidebar-border bg-sidebar-accent/40 hover:bg-sidebar-accent rounded-lg transition-all"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-muted-foreground ${
                isChecking ? "animate-spin text-primary" : ""
              }`}
            />
            <span>Retry</span>
          </Button>
        </div>

        {/* Secondary Links & Navigation */}
        <div className="mt-5 pt-4 border-t border-sidebar-border w-full flex items-center justify-between text-xs text-muted-foreground">
          <Link
            href={`/project/${projectId}`}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-sidebar-foreground transition-colors text-[11px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Canvas</span>
          </Link>

          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80 font-medium">
            <Sparkles className="w-3 h-3 text-muted-foreground" />
            <span>AI Editor Available</span>
          </div>
        </div>
      </div>
    </div>
  );
}

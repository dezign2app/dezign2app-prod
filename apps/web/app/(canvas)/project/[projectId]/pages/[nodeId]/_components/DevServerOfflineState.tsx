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
    <div className="relative w-full h-full bg-[#0a0e17] flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden font-sans">
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08),transparent_65%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.05),transparent_50%)] pointer-events-none" />

      {/* Main Container Card */}
      <div className="relative z-10 max-w-md w-full bg-[#111622]/90 border border-slate-800/80 shadow-2xl rounded-2xl p-7 flex flex-col items-center backdrop-blur-xl">
        {/* Glowing Status Icon */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <ZapOff className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-[#111622]"></span>
          </span>
        </div>

        {/* Title & Description */}
        <h3 className="text-lg font-semibold text-slate-100 tracking-tight mb-1.5 flex items-center gap-2">
          <span>Dev Server is Offline</span>
        </h3>

        <p className="text-xs text-slate-400 leading-relaxed mb-4 max-w-sm">
          The local Next.js preview on port{" "}
          <span className="font-mono text-amber-300 font-semibold">{port}</span> is
          not currently running. Start the dev server to see real-time UI previews and
          hot module reload (HMR).
        </p>

        {/* Target URL Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-300 mb-6 max-w-full truncate">
          <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">{previewUrl}</span>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
          <Button
            onClick={onStartServer}
            className="w-full sm:flex-1 h-9 gap-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 rounded-lg transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Start Dev Server</span>
          </Button>

          <Button
            variant="outline"
            onClick={onRetry}
            disabled={isChecking}
            className="w-full sm:w-auto h-9 gap-1.5 text-xs text-slate-300 border-slate-700 bg-slate-800/40 hover:bg-slate-800 hover:text-white rounded-lg transition-all"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-slate-400 ${
                isChecking ? "animate-spin text-indigo-400" : ""
              }`}
            />
            <span>{isChecking ? "Checking..." : "Retry"}</span>
          </Button>
        </div>

        {/* Secondary Links & Navigation */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 w-full flex items-center justify-between text-xs text-slate-400">
          <Link
            href={`/project/${projectId}`}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-[11px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Canvas</span>
          </Link>

          <div className="flex items-center gap-1 text-[11px] text-violet-400 font-medium">
            <Sparkles className="w-3 h-3 text-violet-400" />
            <span>AI Editor Available</span>
          </div>
        </div>
      </div>
    </div>
  );
}

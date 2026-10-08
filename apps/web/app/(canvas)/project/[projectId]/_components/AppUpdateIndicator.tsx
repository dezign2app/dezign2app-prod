"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Minus,
  Maximize2,
  Loader2,
  ArrowUpCircle,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Progress } from "@workspace/ui/components/progress";
import { useElectronUpdaterStore } from "@/lib/stores/electronUpdaterStore";
import { isElectron } from "@/lib/electron";

export function AppUpdateIndicator() {
  const {
    status,
    version,
    percent,
    error,
    isMinimized,
    isDismissed,
    isRestarting,
    init,
    quitAndInstall,
    checkForUpdates,
    setMinimized,
    setDismissed,
  } = useElectronUpdaterStore();

  // Initialize listener on mount
  useEffect(() => {
    const cleanup = init();
    return () => {
      cleanup();
    };
  }, [init]);

  // Only render inside Electron desktop app (or if simulated in dev)
  const inElectron = isElectron();
  if (!inElectron && status === "idle") {
    return null;
  }

  // Determine if there is an active state to display
  const isDownloading = status === "downloading";
  const isDownloaded = status === "downloaded";
  const isAvailable = status === "available";
  const isError = status === "error" && !isDismissed;

  const hasActiveUpdate = isDownloading || isDownloaded || isAvailable || isError;

  if (!hasActiveUpdate || isDismissed) {
    return null;
  }

  return (
    <div className="fixed z-50 pointer-events-none transition-all duration-300">
      <AnimatePresence mode="wait">
        {/* ================================================================= */}
        {/* MINIMIZED FLOATING BADGE (Docked at top-center or bottom-right)  */}
        {/* ================================================================= */}
        {isMinimized ? (
          <motion.div
            key="minimized-pill"
            initial={{ opacity: 0, scale: 0.85, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-16 right-6 pointer-events-auto"
          >
            {isDownloaded ? (
              <Button
                variant="outline"
                size="sm"
                onClick={quitAndInstall}
                className="h-9 px-3.5 rounded-full bg-card/95 backdrop-blur-xl border-emerald-500/40 text-foreground hover:bg-emerald-500/15 shadow-[0_4px_20px_rgba(16,185,129,0.25)] flex items-center gap-2 group transition-all"
                title="Click to restart and install update"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <Sparkles className="w-3.5 h-3.5 text-emerald-500 group-hover:rotate-12 transition-transform" />
                <span className="text-xs font-semibold">
                  {version ? `v${version} Ready` : "Update Ready"} • Restart
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setMinimized(false);
                  }}
                  className="ml-1 p-0.5 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                  title="Expand update details"
                >
                  <Maximize2 className="w-3 h-3" />
                </span>
              </Button>
            ) : isDownloading ? (
              <div
                onClick={() => setMinimized(false)}
                className="cursor-pointer h-9 px-3.5 rounded-full bg-card/95 backdrop-blur-xl border border-primary/30 text-foreground hover:bg-primary/10 shadow-lg flex items-center gap-2 transition-all"
                title="Downloading update... Click to expand"
              >
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                <span className="text-xs font-medium">
                  Updating: <strong className="font-semibold text-primary">{percent}%</strong>
                </span>
                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            ) : null}
          </motion.div>
        ) : (
          /* ================================================================= */
          /* EXPANDED STATUS BANNER / CARD (Centered floating pill)            */
          /* ================================================================= */
          <motion.div
            key="expanded-card"
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 pointer-events-auto max-w-[480px] w-[94vw] sm:w-[460px]"
          >
            {/* DOWNLOADED / READY TO RESTART CARD */}
            {isDownloaded && (
              <div className="rounded-2xl border border-emerald-500/40 bg-card/95 backdrop-blur-xl shadow-[0_10px_35px_rgba(16,185,129,0.22)] p-4 text-card-foreground flex flex-col gap-3 relative overflow-hidden">
                {/* Subtle emerald top glow line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 shadow-sm">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-foreground">
                          Update Ready to Install
                        </h4>
                        {version && (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-mono"
                          >
                            v{version}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        A new version has been downloaded in the background. Restart now to apply changes.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
                      onClick={() => setMinimized(true)}
                      title="Minimize to floating pill"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
                      onClick={() => setDismissed(true)}
                      title="Dismiss for now"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Restart & Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setMinimized(true)}
                  >
                    Later
                  </Button>
                  <Button
                    size="sm"
                    onClick={quitAndInstall}
                    disabled={isRestarting}
                    className="h-8 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 gap-2 transition-all active:scale-95"
                  >
                    {isRestarting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Restarting...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Restart & Install</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* DOWNLOADING PROGRESS CARD */}
            {(isDownloading || isAvailable) && !isDownloaded && (
              <div className="rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl shadow-2xl p-4 text-card-foreground flex flex-col gap-3 relative overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/25 text-primary shadow-sm shrink-0">
                      <Download className="w-5 h-5 animate-bounce" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-foreground truncate">
                          Downloading Update
                        </h4>
                        {version && (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 border-primary/30 text-primary font-mono"
                          >
                            v{version}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        Installing background files automatically...
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
                      onClick={() => setMinimized(true)}
                      title="Minimize progress bar"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Progress bar and numeric readout */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold text-primary tabular-nums">
                      {percent}%
                    </span>
                  </div>
                  <Progress value={percent} className="h-2 rounded-full" />
                </div>
              </div>
            )}

            {/* ERROR CARD */}
            {isError && (
              <div className="rounded-2xl border border-destructive/40 bg-card/95 backdrop-blur-xl shadow-xl p-3.5 text-card-foreground flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-destructive/15 text-destructive shrink-0">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      Update Check Issue
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[280px]">
                      {error || "Could not reach update server."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => checkForUpdates()}
                  >
                    Retry
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setDismissed(true)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Compact toolbar button component that can be placed in CanvasToolbar,
 * LangGraphCanvasHeader, or any top bar.
 */
export function AppUpdateToolbarButton() {
  const { status, version, percent, isRestarting, quitAndInstall, setMinimized } =
    useElectronUpdaterStore();

  const inElectron = isElectron();
  if (!inElectron && status === "idle") {
    return null;
  }

  if (status === "downloaded") {
    return (
      <Button
        size="sm"
        onClick={quitAndInstall}
        disabled={isRestarting}
        className="h-8 py-0 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/30 gap-1.5 animate-pulse"
        title={`Version v${version || ""} downloaded. Click to restart and update.`}
      >
        {isRestarting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5" />
        )}
        <span>Restart to Update</span>
      </Button>
    );
  }

  if (status === "downloading") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setMinimized(false)}
        className="h-8 py-0 px-2.5 text-xs border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
        title={`Downloading update: ${percent}%`}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        <span className="font-mono">{percent}%</span>
      </Button>
    );
  }

  return null;
}

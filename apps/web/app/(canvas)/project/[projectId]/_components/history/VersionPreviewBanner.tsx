"use client";

import React from "react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Eye, RotateCcw, X, Loader2 } from "lucide-react";

interface VersionPreviewBannerProps {
  versionNumber: number;
  title: string;
  onExitPreview: () => void;
  onRestore: () => void;
  isRestoring?: boolean;
}

export function VersionPreviewBanner({
  versionNumber,
  title,
  onExitPreview,
  onRestore,
  isRestoring = false,
}: VersionPreviewBannerProps): React.JSX.Element {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between z-30 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <div className="p-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
          <Eye className="w-4 h-4" />
        </div>
        <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs">
          v{versionNumber} Preview
        </Badge>
        <span className="text-xs font-medium text-foreground truncate">
          &ldquo;{title}&rdquo; <span className="text-muted-foreground font-normal">(Read-Only)</span>
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-amber-500/30 hover:bg-amber-500/10"
          onClick={onRestore}
          disabled={isRestoring}
        >
          {isRestoring ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <RotateCcw className="w-3 h-3 mr-1" />
          )}
          Restore this Version
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={onExitPreview}
          disabled={isRestoring}
        >
          <X className="w-3.5 h-3.5 mr-1" />
          Exit Preview
        </Button>
      </div>
    </div>
  );
}

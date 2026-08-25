"use client";

import React from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { DevServerOfflineState } from "./DevServerOfflineState";

interface PagePreviewViewportProps {
  projectId: string;
  port: string | number;
  pageRoute: string;
  pageName: string;
  previewUrl: string;
  iframeKey: number;
  isServerRunning: boolean | null;
  isCheckingServer: boolean;
  onRetryServerCheck: () => void;
  onStartDevServer: () => void;
  onReloadPreview: () => void;
}

export function PagePreviewViewport({
  projectId,
  port,
  pageRoute,
  pageName,
  previewUrl,
  iframeKey,
  isServerRunning,
  isCheckingServer,
  onRetryServerCheck,
  onStartDevServer,
  onReloadPreview,
}: PagePreviewViewportProps) {
  return (
    <div className="flex-1 min-h-0 w-full relative pointer-events-auto bg-background flex flex-col">
      {/* Mobile/Tablet Preview URL header */}
      <div className="lg:hidden flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-sidebar/50 text-xs shrink-0">
        <span className="font-mono text-[11px] text-muted-foreground truncate">{previewUrl}</span>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            onClick={onReloadPreview}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            asChild
          >
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>

      {/* Iframe Viewport or Dev Server Offline Placeholder */}
      <div className="flex-1 relative w-full h-full bg-white overflow-hidden">
        {isServerRunning === false ? (
          <DevServerOfflineState
            projectId={projectId}
            port={port}
            pageRoute={pageRoute}
            pageName={pageName}
            isChecking={isCheckingServer}
            onRetry={onRetryServerCheck}
            onStartServer={onStartDevServer}
          />
        ) : (
          <iframe
            key={iframeKey}
            src={previewUrl}
            className="w-full h-full border-0"
            title={`Preview: ${pageName}`}
          />
        )}
      </div>
    </div>
  );
}

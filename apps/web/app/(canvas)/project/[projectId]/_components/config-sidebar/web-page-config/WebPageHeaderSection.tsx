import React, { useState } from "react";
import { Globe, LayoutTemplate, Copy, Check, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { AuthAwarenessBanner } from "../AuthAwarenessBanner";
import { useBufferedInput } from "@/lib/hooks/useBufferedInput";
import { computeCompiledPageRoute, Endpoint } from "@workspace/canvas";
import { Parameter, BackendNode } from "@/types/canvas";
import { WebPageParametersSection } from "./WebPageParametersSection";
import { toast } from "sonner";

export interface WebPageHeaderSectionProps {
  label?: string;
  summary?: string;
  description?: string;
  connectedZoneName: string | null;
  isProtected: boolean;
  requireAuth: boolean;
  onUpdateSummary: (summary: string) => void;
  onUpdateRequireAuth: (requireAuth: boolean) => void;
  onRequestRename?: (newLabel: string) => void;
  isLayout?: boolean;
  effectivePathParams?: Parameter[];
  effectiveQueryParams?: Parameter[];
  onUpdatePathParams?: (pathParams: Parameter[]) => void;
  onUpdateQueryParams?: (queryParams: Parameter[]) => void;
  connectedEndpoint?: Endpoint | null;
  connectedWebApp?: BackendNode | null;
}

export function WebPageHeaderSection({
  label,
  summary,
  description,
  connectedZoneName,
  isProtected,
  requireAuth,
  onUpdateSummary,
  onUpdateRequireAuth,
  onRequestRename,
  isLayout = false,
  effectivePathParams = [],
  effectiveQueryParams = [],
  onUpdatePathParams,
  onUpdateQueryParams,
  connectedEndpoint,
  connectedWebApp,
}: WebPageHeaderSectionProps) {
  const [paramsExpanded, setParamsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const routeBuffer = useBufferedInput(
    label || "",
    React.useCallback(
      (newRoute: string) => {
        if (newRoute !== label && onRequestRename) {
          onRequestRename(newRoute);
        }
      },
      [label, onRequestRename],
    ),
    200,
  );

  const compiledRoute = React.useMemo(() => {
    return computeCompiledPageRoute({
      label: routeBuffer.value,
      pathParams: effectivePathParams,
      queryParams: effectiveQueryParams,
      isLayout,
    });
  }, [routeBuffer.value, effectivePathParams, effectiveQueryParams, isLayout]);

  const devServerPort = connectedWebApp?.data?.port || "3000";
  const fullDevUrl = !isLayout && compiledRoute !== "layout" ? `http://localhost:${devServerPort}${compiledRoute}` : null;

  const handleCopyRoute = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(compiledRoute);
    setCopied(true);
    toast.success("Compiled route copied to clipboard", {
      description: compiledRoute,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const totalParams = effectivePathParams.length + effectiveQueryParams.length;

  return (
    <div className="flex flex-col gap-4 border-b border-border/50 pb-5">
      {/* 1. Page Route Header & Input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded border border-emerald-500/30 shadow-sm flex items-center gap-1 shrink-0">
            {isLayout ? <LayoutTemplate className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
            {isLayout ? "LAYOUT" : "PAGE ROUTE"}
          </span>
          <Input
            className="h-8 text-sm font-semibold tracking-tight text-foreground bg-background font-mono flex-1"
            placeholder={isLayout ? "layout" : "/c/[id]"}
            value={routeBuffer.value}
            onChange={(e) => routeBuffer.onChange(e.target.value)}
            onBlur={routeBuffer.flush}
            disabled={isLayout}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {isLayout
            ? "Route group layout wrapping child pages in this zone."
            : "Configure frontend page route (e.g. /c/[id]), query params, and navigation."}
        </p>
      </div>

      {/* 2. Compiled / Final Route Card */}
      {!isLayout && (
        <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-secondary/35 border border-border/60 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Globe size={11} className="text-emerald-500" />
              Final Compiled Route
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={handleCopyRoute}
                title="Copy compiled route"
              >
                {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              </Button>
              {fullDevUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => window.open(fullDevUrl, "_blank")}
                  title={`Open preview (${fullDevUrl})`}
                >
                  <ExternalLink size={12} />
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 select-all truncate max-w-full">
              {compiledRoute}
            </span>
            {fullDevUrl && (
              <span className="text-[10px] font-mono text-muted-foreground truncate" title={fullDevUrl}>
                ({fullDevUrl})
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. Route Parameters: Path & Query Params (Above the tab) */}
      {!isLayout && onUpdatePathParams && onUpdateQueryParams && (
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={() => setParamsExpanded(!paramsExpanded)}
            className="flex items-center justify-between text-xs font-semibold text-foreground hover:text-primary transition-colors py-1 cursor-pointer select-none"
          >
            <div className="flex items-center gap-1.5">
              {paramsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>Route Parameters</span>
              {totalParams > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary text-muted-foreground font-mono font-medium">
                  {totalParams}
                </span>
              )}
            </div>
            <span className="text-[10px] font-normal text-muted-foreground">
              {paramsExpanded ? "Collapse" : "Expand"}
            </span>
          </button>

          {paramsExpanded && (
            <div className="flex flex-col gap-3 pl-1 border-l-2 border-border/40 ml-1">
              <WebPageParametersSection
                connectedEndpoint={connectedEndpoint}
                effectivePathParams={effectivePathParams}
                effectiveQueryParams={effectiveQueryParams}
                onUpdatePathParams={onUpdatePathParams}
                onUpdateQueryParams={onUpdateQueryParams}
              />
            </div>
          )}
        </div>
      )}

      {/* 4. Auth Awareness Banner */}
      <AuthAwarenessBanner
        zoneName={connectedZoneName}
        isProtected={isProtected}
        requireAuth={requireAuth}
        onRequireAuthChange={onUpdateRequireAuth}
      />

      {/* 5. Summary */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Summary
        </Label>
        <Input
          className="bg-background/50 text-xs"
          placeholder="e.g. Fetches or submits client data."
          value={summary || description || ""}
          onChange={(e) => onUpdateSummary(e.target.value)}
        />
      </div>
    </div>
  );
}

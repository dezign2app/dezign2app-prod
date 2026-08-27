import React from "react";
import { Globe } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { AuthAwarenessBanner } from "../AuthAwarenessBanner";
import type { BackendNode } from "@/types/canvas";

interface WebPageHeaderSectionProps {
  label?: string;
  summary?: string;
  description?: string;
  connectedZoneName: string | null;
  isProtected: boolean;
  requireAuth: boolean;
  onUpdateSummary: (summary: string) => void;
  onUpdateRequireAuth: (requireAuth: boolean) => void;
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
}: WebPageHeaderSectionProps) {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-500 rounded border border-emerald-500/20 shadow-sm flex items-center gap-1">
            <Globe className="w-3 h-3" /> WEB PAGE
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            {label || "Web Page"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure frontend page details, client API parameters, and navigation routing.
        </p>
      </div>

      {/* Auth awareness banner & Bearer token switch */}
      <AuthAwarenessBanner
        zoneName={connectedZoneName}
        isProtected={isProtected}
        requireAuth={requireAuth}
        onRequireAuthChange={onUpdateRequireAuth}
      />

      <div className="flex flex-col gap-2">
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
    </>
  );
}

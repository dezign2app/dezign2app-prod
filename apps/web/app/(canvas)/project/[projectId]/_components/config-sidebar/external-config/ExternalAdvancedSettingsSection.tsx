"use client";

import React from "react";
import { Label } from "@workspace/ui/components/label";
import { BufferedInput } from "./BufferedInput";

interface ExternalAdvancedSettingsSectionProps {
  timeout: string | number;
  onTimeoutCommit: (val: string) => void;
  rateLimit: string;
  onRateLimitCommit: (val: string) => void;
}

export const ExternalAdvancedSettingsSection = React.memo<ExternalAdvancedSettingsSectionProps>(
  ({ timeout, onTimeoutCommit, rateLimit, onRateLimitCommit }) => {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Advanced Call Settings
        </span>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Timeout (seconds)</Label>
            <BufferedInput
              className="h-8 text-xs bg-background"
              placeholder="30"
              value={timeout}
              onCommit={onTimeoutCommit}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Rate Limit</Label>
            <BufferedInput
              className="h-8 text-xs bg-background"
              placeholder="100/m"
              value={rateLimit}
              onCommit={onRateLimitCommit}
            />
          </div>
        </div>
      </div>
    );
  },
);
ExternalAdvancedSettingsSection.displayName = "ExternalAdvancedSettingsSection";

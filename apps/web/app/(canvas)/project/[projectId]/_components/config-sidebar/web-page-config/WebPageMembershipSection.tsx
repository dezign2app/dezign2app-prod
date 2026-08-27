import React from "react";
import { Layers } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

interface WebPageMembershipSectionProps {
  label?: string;
  appSlug: string;
  connectedZoneName: string | null;
  onUpdateLabel: (label: string) => void;
  onUpdateAppSlug: (appSlug: string) => void;
}

export function WebPageMembershipSection({
  label,
  appSlug,
  connectedZoneName,
  onUpdateLabel,
  onUpdateAppSlug,
}: WebPageMembershipSectionProps) {
  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl bg-card border border-border/60 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Layers className="w-4 h-4 text-indigo-400" />
        <span>Page & Section Membership</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">Page Route Name</Label>
          <Input
            value={label || ""}
            onChange={(e) => onUpdateLabel(e.target.value)}
            placeholder="e.g. /dashboard/settings"
            className="h-8 text-xs bg-background/50 font-mono"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">Target Monorepo App</Label>
          <Input
            value={appSlug}
            onChange={(e) => onUpdateAppSlug(e.target.value)}
            placeholder="e.g. customer-portal"
            className="h-8 text-xs font-mono bg-background/50"
          />
        </div>
      </div>

      <div className="p-3 bg-muted/40 rounded-lg border border-border/50 flex items-center justify-between text-xs mt-1">
        <span className="text-muted-foreground">Connected WebApp Section:</span>
        <span className="font-mono font-semibold text-foreground">
          {connectedZoneName ? `🔒 ${connectedZoneName}` : "Unattached Page"}
        </span>
      </div>
    </div>
  );
}

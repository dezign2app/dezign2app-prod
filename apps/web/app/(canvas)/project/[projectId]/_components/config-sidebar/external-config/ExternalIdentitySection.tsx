"use client";

import React from "react";
import { Label } from "@workspace/ui/components/label";
import { ExternalLink } from "lucide-react";
import { BufferedInput, BufferedTextarea } from "./BufferedInput";
import { toVarName } from "@/lib/compiler/utils";

interface ExternalIdentitySectionProps {
  functionName: string;
  onFunctionNameCommit: (val: string) => void;
  label: string;
  onLabelCommit: (val: string) => void;
  description: string;
  onDescriptionCommit: (val: string) => void;
  docsUrl: string;
  onDocsUrlCommit: (val: string) => void;
}

export const ExternalIdentitySection = React.memo<ExternalIdentitySectionProps>(
  ({
    functionName,
    onFunctionNameCommit,
    label,
    onLabelCommit,
    description,
    onDescriptionCommit,
    docsUrl,
    onDocsUrlCommit,
  }) => {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span>Tool Identity</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            Function:{" "}
            <code className="text-emerald-600 dark:text-emerald-400">
              {functionName || "callExternalApi"}
            </code>
          </span>
        </span>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Tool / Function Name</Label>
            <BufferedInput
              className="h-8 text-xs bg-background font-mono"
              placeholder="e.g. callStripeCharge"
              value={functionName}
              onCommit={onFunctionNameCommit}
              transformValue={toVarName}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Display Label</Label>
            <BufferedInput
              className="h-8 text-xs bg-background"
              placeholder="e.g. Stripe Charge"
              value={label}
              onCommit={onLabelCommit}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium">Description</Label>
          <BufferedTextarea
            className="min-h-[50px] text-xs bg-background resize-none"
            placeholder="Describe what this external call performs and what it returns..."
            value={description}
            onCommit={onDescriptionCommit}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium">Documentation URL</Label>
          <div className="flex items-center gap-2">
            <BufferedInput
              className="h-8 text-xs bg-background font-mono flex-1"
              placeholder="https://docs.stripe.com/api"
              value={docsUrl}
              onCommit={onDocsUrlCommit}
            />
            {docsUrl && (
              <a
                href={docsUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                title="Open documentation"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  },
);
ExternalIdentitySection.displayName = "ExternalIdentitySection";

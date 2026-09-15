import React, { useState } from "react";
import { Key, Check, Copy } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  extractKeyTemplateParams,
  deriveKeyPattern,
  deriveNamespace,
} from "../../../backend-nodes/entity-node/RedisConfig";

interface KeyTemplateSectionProps {
  keyTemplate: string;
  clusterTagParam?: string;
  updateData: (changes: Partial<BackendNode["data"]>) => void;
}

export const KeyTemplateSection: React.FC<KeyTemplateSectionProps> = React.memo(({
  keyTemplate,
  clusterTagParam,
  updateData,
}) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [localTemplate, setLocalTemplate] = useState(keyTemplate);

  React.useEffect(() => {
    setLocalTemplate(keyTemplate);
  }, [keyTemplate]);

  const commitTemplate = (val: string) => {
    if (val === keyTemplate) return;
    const extracted = extractKeyTemplateParams(val);
    const newClusterTag =
      clusterTagParam && extracted.includes(clusterTagParam)
        ? clusterTagParam
        : extracted[0] || undefined;
    updateData({
      keyTemplate: val,
      clusterHashTagParam: newClusterTag,
    });
  };

  const keyPattern = deriveKeyPattern(localTemplate);
  const namespace = deriveNamespace(localTemplate);
  const params = extractKeyTemplateParams(localTemplate);

  // Sample Key preview resolution (e.g. user:{id}:profile -> user:1001:profile)
  const sampleKey = localTemplate
    ? localTemplate.replace(/\{([^}]+)\}/g, (_, p) => {
        if (p.toLowerCase().includes("id")) return "1001";
        if (p.toLowerCase().includes("token") || p.toLowerCase().includes("session"))
          return "sess_99a8x";
        if (p.toLowerCase().includes("date")) return "2026-08-22";
        return `val_${p}`;
      })
    : "(none)";

  const handleCopyKey = () => {
    navigator.clipboard.writeText(sampleKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Key size={14} className="text-amber-500" /> Keyspace & Key Template
        </span>
        <Badge
          variant="outline"
          className="text-xs px-2.5 py-0.5 border-border/60 bg-background/60 font-normal"
        >
          <span className="text-muted-foreground mr-1.5">Namespace:</span>
          <span className="font-mono font-medium text-foreground">{namespace}</span>
        </Badge>
      </div>

      {/* Key Template Input */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-foreground">
            Key Template (Shape with variables)
          </Label>
          <span className="text-xs text-muted-foreground">
            Use{" "}
            <code className="font-mono text-xs font-medium text-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
              {`{variable}`}
            </code>{" "}
            for dynamic segments
          </span>
        </div>
        <Input
          value={localTemplate}
          onChange={(e) => setLocalTemplate(e.target.value)}
          onBlur={() => commitTemplate(localTemplate)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitTemplate(localTemplate);
            }
          }}
          placeholder="e.g. user:{id}:profile or session:{token}"
          className="h-8 text-xs font-mono font-medium bg-background border-border/60 focus-visible:ring-primary/30"
        />
      </div>

      {/* Auto-Derived Key Pattern & Cluster Hash Tag */}
      <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-secondary/20 border border-border/40">
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="text-xs font-medium text-muted-foreground">
            Auto-Derived Scan Pattern
          </span>
          <div
            className="flex items-center h-8 px-2.5 rounded-md bg-background/80 border border-border/60 font-mono text-xs font-medium text-foreground truncate select-all"
            title={`SCAN Pattern: ${keyPattern}`}
          >
            {keyPattern}
          </div>
          <span className="text-[11px] text-muted-foreground leading-normal">
            Used for SCAN / wildcard keyspace operations.
          </span>
        </div>

        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="text-xs font-medium text-muted-foreground">
            Cluster Hash Tag Variable
          </span>
          {params.length > 0 ? (
            <Select
              value={clusterTagParam || "none"}
              onValueChange={(val) =>
                updateData({
                  clusterHashTagParam: val === "none" ? undefined : val,
                })
              }
            >
              <SelectTrigger className="h-8 text-xs bg-background/80 border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs text-muted-foreground">
                  None (Default Hashing)
                </SelectItem>
                {params.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">
                    <span className="font-mono font-medium">{`{${p}}`}</span>{" "}
                    <span className="text-muted-foreground text-[11px] ml-1">
                      (Cluster Shard Co-location)
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center h-8 px-2.5 rounded-md bg-background/50 border border-border/40 text-xs italic text-muted-foreground">
              No variables in template
            </div>
          )}
          <span className="text-[11px] text-muted-foreground leading-normal">
            Co-locates keys with the same tag onto the same Redis shard.
          </span>
        </div>
      </div>

      {/* Live Key Resolver Preview */}
      <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-background/70 border border-border/50">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-medium text-muted-foreground shrink-0">
            Resolved Key Example:
          </span>
          <code className="text-xs font-mono font-medium text-foreground bg-muted/50 border border-border/50 px-2 py-0.5 rounded truncate">
            {sampleKey}
          </code>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs px-2.5 gap-1.5 shrink-0 text-muted-foreground hover:text-foreground border-border/60 bg-background/50"
          onClick={handleCopyKey}
        >
          {copiedKey ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          <span>{copiedKey ? "Copied" : "Copy"}</span>
        </Button>
      </div>
    </div>
  );
});

KeyTemplateSection.displayName = "KeyTemplateSection";

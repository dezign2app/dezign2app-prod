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

export const KeyTemplateSection: React.FC<KeyTemplateSectionProps> = ({
  keyTemplate,
  clusterTagParam,
  updateData,
}) => {
  const [copiedKey, setCopiedKey] = useState(false);

  const keyPattern = deriveKeyPattern(keyTemplate);
  const namespace = deriveNamespace(keyTemplate);
  const params = extractKeyTemplateParams(keyTemplate);

  // Sample Key preview resolution (e.g. user:{id}:profile -> user:1001:profile)
  const sampleKey = keyTemplate
    ? keyTemplate.replace(/\{([^}]+)\}/g, (_, p) => {
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
        <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Key size={14} className="text-red-500" /> Keyspace & Key Template
        </span>
        <Badge variant="outline" className="text-[10px] font-mono">
          Namespace: {namespace}
        </Badge>
      </div>

      {/* Key Template Input */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Key Template (Shape with variables)</Label>
          <span className="text-[10px] text-muted-foreground">
            Use <code className="font-mono text-foreground">{`{variable}`}</code> for dynamic segments
          </span>
        </div>
        <Input
          value={keyTemplate}
          onChange={(e) => {
            const val = e.target.value;
            const extracted = extractKeyTemplateParams(val);
            const newClusterTag =
              clusterTagParam && extracted.includes(clusterTagParam)
                ? clusterTagParam
                : extracted[0] || undefined;
            updateData({
              keyTemplate: val,
              clusterHashTagParam: newClusterTag,
            });
          }}
          placeholder="e.g. user:{id}:profile or session:{token}"
          className="h-8 text-xs font-mono bg-background"
        />
      </div>

      {/* Auto-Derived Key Pattern & Cluster Hash Tag */}
      <div className="grid grid-cols-2 gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/30 text-xs">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted-foreground">
            Auto-Derived Scan Pattern
          </span>
          <code className="text-xs font-mono font-bold text-foreground bg-background/80 px-2 py-1 rounded border border-border/40 truncate">
            {keyPattern}
          </code>
          <span className="text-[10px] text-muted-foreground">
            Used for SCAN / wildcard keyspace operations.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted-foreground">
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
              <SelectTrigger className="h-7 text-xs font-mono bg-background/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs italic text-muted-foreground">
                  None (Default Hashing)
                </SelectItem>
                {params.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs font-mono">
                    {`{${p}}`} (Cluster Shard Co-location)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs italic text-muted-foreground py-1">
              No variables in template
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            Co-locates keys with the same tag onto the same Redis shard.
          </span>
        </div>
      </div>

      {/* Live Key Resolver Preview */}
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/40">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
            Resolved Key Example:
          </span>
          <code className="text-xs font-mono font-bold text-red-600 dark:text-red-400 truncate">
            {sampleKey}
          </code>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[11px] gap-1 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={handleCopyKey}
        >
          {copiedKey ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          {copiedKey ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
};

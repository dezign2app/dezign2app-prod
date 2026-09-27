import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import { Globe } from "lucide-react";
import { LocalInput } from "../../../backend-nodes/graph-nodes/shared";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BucketStorageSectionProps } from "./types";
import { EnvVarCombobox } from "../../EnvVarCombobox";

export const CdnConfigSection: React.FC<BucketStorageSectionProps> = ({
  item,
  handleUpdate,
}) => {
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const parentNode = item.nodeId
    ? nodes.find((n) => n.id === item.nodeId)
    : nodes.find((n) => n.data?.buckets?.some((b) => b.id === item.id));
  const effectiveNodeId = item.nodeId || parentNode?.id;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-emerald-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            CDN & Edge Delivery
          </span>
        </div>
        <Switch
          checked={Boolean(item.enableCdn)}
          onCheckedChange={(checked) => handleUpdate(item.id, { enableCdn: checked })}
        />
      </div>

      {item.enableCdn && (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-foreground">CDN Distribution Domain</label>
            <EnvVarCombobox
              placeholder="e.g. CDN_DOMAIN or cdn.myapp.com"
              value={item.cdnDomain || ""}
              onValueChange={(val) => handleUpdate(item.id, { cdnDomain: val })}
              nodeId={effectiveNodeId}
              allowRawInput={true}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-foreground">Cache-Control Header Strategy</label>
            <Select
              value={item.cdnCacheControl || "public, max-age=31536000, immutable"}
              onValueChange={(v) => handleUpdate(item.id, { cdnCacheControl: v })}
            >
              <SelectTrigger className="w-full bg-background/50 h-8 text-xs font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public, max-age=31536000, immutable" className="text-xs font-mono">
                  public, max-age=31536000, immutable (Static Media - 1 Year)
                </SelectItem>
                <SelectItem value="public, max-age=86400" className="text-xs font-mono">
                  public, max-age=86400 (1 Day)
                </SelectItem>
                <SelectItem value="public, max-age=3600" className="text-xs font-mono">
                  public, max-age=3600 (1 Hour)
                </SelectItem>
                <SelectItem value="no-cache, no-store, must-revalidate" className="text-xs font-mono">
                  no-cache, no-store (Private / Sensitive)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
};

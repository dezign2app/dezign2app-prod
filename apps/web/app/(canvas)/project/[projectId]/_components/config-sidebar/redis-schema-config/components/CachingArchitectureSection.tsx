import React from "react";
import { Clock, ShieldAlert, RotateCw } from "lucide-react";
import {
  BackendNode,
  RedisDataStructure,
  RedisDuration,
  isCacheStrategy,
  isRedisDurationUnit,
  isSerializationFormat,
  isCompressionFormat,
} from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@workspace/ui/components/combobox";
import { cn } from "@workspace/ui/lib/utils";
import { TTL_PRESETS } from "../constants";

interface CachingArchitectureSectionProps {
  structure: RedisDataStructure;
  ttl: RedisDuration;
  strategy: string;
  negativeCaching: NonNullable<BackendNode["data"]["negativeCaching"]>;
  staleWhileRevalidate: NonNullable<BackendNode["data"]["staleWhileRevalidate"]>;
  sourceOfTruth?: BackendNode["data"]["sourceOfTruth"];
  invalidationRules?: string;
  serialization?: string;
  compression?: string;
  tableNodes: BackendNode[];
  updateData: (changes: Partial<BackendNode["data"]>) => void;
}

export const CachingArchitectureSection: React.FC<CachingArchitectureSectionProps> = ({
  structure,
  ttl,
  strategy,
  negativeCaching,
  staleWhileRevalidate,
  sourceOfTruth,
  invalidationRules,
  serialization,
  compression,
  tableNodes,
  updateData,
}) => {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
        <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={14} className="text-red-500" /> Caching Policies & Lifecycle
        </span>
      </div>

      {/* TTL Duration Picker with Presets */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Schema TTL (Time to Live)</Label>
          <span className="text-[10px] text-muted-foreground font-mono">
            {ttl.unit === "never" ? "No expiration" : `EXPIRE ${ttl.value}${ttl.unit}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            disabled={ttl.unit === "never"}
            value={ttl.unit === "never" ? "" : ttl.value}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              updateData({
                ttl: { value: isNaN(val) ? 0 : val, unit: ttl.unit === "never" ? "s" : ttl.unit },
              });
            }}
            className="h-8 text-xs font-mono w-28 text-right bg-background"
          />
          <Select
            value={ttl.unit}
            onValueChange={(unit) => {
              if (isRedisDurationUnit(unit)) {
                updateData({
                  ttl: { value: ttl.value || 3600, unit },
                });
              }
            }}
          >
            <SelectTrigger className="h-8 w-28 text-xs font-mono bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="s">Seconds (s)</SelectItem>
              <SelectItem value="m">Minutes (m)</SelectItem>
              <SelectItem value="h">Hours (h)</SelectItem>
              <SelectItem value="d">Days (d)</SelectItem>
              <SelectItem value="never">Never (Persistent)</SelectItem>
            </SelectContent>
          </Select>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1 flex-wrap flex-1 justify-end">
            {TTL_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => updateData({ ttl: p.duration })}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-mono transition-all border",
                  ttl.value === p.duration.value && ttl.unit === p.duration.unit
                    ? "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/50 font-bold"
                    : "bg-background/60 text-muted-foreground border-border/40 hover:bg-secondary hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cache Strategy */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/30">
        <div className="flex flex-col">
          <Label className="text-xs font-semibold">Cache Strategy</Label>
          <span className="text-[10px] text-muted-foreground">Access & invalidation pattern</span>
        </div>
        <Select
          value={strategy}
          onValueChange={(val) => {
            if (isCacheStrategy(val)) {
              updateData({ cacheStrategy: val });
            }
          }}
        >
          <SelectTrigger className="w-[180px] h-8 text-xs font-semibold bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Cache Aside" className="text-xs">Cache Aside (Lazy Load)</SelectItem>
            <SelectItem value="Read Through" className="text-xs">Read Through</SelectItem>
            <SelectItem value="Write Through" className="text-xs">Write Through</SelectItem>
            <SelectItem value="Write Behind" className="text-xs">Write Behind (Async)</SelectItem>
            <SelectItem value="Refresh Ahead" className="text-xs">Refresh Ahead</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Negative Caching Toggle & Shorter TTL */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/40">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
            <ShieldAlert size={14} className="text-amber-500" />
            <span>Negative Caching (Cache 404 / Missing Records)</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Stores a sentinel value for null lookups to prevent cache penetration & database stampedes.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {negativeCaching.enabled && (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                value={negativeCaching.ttl?.value || 60}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  updateData({
                    negativeCaching: {
                      enabled: true,
                      ttl: { value: isNaN(val) ? 60 : val, unit: "s" },
                    },
                  });
                }}
                className="h-6 w-16 text-[11px] font-mono text-right bg-background"
              />
              <span className="text-[10px] text-muted-foreground font-mono">s</span>
            </div>
          )}
          <Switch
            checked={negativeCaching.enabled}
            onCheckedChange={(checked) =>
              updateData({
                negativeCaching: {
                  enabled: checked,
                  ttl: negativeCaching.ttl || { value: 60, unit: "s" },
                },
              })
            }
            className="scale-90"
          />
        </div>
      </div>

      {/* Stale-While-Revalidate (SWR) Toggle & Refresh Interval */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/40">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
            <RotateCw size={14} className="text-emerald-500" />
            <span>Stale-While-Revalidate (SWR Background Refresh)</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Serves stale cached data immediately while revalidating in the background.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {staleWhileRevalidate.enabled && (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                value={staleWhileRevalidate.refreshInterval?.value || 300}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  updateData({
                    staleWhileRevalidate: {
                      enabled: true,
                      refreshInterval: { value: isNaN(val) ? 300 : val, unit: "s" },
                    },
                  });
                }}
                className="h-6 w-16 text-[11px] font-mono text-right bg-background"
              />
              <span className="text-[10px] text-muted-foreground font-mono">s</span>
            </div>
          )}
          <Switch
            checked={staleWhileRevalidate.enabled}
            onCheckedChange={(checked) =>
              updateData({
                staleWhileRevalidate: {
                  enabled: checked,
                  refreshInterval: staleWhileRevalidate.refreshInterval || { value: 300, unit: "s" },
                },
              })
            }
            className="scale-90"
          />
        </div>
      </div>

      {/* Source of Truth Table Linkage */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-border/30">
        <Label className="text-xs font-semibold">Source of Truth (Underlying Database Entity)</Label>
        <Combobox
          value={sourceOfTruth?.tableName || ""}
          onValueChange={(val) => {
            const matchedNode = tableNodes.find((t) => t.data?.label === val);
            updateData({
              sourceOfTruth: {
                tableNodeId: matchedNode?.id,
                tableName: val || undefined,
              },
            });
          }}
        >
          <ComboboxInput
            placeholder="e.g. users or products"
            className="text-xs w-full bg-background"
          />
          <ComboboxContent>
            <ComboboxList>
              <ComboboxEmpty>No relational tables found on canvas.</ComboboxEmpty>
              {tableNodes.map((t) => (
                <ComboboxItem key={t.id} value={t.data?.label || "Table"}>
                  {t.data?.label || "Table"} ({t.data?.dbEngine || "sqlite"})
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      {/* Invalidation Rules */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-semibold">Invalidation Trigger Rules</Label>
        <Input
          value={invalidationRules || ""}
          onChange={(e) => updateData({ invalidationRules: e.target.value })}
          placeholder="e.g. On User.update or Session.logout"
          className="h-8 text-xs bg-background"
        />
      </div>

      {/* Conditional Serialization & Compression (only for string, hash, list, set, zset) */}
      {(structure === "string" ||
        structure === "hash" ||
        structure === "list" ||
        structure === "set" ||
        structure === "zset") && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Serialization Format</Label>
            <Select
              value={serialization || "JSON"}
              onValueChange={(val) => {
                if (isSerializationFormat(val)) {
                  updateData({ serialization: val });
                }
              }}
            >
              <SelectTrigger className="h-7 text-xs font-mono bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="JSON">JSON</SelectItem>
                <SelectItem value="MessagePack">MessagePack</SelectItem>
                <SelectItem value="ProtoBuf">ProtoBuf</SelectItem>
                <SelectItem value="String">String (Raw)</SelectItem>
                <SelectItem value="Binary">Binary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Compression</Label>
            <Select
              value={compression || "None"}
              onValueChange={(val) => {
                if (isCompressionFormat(val)) {
                  updateData({ compression: val });
                }
              }}
            >
              <SelectTrigger className="h-7 text-xs font-mono bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="None">None</SelectItem>
                <SelectItem value="gzip">gzip</SelectItem>
                <SelectItem value="brotli">brotli</SelectItem>
                <SelectItem value="lz4">lz4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
};

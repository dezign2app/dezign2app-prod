import React from "react";
import { BackendNode, RedisDataStructure } from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  DatabaseZap,
  Key,
  Layers,
  Sparkles,
  Clock,
  Radio,
  MapPin,
  ListOrdered,
  List,
  Binary,
  Share2,
} from "lucide-react";

export interface RedisConfigProps {
  id: string;
  data: BackendNode["data"];
  updateNode: (id: string, changes: Partial<BackendNode>) => void;
}

export const REDIS_DATA_STRUCTURE_OPTIONS: Array<{
  value: RedisDataStructure;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  desc: string;
}> = [
  { value: "hash", label: "Hash", icon: Layers, desc: "Field-value mapping (HSET, HGET)" },
  { value: "string", label: "String / Counter", icon: DatabaseZap, desc: "Raw string, number or binary" },
  { value: "json", label: "RedisJSON", icon: Sparkles, desc: "Native nested JSON document" },
  { value: "set", label: "Set", icon: Share2, desc: "Unordered collection of unique strings" },
  { value: "list", label: "List", icon: List, desc: "Ordered collection of strings (LPUSH/RPUSH)" },
  { value: "zset", label: "Sorted Set (ZSet)", icon: ListOrdered, desc: "Ranked collection by score (ZADD)" },
  { value: "geo", label: "Geospatial (GEO)", icon: MapPin, desc: "Longitude & latitude points" },
  { value: "stream", label: "Stream", icon: Radio, desc: "Append-only log with consumer groups" },
  { value: "bitfield", label: "Bitfield", icon: Binary, desc: "Packed subfields with bit offsets" },
  { value: "bitmap", label: "Bitmap", icon: Binary, desc: "Boolean bit array flags" },
  { value: "hyperloglog", label: "HyperLogLog", icon: DatabaseZap, desc: "Probabilistic cardinality estimation" },
];

/**
 * Extracts `{var}` parameter names from key template string
 */
export function extractKeyTemplateParams(template: string): string[] {
  const matches = template.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map((m) => m.replace(/[{}]/g, "").trim()).filter(Boolean);
}

/**
 * Auto-derives wildcard pattern (e.g. user:*:profile) from keyTemplate
 */
export function deriveKeyPattern(template: string): string {
  if (!template) return "*";
  return template.replace(/\{[^}]+\}/g, "*");
}

/**
 * Auto-derives namespace prefix from keyTemplate (before first parameter or colon)
 */
export function deriveNamespace(template: string): string {
  if (!template) return "default";
  const colonIdx = template.indexOf(":");
  const braceIdx = template.indexOf("{");
  if (colonIdx !== -1 && (braceIdx === -1 || colonIdx < braceIdx)) {
    return template.slice(0, colonIdx);
  }
  if (braceIdx !== -1) {
    return template.slice(0, braceIdx).replace(/[:_.-]+$/, "") || "default";
  }
  return template;
}

export const RedisConfig: React.FC<RedisConfigProps> = ({
  id,
  data,
  updateNode,
}) => {
  const structure: RedisDataStructure = data.redisDataStructure || "hash";
  const template = data.keyTemplate ?? "";
  const clusterTagParam = data.clusterHashTagParam;

  const keyPattern = deriveKeyPattern(template);
  const params = extractKeyTemplateParams(template);
  const ttl = data.ttl || { value: 3600, unit: "s" };
  const strategy = data.cacheStrategy || "Cache Aside";

  const handleTemplateChange = (val: string) => {
    const newParams = extractKeyTemplateParams(val);
    const newClusterTag =
      clusterTagParam && newParams.includes(clusterTagParam)
        ? clusterTagParam
        : newParams[0] || undefined;

    updateNode(id, {
      data: {
        ...data,
        keyTemplate: val,
        clusterHashTagParam: newClusterTag,
      },
    });
  };

  const handleStructureChange = (val: RedisDataStructure) => {
    updateNode(id, {
      data: {
        ...data,
        redisDataStructure: val,
      },
    });
  };

  return (
    <div className="flex flex-col gap-2 p-2.5 bg-red-500/5 dark:bg-red-950/20 border-b border-red-500/20 nodrag">
      {/* Key Template Input & Auto-Pattern Display */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
            <Key size={10} /> Key Template
          </span>
          <code
            className="text-[9px] font-mono px-1 py-0.5 rounded bg-background/80 text-muted-foreground border border-border/40"
            title="Auto-derived wildcard pattern for SCAN / keyspace inspection"
          >
            Pattern: {keyPattern}
          </code>
        </div>
        <Input
          className="h-6 text-xs font-mono bg-background border-red-500/30 focus-visible:ring-red-500/40"
          placeholder="e.g. user:{id}:profile"
          value={template}
          onChange={(e) => handleTemplateChange(e.target.value)}
        />
        {/* Cluster Hash Tag Badge & Variable Chips */}
        {params.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap pt-0.5">
            <span className="text-[9px] text-muted-foreground">Variables:</span>
            {params.map((param) => {
              const isClusterTag = clusterTagParam === param;
              return (
                <Badge
                  key={param}
                  variant="outline"
                  className={`text-[9px] px-1 py-0 font-mono cursor-pointer transition-colors ${
                    isClusterTag
                      ? "bg-red-500/20 border-red-500/50 text-red-600 dark:text-red-400 font-bold"
                      : "bg-background/60 text-muted-foreground border-border/40 hover:border-red-500/40"
                  }`}
                  title={
                    isClusterTag
                      ? "Redis Cluster Hash Tag (forces shard co-location)"
                      : "Click to set as Cluster Hash Tag"
                  }
                  onClick={() =>
                    updateNode(id, {
                      data: {
                        ...data,
                        clusterHashTagParam: isClusterTag ? undefined : param,
                      },
                    })
                  }
                >
                  {isClusterTag ? `{${param}} ⚡` : param}
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      {/* Redis Data Structure Selector */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-red-500/15">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Layers size={10} className="text-red-500" /> Structure
        </span>
        <Select
          value={structure}
          onValueChange={(val: RedisDataStructure) => handleStructureChange(val)}
        >
          <SelectTrigger className="h-6 text-xs w-[140px] font-semibold bg-background border-red-500/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REDIS_DATA_STRUCTURE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <Icon size={12} className="text-red-500 shrink-0" />
                    <span>{opt.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Structure-Specific Inline Info Summaries */}
      {structure === "geo" && (
        <div className="p-1.5 rounded bg-background/60 border border-border/40 text-[10px] flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin size={10} className="text-red-500" />
            Coordinates:
          </span>
          <span className="font-mono text-foreground font-semibold">
            {data.geoConfig?.longitudeField || "lon"}, {data.geoConfig?.latitudeField || "lat"} (
            {data.geoConfig?.distanceUnit || "km"})
          </span>
        </div>
      )}

      {structure === "stream" && (
        <div className="p-1.5 rounded bg-background/60 border border-border/40 text-[10px] flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1">
            <Radio size={10} className="text-red-500" />
            Consumer Groups:
          </span>
          <span className="font-mono text-foreground font-semibold">
            {(data.streamConfig?.consumerGroups || []).length} groups
          </span>
        </div>
      )}

      {structure === "bitfield" && (
        <div className="p-1.5 rounded bg-background/60 border border-border/40 text-[10px] flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1">
            <Binary size={10} className="text-red-500" />
            Subfields:
          </span>
          <span className="font-mono text-foreground font-semibold">
            {(data.bitfieldConfig?.fields || []).length} packed
          </span>
        </div>
      )}

      {structure === "zset" && (
        <div className="p-1.5 rounded bg-background/60 border border-border/40 text-[10px] flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1">
            <ListOrdered size={10} className="text-red-500" />
            Score Type:
          </span>
          <span className="font-mono text-foreground font-semibold">
            {data.zsetConfig?.scoreType || "timestamp"} ({data.zsetConfig?.sortOrder || "asc"})
          </span>
        </div>
      )}

      {/* Caching Badges Strip (TTL, Strategy, Negative Caching, SWR) */}
      <div className="flex items-center gap-1 flex-wrap pt-1 text-[9px] text-muted-foreground">
        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-background/80 border border-border/40 font-mono">
          <Clock size={9} className="text-red-500" />
          <span>
            {ttl.unit === "never" ? "No TTL" : `${ttl.value}${ttl.unit}`}
          </span>
        </div>

        <div className="px-1.5 py-0.5 rounded bg-background/80 border border-border/40 font-mono">
          {strategy}
        </div>

        {data.negativeCaching?.enabled && (
          <div
            className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-mono font-semibold"
            title="Negative Caching: caches not-found results"
          >
            404: {data.negativeCaching.ttl?.value || 60}
            {data.negativeCaching.ttl?.unit || "s"}
          </div>
        )}

        {data.staleWhileRevalidate?.enabled && (
          <div
            className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-mono font-semibold"
            title="Stale-While-Revalidate background refresh enabled"
          >
            SWR: {data.staleWhileRevalidate.refreshInterval?.value || 300}
            {data.staleWhileRevalidate.refreshInterval?.unit || "s"}
          </div>
        )}
      </div>
    </div>
  );
};

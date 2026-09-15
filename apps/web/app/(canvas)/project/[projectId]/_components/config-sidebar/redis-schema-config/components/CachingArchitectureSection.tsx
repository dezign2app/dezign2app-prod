import React from "react";
import { Clock } from "lucide-react";
import {
  RedisDataStructure,
  RedisDuration,
  isRedisDurationUnit,
  isSerializationFormat,
  isCompressionFormat,
} from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";
import { TTL_PRESETS } from "../constants";

interface CachingArchitectureSectionProps {
  structure: RedisDataStructure;
  ttl: RedisDuration;
  serialization?: string;
  compression?: string;
  updateData: (changes: Record<string, any>) => void;
}

export const CachingArchitectureSection: React.FC<CachingArchitectureSectionProps> = ({
  structure,
  ttl,
  serialization,
  compression,
  updateData,
}) => {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
        <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={14} className="text-amber-500" /> TTL & Expiration Policies
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
                    ? "bg-primary/20 text-primary border-primary/50 font-bold"
                    : "bg-background/60 text-muted-foreground border-border/40 hover:bg-secondary hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
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

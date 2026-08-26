import React from "react";
import { Binary, Plus, Trash2 } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";

interface BitmapStructureConfigProps {
  bitmapConfig?: BackendNode["data"]["bitmapConfig"];
  updateData: (changes: Partial<BackendNode["data"]>) => void;
}

export const BitmapStructureConfig: React.FC<BitmapStructureConfigProps> = ({
  bitmapConfig,
  updateData,
}) => {
  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
          <Binary size={12} className="text-red-500" /> Bitmap Flags & Offsets (SETBIT / GETBIT / BITCOUNT)
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => {
            const currentBits = bitmapConfig?.bitDescriptions || [];
            const nextOffset =
              currentBits.length > 0
                ? Math.max(...currentBits.map((b) => b.offset)) + 1
                : 0;
            const newBit = {
              offset: nextOffset,
              name: `flag_${currentBits.length + 1}`,
              description: "Boolean feature flag",
            };
            updateData({
              bitmapConfig: { bitDescriptions: [...currentBits, newBit] },
            });
          }}
        >
          <Plus size={12} /> Add Bit Offset
        </Button>
      </div>
      {!bitmapConfig?.bitDescriptions || bitmapConfig.bitDescriptions.length === 0 ? (
        <div className="p-3 text-xs text-muted-foreground italic text-center border border-dashed border-border/60 rounded-lg">
          No bit offset flags defined. Click &quot;Add Bit Offset&quot; to map individual bit positions.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {bitmapConfig.bitDescriptions.map((b, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 p-2 rounded bg-background/80 border border-border/40 text-xs"
            >
              <div className="flex items-center gap-1 w-24 shrink-0">
                <span className="text-[10px] text-muted-foreground">Bit:</span>
                <Input
                  type="number"
                  min={0}
                  value={b.offset}
                  onChange={(e) => {
                    const updated = [...(bitmapConfig?.bitDescriptions || [])];
                    updated[idx] = {
                      ...updated[idx]!,
                      offset: parseInt(e.target.value) || 0,
                    };
                    updateData({ bitmapConfig: { bitDescriptions: updated } });
                  }}
                  className="h-7 text-xs font-mono w-14"
                />
              </div>
              <Input
                value={b.name}
                placeholder="flag name"
                onChange={(e) => {
                  const updated = [...(bitmapConfig?.bitDescriptions || [])];
                  updated[idx] = { ...updated[idx]!, name: e.target.value };
                  updateData({ bitmapConfig: { bitDescriptions: updated } });
                }}
                className="h-7 text-xs font-mono flex-1"
              />
              <Input
                value={b.description || ""}
                placeholder="description..."
                onChange={(e) => {
                  const updated = [...(bitmapConfig?.bitDescriptions || [])];
                  updated[idx] = { ...updated[idx]!, description: e.target.value };
                  updateData({ bitmapConfig: { bitDescriptions: updated } });
                }}
                className="h-7 text-xs flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => {
                  const updated =
                    bitmapConfig?.bitDescriptions?.filter((_, i) => i !== idx) || [];
                  updateData({ bitmapConfig: { bitDescriptions: updated } });
                }}
              >
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

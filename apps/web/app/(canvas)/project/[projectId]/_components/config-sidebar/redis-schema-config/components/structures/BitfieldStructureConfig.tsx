import React from "react";
import { Binary, Plus, Trash } from "lucide-react";
import { BackendNode, RedisBitfieldSubfield, isBitfieldOverflow } from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

interface BitfieldStructureConfigProps {
  bitfieldConfig?: BackendNode["data"]["bitfieldConfig"];
  updateData: (changes: Partial<BackendNode["data"]>) => void;
}

export const BitfieldStructureConfig: React.FC<BitfieldStructureConfigProps> = ({
  bitfieldConfig,
  updateData,
}) => {
  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
          <Binary size={12} className="text-red-500" /> Bitfield Subfields (BITFIELD GET/SET/INCRBY)
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => {
            const currentFields = bitfieldConfig?.fields || [];
            const newField: RedisBitfieldSubfield = {
              name: `counter_${currentFields.length + 1}`,
              type: "u",
              bits: 8,
              offset: currentFields.reduce((sum, f) => sum + f.bits, 0),
              overflow: "WRAP",
            };
            updateData({
              bitfieldConfig: { fields: [...currentFields, newField] },
            });
          }}
        >
          <Plus size={12} /> Add Subfield
        </Button>
      </div>

      {!bitfieldConfig?.fields || bitfieldConfig.fields.length === 0 ? (
        <div className="p-3 text-xs text-muted-foreground italic text-center border border-dashed border-border/60 rounded-lg">
          No packed bitfield subfields defined.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {bitfieldConfig.fields.map((f, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 rounded bg-background/80 border border-border/40">
              <Input
                value={f.name}
                placeholder="name"
                onChange={(e) => {
                  const updated = [...(bitfieldConfig?.fields || [])];
                  updated[idx] = { ...updated[idx]!, name: e.target.value };
                  updateData({ bitfieldConfig: { fields: updated } });
                }}
                className="h-7 text-xs font-mono flex-1"
              />
              <Select
                value={`${f.type}${f.bits}`}
                onValueChange={(val) => {
                  const type = val.startsWith("u") ? "u" : "i";
                  const bits = parseInt(val.slice(1)) || 8;
                  const updated = [...(bitfieldConfig?.fields || [])];
                  updated[idx] = { ...updated[idx]!, type, bits };
                  updateData({ bitfieldConfig: { fields: updated } });
                }}
              >
                <SelectTrigger className="h-7 w-20 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="u4">u4 (4-bit)</SelectItem>
                  <SelectItem value="u8">u8 (byte)</SelectItem>
                  <SelectItem value="u16">u16</SelectItem>
                  <SelectItem value="u32">u32</SelectItem>
                  <SelectItem value="i8">i8 (signed)</SelectItem>
                  <SelectItem value="i16">i16</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={f.overflow || "WRAP"}
                onValueChange={(val) => {
                  if (isBitfieldOverflow(val)) {
                    const updated = [...(bitfieldConfig?.fields || [])];
                    updated[idx] = { ...updated[idx]!, overflow: val };
                    updateData({ bitfieldConfig: { fields: updated } });
                  }
                }}
              >
                <SelectTrigger className="h-7 w-24 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WRAP">WRAP</SelectItem>
                  <SelectItem value="SAT">SAT (Saturate)</SelectItem>
                  <SelectItem value="FAIL">FAIL</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => {
                  const updated = bitfieldConfig?.fields?.filter((_, i) => i !== idx) || [];
                  updateData({ bitfieldConfig: { fields: updated } });
                }}
              >
                <Trash size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

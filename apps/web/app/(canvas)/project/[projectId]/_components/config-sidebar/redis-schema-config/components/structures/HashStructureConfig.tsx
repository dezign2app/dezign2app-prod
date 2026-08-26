import React from "react";
import { Plus, Trash2, Clock } from "lucide-react";
import { BackendNode, RedisHashField, isRedisHashFieldType } from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { syncColumnsFromFields } from "../../constants";

interface HashStructureConfigProps {
  hashFields: RedisHashField[];
  updateData: (changes: Partial<BackendNode["data"]>) => void;
}

export const HashStructureConfig: React.FC<HashStructureConfigProps> = ({
  hashFields,
  updateData,
}) => {
  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">
            Hash Fields Schema ({hashFields.length})
          </span>
          <span className="text-[10px] text-muted-foreground">
            Define field names, data types, defaults, and optional Redis 7.4+ field-level TTLs (HEXPIRE).
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => {
            const newField: RedisHashField = {
              name: `field_${hashFields.length + 1}`,
              type: "string",
              required: false,
            };
            const nextFields = [...hashFields, newField];
            updateData({
              hashConfig: { fields: nextFields },
              columns: syncColumnsFromFields(nextFields),
            });
          }}
        >
          <Plus size={12} /> Add Field
        </Button>
      </div>

      {hashFields.length === 0 ? (
        <div className="p-3 text-xs text-muted-foreground italic text-center border border-dashed border-border/60 rounded-lg">
          No hash fields defined. Click &quot;Add Field&quot; above to specify fields.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {hashFields.map((f, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-lg border border-border/50 bg-background/80 flex flex-col gap-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <Input
                  value={f.name}
                  placeholder="field name"
                  onChange={(e) => {
                    const updated = [...hashFields];
                    updated[idx] = { ...updated[idx]!, name: e.target.value };
                    updateData({
                      hashConfig: { fields: updated },
                      columns: syncColumnsFromFields(updated),
                    });
                  }}
                  className="h-7 text-xs font-mono flex-1"
                />
                <Select
                  value={f.type}
                  onValueChange={(val) => {
                    if (isRedisHashFieldType(val)) {
                      const updated = [...hashFields];
                      updated[idx] = { ...updated[idx]!, type: val };
                      updateData({
                        hashConfig: { fields: updated },
                        columns: syncColumnsFromFields(updated),
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-7 w-28 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">string</SelectItem>
                    <SelectItem value="number">number</SelectItem>
                    <SelectItem value="boolean">boolean</SelectItem>
                    <SelectItem value="json">json</SelectItem>
                    <SelectItem value="datetime">datetime</SelectItem>
                    <SelectItem value="binary">binary</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => {
                    const updated = hashFields.filter((_, i) => i !== idx);
                    updateData({
                      hashConfig: { fields: updated },
                      columns: syncColumnsFromFields(updated),
                    });
                  }}
                >
                  <Trash2 size={12} />
                </Button>
              </div>

              {/* Field TTL & Description row */}
              <div className="flex items-center gap-2 text-[11px]">
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <Input
                    placeholder="Optional field description..."
                    value={f.description || ""}
                    onChange={(e) => {
                      const updated = [...hashFields];
                      updated[idx] = { ...updated[idx]!, description: e.target.value };
                      updateData({ hashConfig: { fields: updated } });
                    }}
                    className="h-6 text-[11px] bg-background/60"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Clock size={11} className="text-red-500" />
                  <span className="text-[10px] text-muted-foreground">Field TTL:</span>
                  <Input
                    type="number"
                    placeholder="inherit"
                    value={f.ttl?.value ?? ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      const updated = [...hashFields];
                      updated[idx] = {
                        ...updated[idx]!,
                        ttl: isNaN(val) ? undefined : { value: val, unit: "s" },
                      };
                      updateData({ hashConfig: { fields: updated } });
                    }}
                    className="h-6 w-16 text-[11px] font-mono text-right"
                  />
                  <span className="text-[10px] text-muted-foreground">s</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

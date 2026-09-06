import React from "react";
import { Plus, Trash } from "lucide-react";
import { DbOperationFunction } from "@workspace/canvas/types";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { TypeCombobox } from "../TypeCombobox";

interface FunctionParamsSectionProps {
  selectedOp: DbOperationFunction;
  updateSelectedOp: (changes: Partial<DbOperationFunction>) => void;
  handleTogglePagination: (enabled: boolean) => void;
  handleChangePaginationMode: (mode: "offset" | "cursor") => void;
}

export const FunctionParamsSection: React.FC<FunctionParamsSectionProps> = ({
  selectedOp,
  updateSelectedOp,
  handleTogglePagination,
  handleChangePaginationMode,
}) => {
  const isPaginated = selectedOp.pagination?.enabled ?? false;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-4 shadow-sm">
      {/* Card Header with Parameters Count, Pagination Switch, and Add Parameter button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Function Input Parameters ({selectedOp.params?.length || 0})
          </span>
          <div className="flex items-center gap-1.5 border-l border-border/40 pl-3">
            <Switch
              id="pagination-toggle"
              checked={isPaginated}
              onCheckedChange={handleTogglePagination}
              className="scale-90"
            />
            <Label
              htmlFor="pagination-toggle"
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              Pagination
            </Label>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] gap-1 cursor-pointer"
          onClick={() => {
            const currentParams = selectedOp.params || [];
            updateSelectedOp({
              params: [
                ...currentParams,
                {
                  name: `param${currentParams.length + 1}`,
                  type: "string",
                  required: true,
                },
              ],
            });
          }}
        >
          <Plus size={12} /> Add Parameter
        </Button>
      </div>

      {/* Embedded Pagination Controls (when pagination is enabled) */}
      {isPaginated && (
        <div className="grid grid-cols-3 gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/30">
          <div className="flex flex-col gap-1">
            <Label className="text-[11px]">Default Limit</Label>
            <Input
              type="number"
              min={0}
              value={selectedOp.pagination?.defaultLimit ?? 20}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                updateSelectedOp({
                  pagination: {
                    ...selectedOp.pagination,
                    defaultLimit: isNaN(parsed) ? 0 : parsed,
                  },
                });
              }}
              className="h-7 text-xs font-mono bg-background/60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-[11px]">Max Limit</Label>
            <Input
              type="number"
              min={0}
              value={selectedOp.pagination?.maxLimit ?? 100}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                updateSelectedOp({
                  pagination: {
                    ...selectedOp.pagination,
                    maxLimit: isNaN(parsed) ? 0 : parsed,
                  },
                });
              }}
              className="h-7 text-xs font-mono bg-background/60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-[11px]">Pagination Mode</Label>
            <Select
              value={selectedOp.pagination?.mode || "offset"}
              onValueChange={handleChangePaginationMode}
            >
              <SelectTrigger className="h-7 text-xs font-mono bg-background/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="offset">Offset / Limit</SelectItem>
                <SelectItem value="cursor">Cursor Keys</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Parameter List */}
      {!selectedOp.params || selectedOp.params.length === 0 ? (
        <div className="text-xs text-muted-foreground italic py-2">
          No input parameters defined for this function.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {selectedOp.params.map((p, idx) => {
            const isPaginationParam =
              isPaginated &&
              (p.name === "limit" || p.name === "offset" || p.name === "cursor");

            return (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={p.name}
                  placeholder="name"
                  onChange={(e) => {
                    const updated = [...(selectedOp.params || [])];
                    updated[idx] = { ...updated[idx]!, name: e.target.value };
                    updateSelectedOp({ params: updated });
                  }}
                  className="h-7 text-xs font-mono flex-1"
                />
                <TypeCombobox
                  value={p.type || "string"}
                  onValueChange={(val) => {
                    const updated = [...(selectedOp.params || [])];
                    updated[idx] = { ...updated[idx]!, type: val };
                    updateSelectedOp({ params: updated });
                  }}
                  className="w-28"
                />

                {isPaginationParam ? (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/30 shrink-0">
                    PAGE
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                    onClick={() => {
                      const updated = selectedOp.params?.filter((_, i) => i !== idx);
                      updateSelectedOp({ params: updated });
                    }}
                  >
                    <Trash size={12} />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

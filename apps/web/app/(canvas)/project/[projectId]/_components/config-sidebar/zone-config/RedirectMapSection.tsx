import React from "react";
import { ArrowRight, Plus, ShieldAlert, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { PRESET_TRIGGER_OPTIONS } from "./constants";

interface RedirectMapSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  redirectEntries: [string, string][];
  onSelectPresetOrCustomRedirect: (val: string) => void;
  onDeleteRedirect: (key: string) => void;
  onUpdateRedirectKey: (oldKey: string, newKey: string) => void;
  onUpdateRedirectRoute: (key: string, route: string) => void;
}

export const RedirectMapSection = ({
  isOpen,
  onToggle,
  redirectEntries,
  onSelectPresetOrCustomRedirect,
  onDeleteRedirect,
  onUpdateRedirectKey,
  onUpdateRedirectRoute,
}: RedirectMapSectionProps) => {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <div
        onClick={onToggle}
        className="flex items-center justify-between cursor-pointer nodrag"
      >
        <div className="flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Redirect Map
          </span>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {redirectEntries.length} {redirectEntries.length === 1 ? "route" : "routes"}
          </span>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Select onValueChange={onSelectPresetOrCustomRedirect}>
            <SelectTrigger className="h-7 text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 font-medium">
              <div className="flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Route
              </div>
            </SelectTrigger>
            <SelectContent align="end" className="nodrag">
              {PRESET_TRIGGER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs font-mono">
                  {opt.label}
                </SelectItem>
              ))}
              <SelectItem value="custom_key" className="text-xs font-medium text-indigo-400">
                + Custom Trigger Key
              </SelectItem>
            </SelectContent>
          </Select>

          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="flex flex-col gap-4 pt-2 border-t border-border/50">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-300">
            <p className="font-semibold flex items-center gap-1 mb-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Evaluation Order Precedence:
            </p>
            <p className="text-[11px] font-mono opacity-90">
              auth → org → orgRole → access → plan → customClaim → customLogic
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {redirectEntries.map(([reasonKey, route]) => {
              const presetMatch = PRESET_TRIGGER_OPTIONS.find((p) => p.value === reasonKey);

              return (
                <div
                  key={reasonKey}
                  className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg bg-background border border-border/50"
                >
                  <div className="col-span-5 flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground font-mono uppercase">
                      Failure Trigger
                    </Label>
                    {presetMatch ? (
                      <span className="h-8 flex items-center px-2 text-xs font-mono font-medium rounded bg-muted/40 border border-border/40 text-foreground truncate" title={presetMatch.label}>
                        {presetMatch.label}
                      </span>
                    ) : (
                      <Input
                        className="h-8 text-xs font-mono bg-background/50"
                        value={reasonKey}
                        placeholder="custom-trigger"
                        onChange={(e) => onUpdateRedirectKey(reasonKey, e.target.value)}
                      />
                    )}
                  </div>

                  <div className="col-span-6 flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground font-mono uppercase">
                      Target Redirect Route
                    </Label>
                    <Input
                      className="h-8 text-xs font-mono bg-background/50"
                      value={route}
                      placeholder="/login"
                      onChange={(e) => onUpdateRedirectRoute(reasonKey, e.target.value)}
                    />
                  </div>

                  <div className="col-span-1 flex justify-end items-end pt-5">
                    <button
                      onClick={() => onDeleteRedirect(reasonKey)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                      title={`Delete ${reasonKey} redirect route`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

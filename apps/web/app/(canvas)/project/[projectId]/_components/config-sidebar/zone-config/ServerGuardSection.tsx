import React from "react";
import { ShieldAlert, ChevronDown, ChevronRight, Database, FunctionSquare, Key } from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import { ServerGuardConfig, ServerGuardCheckMode, ServerGuardParam } from "@workspace/canvas";
import { BackendNode } from "@/types/canvas";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";

interface ServerGuardSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  guard: ServerGuardConfig | undefined;
  allNodes: BackendNode[];
  onUpdateGuard: (guard: ServerGuardConfig) => void;
}

const DEFAULT_GUARD: ServerGuardConfig = {
  entityNodeId: "",
  checkMode: "dbFunction",
  param: "userId",
  requireSession: true,
  failRedirect: "/unauthorized",
};

export const ServerGuardSection = ({
  isOpen,
  onToggle,
  guard,
  allNodes,
  onUpdateGuard,
}: ServerGuardSectionProps) => {
  const cfg: ServerGuardConfig = guard ?? DEFAULT_GUARD;

  const entityNodes = allNodes.filter((n) => n.type === "entity");

  const selectedEntityNode = entityNodes.find((n) => n.id === cfg.entityNodeId);

  // Columns from the selected entity
  const entityColumns: { name: string; type: string }[] =
    selectedEntityNode?.data?.columns ?? [];

  // DB operation functions from the selected entity
  const dbOps = selectedEntityNode
    ? getEntityDbOperations({ data: selectedEntityNode.data }, allNodes).filter(
        (op) => op.enabled !== false,
      )
    : [];

  const update = (patch: Partial<ServerGuardConfig>) =>
    onUpdateGuard({ ...cfg, ...patch });

  const handleEntityChange = (entityNodeId: string) => {
    const node = entityNodes.find((n) => n.id === entityNodeId);
    update({
      entityNodeId,
      entityLabel: node?.data?.label ?? entityNodeId,
      // Reset dependent fields when entity changes
      dbFunctionId: undefined,
      dbFunctionName: undefined,
      entityField: undefined,
      entityFieldExpectedValue: undefined,
    });
  };

  const handleCheckModeChange = (checkMode: ServerGuardCheckMode) => {
    update({
      checkMode,
      dbFunctionId: undefined,
      dbFunctionName: undefined,
      entityField: undefined,
      entityFieldExpectedValue: undefined,
    });
  };

  const handleDbFunctionChange = (fnId: string) => {
    const fn = dbOps.find((op) => op.id === fnId);
    update({ dbFunctionId: fnId, dbFunctionName: fn?.name ?? fnId });
  };

  const isConfigured =
    !!cfg.entityNodeId &&
    (cfg.checkMode === "dbFunction" ? !!cfg.dbFunctionId : !!cfg.entityField);

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      {/* Header */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between cursor-pointer nodrag"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Server Guard
          </span>
          <span
            className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${
              isConfigured
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-muted/40 text-muted-foreground border-border/40"
            }`}
          >
            {isConfigured ? "DB Check" : "Not configured"}
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="flex flex-col gap-5 pt-2 border-t border-border/50">
          {/* Info callout */}
          <div className="flex gap-2 p-3 rounded-lg bg-amber-500/8 border border-amber-500/20 text-[11px] text-amber-300/80 leading-relaxed">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
            <span>
              Server Guard runs a real DB check in <code className="font-mono">layout.tsx</code> — no JWT or session claim required. Use this for API key validation, tenant lookups, or any runtime DB-based access rule.
            </span>
          </div>

          {/* Entity picker */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Entity to query
            </Label>
            <Select value={cfg.entityNodeId || "none"} onValueChange={handleEntityChange}>
              <SelectTrigger className="h-8 text-xs bg-background/50">
                <SelectValue placeholder="Select an entity…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs text-muted-foreground italic">
                  — None —
                </SelectItem>
                {entityNodes.map((n) => (
                  <SelectItem key={n.id} value={n.id} className="text-xs font-mono">
                    {n.data?.label ?? n.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {cfg.entityNodeId && cfg.entityNodeId !== "none" && (
            <>
              {/* Check mode toggle */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <FunctionSquare className="w-3.5 h-3.5" />
                  Check type
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: "dbFunction", label: "DB Function", desc: "Call an operation fn" },
                      { value: "columnValue", label: "Column Value", desc: "Compare a field" },
                    ] as { value: ServerGuardCheckMode; label: string; desc: string }[]
                  ).map(({ value, label, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleCheckModeChange(value)}
                      className={`flex flex-col items-start gap-0.5 p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                        cfg.checkMode === value
                          ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                          : "border-border/50 bg-muted/30 text-muted-foreground hover:border-border"
                      }`}
                    >
                      <span className="font-medium">{label}</span>
                      <span className="text-[10px] opacity-70">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* DB Function picker */}
              {cfg.checkMode === "dbFunction" && (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">DB Operation function</Label>
                  {dbOps.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground p-2 rounded bg-muted/30 border border-border/40">
                      No DB operations on this entity. Add them via the entity node's ⚙ DB Operations panel.
                    </div>
                  ) : (
                    <Select
                      value={cfg.dbFunctionId ?? "none"}
                      onValueChange={handleDbFunctionChange}
                    >
                      <SelectTrigger className="h-8 text-xs font-mono bg-background/50">
                        <SelectValue placeholder="Select function…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs text-muted-foreground italic">
                          — None —
                        </SelectItem>
                        {dbOps.map((op) => (
                          <SelectItem key={op.id} value={op.id} className="text-xs font-mono">
                            {op.name}
                            <span className="ml-1 text-[10px] text-muted-foreground opacity-60">
                              ({op.kind})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Column value picker */}
              {cfg.checkMode === "columnValue" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground">Column</Label>
                    <Select
                      value={cfg.entityField ?? "none"}
                      onValueChange={(v) => update({ entityField: v === "none" ? undefined : v })}
                    >
                      <SelectTrigger className="h-8 text-xs font-mono bg-background/50">
                        <SelectValue placeholder="Pick column…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs text-muted-foreground italic">
                          — None —
                        </SelectItem>
                        {entityColumns.map((col) => (
                          <SelectItem key={col.name} value={col.name} className="text-xs font-mono">
                            {col.name}
                            <span className="ml-1 text-[10px] text-muted-foreground opacity-60">
                              ({col.type})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground">Expected value</Label>
                    <Input
                      value={cfg.entityFieldExpectedValue ?? ""}
                      onChange={(e) => update({ entityFieldExpectedValue: e.target.value })}
                      placeholder='e.g. "true" or "active"'
                      className="h-8 text-xs font-mono bg-background/50"
                    />
                  </div>
                </div>
              )}

              {/* Param — what to pass in */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  Pass to guard as
                </Label>
                <Select
                  value={cfg.param}
                  onValueChange={(v) =>
                    update({ param: v as ServerGuardParam, headerName: undefined })
                  }
                >
                  <SelectTrigger className="h-8 text-xs bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel className="text-[10px] text-muted-foreground uppercase">
                        Session-based
                      </SelectLabel>
                      <SelectItem value="userId" className="text-xs font-mono">
                        session.user.id
                      </SelectItem>
                      <SelectItem value="sessionToken" className="text-xs font-mono">
                        session token (raw)
                      </SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="text-[10px] text-muted-foreground uppercase">
                        Request-based
                      </SelectLabel>
                      <SelectItem value="header" className="text-xs font-mono">
                        HTTP header value
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {/* Header name — shown only when param="header" */}
              {cfg.param === "header" && (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">Header name</Label>
                  <Input
                    value={cfg.headerName ?? ""}
                    onChange={(e) => update({ headerName: e.target.value })}
                    placeholder="e.g. x-api-key"
                    className="h-8 text-xs font-mono bg-background/50"
                  />
                </div>
              )}

              {/* Require session toggle */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-xs text-foreground font-medium">Require session</Label>
                  <span className="text-[11px] text-muted-foreground">
                    Redirect to login if no valid session exists (before the DB check).
                  </span>
                </div>
                <Switch
                  checked={cfg.requireSession !== false}
                  onCheckedChange={(v) => update({ requireSession: v })}
                />
              </div>

              {/* Fail redirect */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">Redirect on failure</Label>
                <Input
                  value={cfg.failRedirect}
                  onChange={(e) => update({ failRedirect: e.target.value })}
                  placeholder="/unauthorized"
                  className="h-8 text-xs font-mono bg-background/50"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

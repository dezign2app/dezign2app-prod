"use client";

import React, { useMemo } from "react";
import { BackendNode } from "@/types/canvas";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command";
import { Plus, X, Globe, Server, Check, ArrowRight, Code } from "lucide-react";
import { toPascalCase, toVarName } from "@/lib/compiler/utils";

interface TransformerDependenciesSectionProps {
  currentNodeId: string;
  allNodes: BackendNode[];
  importedTransformerIds: string[];
  onChangeImportedTransformerIds: (ids: string[]) => void;
  currentScope?: "global" | "local";
}

export const TransformerDependenciesSection: React.FC<TransformerDependenciesSectionProps> = ({
  currentNodeId,
  allNodes,
  importedTransformerIds,
  onChangeImportedTransformerIds,
  currentScope = "local",
}) => {
  const [open, setOpen] = React.useState(false);

  // Available transformers to import (all transformer nodes except current)
  const availableTransformers = useMemo(() => {
    return allNodes
      .filter((n) => n.type === "transformer" && n.id !== currentNodeId)
      .map((n) => {
        const d = n.data || {};
        const fnName = toVarName(d.functionName || d.label || "transformData");
        const scope = d.scope || "global";
        const isAsync = !!d.isAsync;

        // Find service name if local
        let serviceName: string | undefined;
        if (scope === "local" && d.targetServiceId) {
          const svc = allNodes.find((sn) => sn.id === d.targetServiceId);
          serviceName = svc?.data?.label || svc?.id;
        }

        const inputParamNames = (d.inputSchema || [])
          .map((f) => (typeof f.name === "string" ? f.name.trim() : ""))
          .filter((name) => name.length > 0);
        const inputTypeName = `${toPascalCase(fnName)}Input`;
        const outputTypeName = `${toPascalCase(fnName)}Output`;
        const inputSig =
          inputParamNames.length > 0
            ? `{ ${inputParamNames.join(", ")} }: ${inputTypeName}`
            : `input: ${inputTypeName}`;

        return {
          id: n.id,
          name: fnName,
          scope,
          serviceName,
          isAsync,
          inputSig,
          outputSig: outputTypeName,
          description: d.description,
        };
      });
  }, [allNodes, currentNodeId]);

  // Build map of transformer node ID -> importedTransformerIds for cycle detection
  const dependencyGraph = useMemo(() => {
    const graph = new Map<string, string[]>();
    allNodes.forEach((n) => {
      if (n.type === "transformer") {
        const rawDeps = n.data?.importedTransformerIds;
        const deps = Array.isArray(rawDeps)
          ? rawDeps.filter((id): id is string => typeof id === "string")
          : [];
        graph.set(n.id, deps);
      }
    });
    return graph;
  }, [allNodes]);

  // Checks whether targetId already depends on currentNodeId directly or indirectly (DFS)
  const wouldCauseCycle = React.useCallback(
    (targetCandidateId: string): boolean => {
      // If targetCandidate is currentNodeId, that's a direct self-reference
      if (targetCandidateId === currentNodeId) return true;

      // Check if targetCandidate transitively depends on currentNodeId
      const visited = new Set<string>();
      const queue = [targetCandidateId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === currentNodeId) return true;
        if (visited.has(current)) continue;
        visited.add(current);

        const currentDeps = dependencyGraph.get(current) || [];
        for (const depId of currentDeps) {
          if (!visited.has(depId)) {
            queue.push(depId);
          }
        }
      }
      return false;
    },
    [currentNodeId, dependencyGraph],
  );

  const selectedTransformers = useMemo(() => {
    const set = new Set(importedTransformerIds);
    return availableTransformers.filter((t) => set.has(t.id));
  }, [availableTransformers, importedTransformerIds]);

  const handleToggle = (id: string) => {
    if (importedTransformerIds.includes(id)) {
      onChangeImportedTransformerIds(importedTransformerIds.filter((item) => item !== id));
    } else {
      onChangeImportedTransformerIds([...importedTransformerIds, id]);
    }
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeImportedTransformerIds(importedTransformerIds.filter((item) => item !== id));
  };

  return (
    <div className="flex flex-col gap-2.5 p-3.5 bg-secondary/15 rounded-xl border border-border/60 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-semibold text-foreground tracking-tight">
              Imported Transformers / Helpers
            </Label>
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0 h-4 font-mono font-normal bg-purple-500/10 text-purple-400 border border-purple-500/20"
            >
              {selectedTransformers.length} imported
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Compose other reusable data transformers inside this function.
          </p>
        </div>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs gap-1 border-border/60 bg-background/80 hover:bg-secondary cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Import Transformer</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-80" align="end">
            <Command>
              <CommandInput placeholder="Search transformers..." className="h-8 text-xs font-mono" />
              <CommandList className="max-h-60">
                <CommandEmpty className="text-xs py-4 text-center text-muted-foreground">
                  No other transformers found.
                </CommandEmpty>
                <CommandGroup heading="Available Transformers">
                  {availableTransformers.map((t) => {
                    const isSelected = importedTransformerIds.includes(t.id);
                    const isCycle = wouldCauseCycle(t.id);
                    return (
                      <CommandItem
                        key={t.id}
                        value={`${t.name} ${t.serviceName || ""}`}
                        onSelect={() => handleToggle(t.id)}
                        className="flex items-center justify-between gap-2 text-xs py-1.5 cursor-pointer"
                      >
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-medium text-foreground truncate">
                              {t.name}
                            </span>
                            {t.scope === "global" ? (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 h-3.5 text-purple-400 border-purple-500/30 bg-purple-500/5 font-mono"
                              >
                                Global
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 h-3.5 text-sky-400 border-sky-500/30 bg-sky-500/5 font-mono"
                              >
                                {t.serviceName ? `Local: ${t.serviceName}` : "Local"}
                              </Badge>
                            )}
                            {isCycle && (
                              <Badge
                                variant="outline"
                                className="text-[8px] px-1 py-0 h-3.5 bg-amber-500/10 text-amber-400 border-amber-500/30 font-mono"
                                title="This creates a mutual reference between functions"
                              >
                                ⚠️ Circular
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono truncate">
                            {isCycle
                              ? "Mutual dependency — ensure terminating condition in logic"
                              : `${t.isAsync ? "async " : ""}(${t.inputSig}) : ${t.outputSig}`}
                          </span>
                        </div>
                        <div className="shrink-0">
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 text-purple-400" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-xs border border-border/60" />
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected chips list */}
      {selectedTransformers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedTransformers.map((t) => {
            const isCycle = wouldCauseCycle(t.id);
            return (
              <div
                key={t.id}
                className={`group flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-md bg-secondary/50 border text-xs font-mono transition-colors ${
                  isCycle
                    ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60"
                    : "border-border/60 hover:border-purple-500/40"
                }`}
              >
                <div className="flex items-center gap-1">
                  {t.scope === "global" ? (
                    <Globe className="w-3 h-3 text-purple-400 shrink-0" />
                  ) : (
                    <Server className="w-3 h-3 text-sky-400 shrink-0" />
                  )}
                  <span className="text-foreground font-semibold">{t.name}</span>
                </div>
                {isCycle ? (
                  <span className="text-[10px] text-amber-400/90 font-sans" title="Mutual circular dependency">
                    ⚠️ circular
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/80">
                    {t.scope === "global" ? "@workspace/transformers" : `./${t.name}`}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => handleRemove(t.id, e)}
                  className="ml-1 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
                  title="Remove dependency"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground/70 italic px-1">
          No other transformers imported. Click &ldquo;Import Transformer&rdquo; to add reusable helpers.
        </div>
      )}
    </div>
  );
};

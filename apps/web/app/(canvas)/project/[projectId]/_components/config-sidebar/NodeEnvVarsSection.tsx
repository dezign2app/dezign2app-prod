"use client";

import React, { useState, useCallback } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Check,
  ArrowRightFromLine,
  Info,
  ShieldAlert,
} from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import {
  cleanEnvVarName,
  saveLocalEnvVariable,
  getLocalEnvVariable,
} from "@/lib/utils/localEnvSync";
import { toast } from "sonner";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  getDetectedPackageEnvVars,
  DetectedEnvVar,
} from "@/lib/compiler/generators/generateEnvFile";

export interface EnvVarEntry {
  id: string;
  name: string;
  description?: string;
}

interface NodeEnvVarsSectionProps {
  /**
   * 'app'     — runnable node (service, worker, webApp).
   *             Standard env vars panel, shows detected package vars to import.
   * 'package' — shared library node (database, storage, auth, etc.).
   *             Shows an info banner explaining that these vars are available
   *             for connecting apps to import.
   */
  mode: "app" | "package";
  /** Human-readable label for the banner (e.g. "database", "storage"). Shown in the package info banner. */
  nodeKindLabel?: string;
  nodeId?: string;
  detectedEnvVars?: DetectedEnvVar[];
  envVars: EnvVarEntry[];
  onChange: (updated: EnvVarEntry[]) => void;
  projectId?: string;
  defaultEnvVars?: EnvVarEntry[];
  onLoadDefaults?: () => void;
}

/** Generate a simple unique id without external deps. */
function genId() {
  return Math.random().toString(36).slice(2, 10);
}

interface EnvVarRowProps {
  entry: EnvVarEntry;
  projectId?: string;
  onChangeName: (id: string, name: string) => void;
  onChangeDescription: (id: string, desc: string) => void;
  onRemove: (id: string) => void;
}

const EnvVarRow: React.FC<EnvVarRowProps> = ({
  entry,
  projectId,
  onChangeName,
  onChangeDescription,
  onRemove,
}) => {
  const [secretValue, setSecretValue] = useState<string>(() =>
    getLocalEnvVariable(entry.name),
  );
  const [showSecret, setShowSecret] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [localName, setLocalName] = useState(entry.name);

  const handleNameBlur = useCallback(() => {
    const clean = cleanEnvVarName(localName) || entry.name;
    setLocalName(clean);
    onChangeName(entry.id, clean);
  }, [localName, entry.id, entry.name, onChangeName]);

  const handleSaveSecret = useCallback(
    async (val: string) => {
      if (!localName) return;
      try {
        await saveLocalEnvVariable(localName, val, projectId);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      } catch {
        toast.error(`Failed to save ${localName} to local .env`);
      }
    },
    [localName, projectId],
  );

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/30 border border-border/40 group">
      {/* Row header */}
      <div className="flex items-center gap-2">
        <KeyRound size={11} className="text-primary shrink-0" />
        <div className="flex-1 grid grid-cols-2 gap-1.5">
          {/* Variable name */}
          <Input
            className="h-7 text-xs bg-background font-mono"
            placeholder="VAR_NAME"
            value={localName}
            onChange={(e) => setLocalName(cleanEnvVarName(e.target.value))}
            onBlur={handleNameBlur}
          />
          {/* Optional description */}
          <Input
            className="h-7 text-xs bg-background text-muted-foreground"
            placeholder="Description (optional)"
            value={entry.description ?? ""}
            onChange={(e) =>
              onChangeDescription(entry.id, e.target.value)
            }
          />
        </div>
        <button
          type="button"
          onClick={() => onRemove(entry.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5 rounded"
          title="Remove variable"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Secret value row */}
      <div className="flex items-center gap-1.5 pl-[19px]">
        <div className="relative flex-1">
          <Lock size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            type={showSecret ? "text" : "password"}
            className="h-6 text-[11px] bg-background font-mono pl-6 pr-7"
            placeholder="Secret value (local .env only)"
            value={secretValue}
            onChange={(e) => setSecretValue(e.target.value)}
            onBlur={(e) => handleSaveSecret(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
          >
            {showSecret ? <EyeOff size={10} /> : <Eye size={10} />}
          </button>
        </div>
        {isSaved && (
          <span className="text-[10px] text-emerald-500 flex items-center gap-0.5 shrink-0">
            <Check size={10} /> Saved
          </span>
        )}
      </div>

      {/* Env ref hint */}
      <p className="text-[10px] text-muted-foreground pl-[19px] font-mono">
        process.env.
        <span className="text-primary font-semibold">{localName || "VAR_NAME"}</span>
      </p>
    </div>
  );
};

/**
 * Reusable environment variables panel for canvas node config sidebars.
 *
 * - `mode="app"`:     Clean list with detected package env vars import panel (service / worker / webApp).
 * - `mode="package"`: Same UI + a top info banner explaining availability for apps
 *                     (database / storage / auth / queue / payments…).
 */
export const NodeEnvVarsSection: React.FC<NodeEnvVarsSectionProps> = ({
  mode,
  nodeKindLabel = "package",
  nodeId,
  detectedEnvVars,
  envVars,
  onChange,
  projectId,
  defaultEnvVars,
  onLoadDefaults,
}) => {
  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const allEdges = useBackendCanvasStore((s) => s.edges);
  const allEndpoints = useBackendCanvasStore((s) => s.endpoints);

  const targetNode = React.useMemo(() => {
    if (!nodeId) return undefined;
    return allNodes.find((n) => n.id === nodeId);
  }, [allNodes, nodeId]);

  const detected: DetectedEnvVar[] = React.useMemo(() => {
    if (detectedEnvVars) return detectedEnvVars;
    if (targetNode) {
      return getDetectedPackageEnvVars(targetNode, allNodes, allEdges, undefined, allEndpoints);
    }
    return [];
  }, [detectedEnvVars, targetNode, allNodes, allEdges, allEndpoints]);

  const handleImportVar = useCallback(
    (d: DetectedEnvVar) => {
      if (envVars.some((v) => v.name === d.name)) return;
      const newEntry: EnvVarEntry = {
        id: genId(),
        name: d.name,
        description: d.description || `Imported from ${d.sourceNodeLabel}`,
      };
      if (d.exampleValue && !d.exampleValue.startsWith("<")) {
        saveLocalEnvVariable(d.name, d.exampleValue, projectId).catch(() => {});
      }
      onChange([...envVars, newEntry]);
      toast.success(`Imported ${d.name}`);
    },
    [envVars, onChange, projectId],
  );

  const handleImportAll = useCallback(() => {
    const existing = new Set(envVars.map((v) => v.name));
    const toAdd: EnvVarEntry[] = detected
      .filter((d) => !existing.has(d.name))
      .map((d) => {
        if (d.exampleValue && !d.exampleValue.startsWith("<")) {
          saveLocalEnvVariable(d.name, d.exampleValue, projectId).catch(() => {});
        }
        return {
          id: genId(),
          name: d.name,
          description: d.description || `Imported from ${d.sourceNodeLabel}`,
        };
      });
    if (toAdd.length > 0) {
      onChange([...envVars, ...toAdd]);
      toast.success(
        `Imported ${toAdd.length} environment variable${toAdd.length === 1 ? "" : "s"}`,
      );
    }
  }, [detected, envVars, onChange, projectId]);

  const handleChangeName = useCallback(
    (id: string, name: string) => {
      onChange(envVars.map((v) => (v.id === id ? { ...v, name } : v)));
    },
    [envVars, onChange],
  );

  const handleChangeDescription = useCallback(
    (id: string, description: string) => {
      onChange(envVars.map((v) => (v.id === id ? { ...v, description } : v)));
    },
    [envVars, onChange],
  );

  const handleRemove = useCallback(
    (id: string) => {
      onChange(envVars.filter((v) => v.id !== id));
    },
    [envVars, onChange],
  );

  const handleAdd = useCallback(() => {
    onChange([...envVars, { id: genId(), name: "", description: "" }]);
  }, [envVars, onChange]);

  const handleLoadDefaults = useCallback(() => {
    if (onLoadDefaults) {
      onLoadDefaults();
    } else if (defaultEnvVars && defaultEnvVars.length > 0) {
      onChange(defaultEnvVars);
    }
  }, [onLoadDefaults, defaultEnvVars, onChange]);

  const hasDefaults = Boolean(onLoadDefaults || (defaultEnvVars && defaultEnvVars.length > 0));

  return (
    <div className="flex flex-col gap-3">
      {/* Package injection banner */}
      {mode === "package" && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-sky-500/8 border border-sky-500/25 text-sky-700 dark:text-sky-300">
          <Info size={13} className="mt-0.5 shrink-0 text-sky-500" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold flex items-center gap-1.5">
              Available for Connecting Apps
              <ArrowRightFromLine size={11} className="text-sky-500" />
            </span>
            <span className="text-[10px] opacity-85 leading-relaxed">
              These env vars are declared on this{" "}
              <span className="font-medium">{nodeKindLabel}</span> node.
              Connected applications can selectively import only the variables they require.
            </span>
          </div>
        </div>
      )}

      {/* Detected from Connected Packages (App Mode) */}
      {mode === "app" && detected.length > 0 && (
        <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/25">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <ShieldAlert size={14} className="shrink-0" />
              <span className="text-xs font-semibold">
                Detected from Connected Packages
              </span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono font-bold">
                {detected.length}
              </span>
            </div>
            {detected.some((d) => !envVars.some((v) => v.name === d.name)) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[10px] gap-1 px-2 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                onClick={handleImportAll}
              >
                <Plus size={11} />
                Import All
              </Button>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground leading-relaxed">
            The following variables were detected from connected storage, database, or backend packages.
            Import only the necessary variables to avoid leaking sensitive credentials to this app.
          </p>

          <div className="flex flex-col gap-1.5 mt-0.5">
            {detected.map((d) => {
              const isImported = envVars.some((v) => v.name === d.name);
              return (
                <div
                  key={`${d.sourceNodeId}-${d.name}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-background/80 border border-border/50 text-xs"
                >
                  <div className="flex flex-col gap-0.5 overflow-hidden min-w-0 mr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-foreground text-xs truncate">
                        {d.name}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono shrink-0">
                        {d.sourceNodeLabel}
                      </span>
                    </div>
                    {d.description && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {d.description}
                      </span>
                    )}
                  </div>

                  {isImported ? (
                    <span className="text-[10px] text-emerald-500 font-medium px-2 py-0.5 rounded bg-emerald-500/10 shrink-0 flex items-center gap-1">
                      <Check size={11} /> Imported
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] gap-1 px-2 text-primary border-primary/30 hover:bg-primary/10 shrink-0 cursor-pointer"
                      onClick={() => handleImportVar(d)}
                    >
                      <Plus size={10} /> Import
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1.5">
          <KeyRound size={12} className="text-primary" />
          Environment Variables
          {envVars.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-primary/15 text-primary font-mono font-semibold">
              {envVars.length}
            </span>
          )}
        </Label>
        <div className="flex items-center gap-1">
          {envVars.length === 0 && hasDefaults && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-[11px] gap-1 px-2 text-primary border-primary/30 hover:bg-primary/10"
              onClick={handleLoadDefaults}
            >
              <Plus size={11} />
              Load Defaults
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] gap-1 px-2 text-primary hover:bg-primary/10"
            onClick={handleAdd}
          >
            <Plus size={11} />
            Add Variable
          </Button>
        </div>
      </div>

      {/* Var rows */}
      {envVars.length === 0 ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-2 py-6 rounded-lg border border-dashed border-border/50 text-center bg-muted/10",
          )}
        >
          <KeyRound size={18} className="text-muted-foreground/40" />
          <p className="text-[11px] text-muted-foreground">
            No environment variables yet.
          </p>
          <div className="flex items-center gap-2 mt-1">
            {hasDefaults && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[10px] gap-1 px-2 text-primary border-primary/30 hover:bg-primary/10"
                onClick={handleLoadDefaults}
              >
                <Plus size={10} />
                Load Default Variables
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 px-2"
              onClick={handleAdd}
            >
              Add Custom
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {envVars.map((entry) => (
            <EnvVarRow
              key={entry.id}
              entry={entry}
              projectId={projectId}
              onChangeName={handleChangeName}
              onChangeDescription={handleChangeDescription}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
        Secret values are stored in your local{" "}
        <code className="bg-muted px-1 py-0.5 rounded font-mono">.env</code>{" "}
        file only &mdash; never saved to the database.
      </p>
    </div>
  );
};

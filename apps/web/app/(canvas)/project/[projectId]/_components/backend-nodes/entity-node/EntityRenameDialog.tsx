"use client";

import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import {
  AlertTriangle,
  Database,
  Layers,
  Loader2,
  ArrowRight,
  Check,
} from "lucide-react";
import { toPascalCase } from "@/lib/stores/backendCanvas/node/nodeEntitySync";

export interface EntityRenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "table" | "column";
  tableName: string;
  schema?: string;
  oldName: string;
  newName: string;
  dbEngine?: string;
  dbLabel?: string;
  hasLiveConnection: boolean;
  onConfirm: (renameLive: boolean) => Promise<void>;
}

export function EntityRenameDialog({
  open,
  onOpenChange,
  mode,
  tableName,
  schema,
  oldName,
  newName,
  dbEngine = "postgres",
  dbLabel = "Database",
  hasLiveConnection,
  onConfirm,
}: EntityRenameDialogProps): React.JSX.Element | null {
  const [renameLive, setRenameLive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const engineUpper = dbEngine.toUpperCase();
  const isTable = mode === "table";
  const oldPascal = toPascalCase(oldName);
  const newPascal = toPascalCase(newName);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(hasLiveConnection && renameLive);
      onOpenChange(false);
    } catch (err) {
      console.error("[EntityRenameDialog] Rename failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displaySchema = schema && schema !== "public" ? `"${schema}".` : "";
  const sqlCommand = isTable
    ? `ALTER TABLE ${displaySchema}"${oldName}" RENAME TO "${newName}";`
    : `ALTER TABLE ${displaySchema}"${tableName}" RENAME COLUMN "${oldName}" TO "${newName}";`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onClick={(e) => e.stopPropagation()}
        className="p-0 overflow-hidden rounded-2xl border border-zinc-800 bg-[#111216] text-zinc-100 shadow-2xl ring-1 ring-white/5 flex flex-col outline-none w-[92vw] max-w-[560px]"
      >
        <AlertDialogTitle className="sr-only">
          Rename {mode === "table" ? "Table" : "Column"}: {oldName} → {newName}
        </AlertDialogTitle>
        {/* Header Bar */}
        <div className="p-4 px-5 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>Rename {isTable ? "Table" : "Column"}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                  {engineUpper}
                </span>
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5 font-mono">
                <span className="text-zinc-300 font-medium">{oldName}</span>
                <ArrowRight className="w-3 h-3 text-zinc-500" />
                <span className="text-amber-300 font-medium">{newName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-3.5 bg-[#111216]">
          {/* Warning Banner */}
          <div className="p-3.5 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-zinc-900/40 to-black/40 flex flex-col gap-2.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-amber-200 block">
                  Live Database & Types Synchronization
                </span>
                <p className="text-[11px] text-zinc-300 mt-1 leading-relaxed">
                  {isTable ? (
                    <>
                      Renaming table <code className="text-amber-300 font-mono">"{oldName}"</code> to{" "}
                      <code className="text-amber-300 font-mono">"{newName}"</code> will execute an in-place table migration on your live database and synchronize the TypeScript model interface.
                    </>
                  ) : (
                    <>
                      Renaming column <code className="text-amber-300 font-mono">"{oldName}"</code> in table{" "}
                      <code className="text-zinc-200 font-mono">"{tableName}"</code> will execute a column migration on your live database and update the TypeScript type field.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Impact Details Grid */}
            <div className="grid grid-cols-1 gap-2 pt-1">
              {/* SQL Migration Preview */}
              <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1.5">
                  <Database className="w-3 h-3 text-amber-400" /> SQL Migration Execution
                </span>
                <code className="text-xs text-amber-300 font-mono bg-zinc-950 p-1.5 rounded border border-zinc-800/80 overflow-x-auto">
                  {sqlCommand}
                </code>
                <span className="text-[10px] text-zinc-500 mt-0.5">
                  Connected to: <span className="text-zinc-300">{dbLabel}</span> ({engineUpper})
                </span>
              </div>

              {/* Types Node Impact */}
              <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-sky-400" /> Types Node Sync
                </span>
                <div className="text-xs text-zinc-300 flex items-center gap-2 font-mono">
                  {isTable ? (
                    <>
                      <span className="text-zinc-400 line-through">interface {oldPascal}</span>
                      <ArrowRight className="w-3 h-3 text-zinc-500" />
                      <span className="text-sky-300 font-bold">interface {newPascal}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-zinc-400 line-through">{oldName}</span>
                      <ArrowRight className="w-3 h-3 text-zinc-500" />
                      <span className="text-sky-300 font-bold">{newName}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Checkbox for Live DB Migration */}
            {hasLiveConnection && (
              <div className="flex items-center gap-2 pt-2 border-t border-amber-500/20 mt-1">
                <input
                  type="checkbox"
                  id="renameLiveTableCheckbox"
                  checked={renameLive}
                  onChange={(e) => setRenameLive(e.target.checked)}
                  className="w-4 h-4 rounded border-amber-700 bg-zinc-950 text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                <label
                  htmlFor="renameLiveTableCheckbox"
                  className="text-xs font-medium text-zinc-200 cursor-pointer select-none"
                >
                  Also execute in-place migration on connected live database ({engineUpper})
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 px-4 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center justify-end gap-2 shrink-0">
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
            variant="secondary"
            className="h-8 px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/50 cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="h-8 px-3.5 text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                <span>Migrating & Renaming...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" />
                <span>Confirm & Rename</span>
              </>
            )}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

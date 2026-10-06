"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Package,
  Plus,
  Trash2,
  Edit2,
  Check,
  Copy,
  Code2,
  X,
  Library,
} from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";
import { toast } from "sonner";
import { NodeDependencyItem, TransformerPackageImport } from "@workspace/canvas";
import {
  formatPackageImportStatement,
  getPackageExportSuggestions,
  fetchDynamicPackageExports,
  PackageExportSuggestion,
} from "@/lib/utils/packageExportsRegistry";

interface TransformerPackageImportsSectionProps {
  currentNodeId: string;
  customDependencies: NodeDependencyItem[];
  packageImports: TransformerPackageImport[];
  onChangePackageImports: (imports: TransformerPackageImport[]) => void;
  onNavigateToPackagesTab?: () => void;
  onInsertCodeSnippet?: (snippet: string) => void;
}

export const TransformerPackageImportsSection: React.FC<
  TransformerPackageImportsSectionProps
> = ({
  currentNodeId,
  customDependencies = [],
  packageImports = [],
  onChangePackageImports,
  onNavigateToPackagesTab,
  onInsertCodeSnippet,
}) => {
  // Modal / Editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingImportId, setEditingImportId] = useState<string | null>(null);

  // Form draft state
  const [selectedPkgName, setSelectedPkgName] = useState<string>("");
  const [selectedNamedImports, setSelectedNamedImports] = useState<string[]>([]);
  const [defaultImportName, setDefaultImportName] = useState<string>("");
  const [customFunctionInput, setCustomFunctionInput] = useState<string>("");
  const [isTypeOnly, setIsTypeOnly] = useState<boolean>(false);
  const [isNamespace, setIsNamespace] = useState<boolean>(false);
  const [namespaceIdentifier, setNamespaceIdentifier] = useState<string>("");

  // Dynamic suggestion state for the selected package
  const [packageExports, setPackageExports] = useState<PackageExportSuggestion[]>([]);
  const [isLoadingExports, setIsLoadingExports] = useState(false);
  const [copiedImportId, setCopiedImportId] = useState<string | null>(null);

  // STRICTLY only NPM packages that are added / installed on this transformer (exclude @workspace/ packages)
  const availablePackages = useMemo(() => {
    return (customDependencies || [])
      .filter(
        (d) =>
          d.name &&
          d.name !== "@workspace/transformers" &&
          !d.name.startsWith("@workspace/"),
      )
      .map((d) => ({
        name: d.name,
        version: d.version,
        isDev: d.isDev,
      }));
  }, [customDependencies]);

  // Filter out any workspace packages from imports display
  const activePackageImports = useMemo(() => {
    return (packageImports || []).filter(
      (imp) =>
        imp.packageName &&
        imp.packageName !== "@workspace/transformers" &&
        !imp.packageName.startsWith("@workspace/"),
    );
  }, [packageImports]);

  // Total count of imported functions across all configured package imports
  const totalImportedFunctionsCount = useMemo(() => {
    return activePackageImports.reduce((acc, curr) => {
      let count = (curr.namedImports || []).length;
      if (curr.defaultImport) count += 1;
      if (curr.namespaceImport) count += 1;
      return acc + count;
    }, 0);
  }, [activePackageImports]);

  // Purge any lingering workspace packages (e.g. @workspace/transformers) from packageImports state
  useEffect(() => {
    if (
      packageImports &&
      packageImports.some(
        (imp) =>
          !imp.packageName ||
          imp.packageName === "@workspace/transformers" ||
          imp.packageName.startsWith("@workspace/"),
      )
    ) {
      const sanitized = packageImports.filter(
        (imp) =>
          imp.packageName &&
          imp.packageName !== "@workspace/transformers" &&
          !imp.packageName.startsWith("@workspace/"),
      );
      onChangePackageImports(sanitized);
    }
  }, [packageImports, onChangePackageImports]);

  // Load package exports when selected package changes
  useEffect(() => {
    if (!selectedPkgName) {
      setPackageExports([]);
      return;
    }

    // Load curated immediately
    const curated = getPackageExportSuggestions(selectedPkgName);
    setPackageExports(curated);

    // Then dynamically fetch extracted exports in the background
    setIsLoadingExports(true);
    fetchDynamicPackageExports(selectedPkgName)
      .then((dynamic) => {
        if (dynamic && dynamic.length > 0) {
          setPackageExports(dynamic);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoadingExports(false);
      });
  }, [selectedPkgName]);

  // Open editor for a new package import
  const handleOpenAdd = (presetPkg?: string) => {
    setEditingImportId(null);
    const initialPkg =
      presetPkg && availablePackages.some((p) => p.name === presetPkg)
        ? presetPkg
        : (availablePackages[0]?.name ?? "");
    setSelectedPkgName(initialPkg);
    setSelectedNamedImports([]);
    setDefaultImportName("");
    setCustomFunctionInput("");
    setIsTypeOnly(false);
    setIsNamespace(false);
    setNamespaceIdentifier("");
    setIsEditorOpen(true);
  };

  // Open editor to edit an existing package import
  const handleOpenEdit = (imp: TransformerPackageImport) => {
    setEditingImportId(imp.id);
    setSelectedPkgName(imp.packageName);
    setSelectedNamedImports([...(imp.namedImports || [])]);
    setDefaultImportName(imp.defaultImport || "");
    setCustomFunctionInput("");
    setIsTypeOnly(Boolean(imp.isTypeOnly));
    setIsNamespace(Boolean(imp.namespaceImport));
    setNamespaceIdentifier(
      imp.namespaceImport ? imp.namespaceImport.replace(/^\*\s+as\s+/, "") : "",
    );
    setIsEditorOpen(true);
  };

  // Toggle a named export badge
  const handleToggleNamedExport = (exportName: string) => {
    if (selectedNamedImports.includes(exportName)) {
      setSelectedNamedImports(selectedNamedImports.filter((n) => n !== exportName));
    } else {
      setSelectedNamedImports([...selectedNamedImports, exportName]);
    }
  };

  // Add custom function/symbol from input
  const handleAddCustomFunction = () => {
    const trimmed = customFunctionInput.trim();
    if (!trimmed) return;
    if (!selectedNamedImports.includes(trimmed)) {
      setSelectedNamedImports([...selectedNamedImports, trimmed]);
    }
    setCustomFunctionInput("");
  };

  // Save current import draft
  const handleSaveImport = () => {
    const cleanPkg = selectedPkgName.trim();
    if (!cleanPkg) {
      toast.error("Please select an installed package.");
      return;
    }

    const newImport: TransformerPackageImport = {
      id:
        editingImportId ||
        `pkg-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      packageName: cleanPkg,
      namedImports: selectedNamedImports.length > 0 ? selectedNamedImports : undefined,
      defaultImport: defaultImportName.trim() || undefined,
      namespaceImport: isNamespace ? namespaceIdentifier.trim() || "_" : undefined,
      isTypeOnly: isTypeOnly || undefined,
    };

    let updatedList: TransformerPackageImport[];
    if (editingImportId) {
      updatedList = activePackageImports.map((item) =>
        item.id === editingImportId ? newImport : item,
      );
    } else {
      const filtered = activePackageImports.filter((item) => item.packageName !== cleanPkg);
      updatedList = [...filtered, newImport];
    }

    onChangePackageImports(updatedList);
    setIsEditorOpen(false);
    toast.success(`Configured imports from "${cleanPkg}"!`);
  };

  // Delete an imported package entry
  const handleDeleteImport = (id: string, pkgName: string) => {
    const nextList = activePackageImports.filter((item) => item.id !== id);
    onChangePackageImports(nextList);
    toast.info(`Removed imports from ${pkgName}`);
  };

  // Remove a specific named function from an import item
  const handleRemoveSingleFunction = (impId: string, fnToRemove: string) => {
    const updated = activePackageImports
      .map((item) => {
        if (item.id !== impId) return item;
        const nextNamed = (item.namedImports || []).filter((fn) => fn !== fnToRemove);
        return {
          ...item,
          namedImports: nextNamed.length > 0 ? nextNamed : undefined,
        };
      })
      .filter((item) => item.namedImports?.length || item.defaultImport || item.namespaceImport);

    onChangePackageImports(updated);
  };

  // Copy import statement to clipboard
  const handleCopyStatement = (imp: TransformerPackageImport) => {
    const stmt = formatPackageImportStatement(imp);
    if (!stmt) return;
    navigator.clipboard.writeText(stmt);
    setCopiedImportId(imp.id);
    toast.success("Copied import statement to clipboard!");
    setTimeout(() => setCopiedImportId(null), 1800);
  };

  // Live draft statement preview
  const draftStatementPreview = useMemo(() => {
    if (!selectedPkgName) return "";
    return formatPackageImportStatement({
      id: "preview",
      packageName: selectedPkgName,
      namedImports: selectedNamedImports,
      defaultImport: defaultImportName,
      namespaceImport: isNamespace ? namespaceIdentifier.trim() || "_" : undefined,
      isTypeOnly,
    });
  }, [
    selectedPkgName,
    selectedNamedImports,
    defaultImportName,
    isNamespace,
    namespaceIdentifier,
    isTypeOnly,
  ]);

  return (
    <div className="flex flex-col gap-3 p-3.5 bg-secondary/15 rounded-xl border border-border/60 shadow-xs">
      {/* ── Section Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <Library size={13} className="text-indigo-400" />
            <Label className="text-xs font-semibold text-foreground tracking-tight">
              Imported Package Functions & Utilities
            </Label>
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0 h-4 font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
            >
              {activePackageImports.length} package(s) • {totalImportedFunctionsCount} function(s)
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Import functions, utilities, and types from packages installed on this transformer.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {availablePackages.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenAdd()}
              className="h-7 px-2.5 text-xs gap-1 border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/15 text-indigo-300 hover:text-indigo-200 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Import Functions</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── STATE 1: No packages installed on this transformer yet ── */}
      {availablePackages.length === 0 ? (
        <div className="p-3 rounded-lg border border-dashed border-border/70 bg-secondary/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package size={14} className="shrink-0 text-muted-foreground" />
            <span>No packages installed on this transformer yet.</span>
          </div>
          {onNavigateToPackagesTab && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNavigateToPackagesTab}
              className="h-7 text-xs font-medium cursor-pointer"
            >
              Install Packages
            </Button>
          )}
        </div>
      ) : activePackageImports.length === 0 ? (
        /* ── STATE 2: Packages installed, none imported yet ── */
        <div className="p-3 rounded-lg border border-dashed border-border/70 bg-secondary/10 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground font-medium">
              Installed packages on this transformer:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {availablePackages.map((pkg) => (
              <button
                key={pkg.name}
                type="button"
                onClick={() => handleOpenAdd(pkg.name)}
                className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-background/80 hover:bg-indigo-500/15 text-foreground hover:text-indigo-300 border border-border/60 hover:border-indigo-500/40 cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs group"
                title={`Click to import functions from ${pkg.name}`}
              >
                <Package size={11} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                <span className="font-medium">{pkg.name}</span>
                {pkg.version && (
                  <span className="text-[9px] text-muted-foreground opacity-70">
                    {pkg.version}
                  </span>
                )}
                <span className="text-[9px] ml-0.5 px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-sans">
                  + Import
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── STATE 3: Active Package Imports Display ── */
        <div className="flex flex-col gap-2 pt-0.5">
          {activePackageImports.map((imp) => {
            const statement = formatPackageImportStatement(imp);
            const isCopied = copiedImportId === imp.id;
            const functionPills = [
              ...(imp.defaultImport
                ? [{ name: imp.defaultImport, type: "default" as const }]
                : []),
              ...(imp.namespaceImport
                ? [{ name: imp.namespaceImport.replace(/^\*\s+as\s+/, ""), type: "namespace" as const }]
                : []),
              ...(imp.namedImports || []).map((name) => ({ name, type: "named" as const })),
            ];

            return (
              <div
                key={imp.id}
                className="flex flex-col gap-2 p-2.5 rounded-lg bg-card/60 hover:bg-card/90 border border-border/60 hover:border-indigo-500/30 transition-all duration-150 shadow-2xs"
              >
                {/* Header row: Package name + statement preview + actions */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="p-1 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 shrink-0">
                      <Package size={12} />
                    </div>
                    <span className="font-mono text-xs font-semibold text-foreground truncate">
                      {imp.packageName}
                    </span>
                    {imp.isTypeOnly && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 h-3.5 bg-muted/40 text-muted-foreground font-mono"
                      >
                        type-only
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground font-mono hidden md:inline truncate opacity-70">
                      {statement}
                    </span>
                  </div>

                  {/* Actions: Copy, Edit, Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyStatement(imp)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
                      title="Copy import statement"
                    >
                      {isCopied ? (
                        <Check size={11} className="text-emerald-400" />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(imp)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
                      title="Edit package imports"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteImport(imp.id, imp.packageName)}
                      className="p-1 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                      title="Remove import"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Imported Functions Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pl-6">
                  {functionPills.map((fn) => (
                    <div
                      key={fn.name}
                      className="group flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-secondary/60 hover:bg-secondary text-xs font-mono border border-border/50 transition-colors"
                    >
                      <span className="text-foreground font-medium">{fn.name}</span>
                      {fn.type === "default" && (
                        <span className="text-[8.5px] px-1 py-0 rounded bg-indigo-500/15 text-indigo-300 font-sans">
                          default
                        </span>
                      )}
                      {fn.type === "namespace" && (
                        <span className="text-[8.5px] px-1 py-0 rounded bg-purple-500/15 text-purple-300 font-sans">
                          namespace
                        </span>
                      )}

                      {/* Quick insert into logic code */}
                      {onInsertCodeSnippet && (
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = `const result = ${fn.name}(/* ... */);`;
                            onInsertCodeSnippet(snippet);
                          }}
                          className="p-0.5 rounded text-muted-foreground hover:text-indigo-300 hover:bg-indigo-500/15 cursor-pointer transition-colors"
                          title={`Insert ${fn.name} call into logic code`}
                        >
                          <Code2 size={10} />
                        </button>
                      )}

                      {/* Remove single function */}
                      {fn.type === "named" && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSingleFunction(imp.id, fn.name)}
                          className="p-0.5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
                          title={`Remove ${fn.name}`}
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(imp)}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-dashed border-indigo-500/30 cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Plus size={9} />
                    <span>Add function</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Editor Modal / Popover Overlay ── */}
      {isEditorOpen && (
        <div className="p-3.5 mt-1 rounded-xl bg-background/95 border-2 border-indigo-500/40 shadow-lg flex flex-col gap-3.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                <Library size={13} />
              </div>
              <div>
                <span className="text-xs font-semibold text-foreground">
                  {editingImportId ? "Edit Package Import" : "Import Functions from Package"}
                </span>
                <p className="text-[10px] text-muted-foreground">
                  Select functions to import from {selectedPkgName || "installed package"}.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEditorOpen(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* 1. Target Package Selection (ONLY INSTALLED PACKAGES) */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Installed Package
            </Label>
            <select
              value={selectedPkgName}
              onChange={(e) => {
                setSelectedPkgName(e.target.value);
                setSelectedNamedImports([]);
                setDefaultImportName("");
              }}
              className="h-8 text-xs font-mono bg-background border border-border/80 rounded-md px-2 w-full focus:ring-1 focus:ring-indigo-500"
            >
              {availablePackages.map((pkg) => (
                <option key={pkg.name} value={pkg.name}>
                  {pkg.name} {pkg.version ? `(${pkg.version})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Detected Functions from this Installed Package */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Select Functions ({packageExports.length} available)
              </Label>
              {isLoadingExports && (
                <span className="text-[10px] text-indigo-400 font-mono animate-pulse">
                  Scanning exports...
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 rounded-lg bg-secondary/30 border border-border/50">
              {packageExports.length === 0 ? (
                <span className="text-[11px] text-muted-foreground italic p-1">
                  Type a function name below to import from {selectedPkgName}.
                </span>
              ) : (
                packageExports.map((exp) => {
                  const isSelected = selectedNamedImports.includes(exp.name);
                  return (
                    <button
                      key={exp.name}
                      type="button"
                      onClick={() => handleToggleNamedExport(exp.name)}
                      className={cn(
                        "text-[10.5px] font-mono px-2 py-0.5 rounded-md border transition-all cursor-pointer flex items-center gap-1",
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-600 font-medium shadow-xs"
                          : "bg-background/80 hover:bg-indigo-500/15 text-muted-foreground hover:text-foreground border-border/60",
                      )}
                      title={exp.description || `Click to toggle ${exp.name}`}
                    >
                      {isSelected ? <Check size={10} /> : <Plus size={10} className="opacity-60" />}
                      <span>{exp.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 3. Custom Function / Symbol Input */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Type Function Name or Alias
            </Label>
            <div className="flex items-center gap-2">
              <Input
                value={customFunctionInput}
                onChange={(e) => setCustomFunctionInput(e.target.value)}
                placeholder="e.g. v4 or v4 as uuidv4"
                className="h-8 text-xs font-mono bg-background/80 border-border/60"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomFunction();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddCustomFunction}
                className="h-8 px-3 text-xs shrink-0 font-medium bg-secondary hover:bg-secondary/80 text-foreground"
              >
                <Plus size={12} className="mr-1" /> Add
              </Button>
            </div>
          </div>

          {/* 4. Import Style Options: Default Import or Namespace */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/40">
            {/* Default Import */}
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground font-semibold">
                Default Import (optional)
              </Label>
              <Input
                value={defaultImportName}
                onChange={(e) => setDefaultImportName(e.target.value)}
                placeholder={`e.g. ${selectedPkgName ? selectedPkgName.split("/").pop() : "helper"}`}
                className="h-7 text-xs font-mono bg-background/80 border-border/60"
              />
            </div>

            {/* Type-only & Namespace toggles */}
            <div className="flex flex-col justify-end gap-1.5">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isTypeOnly}
                  onChange={(e) => setIsTypeOnly(e.target.checked)}
                  className="rounded text-indigo-500 focus:ring-0"
                />
                <span className="text-[11px]">Type-only (<code className="font-mono text-[10px]">import type</code>)</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isNamespace}
                  onChange={(e) => setIsNamespace(e.target.checked)}
                  className="rounded text-indigo-500 focus:ring-0"
                />
                <span className="text-[11px]">Namespace (<code className="font-mono text-[10px]">import * as ...</code>)</span>
              </label>
            </div>
          </div>

          {/* 5. Live Import Preview */}
          <div className="flex flex-col gap-1 p-2 rounded-lg bg-secondary/40 border border-border/60">
            <span className="text-[9.5px] uppercase font-semibold text-muted-foreground font-mono">
              Generated Import Preview:
            </span>
            <pre className="text-xs font-mono text-indigo-300 overflow-x-auto whitespace-pre select-all">
              {draftStatementPreview || `import from "${selectedPkgName}";`}
            </pre>
          </div>

          {/* 6. Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditorOpen(false)}
              className="h-8 px-3 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveImport}
              className="h-8 px-4 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-sm"
            >
              <Check size={12} className="mr-1.5" />
              Save Imports
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

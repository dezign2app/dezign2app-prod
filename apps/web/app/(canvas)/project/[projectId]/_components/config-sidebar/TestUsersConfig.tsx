"use client";

import React, { useState, useMemo } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Users,
  Plus,
  Pencil,
  Trash,
  Copy,
  Check,
  KeyRound,
  Database,
  Table2,
  Sparkles,
  Link2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";
import { useTestUsersStore } from "../test-users/useTestUsersStore";
import {
  TestUserPersona,
  TableSeedRecord,
  generateRecordId,
  generatePersonaId,
} from "../test-users/types";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";

interface ColumnDef {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isUnique?: boolean;
  defaultValue?: string;
}

interface TableNodeInfo {
  id: string;
  name: string;
  databaseNodeId: string;
  columns: ColumnDef[];
}

interface TestUsersConfigProps {
  id?: string;
  nodeId?: string;
}

export function TestUsersConfig({ id, nodeId }: TestUsersConfigProps) {
  const personas = useTestUsersStore((s) => s.personas);
  const addPersona = useTestUsersStore((s) => s.addPersona);
  const updatePersona = useTestUsersStore((s) => s.updatePersona);
  const deletePersona = useTestUsersStore((s) => s.deletePersona);

  const allNodes = useBackendCanvasStore((s) => s.nodes);

  // 1. Discover all databases
  const databaseNodes = useMemo(() => {
    const dbs = allNodes.filter((n) => n.type === "database");
    if (dbs.length === 0) {
      return [
        {
          id: "primary-sqlite",
          name: "Primary Database (SQLite)",
          engine: "sqlite",
        },
      ];
    }
    return dbs.map((d) => ({
      id: d.id,
      name: d.data?.label || "Database",
      engine: d.data?.dbEngine || "sqlite",
    }));
  }, [allNodes]);

  // 2. Discover all table / entity nodes
  const tableNodes = useMemo<TableNodeInfo[]>(() => {
    return allNodes
      .filter((n) => n.type === "entity")
      .map((t) => {
        const rawCols = t.data?.columns || [];
        const columns: ColumnDef[] = rawCols.map((c) => ({
          name: c.name || "field",
          type: c.type || "string",
          isPrimaryKey: Boolean(c.isPrimaryKey),
          isUnique: Boolean(c.isUnique),
          defaultValue: "",
        }));

        const effectiveColumns: ColumnDef[] =
          columns.length > 0
            ? columns
            : [
                { name: "id", type: "string", isPrimaryKey: true, defaultValue: "" },
                { name: "name", type: "string", defaultValue: "" },
                { name: "email", type: "string", defaultValue: "" },
                { name: "role", type: "string", defaultValue: "" },
              ];

        return {
          id: t.id,
          name: t.data?.label || "table",
          databaseNodeId: t.data?.databaseId || t.data?.parentId || "primary-sqlite",
          columns: effectiveColumns,
        };
      });
  }, [allNodes]);

  // Built-in fallback table schemas
  const fallbackTables = useMemo<TableNodeInfo[]>(() => {
    if (tableNodes.length > 0) return tableNodes;
    return [
      {
        id: "tbl-user",
        name: "user",
        databaseNodeId: "primary-sqlite",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true, defaultValue: "" },
          { name: "name", type: "string", defaultValue: "" },
          { name: "email", type: "string", defaultValue: "" },
          { name: "role", type: "string", defaultValue: "" },
        ],
      },
      {
        id: "tbl-session",
        name: "session",
        databaseNodeId: "primary-sqlite",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true, defaultValue: "" },
          { name: "userId", type: "string", defaultValue: "" },
          { name: "token", type: "string", defaultValue: "" },
          { name: "expiresAt", type: "string", defaultValue: "2099-01-01T00:00:00.000Z" },
        ],
      },
      {
        id: "tbl-account",
        name: "account",
        databaseNodeId: "primary-sqlite",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true, defaultValue: "" },
          { name: "userId", type: "string", defaultValue: "" },
          { name: "providerId", type: "string", defaultValue: "" },
          { name: "password", type: "string", defaultValue: "" },
        ],
      },
    ];
  }, [tableNodes]);

  // Mode: list vs create/edit
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formActiveToken, setFormActiveToken] = useState("");
  const [formRecords, setFormRecords] = useState<TableSeedRecord[]>([]);

  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [copiedRecordId, setCopiedRecordId] = useState<string | null>(null);

  // Open Edit form
  const handleStartEdit = (persona: TestUserPersona) => {
    setEditingPersonaId(persona.id);
    setIsCreating(false);
    setFormName(persona.name);
    setFormDescription(persona.description || "");
    setFormActiveToken(persona.activeAuthToken || "");
    setFormRecords(persona.records);
  };

  // Open Create form
  const handleStartCreate = () => {
    const userId = generateRecordId("user");
    const sessId = generateRecordId("session");
    const token = `token_${Math.random().toString(36).substring(2, 10)}`;

    setEditingPersonaId(null);
    setIsCreating(true);
    setFormName("");
    setFormDescription("");
    setFormActiveToken(token);
    setFormRecords([
      {
        id: userId,
        databaseName: databaseNodes[0]?.name || "Primary Database (SQLite)",
        tableName: "user",
        fields: {
          id: userId,
          name: "Test Persona",
          email: "test@example.com",
          role: "user",
        },
      },
      {
        id: sessId,
        databaseName: databaseNodes[0]?.name || "Primary Database (SQLite)",
        tableName: "session",
        fields: {
          id: sessId,
          userId: userId,
          token: token,
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
      },
    ]);
  };

  // Cancel form
  const handleCancelForm = () => {
    setEditingPersonaId(null);
    setIsCreating(false);
  };

  // Copy bearer header
  const handleCopyHeader = (persona: TestUserPersona) => {
    if (!persona.activeAuthToken) {
      toast.error("No active token found for this persona");
      return;
    }
    const headerVal = `Bearer ${persona.activeAuthToken}`;
    navigator.clipboard.writeText(headerVal);
    setCopiedTokenId(persona.id);
    toast.success(`Copied: Authorization: ${headerVal}`);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  // Copy record ID
  const handleCopyRecordId = (recId: string) => {
    navigator.clipboard.writeText(recId);
    setCopiedRecordId(recId);
    toast.success(`Copied record _id: ${recId}`);
    setTimeout(() => setCopiedRecordId(null), 2000);
  };

  // Add another table record
  const handleAddRecordToForm = () => {
    const defaultDb = databaseNodes[0]?.name || "Primary Database (SQLite)";
    const defaultTbl = fallbackTables[0]?.name || "user";
    const newId = generateRecordId(defaultTbl);

    setFormRecords([
      ...formRecords,
      {
        id: newId,
        databaseName: defaultDb,
        tableName: defaultTbl,
        fields: {
          id: newId,
        },
      },
    ]);
  };

  // Remove table record
  const handleRemoveRecordFromForm = (idx: number) => {
    setFormRecords(formRecords.filter((_, i) => i !== idx));
  };

  // Field change
  const handleFieldChange = (
    recIdx: number,
    fieldName: string,
    val: string | number | boolean | null,
  ) => {
    setFormRecords((prev) => {
      const copy = [...prev];
      const rec = { ...copy[recIdx]! };
      rec.fields = { ...rec.fields, [fieldName]: val };

      if (fieldName === "token" && val) {
        setFormActiveToken(String(val));
      }

      copy[recIdx] = rec;
      return copy;
    });
  };

  // Save Persona
  const handleSaveForm = () => {
    if (!formName.trim()) {
      toast.error("Please enter a Persona Name");
      return;
    }

    const personaToSave: TestUserPersona = {
      id: editingPersonaId || generatePersonaId(),
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      activeAuthToken: formActiveToken.trim() || undefined,
      records: formRecords.map((r) => ({
        ...r,
        fields: {
          ...r.fields,
          id: r.fields.id || r.id,
        },
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingPersonaId) {
      updatePersona(editingPersonaId, personaToSave);
      toast.success(`Updated persona: ${personaToSave.name}`);
    } else {
      addPersona(personaToSave);
      toast.success(`Created persona: ${personaToSave.name}`);
    }

    handleCancelForm();
  };

  // Available foreign keys
  const availableForeignKeys = useMemo(() => {
    return formRecords.map((r) => ({
      id: r.id,
      tableName: r.tableName,
    }));
  }, [formRecords]);

  const showEditorForm = isCreating || editingPersonaId !== null;

  return (
    <div className="flex flex-col gap-6 mt-2 pb-12 text-foreground font-sans">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-secondary text-foreground border border-border/60">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                Test Users & Fixtures
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-secondary text-muted-foreground border border-border/50">
                {personas.length} Personas
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define mock identities, seed multi-table records, and link foreign keys for endpoint testing.
            </p>
          </div>
        </div>
      </div>

      {/* Overview Status Card */}
      <div className="p-4 rounded-xl bg-card border border-border/60 shadow-sm flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Database Fixture Sync</span>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            @workspace/db
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Configured test personas are automatically seeded into SQLite (<code className="text-[11px] font-mono bg-secondary/80 px-1 py-0.5 rounded">user</code> & <code className="text-[11px] font-mono bg-secondary/80 px-1 py-0.5 rounded">session</code> tables) and exposed in Endpoint Testing.
        </p>
      </div>

      {/* Actions Toolbar */}
      {!showEditorForm && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active Personas ({personas.length})
          </span>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleStartCreate}
            className="h-8 text-xs px-3 bg-secondary/80 hover:bg-secondary text-foreground border border-border/60 gap-1.5 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Test User</span>
          </Button>
        </div>
      )}

      {/* Editor Form (Create or Edit) */}
      {showEditorForm ? (
        <div className="flex flex-col gap-4 p-4 rounded-xl border border-border/70 bg-card/60 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">
                {isCreating ? "Create Test User Persona" : "Edit Test User Persona"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelForm}
              className="h-7 text-xs text-muted-foreground"
            >
              Cancel
            </Button>
          </div>

          {/* Persona Info */}
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Persona Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Admin - Acme Tenant"
                className="h-8 text-xs bg-background"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Active Bearer Token (for Endpoint Testing)</Label>
              <div className="relative flex items-center">
                <KeyRound className="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground" />
                <Input
                  value={formActiveToken}
                  onChange={(e) => setFormActiveToken(e.target.value)}
                  placeholder="e.g. fake_admin_token"
                  className="h-8 text-xs pl-8 font-mono bg-background"
                />
              </div>
            </div>
          </div>

          {/* Multi-Table Record Fixtures */}
          <div className="flex flex-col gap-3 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Table2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Table Records ({formRecords.length})
                </span>
              </div>

              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleAddRecordToForm}
                className="h-7 text-xs px-2.5 bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50 gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Record</span>
              </Button>
            </div>

            {formRecords.map((rec, recIdx) => {
              const matchedTable = fallbackTables.find(
                (t) => t.name.toLowerCase() === rec.tableName.toLowerCase(),
              );
              const columns = matchedTable?.columns || [
                { name: "name", type: "string" },
                { name: "email", type: "string" },
                { name: "role", type: "string" },
              ];

              return (
                <div
                  key={recIdx}
                  className="flex flex-col gap-3 p-3 rounded-lg border border-border/60 bg-background/60"
                >
                  {/* Record Header: Database -> Table & _id */}
                  <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Database Selector */}
                      <div className="flex items-center gap-1">
                        <Database className="w-3.5 h-3.5 text-muted-foreground" />
                        <Select
                          value={rec.databaseName}
                          onValueChange={(val) => {
                            setFormRecords((prev) => {
                              const copy = [...prev];
                              copy[recIdx] = { ...copy[recIdx]!, databaseName: val };
                              return copy;
                            });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs bg-background w-36 border-border/60">
                            <SelectValue placeholder="Database" />
                          </SelectTrigger>
                          <SelectContent>
                            {databaseNodes
                              .filter((db) => Boolean(db && db.name && db.name.trim()))
                              .map((db) => (
                                <SelectItem key={db.id} value={db.name} className="text-xs">
                                  {db.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Table Selector (Filtered) */}
                      <div className="flex items-center gap-1">
                        <Table2 className="w-3.5 h-3.5 text-muted-foreground" />
                        <Select
                          value={rec.tableName}
                          onValueChange={(val) => {
                            const newId = generateRecordId(val);
                            setFormRecords((prev) => {
                              const copy = [...prev];
                              copy[recIdx] = {
                                ...copy[recIdx]!,
                                id: newId,
                                tableName: val,
                                fields: { id: newId },
                              };
                              return copy;
                            });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs bg-background w-32 font-mono font-medium border-border/60">
                            <SelectValue placeholder="Table" />
                          </SelectTrigger>
                          <SelectContent>
                            {fallbackTables
                              .filter((t) => Boolean(t && t.name && t.name.trim()))
                              .map((t) => (
                                <SelectItem key={t.id} value={t.name} className="text-xs font-mono">
                                  {t.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Generated _id Badge */}
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/80 border border-border/50 text-[11px] font-mono">
                        <span className="text-muted-foreground">_id:</span>
                        <span className="font-bold text-foreground">{rec.id}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyRecordId(rec.id)}
                          className="ml-1 text-muted-foreground hover:text-foreground"
                          title="Copy _id to use as Foreign Key"
                        >
                          {copiedRecordId === rec.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {formRecords.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRecordFromForm(recIdx)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Dynamic Column Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {columns
                      .filter((c) => c.name !== "id" && c.name !== "_id")
                      .map((col) => {
                        const isForeignKeyField =
                          col.name.toLowerCase().endsWith("id") ||
                          col.name.toLowerCase().includes("user") ||
                          col.name.toLowerCase().includes("org");

                        const val = rec.fields[col.name];

                        return (
                          <div key={col.name} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-[11px] font-mono text-muted-foreground truncate">
                                {col.name}
                              </Label>
                              {isForeignKeyField && availableForeignKeys.length > 1 && (
                                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                  <Link2 className="w-2.5 h-2.5" /> FK
                                </span>
                              )}
                            </div>

                            {isForeignKeyField && availableForeignKeys.some((k) => k.id !== rec.id) ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={val === null || val === undefined ? "" : String(val)}
                                  onChange={(e) =>
                                    handleFieldChange(recIdx, col.name, e.target.value)
                                  }
                                  placeholder={col.defaultValue || `value`}
                                  className="h-7 text-xs font-mono bg-background flex-1"
                                />
                                <Select
                                  value=""
                                  onValueChange={(fkVal) =>
                                    handleFieldChange(recIdx, col.name, fkVal)
                                  }
                                >
                                  <SelectTrigger className="h-7 w-7 p-0 bg-secondary/60 border-border/50 text-muted-foreground">
                                    <Link2 className="w-3 h-3 mx-auto" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableForeignKeys
                                      .filter((k) => Boolean(k && k.id && k.id.trim() && k.id !== rec.id))
                                      .map((k) => (
                                        <SelectItem key={k.id} value={k.id} className="text-xs font-mono">
                                          {k.tableName}._id ({k.id})
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <Input
                                value={val === null || val === undefined ? "" : String(val)}
                                onChange={(e) =>
                                  handleFieldChange(recIdx, col.name, e.target.value)
                                }
                                placeholder={
                                  col.name === "role"
                                    ? "admin / user / manager"
                                    : col.name === "token"
                                    ? "token_val"
                                    : col.defaultValue || `Enter ${col.name}`
                                }
                                className="h-7 text-xs bg-background"
                              />
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Form Submit Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelForm}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSaveForm}
              className="h-8 text-xs px-4 bg-secondary text-foreground font-semibold border border-border/60"
            >
              Save Persona & Seed
            </Button>
          </div>
        </div>
      ) : (
        /* List of Configured Personas */
        <div className="flex flex-col gap-3">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className="flex flex-col gap-3 p-4 rounded-xl border border-border/60 bg-card/40 shadow-sm hover:border-border/80 transition-colors"
            >
              {/* Top Bar */}
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-foreground">
                      {persona.name}
                    </span>
                    {persona.activeAuthToken && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <KeyRound className="w-2.5 h-2.5" />
                        <span>Active Token</span>
                      </span>
                    )}
                  </div>
                  {persona.description && (
                    <span className="text-[11px] text-muted-foreground">
                      {persona.description}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {persona.activeAuthToken && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyHeader(persona)}
                      className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground gap-1"
                      title="Copy Authorization: Bearer <token>"
                    >
                      {copiedTokenId === persona.id ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>Copy Bearer</span>
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStartEdit(persona)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    title="Edit Persona"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      deletePersona(persona.id);
                      toast.success(`Deleted persona: ${persona.name}`);
                    }}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    title="Delete Persona"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Seeded Records Summary */}
              <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Seeded Table Records ({persona.records.length})
                </span>

                <div className="grid grid-cols-1 gap-2">
                  {persona.records.map((rec, recIdx) => (
                    <div
                      key={recIdx}
                      className="p-2.5 rounded-lg bg-background/50 border border-border/50 flex flex-col gap-1 text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 font-mono">
                          <Table2 className="w-3 h-3 text-muted-foreground" />
                          <span className="font-semibold text-foreground">{rec.tableName}</span>
                          <span className="text-muted-foreground/60">•</span>
                          <span className="text-muted-foreground">{rec.databaseName}</span>
                        </div>

                        <span className="font-mono text-[10px] text-muted-foreground bg-secondary/60 px-1.5 py-0.2 rounded border border-border/40">
                          _id: {rec.id}
                        </span>
                      </div>

                      {/* Preview fields */}
                      <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-muted-foreground pt-0.5">
                        {Object.entries(rec.fields)
                          .filter(([k]) => k !== "id")
                          .slice(0, 4)
                          .map(([k, v]) => (
                            <span key={k} className="inline-flex items-center gap-1 bg-secondary/30 px-1.5 py-0.5 rounded">
                              <span className="text-muted-foreground/70">{k}:</span>
                              <span className="text-foreground font-medium truncate max-w-[120px]">
                                {String(v)}
                              </span>
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@workspace/ui/components/sheet";
import { Button } from "@workspace/ui/components/button";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Check,
  KeyRound,
  Database,
  Table2,
  ShieldCheck,
  Sparkles,
  Link2,
} from "lucide-react";
import { useTestUsersStore } from "./useTestUsersStore";
import { TestUserPersona } from "./types";
import { TestUserPersonaEditor } from "./TestUserPersonaEditor";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";

interface TestUsersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TestUsersSheet({ open, onOpenChange }: TestUsersSheetProps) {
  const personas = useTestUsersStore((s) => s.personas);
  const addPersona = useTestUsersStore((s) => s.addPersona);
  const updatePersona = useTestUsersStore((s) => s.updatePersona);
  const deletePersona = useTestUsersStore((s) => s.deletePersona);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<TestUserPersona | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const handleCreateNew = () => {
    setEditingPersona(null);
    setEditorOpen(true);
  };

  const handleEdit = (persona: TestUserPersona) => {
    setEditingPersona(persona);
    setEditorOpen(true);
  };

  const handleSave = (persona: TestUserPersona) => {
    if (editingPersona) {
      updatePersona(persona.id, persona);
    } else {
      addPersona(persona);
    }
  };

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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl flex flex-col p-0 gap-0 font-sans bg-background border-l border-border/50"
        >
          {/* Header */}
          <SheetHeader className="p-5 border-b border-border/50 bg-secondary/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-secondary text-foreground border border-border/60">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <SheetTitle className="text-sm font-semibold flex items-center gap-2">
                    <span>Test Users & Multi-Table Fixtures</span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-secondary text-muted-foreground border border-border/50">
                      {personas.length} Personas
                    </span>
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                    Define mock identities, seed database records, and link foreign keys for testing.
                  </SheetDescription>
                </div>
              </div>
            </div>
          </SheetHeader>

          {/* Action Toolbar */}
          <div className="flex items-center justify-between p-3.5 px-5 border-b border-border/40 bg-secondary/5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Configured Personas
            </span>

            <Button
              size="sm"
              variant="secondary"
              onClick={handleCreateNew}
              className="h-7 text-xs px-2.5 bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50 gap-1.5 font-medium shadow-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Test User</span>
            </Button>
          </div>

          {/* List of Personas */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3.5">
            {personas.map((persona) => {
              return (
                <div
                  key={persona.id}
                  className="flex flex-col gap-3 p-4 rounded-xl border border-border/60 bg-card/40 shadow-sm hover:border-border/80 transition-colors"
                >
                  {/* Persona Top Bar */}
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
                        onClick={() => handleEdit(persona)}
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
                        <Trash2 className="w-3.5 h-3.5" />
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

                          {/* Field Values preview */}
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
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Editor Modal */}
      <TestUserPersonaEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initialPersona={editingPersona}
        onSave={handleSave}
      />
    </>
  );
}

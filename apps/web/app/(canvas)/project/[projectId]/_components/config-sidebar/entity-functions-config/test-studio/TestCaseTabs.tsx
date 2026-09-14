import React, { useState } from "react";
import { CheckCircle2, XCircle, Edit2, Copy, Trash2, Plus } from "lucide-react";
import { DbOperationTestCase } from "@workspace/canvas/types";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

export interface TestCaseTabsProps {
  testCases: DbOperationTestCase[];
  activeCaseId: string;
  onSelectCase: (caseId: string) => void;
  onAddCase: () => void;
  onDuplicateCase: (testCase: DbOperationTestCase) => void;
  onDeleteCase: (caseId: string) => void;
  onRenameCase: (caseId: string, newName: string) => void;
}

export const TestCaseTabs: React.FC<TestCaseTabsProps> = ({
  testCases,
  activeCaseId,
  onSelectCase,
  onAddCase,
  onDuplicateCase,
  onDeleteCase,
  onRenameCase,
}) => {
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");

  const handleStartRename = (tc: DbOperationTestCase, e: React.MouseEvent) => {
    e.stopPropagation();
    setTempName(tc.name);
    setEditingCaseId(tc.id);
  };

  const handleFinishRename = (tcId: string) => {
    if (tempName.trim()) {
      onRenameCase(tcId, tempName.trim());
    }
    setEditingCaseId(null);
  };

  return (
    <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
      <div className="flex items-center gap-1.5 min-w-0">
        {testCases.map((tc) => {
          const isActive = tc.id === activeCaseId;
          const hasPassed = tc.lastResult?.success === true;
          const hasFailed = tc.lastResult?.success === false;

          return (
            <div
              key={tc.id}
              onClick={() => onSelectCase(tc.id)}
              className={cn(
                "group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none",
                isActive
                  ? "bg-secondary text-secondary-foreground border-border shadow-xs font-semibold"
                  : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {hasPassed ? (
                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
              ) : hasFailed ? (
                <XCircle size={12} className="text-destructive shrink-0" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
              )}

              {editingCaseId === tc.id ? (
                <input
                  type="text"
                  value={tempName}
                  autoFocus
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={() => handleFinishRename(tc.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleFinishRename(tc.id);
                    }
                  }}
                  className="h-5 px-1 text-xs bg-background rounded border border-ring outline-none font-mono"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate max-w-[120px]">{tc.name}</span>
              )}

              {/* Actions on active test case tab */}
              {isActive && editingCaseId !== tc.id && (
                <div
                  className="flex items-center gap-0.5 ml-1 opacity-80 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    title="Rename test case"
                    onClick={(e) => handleStartRename(tc, e)}
                    className="p-0.5 rounded hover:bg-background/80 hover:text-foreground cursor-pointer"
                  >
                    <Edit2 size={10} />
                  </button>
                  <button
                    type="button"
                    title="Duplicate test case"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateCase(tc);
                    }}
                    className="p-0.5 rounded hover:bg-background/80 hover:text-foreground cursor-pointer"
                  >
                    <Copy size={10} />
                  </button>
                  {testCases.length > 1 && (
                    <button
                      type="button"
                      title="Delete test case"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCase(tc.id);
                      }}
                      className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive cursor-pointer"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={onAddCase}
        className="h-7 text-xs gap-1 shrink-0 cursor-pointer"
      >
        <Plus size={12} /> New Case
      </Button>
    </div>
  );
};

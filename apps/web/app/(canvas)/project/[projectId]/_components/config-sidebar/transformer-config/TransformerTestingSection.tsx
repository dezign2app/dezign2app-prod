"use client";

import React from "react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  FlaskConical,
  Play,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Plus,
  RotateCcw,
} from "lucide-react";
import { Parameter } from "@/types/canvas";
import { TransformerTestCase } from "@workspace/canvas";
import { cn } from "@workspace/ui/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build and execute the user's transformer code in-browser using AsyncFunction. */
async function runTransformerCode(
  functionName: string,
  code: string,
  isAsync: boolean,
  inputs: Record<string, unknown>,
  timeoutMs = 5000,
): Promise<{ output: unknown; error?: never } | { output?: never; error: string }> {
  if (!code.trim()) {
    return { error: "No code defined for this transformer." };
  }

  const argNames = Object.keys(inputs);
  const argValues = Object.values(inputs);

  try {
    // Wrap user code in a destructuring function to match their schema
    const bodyLines: string[] = [];
    if (argNames.length > 0) {
      bodyLines.push(`const { ${argNames.join(", ")} } = __inputs__;`);
    }
    bodyLines.push(code);

    const AsyncFn = Object.getPrototypeOf(async function () {}).constructor as FunctionConstructor;
    const fn = new AsyncFn("__inputs__", bodyLines.join("\n"));

    const resultPromise = fn({ ...inputs });

    // Race against a timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs / 1000}s`)), timeoutMs),
    );

    const output = await Promise.race([resultPromise, timeoutPromise]);
    return { output };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Parse a raw string field value to a best-effort JS value. */
function parseFieldValue(raw: string, type: string): unknown {
  if (type === "number") {
    const n = Number(raw);
    return isNaN(n) ? raw : n;
  }
  if (type === "boolean") {
    if (raw === "true") return true;
    if (raw === "false") return false;
    return raw;
  }
  if (type === "object" || type.startsWith("{") || raw.trim().startsWith("{") || raw.trim().startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SavedCaseRowProps {
  tc: TransformerTestCase;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const SavedCaseRow: React.FC<SavedCaseRowProps> = ({ tc, isActive, onSelect, onDelete }) => (
  <div
    className={cn(
      "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer group transition-colors",
      isActive
        ? "bg-purple-500/15 border border-purple-500/25"
        : "hover:bg-muted/50 border border-transparent",
    )}
    onClick={onSelect}
  >
    <span className="text-xs font-mono text-foreground flex-1 truncate">{tc.label}</span>

    {tc.lastError ? (
      <XCircle className="w-3 h-3 text-red-400 shrink-0" />
    ) : tc.lastOutput !== undefined ? (
      <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />
    ) : null}

    {tc.lastRunAt && (
      <span className="text-[10px] text-muted-foreground hidden group-hover:inline shrink-0">
        {new Date(tc.lastRunAt).toLocaleTimeString()}
      </span>
    )}

    <button
      className="opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      title="Delete test case"
    >
      <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-400 transition-colors" />
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface TransformerTestingSectionProps {
  functionName: string;
  code: string;
  isAsync: boolean;
  inputSchema: Parameter[];
  testCases: TransformerTestCase[];
  onSaveTestCase: (tc: TransformerTestCase) => void;
  onDeleteTestCase: (id: string) => void;
}

export const TransformerTestingSection: React.FC<TransformerTestingSectionProps> = ({
  functionName,
  code,
  isAsync,
  inputSchema,
  testCases,
  onSaveTestCase,
  onDeleteTestCase,
}) => {
  // ----- local state -----
  const [fieldValues, setFieldValues] = React.useState<Record<string, string>>({});
  const [output, setOutput] = React.useState<unknown | undefined>(undefined);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [running, setRunning] = React.useState(false);
  const [saveLabel, setSaveLabel] = React.useState("");
  const [showSaveInput, setShowSaveInput] = React.useState(false);
  const [activeCaseId, setActiveCaseId] = React.useState<string | undefined>(undefined);
  const [showSavedCases, setShowSavedCases] = React.useState(true);

  // Reset fields when inputSchema changes
  React.useEffect(() => {
    setFieldValues((prev) => {
      const next: Record<string, string> = {};
      for (const f of inputSchema) {
        next[f.name] = prev[f.name] ?? "";
      }
      return next;
    });
  }, [inputSchema]);

  // Load a saved test case into the form
  const loadTestCase = (tc: TransformerTestCase) => {
    setActiveCaseId(tc.id);
    setOutput(tc.lastOutput);
    setError(tc.lastError);
    const strInputs: Record<string, string> = {};
    for (const [k, v] of Object.entries(tc.inputs)) {
      strInputs[k] = typeof v === "string" ? v : JSON.stringify(v);
    }
    setFieldValues(strInputs);
  };

  const handleRun = async () => {
    setRunning(true);
    setOutput(undefined);
    setError(undefined);

    const parsedInputs: Record<string, unknown> = {};
    for (const f of inputSchema) {
      parsedInputs[f.name] = parseFieldValue(fieldValues[f.name] ?? "", f.type);
    }

    const result = await runTransformerCode(functionName, code, isAsync, parsedInputs);

    setRunning(false);
    if ("error" in result) {
      setError(result.error);
      setOutput(undefined);
    } else {
      setOutput(result.output);
      setError(undefined);
    }

    // If a saved case is active, auto-update it with the latest run result
    if (activeCaseId) {
      const existing = testCases.find((tc) => tc.id === activeCaseId);
      if (existing) {
        onSaveTestCase({
          ...existing,
          inputs: parsedInputs,
          lastOutput: "error" in result ? undefined : result.output,
          lastError: "error" in result ? result.error : undefined,
          lastRunAt: new Date().toISOString(),
        });
      }
    }
  };

  const handleSave = () => {
    if (!saveLabel.trim()) return;
    const parsedInputs: Record<string, unknown> = {};
    for (const f of inputSchema) {
      parsedInputs[f.name] = parseFieldValue(fieldValues[f.name] ?? "", f.type);
    }
    const tc: TransformerTestCase = {
      id: `tc-${Date.now()}`,
      label: saveLabel.trim(),
      inputs: parsedInputs,
      lastOutput: output,
      lastError: error,
      lastRunAt: output !== undefined || error ? new Date().toISOString() : undefined,
    };
    onSaveTestCase(tc);
    setActiveCaseId(tc.id);
    setSaveLabel("");
    setShowSaveInput(false);
  };

  const handleReset = () => {
    setFieldValues({});
    setOutput(undefined);
    setError(undefined);
    setActiveCaseId(undefined);
  };

  const outputJson = React.useMemo(() => {
    if (output === undefined) return null;
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  }, [output]);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-semibold text-foreground">Test Runner</span>
        <span className="text-xs text-muted-foreground font-mono ml-1 truncate">{functionName}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleReset}
            title="Reset form"
            className="p-1 rounded hover:bg-muted/60 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* ── Sandbox notice ── */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-400/90">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Runs in-browser using <code className="font-mono">AsyncFunction</code>. External calls (fetch, DB) are{" "}
          <strong>not</strong> available. Best for pure logic validation.
        </span>
      </div>

      {/* ── Saved test cases ── */}
      {testCases.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <button
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            onClick={() => setShowSavedCases((v) => !v)}
          >
            {showSavedCases ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            Saved Cases ({testCases.length})
          </button>
          {showSavedCases && (
            <div className="flex flex-col gap-0.5 pl-1">
              {testCases.map((tc) => (
                <SavedCaseRow
                  key={tc.id}
                  tc={tc}
                  isActive={activeCaseId === tc.id}
                  onSelect={() => loadTestCase(tc)}
                  onDelete={() => {
                    if (activeCaseId === tc.id) setActiveCaseId(undefined);
                    onDeleteTestCase(tc.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Input fields ── */}
      <div className="flex flex-col gap-3">
        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Input Fields
        </Label>

        {inputSchema.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No input schema defined. Add fields in the Config &amp; Logic tab.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {inputSchema.map((field) => (
              <div key={field.name} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono text-foreground">{field.name}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                    {field.type}
                  </span>
                  {field.required && (
                    <span className="text-[10px] text-red-400">*</span>
                  )}
                </div>
                <Input
                  className="h-8 text-xs font-mono bg-background/60 border-border/60"
                  placeholder={
                    field.type === "object"
                      ? `{ "key": "value" }`
                      : field.type === "number"
                      ? "0"
                      : field.type === "boolean"
                      ? "true / false"
                      : `"${field.name} value"`
                  }
                  value={fieldValues[field.name] ?? ""}
                  onChange={(e) =>
                    setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
          onClick={handleRun}
          disabled={running || !code.trim()}
        >
          {running ? (
            <>
              <Clock className="w-3.5 h-3.5 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Run
            </>
          )}
        </Button>

        {!showSaveInput ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => {
              setSaveLabel(activeCaseId ? (testCases.find((t) => t.id === activeCaseId)?.label ?? "") : "");
              setShowSaveInput(true);
            }}
            disabled={!code.trim()}
          >
            <Save className="w-3.5 h-3.5" />
            Save case
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 flex-1">
            <Input
              autoFocus
              className="h-8 text-xs flex-1"
              placeholder="Case label…"
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setShowSaveInput(false);
              }}
            />
            <Button
              size="sm"
              className="h-8 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white shrink-0"
              onClick={handleSave}
              disabled={!saveLabel.trim()}
            >
              <Plus className="w-3 h-3" />
              Add
            </Button>
          </div>
        )}
      </div>

      {/* ── Output ── */}
      {(output !== undefined || error) && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            {error ? (
              <>
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                <Label className="text-xs text-red-400 font-semibold uppercase tracking-wider">
                  Error
                </Label>
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                <Label className="text-xs text-green-400 font-semibold uppercase tracking-wider">
                  Output
                </Label>
              </>
            )}
          </div>

          <pre
            className={cn(
              "rounded-md border text-[11px] font-mono p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all leading-relaxed",
              error
                ? "bg-red-500/10 border-red-500/20 text-red-300"
                : "bg-green-500/10 border-green-500/20 text-green-300",
            )}
          >
            {error ?? outputJson}
          </pre>
        </div>
      )}

      {!code.trim() && (
        <p className="text-xs text-muted-foreground italic text-center py-2">
          Add transformation logic in the <strong>Config &amp; Logic</strong> tab to enable testing.
        </p>
      )}
    </div>
  );
};

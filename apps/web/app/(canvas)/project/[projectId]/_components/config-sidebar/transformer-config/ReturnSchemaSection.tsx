import React from "react";
import { RequestBodyEditor, RequestBodyMode } from "../RequestBodyEditor";
import { Parameter, Schema, BackendNode } from "@/types/canvas";
import { Sparkles, RefreshCw } from "lucide-react";

interface ReturnSchemaSectionProps {
  nodeId: string;
  returnSchemaMode: RequestBodyMode;
  returnSchema: Parameter[];
  rawJson: string;
  inferredCount?: number;
  onInferFromCode?: () => void;
  onModeChange: (mode: RequestBodyMode) => void;
  onSchemaChange: (fields: Parameter[], rawJson: string) => void;
  onCreateTypeForField?: (field: Parameter) => void;
  allNodes?: BackendNode[];
}

export const ReturnSchemaSection: React.FC<ReturnSchemaSectionProps> = ({
  nodeId,
  returnSchemaMode,
  returnSchema,
  rawJson,
  inferredCount,
  onInferFromCode,
  onModeChange,
  onSchemaChange,
  onCreateTypeForField,
  allNodes,
}) => {
  return (
    <RequestBodyEditor
      title="3. Return Schema"
      subtitle="Return object shape produced by the transformer"
      badge={
        inferredCount !== undefined && inferredCount > 0 ? (
          <span className="text-[9px] font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/25 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
            <span>{inferredCount} inferred</span>
          </span>
        ) : null
      }
      headerActions={
        onInferFromCode ? (
          <button
            type="button"
            onClick={onInferFromCode}
            title="Re-infer return schema from function return statements"
            className="h-6 px-2 text-[10px] font-mono text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary/70 rounded-md border border-border/50 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Infer from Code</span>
          </button>
        ) : null
      }
      mode={returnSchemaMode}
      onModeChange={onModeChange}
      allNodes={allNodes}
      onCreateTypeForField={onCreateTypeForField}
      schema={{
        id: `transformer-out-${nodeId}`,
        fields: returnSchema,
        rawJson: rawJson || "",
      }}
      onSchemaChange={(s: Schema) =>
        onSchemaChange(s.fields || [], s.rawJson || "")
      }
    />
  );
};


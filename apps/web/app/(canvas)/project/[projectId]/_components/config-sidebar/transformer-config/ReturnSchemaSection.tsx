"use client";

import React from "react";
import { RequestBodyEditor, RequestBodyMode } from "../RequestBodyEditor";
import { Parameter, Schema } from "@/types/canvas";

interface ReturnSchemaSectionProps {
  nodeId: string;
  returnSchemaMode: RequestBodyMode;
  returnSchema: Parameter[];
  rawJson: string;
  onModeChange: (mode: RequestBodyMode) => void;
  onSchemaChange: (fields: Parameter[], rawJson: string) => void;
}

export const ReturnSchemaSection: React.FC<ReturnSchemaSectionProps> = ({
  nodeId,
  returnSchemaMode,
  returnSchema,
  rawJson,
  onModeChange,
  onSchemaChange,
}) => {
  return (
    <RequestBodyEditor
      title="3. Return Schema"
      subtitle="Return object shape produced by the transformer"
      mode={returnSchemaMode}
      onModeChange={onModeChange}
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

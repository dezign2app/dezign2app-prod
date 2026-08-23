"use client";

import React from "react";
import { RequestBodyEditor, RequestBodyMode } from "../RequestBodyEditor";
import { Parameter, Schema } from "@/types/canvas";

interface InputSchemaSectionProps {
  nodeId: string;
  inputSchemaMode: RequestBodyMode;
  inputSchema: Parameter[];
  rawJson: string;
  onModeChange: (mode: RequestBodyMode) => void;
  onSchemaChange: (fields: Parameter[], rawJson: string) => void;
}

export const InputSchemaSection: React.FC<InputSchemaSectionProps> = ({
  nodeId,
  inputSchemaMode,
  inputSchema,
  rawJson,
  onModeChange,
  onSchemaChange,
}) => {
  return (
    <RequestBodyEditor
      title="1. Input Schema"
      subtitle="Parameters passed into the transformer function"
      mode={inputSchemaMode}
      onModeChange={onModeChange}
      schema={{
        id: `transformer-in-${nodeId}`,
        fields: inputSchema,
        rawJson: rawJson || "",
      }}
      onSchemaChange={(s: Schema) =>
        onSchemaChange(s.fields || [], s.rawJson || "")
      }
    />
  );
};

import React, { useCallback } from "react";
import { Code2 } from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import { DbOperationFunction, DbOperationTestCase } from "@workspace/canvas/types";
import { ParamFieldEditor } from "./ParamFieldEditor";

export interface TestParamsFormProps {
  selectedOp: DbOperationFunction;
  activeCase: DbOperationTestCase;
  label: string;
  onParamChange: (paramName: string, value: unknown) => void;
}

interface ParamFieldRowProps {
  param: { name: string; type: string; required?: boolean };
  value: unknown;
  label: string;
  onParamChange: (paramName: string, value: unknown) => void;
}

const ParamFieldRow: React.FC<ParamFieldRowProps> = React.memo(
  ({ param, value, label, onParamChange }) => {
    const handleCommit = useCallback(
      (val: unknown) => {
        onParamChange(param.name, val);
      },
      [onParamChange, param.name],
    );

    return (
      <ParamFieldEditor
        param={param}
        value={value}
        onCommit={handleCommit}
        label={label}
      />
    );
  },
);
ParamFieldRow.displayName = "ParamFieldRow";

export const TestParamsForm: React.FC<TestParamsFormProps> = React.memo(({
  selectedOp,
  activeCase,
  label,
  onParamChange,
}) => {
  const paramDefs =
    selectedOp.params && selectedOp.params.length > 0
      ? selectedOp.params
      : [{ name: "key", type: "string", required: true }];

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Code2 size={13} />
          Input Parameters ({paramDefs.length})
        </Label>
        <span className="text-[10px] text-muted-foreground">
          Values passed to <code>{selectedOp.name}()</code>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {paramDefs.map((p) => (
          <ParamFieldRow
            key={`${activeCase.id}-${p.name}`}
            param={p}
            value={activeCase.params[p.name]}
            label={label}
            onParamChange={onParamChange}
          />
        ))}
      </div>
    </div>
  );
});

TestParamsForm.displayName = "TestParamsForm";


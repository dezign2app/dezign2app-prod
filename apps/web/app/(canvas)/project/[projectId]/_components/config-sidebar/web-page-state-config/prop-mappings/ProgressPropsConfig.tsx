"use client";

import React from "react";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import { LocalInput } from "../../../backend-nodes/graph-nodes/shared";
import { StateStoreVariablePicker } from "../StateStoreVariablePicker";
import { BasePropsConfigProps } from "./types";

export const ProgressPropsConfig: React.FC<BasePropsConfigProps> = React.memo(({
  propMappings,
  onUpdatePropMapping,
  stateStores,
  stateName,
  effectiveStoreName,
  effectiveStoreId,
}) => {
  return (
    <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
      {/* Progress Value Binding */}
      <StateStoreVariablePicker
        label="Progress Value Binding"
        propName="value"
        valueBinding={propMappings.progressValueBinding || propMappings.valueBinding || stateName}
        storeName={propMappings.progressValueStoreName || effectiveStoreName}
        storeId={propMappings.progressValueStoreId || effectiveStoreId}
        mode={propMappings.valueMode}
        stateStores={stateStores}
        expectedType="number"
        placeholder={stateName}
        description="Numeric StateStore variable feeding the progress bar (0 - 100)."
        onChange={(res) => {
          onUpdatePropMapping({
            progressValueBinding: res.valueBinding,
            progressValueStoreName: res.storeName,
            progressValueStoreId: res.storeId,
            valueBinding: res.valueBinding,
            valueStoreName: res.storeName,
            valueStoreId: res.storeId,
            valueMode: res.mode,
          });
        }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-medium text-foreground">
            Max Value (<code className="font-mono text-[10px] text-cyan-500">max</code>)
          </Label>
          <LocalInput
            type="number"
            value={propMappings.max ?? 100}
            onChange={(e) => onUpdatePropMapping({ max: Number(e.target.value) || 100 })}
            placeholder="100"
            className="h-8 text-xs font-mono bg-background"
          />
          <span className="text-[10px] text-muted-foreground">Default scale 0 to 100</span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-background/80 border border-border/40 mt-auto">
          <div className="flex flex-col">
            <Label className="text-[11px] font-medium cursor-pointer">
              Show Percentage
            </Label>
            <span className="text-[9px] text-muted-foreground">Display % metric</span>
          </div>
          <Switch
            checked={propMappings.showPercent !== false}
            onCheckedChange={(checked) => onUpdatePropMapping({ showPercent: checked })}
          />
        </div>
      </div>
    </div>
  );
});
ProgressPropsConfig.displayName = "ProgressPropsConfig";

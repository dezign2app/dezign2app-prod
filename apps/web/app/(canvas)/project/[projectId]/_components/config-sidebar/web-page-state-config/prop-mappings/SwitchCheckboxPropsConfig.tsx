"use client";

import React from "react";
import {
  ToggleLeft,
  SquareCheck,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import { StateStoreVariablePicker } from "../StateStoreVariablePicker";
import { SwitchCheckboxPropsConfigProps } from "./types";

export const SwitchCheckboxPropsConfig: React.FC<SwitchCheckboxPropsConfigProps> = React.memo(({
  propMappings,
  onUpdatePropMapping,
  stateStores,
  stateName,
  effectiveStoreName,
  effectiveStoreId,
  defaultSetterName = "setChecked",
  currentComponent,
}) => {
  return (
    <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
      {/* Header pill / store indicator */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40 text-[11px]">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          {currentComponent === "switch" ? (
            <ToggleLeft size={13} className="text-primary" />
          ) : (
            <SquareCheck size={13} className="text-primary" />
          )}
          <span>{currentComponent === "switch" ? "Switch" : "Checkbox"} Configuration</span>
        </div>
        {effectiveStoreName ? (
          <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Bound to {effectiveStoreName.endsWith("Store") ? effectiveStoreName : `${effectiveStoreName}Store`}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 text-muted-foreground">
            Unbound Component
          </Badge>
        )}
      </div>

      {/* Checked State Binding */}
      <StateStoreVariablePicker
        label="Checked State Binding"
        propName="checked"
        valueBinding={propMappings.checkedBinding || propMappings.valueBinding || stateName}
        storeName={propMappings.checkedStoreName || effectiveStoreName}
        storeId={propMappings.checkedStoreId || effectiveStoreId}
        mode={propMappings.checkedMode}
        stateStores={stateStores}
        expectedType="boolean"
        placeholder={stateName}
        description="Boolean StateStore variable controlling the toggled on/off state."
        onChange={(res) => {
          onUpdatePropMapping({
            checkedBinding: res.valueBinding,
            checkedStoreName: res.storeName,
            checkedStoreId: res.storeId,
            checkedMode: res.mode,
            valueBinding: res.valueBinding,
            valueStoreName: res.storeName,
            valueStoreId: res.storeId,
            targetSetterName: res.suggestedSetterName || propMappings.targetSetterName,
          });
        }}
      />

      {/* Direct State Mutation Wiring preview */}
      <div className="p-2 rounded-lg bg-background/80 border border-border/40 text-[11px] space-y-1">
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle2 size={12} />
          <span>Toggle Mutation Wired</span>
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {effectiveStoreName
            ? `Calls ${effectiveStoreName.endsWith("Store") ? effectiveStoreName : `${effectiveStoreName}Store`}.${propMappings.targetSetterName || defaultSetterName}(checked)`
            : `Calls ${propMappings.targetSetterName || defaultSetterName}(checked)`}
        </div>
      </div>

      <div className="flex items-center justify-between p-2 rounded-lg bg-background/80 border border-border/40">
        <div className="flex flex-col">
          <Label className="text-[11px] font-medium cursor-pointer">
            Disabled (<code className="font-mono text-[9px]">disabled</code>)
          </Label>
          <span className="text-[9px] text-muted-foreground">Prevent user interaction</span>
        </div>
        <Switch
          checked={Boolean(propMappings.disabled)}
          onCheckedChange={(checked) => onUpdatePropMapping({ disabled: checked })}
        />
      </div>
    </div>
  );
});
SwitchCheckboxPropsConfig.displayName = "SwitchCheckboxPropsConfig";

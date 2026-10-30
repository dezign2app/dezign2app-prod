"use client";

import React from "react";
import { StateStoreVariablePicker } from "../StateStoreVariablePicker";
import { BasePropsConfigProps } from "./types";

export const CodeTextPropsConfig: React.FC<BasePropsConfigProps> = React.memo(({
  propMappings,
  onUpdatePropMapping,
  stateStores,
  stateName,
  effectiveStoreName,
  effectiveStoreId,
}) => {
  return (
    <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50 text-xs">
      <StateStoreVariablePicker
        label="Rendered State Value"
        propName="children"
        valueBinding={propMappings.valueBinding ?? stateName}
        storeName={effectiveStoreName}
        storeId={effectiveStoreId}
        mode={propMappings.valueMode}
        stateStores={stateStores}
        placeholder={stateName}
        description="StateStore variable whose value is rendered and syntax-formatted."
        onChange={(res) => {
          onUpdatePropMapping({
            valueBinding: res.valueBinding,
            valueStoreName: res.storeName,
            valueStoreId: res.storeId,
            valueMode: res.mode,
          });
        }}
      />
      <span className="text-[10px] text-muted-foreground">
        Renders raw or serialized state value with syntax formatting.
      </span>
    </div>
  );
});
CodeTextPropsConfig.displayName = "CodeTextPropsConfig";

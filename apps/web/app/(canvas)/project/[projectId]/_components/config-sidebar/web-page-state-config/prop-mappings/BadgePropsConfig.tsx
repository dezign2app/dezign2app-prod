"use client";

import React from "react";
import { StateStoreVariablePicker } from "../StateStoreVariablePicker";
import { BasePropsConfigProps } from "./types";

export const BadgePropsConfig: React.FC<BasePropsConfigProps> = React.memo(({
  propMappings,
  onUpdatePropMapping,
  stateStores,
  stateName,
  effectiveStoreName,
  effectiveStoreId,
}) => {
  return (
    <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50 text-xs">
      {/* State Variable Binding */}
      <StateStoreVariablePicker
        label="Badge State Value"
        propName="children"
        valueBinding={propMappings.valueBinding ?? stateName}
        storeName={effectiveStoreName}
        storeId={effectiveStoreId}
        mode={propMappings.valueMode}
        stateStores={stateStores}
        placeholder={stateName}
        description="StateStore variable displayed inside the badge pill."
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
        Badge variant (default, secondary, outline, destructive) can be adjusted in the Formatting section below.
      </span>
    </div>
  );
});
BadgePropsConfig.displayName = "BadgePropsConfig";

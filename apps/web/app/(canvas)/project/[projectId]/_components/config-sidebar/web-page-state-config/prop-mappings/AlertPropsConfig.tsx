"use client";

import React from "react";
import { StateStoreVariablePicker } from "../StateStoreVariablePicker";
import { BasePropsConfigProps } from "./types";

export const AlertPropsConfig: React.FC<BasePropsConfigProps> = React.memo(({
  propMappings,
  onUpdatePropMapping,
  stateStores,
}) => {
  return (
    <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
      <StateStoreVariablePicker
        label="Alert Title"
        propName="title"
        valueBinding={propMappings.alertTitle || ""}
        storeName={propMappings.alertTitleStoreName}
        storeId={propMappings.alertTitleStoreId}
        mode={propMappings.alertTitleMode}
        stateStores={stateStores}
        placeholder="e.g. System Notice"
        description="Prominent headline rendered at top of alert banner."
        onChange={(res) => {
          onUpdatePropMapping({
            alertTitle: res.valueBinding,
            alertTitleStoreName: res.storeName,
            alertTitleStoreId: res.storeId,
            alertTitleMode: res.mode,
          });
        }}
      />
    </div>
  );
});
AlertPropsConfig.displayName = "AlertPropsConfig";

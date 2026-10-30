"use client";

import React from "react";
import { StateStoreVariablePicker } from "../StateStoreVariablePicker";
import { BasePropsConfigProps } from "./types";

export const CardPropsConfig: React.FC<BasePropsConfigProps> = React.memo(({
  propMappings,
  onUpdatePropMapping,
  stateStores,
  stateName,
  displayLabel,
  effectiveStoreName,
  effectiveStoreId,
}) => {
  return (
    <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
      {/* Card Metric Stat Binding */}
      <StateStoreVariablePicker
        label="Card Metric Stat Value"
        propName="value"
        valueBinding={propMappings.cardValueBinding || propMappings.valueBinding || stateName}
        storeName={propMappings.cardValueStoreName || effectiveStoreName}
        storeId={propMappings.cardValueStoreId || effectiveStoreId}
        mode={propMappings.valueMode}
        stateStores={stateStores}
        placeholder={stateName}
        description="Main numerical or text metric displayed inside the card body."
        onChange={(res) => {
          onUpdatePropMapping({
            cardValueBinding: res.valueBinding,
            cardValueStoreName: res.storeName,
            cardValueStoreId: res.storeId,
            valueBinding: res.valueBinding,
            valueStoreName: res.storeName,
            valueStoreId: res.storeId,
            valueMode: res.mode,
          });
        }}
      />

      {/* Card Title */}
      <StateStoreVariablePicker
        label="Card Title"
        propName="title"
        valueBinding={propMappings.titleBinding || ""}
        storeName={propMappings.titleStoreName}
        storeId={propMappings.titleStoreId}
        mode={propMappings.titleMode}
        stateStores={stateStores}
        placeholder={displayLabel}
        description="Header title text displayed above the stat value."
        onChange={(res) => {
          onUpdatePropMapping({
            titleBinding: res.valueBinding,
            titleStoreName: res.storeName,
            titleStoreId: res.storeId,
            titleMode: res.mode,
          });
        }}
      />

      {/* Card Subtitle / Description */}
      <StateStoreVariablePicker
        label="Card Subtitle / Description"
        propName="description"
        valueBinding={propMappings.descriptionBinding || ""}
        storeName={propMappings.descriptionStoreName}
        storeId={propMappings.descriptionStoreId}
        mode={propMappings.descriptionMode}
        stateStores={stateStores}
        placeholder="e.g. Total count or last 30 days"
        description="Subtitle or supplementary description text in card."
        onChange={(res) => {
          onUpdatePropMapping({
            descriptionBinding: res.valueBinding,
            descriptionStoreName: res.storeName,
            descriptionStoreId: res.storeId,
            descriptionMode: res.mode,
          });
        }}
      />
    </div>
  );
});
CardPropsConfig.displayName = "CardPropsConfig";

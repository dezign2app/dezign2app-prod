"use client";

import React from "react";
import { StateStoreVariablePicker } from "../StateStoreVariablePicker";
import { BasePropsConfigProps } from "./types";

export const AvatarPropsConfig: React.FC<BasePropsConfigProps> = React.memo(({
  propMappings,
  onUpdatePropMapping,
  stateStores,
  displayLabel,
}) => {
  return (
    <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
      <StateStoreVariablePicker
        label="Image URL"
        propName="src"
        valueBinding={propMappings.avatarSrc || ""}
        storeName={propMappings.avatarSrcStoreName}
        storeId={propMappings.avatarSrcStoreId}
        mode={propMappings.avatarSrcMode}
        stateStores={stateStores}
        placeholder="https://example.com/avatar.jpg"
        description="Direct image link or leave empty to use initials fallback."
        onChange={(res) => {
          onUpdatePropMapping({
            avatarSrc: res.valueBinding,
            avatarSrcStoreName: res.storeName,
            avatarSrcStoreId: res.storeId,
            avatarSrcMode: res.mode,
          });
        }}
      />

      <StateStoreVariablePicker
        label="Fallback Initials"
        propName="fallback"
        valueBinding={propMappings.avatarFallback || ""}
        storeName={propMappings.avatarFallbackStoreName}
        storeId={propMappings.avatarFallbackStoreId}
        mode={propMappings.avatarFallbackMode}
        stateStores={stateStores}
        placeholder={displayLabel.slice(0, 2).toUpperCase() || "AV"}
        description="Initials rendered when image is loading or fails."
        onChange={(res) => {
          onUpdatePropMapping({
            avatarFallback: res.valueBinding,
            avatarFallbackStoreName: res.storeName,
            avatarFallbackStoreId: res.storeId,
            avatarFallbackMode: res.mode,
          });
        }}
      />
    </div>
  );
});
AvatarPropsConfig.displayName = "AvatarPropsConfig";

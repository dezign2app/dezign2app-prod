import React, { useState } from "react";
import { ConfigItemData } from "../types";
import type { TestingViewMode } from "@workspace/canvas/types";

import { useStorageTestingConfig } from "./useStorageTestingConfig";
import { useStorageTestingActions } from "./useStorageTestingActions";
import { ServerStatusBar } from "./ServerStatusBar";
import { TestingViewTabs } from "./TestingViewTabs";
import { OperationsView } from "./OperationsView";
import { ConnectionView } from "./ConnectionView";
import { SuiteView } from "./SuiteView";

// Re-export pure utilities so external consumers keep the same import paths
export { generateOperationInvocationCode, generateFullVitestSuite } from "./codeGenerators";

export interface BucketTestingTabProps {
  item: ConfigItemData;
  handleUpdate?: (id: string, updates: Partial<ConfigItemData>) => void;
}

export const BucketTestingTab: React.FC<BucketTestingTabProps> = ({ item, handleUpdate }) => {
  const [viewMode, setViewMode] = useState<TestingViewMode>("operations");

  const config = useStorageTestingConfig(item);
  const actions = useStorageTestingActions(item, config, handleUpdate);

  return (
    <div className="flex flex-col gap-4 text-xs">
      <ServerStatusBar config={config} />
      <TestingViewTabs viewMode={viewMode} onSelect={setViewMode} />

      {viewMode === "operations" && <OperationsView config={config} actions={actions} />}
      {viewMode === "connection" && <ConnectionView config={config} actions={actions} />}
      {viewMode === "suite" && <SuiteView item={item} config={config} actions={actions} />}
    </div>
  );
};

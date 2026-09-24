"use client";

import React from "react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { Badge } from "@workspace/ui/components/badge";
import { Database, Sliders } from "lucide-react";
import { StoreCallPreviewCard } from "../state-store-config/StoreCallPreviewCard";
import {
  TargetStateStoreSectionProps,
  useTargetStateStoreBinding,
  StoreSelector,
  StoreActionSelector,
  StorePopulateMapping,
  StoreArgumentMapping,
  StoreActiveBadgeCard,
} from "./target-state-store";

export type { TargetStateStoreSectionProps };

export const TargetStateStoreSection: React.FC<TargetStateStoreSectionProps> = ({
  nodeId,
  actionId,
  actionName,
  actionEvent,
  storeBinding,
  stateStoreNodes,
  isEndpointConnected,
  connectedEndpointName,
  connectedEndpoint,
  eventRequestBody,
  onUpdateStoreBinding,
}) => {
  const {
    selectedStoreNode,
    fields,
    customActions,
    targetField,
    customActionParameters,
    isPopulateAction,
    isResetAction,
    selectedSourceKind,
    currentSuggestedPaths,
    handleStoreChange,
    handleActionChange,
    handleSourceKindChange,
    handlePathChange,
    handleCustomValueChange,
    handleFieldMappingChange,
    handleAutoMatchPopulate,
  } = useTargetStateStoreBinding({
    nodeId,
    actionId,
    actionName,
    actionEvent,
    storeBinding,
    stateStoreNodes,
    isEndpointConnected,
    connectedEndpoint,
    eventRequestBody,
    onUpdateStoreBinding,
  });

  return (
    <AccordionItem
      value="store_action_binding"
      className="border rounded-xl overflow-hidden bg-card"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/20 transition-colors [&>svg]:shrink-0">
        <div className="flex items-center justify-between w-full pr-2">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-indigo-500" />
            <span className="text-xs font-semibold">
              Target State Store &amp; Mutation
            </span>
          </div>
          {storeBinding && (
            <Badge
              variant="secondary"
              className="text-[10px] font-mono font-medium bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
            >
              {storeBinding.storeName}.{storeBinding.actionName}()
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-5 pt-2">
        <div className="flex flex-col gap-4">
          {/* Target State Store Selector */}
          <StoreSelector
            selectedStoreNodeId={storeBinding?.storeNodeId}
            stateStoreNodes={stateStoreNodes}
            onStoreChange={handleStoreChange}
          />

          {/* Store Mutation / Action Selector */}
          {selectedStoreNode && storeBinding && (
            <StoreActionSelector
              actionId={storeBinding.actionId}
              fields={fields}
              customActions={customActions}
              onActionChange={handleActionChange}
            />
          )}

          {/* Input Values / Parameter Mapping Section */}
          {selectedStoreNode && storeBinding && (
            <div className="flex flex-col gap-3 p-3 rounded-lg bg-secondary/20 border border-border/60">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sliders size={11} className="text-indigo-500" />
                  Function Input &amp; Argument Mapping
                </span>
                {isPopulateAction ? (
                  <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                    Target: {fields.length} store fields
                  </Badge>
                ) : targetField ? (
                  <Badge variant="outline" className="text-[9px] font-mono">
                    Target: {targetField.name} ({targetField.type})
                  </Badge>
                ) : null}
              </div>

              {isPopulateAction ? (
                <StorePopulateMapping
                  fields={fields}
                  parameterMappings={storeBinding.parameterMappings}
                  isEndpointConnected={isEndpointConnected}
                  connectedEndpoint={connectedEndpoint}
                  connectedEndpointName={connectedEndpointName}
                  actionName={actionName}
                  selectedSourceKind={selectedSourceKind}
                  currentSuggestedPaths={currentSuggestedPaths}
                  onSourceKindChange={handleSourceKindChange}
                  onFieldMappingChange={handleFieldMappingChange}
                  onAutoMatchPopulate={handleAutoMatchPopulate}
                />
              ) : (
                <StoreArgumentMapping
                  isResetAction={isResetAction}
                  targetField={targetField}
                  customActionParameters={customActionParameters}
                  actionName={actionName}
                  storeName={storeBinding.storeName}
                  boundActionName={storeBinding.actionName}
                  parameterMappings={storeBinding.parameterMappings}
                  onUpdateParameterMapping={(paramName, p) => {
                    onUpdateStoreBinding({
                      ...storeBinding,
                      parameterMappings: {
                        ...(storeBinding.parameterMappings || {}),
                        [paramName]: p,
                      },
                    });
                  }}
                  selectedSourceKind={selectedSourceKind}
                  onSourceKindChange={handleSourceKindChange}
                  isEndpointConnected={isEndpointConnected}
                  connectedEndpoint={connectedEndpoint}
                  connectedEndpointName={connectedEndpointName}
                  valuePath={storeBinding.valuePath}
                  onPathChange={handlePathChange}
                  customValue={storeBinding.customValue}
                  onCustomValueChange={handleCustomValueChange}
                  currentSuggestedPaths={currentSuggestedPaths}
                />
              )}
            </div>
          )}

          {/* Live Compiled Store Function Call Preview */}
          {selectedStoreNode && storeBinding && (
            <StoreCallPreviewCard
              storeName={storeBinding.storeName || "App"}
              actionName={storeBinding.actionName || "action"}
              actionType={storeBinding.actionType}
              targetFieldName={storeBinding.targetFieldName}
              updateSource={storeBinding.updateSource}
              valuePath={storeBinding.valuePath}
              customValue={storeBinding.customValue}
              parameterMappings={storeBinding.parameterMappings}
              sourceKind={selectedSourceKind === "endpoint" ? "response" : "payload"}
              subtitle={
                selectedSourceKind === "endpoint"
                  ? `Executes on ${connectedEndpointName || "API"} response`
                  : `Executes on ${actionName || "event"} trigger`
              }
            />
          )}

          {/* Active Connection Badge Card */}
          {selectedStoreNode && storeBinding && (
            <StoreActiveBadgeCard
              storeName={storeBinding.storeName}
              actionName={storeBinding.actionName}
              actionType={storeBinding.actionType}
            />
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

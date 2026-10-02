import React, { useState } from "react";
import type {
  LangGraphStateChannel,
  LangGraphCustomReducer,
} from "@/types/canvas";
import { useStateSimulationManager } from "../hooks/useStateSimulationManager";
import {
  StateTestingHeader,
  CurrentGraphStateCard,
  SimulateNodeOutputCard,
  SimulationTraceCard,
  StateHistoryTimeline,
  ReducerPlaygroundSection,
} from "./testing";

export interface StateTestingTabProps {
  stateChannels: LangGraphStateChannel[];
  customReducers?: LangGraphCustomReducer[];
  initialSelectedReducer?: string;
  onNavigateToChannels?: () => void;
}

export function StateTestingTab({
  stateChannels,
  customReducers = [],
  initialSelectedReducer,
  onNavigateToChannels,
}: StateTestingTabProps) {
  const {
    testingSubMode,
    setTestingSubMode,

    // State Transition
    simulatedState,
    isEditingState,
    setIsEditingState,
    rawStateInput,
    setRawStateInput,
    rawStateError,
    handleSaveRawState,
    handleResetToInitial,
    payloadMode,
    setPayloadMode,
    rawPayloadInput,
    setRawPayloadInput,
    payloadError,
    setPayloadError,
    handleFormatPayloadJson,
    formRows,
    handleAddFormRow,
    handleUpdateFormRow,
    handleRemoveFormRow,
    stepHistory,
    activeStepId,
    handleRevertToStep,
    lastSimulationResult,
    handleApplyUpdate,
    handleLoadStateUpdatePreset,
    handleSelectChannelToSimulate,
    singleChannelKey,
    setSingleChannelKey,
    singleUpdateVal,
    setSingleUpdateVal,

    // Reducer Playground
    selectedReducer,
    setSelectedReducer,
    matchedCustomReducer,
    customPlaygroundCode,
    setCustomPlaygroundCode,
    prevInput,
    setPrevInput,
    nextInput,
    setNextInput,
    playgroundResult,
    handleRunPlayground,
    handleSelectReducerForTesting,
    handleApplyPlaygroundPreset,
    handleLoadStateIntoPlaygroundPrev,
  } = useStateSimulationManager({
    stateChannels,
    customReducers,
    initialSelectedReducer,
  });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="flex flex-col gap-4 text-xs font-sans pb-6">
      {/* ── Top Header & Sub-Mode Switcher ── */}
      <StateTestingHeader
        testingSubMode={testingSubMode}
        onSubModeChange={setTestingSubMode}
        channelCount={stateChannels.length}
        onResetToInitial={handleResetToInitial}
      />

      {/* ── Mode 1: State Transition Simulator ── */}
      {testingSubMode === "transition" && (
        <div className="flex flex-col gap-4">
          <CurrentGraphStateCard
            simulatedState={simulatedState}
            stateChannels={stateChannels}
            customReducers={customReducers}
            isEditingState={isEditingState}
            setIsEditingState={setIsEditingState}
            rawStateInput={rawStateInput}
            setRawStateInput={setRawStateInput}
            rawStateError={rawStateError}
            onSaveRawState={handleSaveRawState}
            onSelectChannelToSimulate={handleSelectChannelToSimulate}
            onSelectReducerForTesting={handleSelectReducerForTesting}
            onNavigateToChannels={onNavigateToChannels}
            copiedKey={copiedKey}
            onCopy={handleCopy}
          />

          <SimulateNodeOutputCard
            stateChannels={stateChannels}
            customReducers={customReducers}
            simulatedState={simulatedState}
            payloadMode={payloadMode}
            setPayloadMode={setPayloadMode}
            singleChannelKey={singleChannelKey}
            setSingleChannelKey={setSingleChannelKey}
            singleUpdateVal={singleUpdateVal}
            setSingleUpdateVal={setSingleUpdateVal}
            rawPayloadInput={rawPayloadInput}
            setRawPayloadInput={setRawPayloadInput}
            payloadError={payloadError}
            setPayloadError={setPayloadError}
            onFormatPayloadJson={handleFormatPayloadJson}
            formRows={formRows}
            onAddFormRow={handleAddFormRow}
            onUpdateFormRow={handleUpdateFormRow}
            onRemoveFormRow={handleRemoveFormRow}
            onApplyUpdate={handleApplyUpdate}
            onLoadStateUpdatePreset={handleLoadStateUpdatePreset}
            onSelectChannelToSimulate={handleSelectChannelToSimulate}
            onSelectReducerForTesting={handleSelectReducerForTesting}
          />

          {lastSimulationResult && (
            <SimulationTraceCard simulationResult={lastSimulationResult} />
          )}

          <StateHistoryTimeline
            stepHistory={stepHistory}
            activeStepId={activeStepId}
            onRevertToStep={handleRevertToStep}
          />
        </div>
      )}

      {/* ── Mode 2: Reducer Playground (Unit Testing) ── */}
      {testingSubMode === "playground" && (
        <ReducerPlaygroundSection
          stateChannels={stateChannels}
          customReducers={customReducers}
          selectedReducer={selectedReducer}
          onSelectReducer={setSelectedReducer}
          matchedCustomReducer={matchedCustomReducer}
          customPlaygroundCode={customPlaygroundCode}
          setCustomPlaygroundCode={setCustomPlaygroundCode}
          prevInput={prevInput}
          setPrevInput={setPrevInput}
          nextInput={nextInput}
          setNextInput={setNextInput}
          playgroundResult={playgroundResult}
          onRunPlayground={handleRunPlayground}
          onApplyPlaygroundPreset={handleApplyPlaygroundPreset}
          onLoadStateIntoPlaygroundPrev={handleLoadStateIntoPlaygroundPrev}
          copiedKey={copiedKey}
          onCopy={handleCopy}
        />
      )}
    </div>
  );
}

import React from "react";
import {
  BUILT_IN_REDUCERS,
  StateTabHeader,
  StateChannelsSection,
  ReducersSection,
  useStateChannelsManager,
  useCustomReducersManager,
} from "./state-inspector";
import type { StateTabContentProps } from "./state-inspector/types";

export type { StateTabContentProps };
export { BUILT_IN_REDUCERS };

export function StateTabContent({
  stateChannels,
  setStateChannels,
  customReducers: externalCustomReducers,
  onAddCustomReducer,
  onUpdateCustomReducer,
  onDeleteCustomReducer,
  onClose,
}: StateTabContentProps) {
  const {
    availableFieldKeys,
    hasMessagesChannel,
    handleAddDefaultMessagesChannel,
    handleAddField,
    handleDeleteField,
    handleUpdateField,
  } = useStateChannelsManager({
    stateChannels,
    setStateChannels,
  });

  const {
    customReducers,
    showReducersSection,
    setShowReducersSection,
    isAddingReducer,
    setIsAddingReducer,
    newReducerName,
    setNewReducerName,
    newReducerCode,
    setNewReducerCode,
    newReducerDesc,
    setNewReducerDesc,
    newTargetField,
    newTargetFieldInput,
    setNewTargetFieldInput,
    handleSelectNewTargetField,
    handleCreateCustomReducer,
    resetNewReducerForm,
    editingReducerId,
    editReducerName,
    setEditReducerName,
    editReducerCode,
    setEditReducerCode,
    editReducerDesc,
    setEditReducerDesc,
    editTargetField,
    setEditTargetField,
    editTargetFieldInput,
    setEditTargetFieldInput,
    handleStartEditCustomReducer,
    handleCancelEditCustomReducer,
    handleSaveEditCustomReducer,
    handleDeleteCustomReducer,
    handleOpenCustomizeChatHistory,
  } = useCustomReducersManager({
    externalCustomReducers,
    stateChannels,
    setStateChannels,
    onAddCustomReducer,
    onUpdateCustomReducer,
    onDeleteCustomReducer,
  });

  return (
    <div className="flex-1 min-h-0 p-4 overflow-y-auto hide-scrollbar m-0 flex flex-col gap-4">
      <StateTabHeader
        channelCount={stateChannels.length}
        reducerCount={BUILT_IN_REDUCERS.length + customReducers.length}
        onAddField={handleAddField}
        onClose={onClose}
      />

      <StateChannelsSection
        stateChannels={stateChannels}
        customReducers={customReducers}
        hasMessagesChannel={hasMessagesChannel}
        onAddDefaultMessagesChannel={handleAddDefaultMessagesChannel}
        onAddField={handleAddField}
        onUpdateField={handleUpdateField}
        onDeleteField={handleDeleteField}
      />

      <ReducersSection
        customReducers={customReducers}
        stateChannels={stateChannels}
        availableFieldKeys={availableFieldKeys}
        showReducersSection={showReducersSection}
        onToggleShow={() => setShowReducersSection((prev) => !prev)}
        isAddingReducer={isAddingReducer}
        onStartAddReducer={() => {
          setShowReducersSection(true);
          setIsAddingReducer(true);
        }}
        newReducerName={newReducerName}
        setNewReducerName={setNewReducerName}
        newReducerCode={newReducerCode}
        setNewReducerCode={setNewReducerCode}
        newReducerDesc={newReducerDesc}
        setNewReducerDesc={setNewReducerDesc}
        newTargetField={newTargetField}
        newTargetFieldInput={newTargetFieldInput}
        setNewTargetFieldInput={setNewTargetFieldInput}
        onSelectNewTargetField={handleSelectNewTargetField}
        onCreateCustomReducer={handleCreateCustomReducer}
        onResetNewReducerForm={resetNewReducerForm}
        editingReducerId={editingReducerId}
        editReducerName={editReducerName}
        setEditReducerName={setEditReducerName}
        editReducerCode={editReducerCode}
        setEditReducerCode={setEditReducerCode}
        editReducerDesc={editReducerDesc}
        setEditReducerDesc={setEditReducerDesc}
        editTargetField={editTargetField}
        setEditTargetField={setEditTargetField}
        editTargetFieldInput={editTargetFieldInput}
        setEditTargetFieldInput={setEditTargetFieldInput}
        onStartEditCustomReducer={handleStartEditCustomReducer}
        onCancelEditCustomReducer={handleCancelEditCustomReducer}
        onSaveEditCustomReducer={handleSaveEditCustomReducer}
        onDeleteCustomReducer={handleDeleteCustomReducer}
        onOpenCustomizeChatHistory={handleOpenCustomizeChatHistory}
      />
    </div>
  );
}

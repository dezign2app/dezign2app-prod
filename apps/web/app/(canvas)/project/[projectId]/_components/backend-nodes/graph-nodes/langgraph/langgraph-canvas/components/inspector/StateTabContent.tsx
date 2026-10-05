import React, { useState, useCallback } from "react";
import { Database, FlaskConical, X } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import {
  BUILT_IN_REDUCERS,
  StateTabHeader,
  StateChannelsSection,
  ReducersSection,
  StateTestingTab,
  useStateChannelsManager,
  useCustomReducersManager,
} from "./state-inspector";
import type { StateTabContentProps } from "./state-inspector/types";
import type { LangGraphCustomReducer } from "@/types/canvas";

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
  defaultTab = "channels",
  initialSelectedReducer: externalInitialReducer,
}: StateTabContentProps) {
  const [activeTab, setActiveTab] = useState<"channels" | "testing">(defaultTab);
  const [targetTestReducer, setTargetTestReducer] = useState<string | undefined>(
    externalInitialReducer,
  );

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

  const handleTestReducer = useCallback((reducerName: string) => {
    setTargetTestReducer(reducerName);
    setActiveTab("testing");
  }, []);

  const handleTestChannel = useCallback(
    (_channelKey: string, reducerName: string) => {
      setTargetTestReducer(reducerName);
      setActiveTab("testing");
    },
    [],
  );

  const handleEditCustomReducerFromField = useCallback(
    (reducer: LangGraphCustomReducer) => {
      setShowReducersSection(true);
      handleStartEditCustomReducer(reducer);
      setTimeout(() => {
        const target =
          document.getElementById("edit-custom-reducer-form") ||
          document.getElementById("reducers-section");
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    },
    [handleStartEditCustomReducer, setShowReducersSection],
  );

  const handleCreateCustomReducerForField = useCallback(
    (fieldKey: string) => {
      setShowReducersSection(true);
      handleSelectNewTargetField(fieldKey);
      setIsAddingReducer(true);
      setTimeout(() => {
        const target =
          document.getElementById("create-custom-reducer-form") ||
          document.getElementById("reducers-section");
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    },
    [handleSelectNewTargetField, setIsAddingReducer, setShowReducersSection],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top Tabs Navigation Bar ── */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "channels" | "testing")}
        className="flex-1 flex flex-col h-full min-h-0"
      >
        <div className="px-3 pt-3 pb-2 border-b border-border/60 bg-muted/20 shrink-0 flex items-center gap-2">
          <TabsList className="flex-1 grid grid-cols-2 h-8 p-1 bg-muted/60">
            <TabsTrigger
              value="channels"
              className="text-xs flex items-center justify-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground font-semibold transition-all"
            >
              <Database className="w-3.5 h-3.5 text-[#006ddd]" />
              <span>Channels &amp; Reducers</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-normal text-muted-foreground ml-1">
                {stateChannels.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="testing"
              className="text-xs flex items-center justify-center gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-semibold transition-all"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Test State &amp; Reducers</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
            </TabsTrigger>
          </TabsList>

          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 rounded-md"
              onClick={onClose}
              onMouseDown={(e) => e.stopPropagation()}
              title="Close inspector (Esc)"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* ── Tab 1: Channels & Reducers (Schema Definition) ── */}
        <TabsContent
          value="channels"
          className="flex-1 min-h-0 overflow-y-auto hide-scrollbar m-0 p-4 flex flex-col gap-4"
        >
          <StateTabHeader
            channelCount={stateChannels.length}
            reducerCount={BUILT_IN_REDUCERS.length + customReducers.length}
            onAddField={handleAddField}
            onClose={onClose}
            onOpenTesting={() => setActiveTab("testing")}
          />

          <StateChannelsSection
            stateChannels={stateChannels}
            customReducers={customReducers}
            hasMessagesChannel={hasMessagesChannel}
            onAddDefaultMessagesChannel={handleAddDefaultMessagesChannel}
            onAddField={handleAddField}
            onUpdateField={handleUpdateField}
            onDeleteField={handleDeleteField}
            onTestChannel={handleTestChannel}
            onStartEditCustomReducer={handleEditCustomReducerFromField}
            onAddCustomReducerForField={handleCreateCustomReducerForField}
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
            onTestReducer={handleTestReducer}
          />
        </TabsContent>

        {/* ── Tab 2: Test State & Reducers (Testing & Simulation) ── */}
        <TabsContent
          value="testing"
          className="flex-1 min-h-0 overflow-y-auto hide-scrollbar m-0 p-4"
        >
          <StateTestingTab
            stateChannels={stateChannels}
            customReducers={customReducers}
            initialSelectedReducer={targetTestReducer}
            onNavigateToChannels={() => setActiveTab("channels")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

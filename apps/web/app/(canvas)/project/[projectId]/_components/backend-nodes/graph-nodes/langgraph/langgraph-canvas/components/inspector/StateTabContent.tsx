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
  StateTestingTab,
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
    handleDeleteCustomReducer,
  } = useCustomReducersManager({
    externalCustomReducers,
    stateChannels,
    setStateChannels,
    onAddCustomReducer,
    onUpdateCustomReducer,
    onDeleteCustomReducer,
  });

  const handleTestChannel = useCallback(
    (_channelKey: string, reducerName: string) => {
      setTargetTestReducer(reducerName);
      setActiveTab("testing");
    },
    [],
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
            onAddCustomReducer={onAddCustomReducer}
            onUpdateCustomReducer={onUpdateCustomReducer}
            onDeleteCustomReducer={handleDeleteCustomReducer}
          />

          {/* Thread ID Architecture Callout */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs">
            <span className="text-primary mt-0.5 text-sm">ℹ️</span>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
                <span>Looking for <code className="font-mono text-primary font-bold">thread_id</code>?</span>
              </span>
              <span className="text-[10px] text-muted-foreground leading-relaxed">
                In LangGraph, <code className="font-mono text-foreground/80">thread_id</code> is managed as a checkpointer session key in the <strong>Memory</strong> tab and passed dynamically by calling API routes via <code className="font-mono text-primary font-bold">configurable.thread_id</code>. It is intentionally kept separate from State Channels so checkpointer storage can persist and resume conversation context across turns.
              </span>
            </div>
          </div>
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

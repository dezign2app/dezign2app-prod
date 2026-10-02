import React from "react";
import type { LangGraphStateChannel, LangGraphCustomReducer } from "@/types/canvas";
import { StateChannelsEmpty } from "./StateChannelsEmpty";
import { ChatHistoryCallout } from "./ChatHistoryCallout";
import { StateChannelItem } from "./StateChannelItem";

interface StateChannelsSectionProps {
  stateChannels: LangGraphStateChannel[];
  customReducers: LangGraphCustomReducer[];
  hasMessagesChannel: boolean;
  onAddDefaultMessagesChannel: () => void;
  onAddField: () => void;
  onUpdateField: (
    index: number,
    changes: Partial<LangGraphStateChannel>,
  ) => void;
  onDeleteField: (index: number) => void;
  onTestChannel?: (channelKey: string, reducerName: string) => void;
  onStartEditCustomReducer?: (reducer: LangGraphCustomReducer) => void;
  onAddCustomReducerForField?: (fieldKey: string) => void;
}

export function StateChannelsSection({
  stateChannels,
  customReducers,
  hasMessagesChannel,
  onAddDefaultMessagesChannel,
  onAddField,
  onUpdateField,
  onDeleteField,
  onTestChannel,
  onStartEditCustomReducer,
  onAddCustomReducerForField,
}: StateChannelsSectionProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        State Channels ({stateChannels.length})
      </span>

      {stateChannels.length === 0 ? (
        <StateChannelsEmpty
          onAddDefaultMessagesChannel={onAddDefaultMessagesChannel}
          onAddField={onAddField}
        />
      ) : (
        <>
          {!hasMessagesChannel && (
            <ChatHistoryCallout
              onAddDefaultMessagesChannel={onAddDefaultMessagesChannel}
            />
          )}
          {stateChannels.map((ch, idx) => (
            <StateChannelItem
              key={idx}
              channel={ch}
              index={idx}
              customReducers={customReducers}
              onUpdateField={onUpdateField}
              onDeleteField={onDeleteField}
              onTestChannel={onTestChannel}
              onStartEditCustomReducer={onStartEditCustomReducer}
              onAddCustomReducerForField={onAddCustomReducerForField}
            />
          ))}
        </>
      )}
    </div>
  );
}

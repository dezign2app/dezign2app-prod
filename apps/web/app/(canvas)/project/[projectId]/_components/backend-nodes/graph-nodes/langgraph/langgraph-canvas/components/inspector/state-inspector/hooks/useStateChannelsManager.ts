import React from "react";
import type { LangGraphStateChannel } from "@/types/canvas";

interface UseStateChannelsManagerProps {
  stateChannels: LangGraphStateChannel[];
  setStateChannels: React.Dispatch<
    React.SetStateAction<LangGraphStateChannel[]>
  >;
}

export function useStateChannelsManager({
  stateChannels,
  setStateChannels,
}: UseStateChannelsManagerProps) {
  const availableFieldKeys = React.useMemo(() => {
    return stateChannels
      .map((c) => c.key)
      .filter((k): k is string => Boolean(k && k.trim()));
  }, [stateChannels]);

  const hasMessagesChannel = React.useMemo(() => {
    return stateChannels.some((c) => c.key === "messages");
  }, [stateChannels]);

  const handleAddDefaultMessagesChannel = React.useCallback(() => {
    if (stateChannels.some((c) => c.key === "messages")) return;
    const defaultMessagesChannel: LangGraphStateChannel = {
      key: "messages",
      type: "messages",
      reducer: "add_messages",
      defaultValue: [],
    };
    setStateChannels([defaultMessagesChannel, ...stateChannels]);
  }, [stateChannels, setStateChannels]);

  const handleAddField = React.useCallback(() => {
    const newChannel: LangGraphStateChannel = {
      key: "",
      type: "string",
      reducer: "replace",
      defaultValue: "",
    };
    setStateChannels([...stateChannels, newChannel]);
  }, [stateChannels, setStateChannels]);

  const handleDeleteField = React.useCallback(
    (index: number) => {
      if (stateChannels[index]?.key === "messages") return;
      setStateChannels(stateChannels.filter((_, i) => i !== index));
    },
    [stateChannels, setStateChannels],
  );

  const handleUpdateField = React.useCallback(
    (index: number, changes: Partial<LangGraphStateChannel>) => {
      setStateChannels(
        stateChannels.map((c, i) => (i === index ? { ...c, ...changes } : c)),
      );
    },
    [stateChannels, setStateChannels],
  );

  return {
    availableFieldKeys,
    hasMessagesChannel,
    handleAddDefaultMessagesChannel,
    handleAddField,
    handleDeleteField,
    handleUpdateField,
  };
}

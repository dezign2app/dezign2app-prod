import React, { useState } from "react";
import type { LangGraphStateChannel, LangGraphCustomReducer } from "@/types/canvas";
import {
  DEFAULT_REDUCER_CODE,
  getSuggestedReducerCodeForChannelType,
} from "../constants";

interface UseCustomReducersManagerProps {
  externalCustomReducers?: LangGraphCustomReducer[];
  stateChannels: LangGraphStateChannel[];
  setStateChannels: React.Dispatch<
    React.SetStateAction<LangGraphStateChannel[]>
  >;
  onAddCustomReducer?: (reducer: LangGraphCustomReducer) => void;
  onUpdateCustomReducer?: (
    idOrName: string,
    changes: Partial<LangGraphCustomReducer>,
  ) => void;
  onDeleteCustomReducer?: (idOrName: string) => void;
}

export function useCustomReducersManager({
  externalCustomReducers,
  stateChannels,
  setStateChannels,
  onAddCustomReducer,
  onUpdateCustomReducer,
  onDeleteCustomReducer,
}: UseCustomReducersManagerProps) {
  const customReducers = React.useMemo(() => {
    return [...(externalCustomReducers || [])];
  }, [externalCustomReducers]);

  const [showReducersSection, setShowReducersSection] = useState(true);

  // New reducer state
  const [isAddingReducer, setIsAddingReducer] = useState(false);
  const [newReducerName, setNewReducerName] = useState("");
  const [newReducerCode, setNewReducerCode] = useState(DEFAULT_REDUCER_CODE);
  const [newReducerDesc, setNewReducerDesc] = useState("");
  const [newTargetField, setNewTargetField] = useState("");
  const [newTargetFieldInput, setNewTargetFieldInput] = useState("");

  // Edit custom reducer state
  const [editingReducerId, setEditingReducerId] = useState<string | null>(null);
  const [editReducerName, setEditReducerName] = useState("");
  const [editReducerCode, setEditReducerCode] = useState("");
  const [editReducerDesc, setEditReducerDesc] = useState("");
  const [editTargetField, setEditTargetField] = useState("");
  const [editTargetFieldInput, setEditTargetFieldInput] = useState("");

  const handleSelectNewTargetField = React.useCallback(
    (fieldKey: string) => {
      setNewTargetField(fieldKey);
      setNewTargetFieldInput(fieldKey);

      if (
        !newReducerName ||
        newReducerName.endsWith("_reducer") ||
        newReducerName === "custom_reducer"
      ) {
        setNewReducerName(`${fieldKey}_reducer`);
      }

      const channel = stateChannels.find((c) => c.key === fieldKey);
      setNewReducerCode(getSuggestedReducerCodeForChannelType(channel?.type));
    },
    [newReducerName, stateChannels],
  );

  const resetNewReducerForm = React.useCallback(() => {
    setIsAddingReducer(false);
    setNewReducerName("");
    setNewReducerCode(DEFAULT_REDUCER_CODE);
    setNewReducerDesc("");
    setNewTargetField("");
    setNewTargetFieldInput("");
  }, []);

  const handleCreateCustomReducer = React.useCallback(() => {
    const trimmedName = newReducerName.trim().replace(/\s+/g, "_");
    if (!trimmedName) return;

    const trimmedTarget = newTargetField.trim();
    const code = newReducerCode.trim() || "(prev, next) => next";

    const newReducer: LangGraphCustomReducer = {
      id: `custom_${Date.now().toString(36)}`,
      name: trimmedName,
      code,
      description: newReducerDesc.trim() || undefined,
      targetField: trimmedTarget || undefined,
    };

    if (onAddCustomReducer) {
      onAddCustomReducer(newReducer);
    }

    if (trimmedTarget) {
      setStateChannels((prev) => {
        const channelExists = prev.some((c) => c.key === trimmedTarget);
        if (channelExists) {
          return prev.map((c) =>
            c.key === trimmedTarget
              ? {
                  ...c,
                  reducer: trimmedName,
                  customReducerCode: code,
                }
              : c,
          );
        } else {
          return [
            ...prev,
            {
              key: trimmedTarget,
              type: "array",
              reducer: trimmedName,
              customReducerCode: code,
              defaultValue: "",
            },
          ];
        }
      });
    }

    resetNewReducerForm();
  }, [
    newReducerName,
    newTargetField,
    newReducerCode,
    newReducerDesc,
    onAddCustomReducer,
    setStateChannels,
    resetNewReducerForm,
  ]);

  const handleStartEditCustomReducer = React.useCallback(
    (reducer: LangGraphCustomReducer) => {
      setEditingReducerId(reducer.id);
      setEditReducerName(reducer.name);
      setEditReducerCode(reducer.code);
      setEditReducerDesc(reducer.description || "");

      const tiedChannel = stateChannels.find(
        (c) =>
          c.key === reducer.targetField ||
          c.reducer === reducer.name ||
          c.reducer === reducer.id,
      );
      const initialTarget = reducer.targetField || tiedChannel?.key || "";
      setEditTargetField(initialTarget);
      setEditTargetFieldInput(initialTarget);
    },
    [stateChannels],
  );

  const handleCancelEditCustomReducer = React.useCallback(() => {
    setEditingReducerId(null);
    setEditReducerName("");
    setEditReducerCode("");
    setEditReducerDesc("");
    setEditTargetField("");
    setEditTargetFieldInput("");
  }, []);

  const handleSaveEditCustomReducer = React.useCallback(
    (reducerId: string) => {
      const trimmedName = editReducerName.trim().replace(/\s+/g, "_");
      if (!trimmedName) return;

      const trimmedTarget = editTargetField.trim();
      const code = editReducerCode.trim() || "(prev, next) => next";

      if (onUpdateCustomReducer) {
        onUpdateCustomReducer(reducerId, {
          name: trimmedName,
          code,
          description: editReducerDesc.trim() || undefined,
          targetField: trimmedTarget || undefined,
        });
      }

      setStateChannels((prev) => {
        let foundTarget = false;
        const updated = prev.map((c) => {
          if (trimmedTarget && c.key === trimmedTarget) {
            foundTarget = true;
            return {
              ...c,
              reducer: trimmedName,
              customReducerCode: code,
            };
          }
          if (c.reducer === editReducerName || c.reducer === reducerId) {
            if (trimmedTarget && c.key !== trimmedTarget) {
              return {
                ...c,
                reducer: "replace",
                customReducerCode: undefined,
              };
            }
            return {
              ...c,
              reducer: trimmedName,
              customReducerCode: code,
            };
          }
          return c;
        });

        if (trimmedTarget && !foundTarget) {
          updated.push({
            key: trimmedTarget,
            type: "string",
            reducer: trimmedName,
            customReducerCode: code,
            defaultValue: "",
          });
        }

        return updated;
      });

      handleCancelEditCustomReducer();
    },
    [
      editReducerName,
      editTargetField,
      editReducerCode,
      editReducerDesc,
      onUpdateCustomReducer,
      setStateChannels,
      handleCancelEditCustomReducer,
    ],
  );

  const handleDeleteCustomReducer = React.useCallback(
    (reducerName: string) => {
      if (onDeleteCustomReducer) {
        onDeleteCustomReducer(reducerName);
      }
      setStateChannels((prev) =>
        prev.map((c) =>
          c.reducer === reducerName
            ? { ...c, reducer: "replace", customReducerCode: undefined }
            : c,
        ),
      );
    },
    [onDeleteCustomReducer, setStateChannels],
  );

  const handleOpenCustomizeChatHistory = React.useCallback(() => {
    setIsAddingReducer(true);
    setNewReducerName("add_messages");
    setNewTargetField("messages");
    setNewTargetFieldInput("messages");
    setNewReducerCode(
      "(prev, next) => [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [next])]",
    );
    setNewReducerDesc(
      "Custom chat history deduplication and append function",
    );
  }, []);

  return {
    customReducers,
    showReducersSection,
    setShowReducersSection,
    // Add reducer state & actions
    isAddingReducer,
    setIsAddingReducer,
    newReducerName,
    setNewReducerName,
    newReducerCode,
    setNewReducerCode,
    newReducerDesc,
    setNewReducerDesc,
    newTargetField,
    setNewTargetField,
    newTargetFieldInput,
    setNewTargetFieldInput,
    handleSelectNewTargetField,
    handleCreateCustomReducer,
    resetNewReducerForm,
    // Edit reducer state & actions
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
    // Delete & customize actions
    handleDeleteCustomReducer,
    handleOpenCustomizeChatHistory,
  };
}

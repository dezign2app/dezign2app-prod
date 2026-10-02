import { useState, useCallback, useMemo, useEffect } from "react";
import type {
  LangGraphStateChannel,
  LangGraphCustomReducer,
} from "@/types/canvas";
import {
  buildInitialState,
  simulateStateTransition,
  executeReducer,
  REDUCER_PRESETS,
  type StateSimulationStep,
  type ChannelSimulationResult,
  type ReducerExecutionResult,
} from "../utils/reducerSimulationEngine";

export interface UseStateSimulationManagerProps {
  stateChannels: LangGraphStateChannel[];
  customReducers?: LangGraphCustomReducer[];
  initialSelectedReducer?: string;
}

export function useStateSimulationManager({
  stateChannels,
  customReducers = [],
  initialSelectedReducer,
}: UseStateSimulationManagerProps) {
  // ── Active Sub-Mode in Testing ──
  const [testingSubMode, setTestingSubMode] = useState<
    "transition" | "playground"
  >("transition");

  // ── 1. Full State Transition Simulator ──
  const defaultInitialState = useMemo(
    () => buildInitialState(stateChannels),
    [stateChannels],
  );

  const [simulatedState, setSimulatedState] =
    useState<Record<string, unknown>>(defaultInitialState);

  // Sync state if channels change when starting
  useEffect(() => {
    setSimulatedState((prev) => {
      const next: Record<string, unknown> = { ...prev };
      for (const ch of stateChannels) {
        if (!Object.prototype.hasOwnProperty.call(next, ch.key)) {
          next[ch.key] = defaultInitialState[ch.key];
        }
      }
      return next;
    });
  }, [stateChannels, defaultInitialState]);

  // Raw initial state edit mode
  const [isEditingState, setIsEditingState] = useState(false);
  const [rawStateInput, setRawStateInput] = useState(() =>
    JSON.stringify(defaultInitialState, null, 2),
  );
  const [rawStateError, setRawStateError] = useState<string | null>(null);

  // Incoming Node State Update payload
  const [payloadMode, setPayloadMode] = useState<"single" | "json" | "form">(
    "single",
  );
  const [singleChannelKey, setSingleChannelKey] = useState<string>(() => {
    return stateChannels[0]?.key || "";
  });
  const [singleUpdateVal, setSingleUpdateVal] = useState<string>(() => {
    const first = stateChannels[0];
    if (first?.type === "number") return "1";
    if (first?.type === "boolean") return "true";
    if (first?.type === "messages") {
      return JSON.stringify(
        [
          {
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: "Hello! State transition test.",
          },
        ],
        null,
        2,
      );
    }
    return '"updated"';
  });
  const [rawPayloadInput, setRawPayloadInput] = useState(() => {
    const firstChannel = stateChannels[0];
    if (firstChannel?.key === "messages") {
      return JSON.stringify(
        {
          messages: [
            {
              id: "msg-sim-1",
              role: "assistant",
              content: "Hello! State transition test.",
            },
          ],
        },
        null,
        2,
      );
    }
    if (firstChannel) {
      return JSON.stringify(
        {
          [firstChannel.key]:
            firstChannel.type === "number"
              ? 1
              : firstChannel.type === "boolean"
                ? true
                : firstChannel.type === "array"
                  ? ["test_item"]
                  : "updated_val",
        },
        null,
        2,
      );
    }
    return JSON.stringify({ sampleKey: "sampleValue" }, null, 2);
  });
  const [payloadError, setPayloadError] = useState<string | null>(null);

  // Visual form update rows
  const [formRows, setFormRows] = useState<
    Array<{ key: string; valueStr: string }>
  >(() => {
    const first = stateChannels[0];
    return first ? [{ key: first.key, valueStr: "" }] : [];
  });

  // Step History (Time Travel)
  const [stepHistory, setStepHistory] = useState<StateSimulationStep[]>(() => [
    {
      id: "step-0",
      timestamp: Date.now(),
      label: "Step 0 (Initial State)",
      state: defaultInitialState,
      updatePayload: {},
      channelResults: [],
    },
  ]);

  const [activeStepId, setActiveStepId] = useState<string>("step-0");

  const [lastSimulationResult, setLastSimulationResult] = useState<{
    channelResults: ChannelSimulationResult[];
    unmatchedPayloadKeys: string[];
  } | null>(null);

  // ── 2. Reducer Playground (Single Reducer Unit Test) ──
  const [selectedReducer, setSelectedReducer] = useState<string>(
    initialSelectedReducer ||
      (stateChannels.find((c) => c.key === "messages")
        ? "add_messages"
        : stateChannels[0]?.reducer || "replace"),
  );

  const matchedCustomReducer = useMemo(() => {
    const fromCustom = customReducers.find(
      (r) => r.name === selectedReducer || r.id === selectedReducer,
    );
    if (fromCustom) return fromCustom;

    // Check if any state channel has this custom reducer name
    const fromChannel = stateChannels.find((c) => c.reducer === selectedReducer);
    if (fromChannel) {
      return {
        id: `channel-reducer-${fromChannel.key}`,
        name: fromChannel.reducer,
        targetField: fromChannel.key,
        code:
          fromChannel.customReducerCode ||
          (fromChannel.type === "number"
            ? "(prev, next) => (prev ?? 0) + (next ?? 1)"
            : "(prev, next) => next"),
        description: `Reducer assigned to "${fromChannel.key}" channel`,
      } as LangGraphCustomReducer;
    }
    return undefined;
  }, [customReducers, selectedReducer, stateChannels]);

  const [customPlaygroundCode, setCustomPlaygroundCode] = useState<string>(
    matchedCustomReducer?.code || "(prev, next) => next",
  );

  // Sync custom playground code if selected reducer changes
  useEffect(() => {
    if (matchedCustomReducer) {
      setCustomPlaygroundCode(matchedCustomReducer.code);
    }
  }, [matchedCustomReducer]);

  // Initial playground prev & next inputs based on selected reducer
  const defaultPreset = useMemo(() => {
    const presets = REDUCER_PRESETS[selectedReducer];
    return presets?.[0] || null;
  }, [selectedReducer]);

  const [prevInput, setPrevInput] = useState<string>(() =>
    defaultPreset ? JSON.stringify(defaultPreset.prev, null, 2) : '""',
  );
  const [nextInput, setNextInput] = useState<string>(() =>
    defaultPreset ? JSON.stringify(defaultPreset.next, null, 2) : '""',
  );

  const [playgroundResult, setPlaygroundResult] =
    useState<ReducerExecutionResult | null>(null);

  // ── Functions: State Transition Simulator ──

  const handleSaveRawState = useCallback(() => {
    try {
      const parsed = JSON.parse(rawStateInput);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setRawStateError("State must be a JSON object: { key: value }");
        return;
      }
      setSimulatedState(parsed);
      setRawStateError(null);
      setIsEditingState(false);
      // Append step
      const stepId = `step-edit-${Date.now()}`;
      setStepHistory((prev) => [
        ...prev,
        {
          id: stepId,
          timestamp: Date.now(),
          label: `Edited State Manually`,
          state: parsed,
          updatePayload: {},
          channelResults: [],
        },
      ]);
      setActiveStepId(stepId);
    } catch (err: unknown) {
      setRawStateError(
        err instanceof Error ? err.message : "Invalid JSON format",
      );
    }
  }, [rawStateInput]);

  const handleResetToInitial = useCallback(() => {
    const fresh = buildInitialState(stateChannels);
    setSimulatedState(fresh);
    setRawStateInput(JSON.stringify(fresh, null, 2));
    setRawStateError(null);
    setLastSimulationResult(null);
    const initialStep: StateSimulationStep = {
      id: `step-reset-${Date.now()}`,
      timestamp: Date.now(),
      label: "Reset to Channel Defaults",
      state: fresh,
      updatePayload: {},
      channelResults: [],
    };
    setStepHistory([initialStep]);
    setActiveStepId(initialStep.id);
  }, [stateChannels]);

  const handleRevertToStep = useCallback(
    (stepId: string) => {
      const found = stepHistory.find((s) => s.id === stepId);
      if (found) {
        setSimulatedState(found.state);
        setRawStateInput(JSON.stringify(found.state, null, 2));
        setActiveStepId(stepId);
        setLastSimulationResult(
          found.channelResults.length > 0
            ? {
                channelResults: found.channelResults,
                unmatchedPayloadKeys: [],
              }
            : null,
        );
      }
    },
    [stepHistory],
  );

  const handleApplyUpdate = useCallback(() => {
    let payload: Record<string, unknown> = {};

    if (payloadMode === "single") {
      if (!singleChannelKey) {
        setPayloadError("Please select a channel to update.");
        return;
      }
      let parsedVal: unknown;
      try {
        parsedVal = JSON.parse(singleUpdateVal);
      } catch {
        parsedVal = singleUpdateVal;
      }
      payload = { [singleChannelKey]: parsedVal };
      setPayloadError(null);
    } else if (payloadMode === "json") {
      try {
        const parsed = JSON.parse(rawPayloadInput);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          setPayloadError(
            "State update payload must be a JSON object: { [channel]: value }",
          );
          return;
        }
        payload = parsed;
        setPayloadError(null);
      } catch (err: unknown) {
        setPayloadError(
          err instanceof Error ? err.message : "Invalid JSON format",
        );
        return;
      }
    } else {
      // Build from form rows
      for (const row of formRows) {
        if (!row.key) continue;
        let parsedVal: unknown = row.valueStr;
        try {
          parsedVal = JSON.parse(row.valueStr);
        } catch {
          parsedVal = row.valueStr;
        }
        payload[row.key] = parsedVal;
      }
    }

    const res = simulateStateTransition({
      stateChannels,
      customReducers,
      currentState: simulatedState,
      updatePayload: payload,
    });

    setSimulatedState(res.nextState);
    setRawStateInput(JSON.stringify(res.nextState, null, 2));
    setLastSimulationResult({
      channelResults: res.channelResults,
      unmatchedPayloadKeys: res.unmatchedPayloadKeys,
    });

    const stepIndex = stepHistory.length;
    const updatedCount = res.channelResults.filter(
      (r) => r.status === "updated",
    ).length;

    const newStep: StateSimulationStep = {
      id: `step-${Date.now()}`,
      timestamp: Date.now(),
      label: `Step ${stepIndex} (${updatedCount} channel${updatedCount === 1 ? "" : "s"} updated)`,
      state: res.nextState,
      updatePayload: payload,
      channelResults: res.channelResults,
    };

    setStepHistory((prev) => [...prev, newStep]);
    setActiveStepId(newStep.id);
  }, [
    payloadMode,
    singleChannelKey,
    singleUpdateVal,
    rawPayloadInput,
    formRows,
    stateChannels,
    customReducers,
    simulatedState,
    stepHistory.length,
  ]);

  const handleLoadStateUpdatePreset = useCallback(
    (payload: Record<string, unknown>) => {
      setPayloadMode("json");
      setRawPayloadInput(JSON.stringify(payload, null, 2));
      setPayloadError(null);
    },
    [],
  );

  const handleFormatPayloadJson = useCallback(() => {
    try {
      const parsed = JSON.parse(rawPayloadInput);
      setRawPayloadInput(JSON.stringify(parsed, null, 2));
      setPayloadError(null);
    } catch (err: unknown) {
      setPayloadError(
        err instanceof Error ? err.message : "Cannot format invalid JSON",
      );
    }
  }, [rawPayloadInput]);

  // Form row helpers
  const handleAddFormRow = useCallback(() => {
    const unused = stateChannels.find(
      (c) => !formRows.some((r) => r.key === c.key),
    );
    setFormRows((prev) => [
      ...prev,
      { key: unused ? unused.key : stateChannels[0]?.key || "", valueStr: "" },
    ]);
  }, [stateChannels, formRows]);

  const handleUpdateFormRow = useCallback(
    (index: number, changes: Partial<{ key: string; valueStr: string }>) => {
      setFormRows((prev) => {
        const next = [...prev];
        const currentRow = next[index];
        if (currentRow) {
          next[index] = { ...currentRow, ...changes };
        }
        return next;
      });
    },
    [],
  );

  const handleRemoveFormRow = useCallback((index: number) => {
    setFormRows((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Functions: Single Reducer Playground ──

  const handleRunPlayground = useCallback(() => {
    let parsedPrev: unknown;
    let parsedNext: unknown;

    try {
      parsedPrev = JSON.parse(prevInput);
    } catch {
      parsedPrev = prevInput;
    }

    try {
      parsedNext = JSON.parse(nextInput);
    } catch {
      parsedNext = nextInput;
    }

    const effectiveCode =
      selectedReducer === "custom" || matchedCustomReducer
        ? customPlaygroundCode
        : undefined;

    const res = executeReducer(
      matchedCustomReducer ? "custom" : selectedReducer,
      effectiveCode,
      parsedPrev,
      parsedNext,
      simulatedState,
    );

    setPlaygroundResult(res);
  }, [
    prevInput,
    nextInput,
    selectedReducer,
    matchedCustomReducer,
    customPlaygroundCode,
    simulatedState,
  ]);

  // Auto-run playground whenever inputs or selected reducer changes
  useEffect(() => {
    handleRunPlayground();
  }, [handleRunPlayground]);

  const handleSelectReducerForTesting = useCallback(
    (reducerName: string, customCode?: string) => {
      setSelectedReducer(reducerName);
      if (customCode) {
        setCustomPlaygroundCode(customCode);
      }
      setTestingSubMode("playground");

      // Load first preset for this reducer if available
      const presets = REDUCER_PRESETS[reducerName];
      const firstPreset = presets?.[0];
      if (firstPreset) {
        setPrevInput(JSON.stringify(firstPreset.prev, null, 2));
        setNextInput(JSON.stringify(firstPreset.next, null, 2));
      } else {
        // If no preset, provide current graph state as prev
        setPrevInput(JSON.stringify(simulatedState, null, 2));
        setNextInput(JSON.stringify(1, null, 2));
      }
    },
    [simulatedState],
  );

  const handleApplyPlaygroundPreset = useCallback(
    (preset: { prev: unknown; next: unknown }) => {
      setPrevInput(JSON.stringify(preset.prev, null, 2));
      setNextInput(JSON.stringify(preset.next, null, 2));
    },
    [],
  );

  const handleLoadStateIntoPlaygroundPrev = useCallback(() => {
    setPrevInput(JSON.stringify(simulatedState, null, 2));
  }, [simulatedState]);

  const handleSelectChannelToSimulate = useCallback(
    (channelKey: string) => {
      const ch = stateChannels.find((c) => c.key === channelKey);
      if (!ch) return;

      let defaultVal: unknown;
      if (ch.type === "number") defaultVal = 1;
      else if (ch.type === "boolean") defaultVal = true;
      else if (ch.type === "messages") {
        defaultVal = [
          {
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: "Simulated message update",
          },
        ];
      } else if (ch.type === "array") defaultVal = ["new_item"];
      else if (ch.type === "object") defaultVal = { updated_field: "value" };
      else defaultVal = "updated value";

      setRawPayloadInput(JSON.stringify({ [ch.key]: defaultVal }, null, 2));
      setFormRows([{ key: ch.key, valueStr: JSON.stringify(defaultVal) }]);
      setPayloadError(null);
    },
    [stateChannels],
  );

  return {
    // Mode
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
  };
}

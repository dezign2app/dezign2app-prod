import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Database,
  X,
  GitMerge,
  Code2,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Pencil,
  Link2,
  Lock,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { LocalInput, LocalTextarea } from "../../../../common";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@workspace/ui/components/combobox";
import type { LangGraphStateChannel, LangGraphCustomReducer } from "@/types/canvas";
import { isLangGraphChannelType } from "@workspace/canvas";

interface StateTabContentProps {
  stateChannels: LangGraphStateChannel[];
  setStateChannels: React.Dispatch<
    React.SetStateAction<LangGraphStateChannel[]>
  >;
  customReducers?: LangGraphCustomReducer[];
  onAddCustomReducer?: (reducer: LangGraphCustomReducer) => void;
  onUpdateCustomReducer?: (
    idOrName: string,
    changes: Partial<LangGraphCustomReducer>,
  ) => void;
  onDeleteCustomReducer?: (idOrName: string) => void;
  onClose?: () => void;
}

const BUILT_IN_REDUCERS = [
  {
    name: "replace",
    label: "replace (last-value-wins)",
    desc: "Direct assignment, overwriting previous value",
    typeHint: "primitive",
  },
  {
    name: "add_messages",
    label: "add_messages (chat history dedup/append)",
    desc: "LangGraph ID-based dedup and message history append",
    typeHint: "messages",
  },
  {
    name: "append",
    label: "append (array concat)",
    desc: "Appends incoming updates to the existing array",
    typeHint: "array",
  },
  {
    name: "concat_array",
    label: "concat_array (merge lists)",
    desc: "Concatenates array updates",
    typeHint: "array",
  },
  {
    name: "merge_object",
    label: "merge_object (dict merge)",
    desc: "Shallow dictionary merge: { ...prev, ...next }",
    typeHint: "object",
  },
];

export function StateTabContent({
  stateChannels,
  setStateChannels,
  customReducers: externalCustomReducers,
  onAddCustomReducer,
  onUpdateCustomReducer,
  onDeleteCustomReducer,
  onClose,
}: StateTabContentProps) {
  // Only explicitly defined shared custom reducers passed externally
  const customReducers = React.useMemo(() => {
    return [...(externalCustomReducers || [])];
  }, [externalCustomReducers]);

  const [isAddingReducer, setIsAddingReducer] = useState(false);
  const [newReducerName, setNewReducerName] = useState("");
  const [newReducerCode, setNewReducerCode] = useState("(prev, next) => Array.isArray(prev) ? [...prev, ...next] : next");
  const [newReducerDesc, setNewReducerDesc] = useState("");
  const [newTargetField, setNewTargetField] = useState("");
  const [newTargetFieldInput, setNewTargetFieldInput] = useState("");
  const [showReducersSection, setShowReducersSection] = useState(true);

  // Edit custom reducer state
  const [editingReducerId, setEditingReducerId] = useState<string | null>(null);
  const [editReducerName, setEditReducerName] = useState("");
  const [editReducerCode, setEditReducerCode] = useState("");
  const [editReducerDesc, setEditReducerDesc] = useState("");
  const [editTargetField, setEditTargetField] = useState("");
  const [editTargetFieldInput, setEditTargetFieldInput] = useState("");

  const availableFieldKeys = React.useMemo(() => {
    return stateChannels
      .map((c) => c.key)
      .filter((k): k is string => Boolean(k && k.trim()));
  }, [stateChannels]);

  const handleSelectNewTargetField = (fieldKey: string) => {
    setNewTargetField(fieldKey);
    setNewTargetFieldInput(fieldKey);

    // If reducer name is empty or default, suggest one based on fieldKey
    if (!newReducerName || newReducerName.endsWith("_reducer") || newReducerName === "custom_reducer") {
      setNewReducerName(`${fieldKey}_reducer`);
    }

    // Auto-suggest template code according to the channel type
    const channel = stateChannels.find((c) => c.key === fieldKey);
    if (channel) {
      if (channel.type === "array" || channel.type === "messages") {
        setNewReducerCode(
          "(prev, next) => [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [next])]",
        );
      } else if (channel.type === "number") {
        setNewReducerCode("(prev, next) => (prev || 0) + (next || 0)");
      } else if (channel.type === "object" || channel.type === "json") {
        setNewReducerCode(
          "(prev, next) => ({ ...(prev || {}), ...(next || {}) })",
        );
      } else if (channel.type === "string") {
        setNewReducerCode(
          "(prev, next) => (prev ? `${prev}\\n${next}` : next)",
        );
      }
    }
  };

  const handleStartEditCustomReducer = (reducer: LangGraphCustomReducer) => {
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
  };

  const handleCancelEditCustomReducer = () => {
    setEditingReducerId(null);
    setEditReducerName("");
    setEditReducerCode("");
    setEditReducerDesc("");
    setEditTargetField("");
    setEditTargetFieldInput("");
  };

  const handleSaveEditCustomReducer = (reducerId: string) => {
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

    // Synchronize channels:
    // Tie the target channel to this reducer, and update any channels that referenced the old name
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

    setEditingReducerId(null);
    setEditReducerName("");
    setEditReducerCode("");
    setEditReducerDesc("");
    setEditTargetField("");
    setEditTargetFieldInput("");
  };

  const handleAddDefaultMessagesChannel = () => {
    if (stateChannels.some((c) => c.key === "messages")) return;
    const defaultMessagesChannel: LangGraphStateChannel = {
      key: "messages",
      type: "messages",
      reducer: "add_messages",
      defaultValue: [],
    };
    setStateChannels([defaultMessagesChannel, ...stateChannels]);
  };

  const handleAddField = () => {
    const newChannel: LangGraphStateChannel = {
      key: "",
      type: "string",
      reducer: "replace",
      defaultValue: "",
    };
    setStateChannels([...stateChannels, newChannel]);
  };

  const handleDeleteField = (index: number) => {
    if (stateChannels[index]?.key === "messages") return;
    setStateChannels(stateChannels.filter((_, i) => i !== index));
  };

  const handleUpdateField = (
    index: number,
    changes: Partial<LangGraphStateChannel>,
  ) => {
    setStateChannels(
      stateChannels.map((c, i) => (i === index ? { ...c, ...changes } : c)),
    );
  };

  const handleCreateCustomReducer = () => {
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

    // Automatically tie the target state channel to this custom reducer
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

    setIsAddingReducer(false);
    setNewReducerName("");
    setNewReducerCode("(prev, next) => Array.isArray(prev) ? [...prev, ...next] : next");
    setNewReducerDesc("");
    setNewTargetField("");
    setNewTargetFieldInput("");
  };

  const handleDeleteCustomReducer = (reducerName: string) => {
    if (onDeleteCustomReducer) {
      onDeleteCustomReducer(reducerName);
    }
    // If any channel was using this custom reducer, revert to 'replace'
    setStateChannels((prev) =>
      prev.map((c) =>
        c.reducer === reducerName
          ? { ...c, reducer: "replace", customReducerCode: undefined }
          : c,
      ),
    );
  };

  return (
    <div className="flex-1 min-h-0 p-4 overflow-y-auto hide-scrollbar m-0 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#006ddd]/10 text-[#006ddd] border border-[#006ddd]/20">
            <Database className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xs text-foreground tracking-wide">
              Global Graph State
            </span>
            <span className="text-[10px] text-muted-foreground">
              {stateChannels.length} channels • {BUILT_IN_REDUCERS.length + customReducers.length} reducers
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-border gap-1 font-semibold hover:border-[#006ddd]/50 hover:bg-[#006ddd]/10 hover:text-[#006ddd]"
            onClick={handleAddField}
          >
            <Plus className="w-3.5 h-3.5" /> Add Field
          </Button>
          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              title="Close Inspector"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* State Channels Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          State Channels ({stateChannels.length})
        </span>

        {stateChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-border rounded-xl gap-2 bg-secondary/10">
            <Database className="w-8 h-8 text-muted-foreground/40" />
            <span className="text-xs font-semibold text-foreground">
              No State Channels Defined
            </span>
            <span className="text-[11px] text-muted-foreground max-w-[240px]">
              State channels hold shared data across graph nodes. Add a default chat history channel or custom fields.
            </span>
            <div className="flex items-center gap-2 mt-2">
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5 bg-[#006ddd] hover:bg-[#006ddd]/90 text-white font-semibold cursor-pointer shadow-sm"
                onClick={handleAddDefaultMessagesChannel}
              >
                <Plus className="w-3.5 h-3.5" /> Add Default messages (Chat History)
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 cursor-pointer"
                onClick={handleAddField}
              >
                <Plus className="w-3.5 h-3.5" /> Add Field
              </Button>
            </div>
          </div>
        ) : (
          <>
            {!stateChannels.some((c) => c.key === "messages") && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs">
                <div className="flex items-center gap-2 text-blue-300">
                  <Database className="w-4 h-4 text-blue-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">Chat History Channel</span>
                    <span className="text-[10px] text-muted-foreground">
                      LangGraph uses <code className="font-mono text-blue-300 font-semibold">messages</code> with <code className="font-mono text-blue-300 font-semibold">add_messages</code> reducer to persist chat turns.
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-6 text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1 shrink-0 cursor-pointer"
                  onClick={handleAddDefaultMessagesChannel}
                >
                  <Plus className="w-3 h-3" /> Add messages State
                </Button>
              </div>
            )}
            {stateChannels.map((ch, idx) => {
            const isCustom = !BUILT_IN_REDUCERS.some((r) => r.name === ch.reducer);
            const isBuiltin = ch.key === "messages";

            return (
              <div
                key={idx}
                className={`flex flex-col gap-3 p-3 rounded-xl border border-border/60 bg-card/60 shadow-sm backdrop-blur-sm text-xs ${
                  isBuiltin ? "border-blue-500/30 bg-blue-500/[0.03]" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] text-muted-foreground font-mono">
                        Field Key #{idx + 1}
                      </Label>
                      {isBuiltin && (
                        <div className="flex items-center gap-1 text-[9px] text-blue-400 font-mono">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Built-in Chat State</span>
                        </div>
                      )}
                    </div>
                    <LocalInput
                      className={`h-7 text-xs font-mono font-medium bg-background ${
                        isBuiltin ? "cursor-not-allowed opacity-80" : ""
                      }`}
                      placeholder="e.g. messages, user_query"
                      autoFocus={!ch.key && !isBuiltin}
                      disabled={isBuiltin}
                      value={ch.key}
                      onChange={(e) => {
                        if (!isBuiltin) {
                          handleUpdateField(idx, { key: e.target.value });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
                          e.target.blur();
                        }
                      }}
                    />
                  </div>
                  {!isBuiltin && (
                    <div className="self-end pb-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
                        onClick={() => handleDeleteField(idx)}
                        title="Delete state field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">Type</Label>
                    <Select
                      value={ch.type}
                      disabled={isBuiltin}
                      onValueChange={(v) => {
                        if (isLangGraphChannelType(v)) {
                          const defaultReducer =
                            v === "messages"
                              ? "add_messages"
                              : v === "array"
                                ? "append"
                                : v === "object"
                                  ? "merge_object"
                                  : "replace";
                          handleUpdateField(idx, { type: v, reducer: defaultReducer });
                        }
                      }}
                    >
                      <SelectTrigger className={`h-7 text-xs bg-background font-mono ${isBuiltin ? "cursor-not-allowed opacity-80" : ""}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="messages">messages</SelectItem>
                        <SelectItem value="string">string</SelectItem>
                        <SelectItem value="number">number</SelectItem>
                        <SelectItem value="boolean">boolean</SelectItem>
                        <SelectItem value="array">array</SelectItem>
                        <SelectItem value="object">object</SelectItem>
                        <SelectItem value="json">json</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] text-muted-foreground">Reducer</Label>
                      {isCustom && (
                        <span className="text-[9px] text-purple-400 font-mono font-bold">
                          custom
                        </span>
                      )}
                    </div>
                    <Select
                      disabled={isBuiltin}
                      value={isBuiltin ? "add_messages" : (ch.reducer === "add_message" ? "add_messages" : ch.reducer)}
                      onValueChange={(v) => {
                        const matchedCustom = customReducers.find((r) => r.name === v);
                        handleUpdateField(idx, {
                          reducer: v,
                          customReducerCode:
                            v === "custom"
                              ? (ch.customReducerCode || "(prev, next) => next")
                              : matchedCustom?.code,
                        });
                      }}
                    >
                      <SelectTrigger className={`h-7 text-xs bg-background font-mono ${isBuiltin ? "cursor-not-allowed opacity-80" : ""}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="font-mono text-xs">
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">
                          Built-in Reducers
                        </div>
                        {BUILT_IN_REDUCERS.map((r) => (
                          <SelectItem key={r.name} value={r.name}>
                            {r.label}
                          </SelectItem>
                        ))}

                        <div className="px-2 py-1 text-[10px] font-bold text-purple-400 uppercase border-t border-border/40 mt-1">
                          Developer Defined
                        </div>
                        <SelectItem value="custom" className="text-purple-300 font-semibold">
                          custom (developer defined inline)
                        </SelectItem>

                        {customReducers.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-[10px] font-bold text-purple-400 uppercase border-t border-border/40 mt-1">
                              Custom Reducers
                            </div>
                            {customReducers.map((r) => (
                              <SelectItem key={r.id} value={r.name}>
                                {r.name} {r.targetField ? `(tied to ${r.targetField})` : "(custom)"}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isCustom && (
                  <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold text-purple-300 flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-purple-400" />
                        Custom Reducer for <span className="font-mono text-foreground font-semibold">"{ch.key || "unnamed"}"</span>
                      </Label>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        (prev, next) =&gt; combined
                      </span>
                    </div>
                    <LocalInput
                      value={ch.customReducerCode ?? "(prev, next) => next"}
                      onChange={(e) =>
                        handleUpdateField(idx, {
                          customReducerCode: e.target.value,
                        })
                      }
                      className="font-mono text-xs bg-background h-8 border-purple-500/30 text-purple-200 placeholder:text-muted-foreground"
                      placeholder="(prev, next) => Array.isArray(prev) ? [...prev, ...next] : next"
                    />
                    <p className="text-[9px] text-muted-foreground leading-tight">
                      Developer-defined merge function executed whenever this field receives an update.
                    </p>
                  </div>
                )}

                {(ch.type === "messages" || ch.reducer === "add_messages") && (
                  <div className="p-1.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-sans text-muted-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span>Chat history channel: <code className="font-mono text-blue-300 font-semibold">add_messages</code> automatically deduplicates by message ID &amp; appends.</span>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
      </div>

      {/* Reducer Functions Section */}
      <div className="flex flex-col gap-2.5 border-t border-border/50 pt-3">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setShowReducersSection((prev) => !prev)}
        >
          <div className="flex items-center gap-1.5">
            <GitMerge className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Reducer Functions
            </span>
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 h-4 text-purple-400 border-purple-500/30 font-mono"
            >
              {customReducers.length} custom
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 gap-1 font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                setShowReducersSection(true);
                setIsAddingReducer(true);
              }}
            >
              <Plus className="w-3 h-3" /> Add Custom Reducer
            </Button>
            {showReducersSection ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>

        {showReducersSection && (
          <div className="flex flex-col gap-2">
            <div className="text-[10px] text-muted-foreground flex items-start gap-1 px-1">
              <Info className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
              <span>Custom merge functions tied to your state channels. Control how concurrent node updates merge into specific state variables.</span>
            </div>

            {/* Custom Reducer Creation Form */}
            {isAddingReducer && (
              <div className="flex flex-col gap-2.5 p-3 rounded-xl border border-purple-500/40 bg-purple-500/5 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5" /> Define Custom Reducer
                  </span>
                  <button
                    onClick={() => {
                      setIsAddingReducer(false);
                      setNewTargetField("");
                      setNewTargetFieldInput("");
                    }}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Target State Variable (Combobox) */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-purple-400" />
                      Target State Variable to Update
                    </Label>
                    <span className="text-[9px] text-muted-foreground">Select or type variable</span>
                  </div>
                  <Combobox
                    items={availableFieldKeys}
                    value={newTargetField}
                    onValueChange={(val) => {
                      if (typeof val === "string" && val.trim()) {
                        handleSelectNewTargetField(val.trim());
                      }
                    }}
                    inputValue={newTargetFieldInput}
                    onInputValueChange={(text) => {
                      setNewTargetFieldInput(text);
                      setNewTargetField(text);
                      if (text && (!newReducerName || newReducerName.endsWith("_reducer") || newReducerName === "custom_reducer")) {
                        setNewReducerName(`${text.trim()}_reducer`);
                      }
                    }}
                  >
                    <ComboboxInput
                      placeholder="Search state variable (e.g. messages, scores)..."
                      className="h-7 text-xs font-mono bg-background w-full"
                      autoFocus
                    />
                    <ComboboxContent
                      className="w-[300px] p-0 shadow-2xl border border-border/80 bg-popover text-popover-foreground rounded-xl z-50 overflow-hidden"
                      align="start"
                      sideOffset={4}
                    >
                      <ComboboxEmpty className="py-2.5 px-3 text-xs text-muted-foreground text-center">
                        {availableFieldKeys.length === 0
                          ? "No state channels yet. Type a variable name."
                          : "No matching channels. Type to use custom variable."}
                      </ComboboxEmpty>
                      <ComboboxList className="max-h-56 overflow-y-auto no-scrollbar p-1 bg-popover text-popover-foreground hide-scrollbar">
                        {(fieldKey: string) => {
                          const ch = stateChannels.find((c) => c.key === fieldKey);
                          return (
                            <ComboboxItem
                              key={fieldKey}
                              value={fieldKey}
                              className="flex items-center justify-between py-1.5 px-2 text-xs font-mono cursor-pointer rounded-md gap-2"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <Database className="w-3 h-3 text-blue-400 shrink-0" />
                                <span className="font-semibold text-foreground truncate">{fieldKey}</span>
                              </div>
                              {ch?.type && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-muted-foreground font-mono shrink-0">
                                  {ch.type}
                                </Badge>
                              )}
                            </ComboboxItem>
                          );
                        }}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  {newTargetField && (
                    <span className="text-[9px] text-purple-300/90 font-mono flex items-center gap-1 pl-0.5">
                      <Check className="w-2.5 h-2.5 text-purple-400" />
                      Will tie this reducer directly to <span className="font-bold text-foreground">"{newTargetField}"</span> channel
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground font-mono">
                    Reducer Name
                  </Label>
                  <LocalInput
                    className="h-7 text-xs font-mono font-medium bg-background"
                    placeholder="e.g. sum_scores, dedup_append"
                    value={newReducerName}
                    onChange={(e) => setNewReducerName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground font-mono">
                      Reducer Function Body (JavaScript)
                    </Label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setNewReducerCode("(prev, next) => [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [next])]");
                          setNewTargetField("messages");
                          setNewTargetFieldInput("messages");
                          if (!newReducerName || newReducerName.endsWith("_reducer")) {
                            setNewReducerName("add_messages");
                          }
                        }}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-mono transition-colors cursor-pointer"
                        title="Chat history dedup & append"
                      >
                        +chat (messages)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewReducerCode("(prev, next) => [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [next])]")}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
                        title="Append array values"
                      >
                        +array
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewReducerCode("(prev, next) => ({ ...(prev || {}), ...(next || {}) })")}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
                        title="Merge object keys"
                      >
                        +merge
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewReducerCode("(prev, next) => (prev || 0) + (next || 0)")}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
                        title="Sum numbers"
                      >
                        +sum
                      </button>
                    </div>
                  </div>
                  <LocalTextarea
                    className="min-h-[72px] text-xs font-mono bg-background leading-relaxed p-2 resize-y"
                    placeholder="(prev, next) => prev + next"
                    value={newReducerCode}
                    onChange={(e) => setNewReducerCode(e.target.value)}
                    debounceMs={150}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground font-mono">
                    Description (optional)
                  </Label>
                  <LocalInput
                    className="h-7 text-xs bg-background"
                    placeholder="Brief description of the reduction logic"
                    value={newReducerDesc}
                    onChange={(e) => setNewReducerDesc(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setIsAddingReducer(false);
                      setNewTargetField("");
                      setNewTargetFieldInput("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-1 cursor-pointer"
                    onClick={handleCreateCustomReducer}
                    disabled={!newReducerName.trim()}
                  >
                    <Check className="w-3 h-3" /> Save &amp; Tie Reducer
                  </Button>
                </div>
              </div>
            )}

            {/* Core Chat History Reducer Function Card */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 px-1">
                Chat History Reducer (Core)
              </span>
              <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs font-mono shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-blue-300">add_messages</span>
                    <Badge variant="secondary" className="text-[8px] h-3.5 px-1 bg-blue-500/20 text-blue-300 border-0">
                      chat history
                    </Badge>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-200 text-[10px] font-sans">
                      <Link2 className="w-3 h-3 text-blue-400" />
                      <span className="text-muted-foreground text-[9px]">Tied to:</span>
                      <span className="font-mono font-semibold text-blue-100">messages</span>
                      <span className="text-[8px] px-1 py-0 rounded bg-blue-500/30 text-blue-200 font-mono">
                        messages
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-blue-500/30 text-blue-300 font-sans">
                    Built-in
                  </Badge>
                </div>
                <code className="text-[9px] text-blue-200/90 line-clamp-3 whitespace-pre-wrap font-mono bg-background/50 px-2 py-1.5 rounded-lg border border-blue-500/20">
                  {"(prev, next) => Array.isArray(prev) ? [...prev, ...(Array.isArray(next) ? next : [next])] : next"}
                </code>
                <div className="flex items-center justify-between text-[9px] text-muted-foreground font-sans">
                  <span>Deduplicates incoming messages by ID and appends conversation history.</span>
                  {!customReducers.some((r) => r.name === "add_message" || r.name === "add_messages") && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingReducer(true);
                        setNewReducerName("add_messages");
                        setNewTargetField("messages");
                        setNewTargetFieldInput("messages");
                        setNewReducerCode("(prev, next) => [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [next])]");
                        setNewReducerDesc("Custom chat history deduplication and append function");
                      }}
                      className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer underline underline-offset-2 ml-2 shrink-0"
                    >
                      Customize as custom reducer
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Custom Reducers List */}
            {customReducers.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 px-1">
                  Custom Reducers ({customReducers.length})
                </span>
                {customReducers.map((r) => {
                  const isEditing = editingReducerId === r.id;
                  const tiedChannel = stateChannels.find(
                    (c) =>
                      c.key === r.targetField ||
                      c.reducer === r.name ||
                      c.reducer === r.id,
                  );
                  const targetFieldName = r.targetField || tiedChannel?.key;

                  if (isEditing) {
                    return (
                      <div
                        key={r.id}
                        className="flex flex-col gap-2.5 p-2.5 rounded-xl border border-purple-500/50 bg-purple-500/10 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
                            <Code2 className="w-3.5 h-3.5" /> Edit Custom Reducer
                          </span>
                          <button
                            type="button"
                            onClick={handleCancelEditCustomReducer}
                            className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Target State Variable (Combobox) */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[9px] text-muted-foreground font-mono flex items-center gap-1">
                              <Link2 className="w-3 h-3 text-purple-400" />
                              Target State Variable to Update
                            </Label>
                            <span className="text-[8px] text-muted-foreground">Select or type variable</span>
                          </div>
                          <Combobox
                            items={availableFieldKeys}
                            value={editTargetField}
                            onValueChange={(val) => {
                              if (typeof val === "string" && val.trim()) {
                                setEditTargetField(val.trim());
                                setEditTargetFieldInput(val.trim());
                              }
                            }}
                            inputValue={editTargetFieldInput}
                            onInputValueChange={(text) => {
                              setEditTargetFieldInput(text);
                              setEditTargetField(text);
                            }}
                          >
                            <ComboboxInput
                              placeholder="Search state variable..."
                              className="h-7 text-xs font-mono bg-background w-full"
                            />
                            <ComboboxContent
                              className="w-[300px] p-0 shadow-2xl border border-border/80 bg-popover text-popover-foreground rounded-xl z-50 overflow-hidden"
                              align="start"
                              sideOffset={4}
                            >
                              <ComboboxEmpty className="py-2.5 px-3 text-xs text-muted-foreground text-center">
                                No matching channels. Type to use custom variable.
                              </ComboboxEmpty>
                              <ComboboxList className="max-h-56 overflow-y-auto no-scrollbar p-1 bg-popover text-popover-foreground hide-scrollbar">
                                {(fieldKey: string) => {
                                  const ch = stateChannels.find((c) => c.key === fieldKey);
                                  return (
                                    <ComboboxItem
                                      key={fieldKey}
                                      value={fieldKey}
                                      className="flex items-center justify-between py-1.5 px-2 text-xs font-mono cursor-pointer rounded-md gap-2"
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        <Database className="w-3 h-3 text-blue-400 shrink-0" />
                                        <span className="font-semibold text-foreground truncate">{fieldKey}</span>
                                      </div>
                                      {ch?.type && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-muted-foreground font-mono shrink-0">
                                          {ch.type}
                                        </Badge>
                                      )}
                                    </ComboboxItem>
                                  );
                                }}
                              </ComboboxList>
                            </ComboboxContent>
                          </Combobox>
                          {editTargetField && (
                            <span className="text-[9px] text-purple-300/90 font-mono flex items-center gap-1 pl-0.5">
                              <Check className="w-2.5 h-2.5 text-purple-400" />
                              Tied to state variable <span className="font-bold text-foreground">"{editTargetField}"</span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label className="text-[9px] text-muted-foreground font-mono">
                            Reducer Name
                          </Label>
                          <LocalInput
                            className="h-7 text-xs font-mono font-medium bg-background"
                            placeholder="reducer_name"
                            value={editReducerName}
                            onChange={(e) => setEditReducerName(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[9px] text-muted-foreground font-mono">
                              Function Body (JavaScript)
                            </Label>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditReducerCode("(prev, next) => [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [next])]")}
                                className="text-[8px] px-1 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
                                title="Append array values"
                              >
                                +array
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditReducerCode("(prev, next) => ({ ...(prev || {}), ...(next || {}) })")}
                                className="text-[8px] px-1 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
                                title="Merge object keys"
                              >
                                +merge
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditReducerCode("(prev, next) => (prev || 0) + (next || 0)")}
                                className="text-[8px] px-1 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
                                title="Sum numbers"
                              >
                                +sum
                              </button>
                            </div>
                          </div>
                          <LocalTextarea
                            className="min-h-[72px] text-xs font-mono bg-background leading-relaxed p-2 resize-y"
                            placeholder="(prev, next) => Array.isArray(prev) ? [...prev, ...next] : next"
                            value={editReducerCode}
                            onChange={(e) => setEditReducerCode(e.target.value)}
                            debounceMs={150}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-[9px] text-muted-foreground font-mono">
                            Description (optional)
                          </Label>
                          <LocalInput
                            className="h-7 text-xs bg-background"
                            placeholder="Description"
                            value={editReducerDesc}
                            onChange={(e) => setEditReducerDesc(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={handleCancelEditCustomReducer}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-6 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-1 cursor-pointer"
                            onClick={() => handleSaveEditCustomReducer(r.id)}
                            disabled={!editReducerName.trim()}
                          >
                            <Check className="w-3 h-3" /> Save Changes
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={r.id}
                      className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/25 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-purple-300">{r.name}</span>
                          <Badge variant="secondary" className="text-[8px] h-3.5 px-1 bg-purple-500/20 text-purple-300 border-0">
                            custom
                          </Badge>
                          {targetFieldName ? (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-sans">
                              <Link2 className="w-3 h-3 text-blue-400" />
                              <span className="text-muted-foreground text-[9px]">Tied to:</span>
                              <span className="font-mono font-semibold text-blue-200">{targetFieldName}</span>
                              {tiedChannel?.type && (
                                <span className="text-[8px] px-1 py-0 rounded bg-blue-500/20 text-blue-300 font-mono">
                                  {tiedChannel.type}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="flex items-center gap-1 text-[9px] text-muted-foreground font-sans px-1">
                              <Link2 className="w-2.5 h-2.5 opacity-50" /> Unassigned
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditCustomReducer(r)}
                            className="text-muted-foreground hover:text-purple-300 p-1 rounded transition-colors cursor-pointer"
                            title="Edit custom reducer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomReducer(r.name)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
                            title="Delete custom reducer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <code className="text-[9px] text-purple-200/80 line-clamp-3 whitespace-pre-wrap font-mono bg-background/50 px-1.5 py-1 rounded border border-purple-500/20">
                        {r.code}
                      </code>
                      {r.description && (
                        <span className="text-[9px] text-muted-foreground font-sans">{r.description}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {customReducers.length === 0 && !isAddingReducer && (
              <div className="p-3 text-center text-muted-foreground text-xs border border-dashed border-border/50 rounded-lg bg-secondary/10">
                No custom reducers defined yet. Use &ldquo;Add Custom Reducer&rdquo; or configure inline custom reducers directly on your fields above.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

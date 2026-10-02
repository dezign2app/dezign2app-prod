import React from "react";
import { Info } from "lucide-react";
import { ReducersSectionHeader } from "./ReducersSectionHeader";
import { CreateCustomReducerForm } from "./CreateCustomReducerForm";
import { CoreChatHistoryCard } from "./CoreChatHistoryCard";
import { CustomReducerItem } from "./CustomReducerItem";
import type { LangGraphCustomReducer, LangGraphStateChannel } from "@/types/canvas";

interface ReducersSectionProps {
  customReducers: LangGraphCustomReducer[];
  stateChannels: LangGraphStateChannel[];
  availableFieldKeys: string[];
  showReducersSection: boolean;
  onToggleShow: () => void;
  // Add reducer
  isAddingReducer: boolean;
  onStartAddReducer: () => void;
  newReducerName: string;
  setNewReducerName: (val: string) => void;
  newReducerCode: string;
  setNewReducerCode: (val: string) => void;
  newReducerDesc: string;
  setNewReducerDesc: (val: string) => void;
  newTargetField: string;
  newTargetFieldInput: string;
  setNewTargetFieldInput: (val: string) => void;
  onSelectNewTargetField: (fieldKey: string) => void;
  onCreateCustomReducer: () => void;
  onResetNewReducerForm: () => void;
  // Edit reducer
  editingReducerId: string | null;
  editReducerName: string;
  setEditReducerName: (val: string) => void;
  editReducerCode: string;
  setEditReducerCode: (val: string) => void;
  editReducerDesc: string;
  setEditReducerDesc: (val: string) => void;
  editTargetField: string;
  setEditTargetField: (val: string) => void;
  editTargetFieldInput: string;
  setEditTargetFieldInput: (val: string) => void;
  onStartEditCustomReducer: (reducer: LangGraphCustomReducer) => void;
  onCancelEditCustomReducer: () => void;
  onSaveEditCustomReducer: (reducerId: string) => void;
  // Delete & customize
  onDeleteCustomReducer: (reducerName: string) => void;
  onOpenCustomizeChatHistory: () => void;
}

export function ReducersSection({
  customReducers,
  stateChannels,
  availableFieldKeys,
  showReducersSection,
  onToggleShow,
  isAddingReducer,
  onStartAddReducer,
  newReducerName,
  setNewReducerName,
  newReducerCode,
  setNewReducerCode,
  newReducerDesc,
  setNewReducerDesc,
  newTargetField,
  newTargetFieldInput,
  setNewTargetFieldInput,
  onSelectNewTargetField,
  onCreateCustomReducer,
  onResetNewReducerForm,
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
  onStartEditCustomReducer,
  onCancelEditCustomReducer,
  onSaveEditCustomReducer,
  onDeleteCustomReducer,
  onOpenCustomizeChatHistory,
}: ReducersSectionProps) {
  const hasCustomAddMessages = customReducers.some(
    (r) => r.name === "add_message" || r.name === "add_messages",
  );

  return (
    <div className="flex flex-col gap-2.5 border-t border-border/50 pt-3">
      <ReducersSectionHeader
        customReducerCount={customReducers.length}
        showReducersSection={showReducersSection}
        onToggleShow={onToggleShow}
        onAddCustomReducerClick={onStartAddReducer}
      />

      {showReducersSection && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] text-muted-foreground flex items-start gap-1 px-1">
            <Info className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
            <span>
              Custom merge functions tied to your state channels. Control how concurrent node updates merge into specific state variables.
            </span>
          </div>

          {/* Custom Reducer Creation Form */}
          {isAddingReducer && (
            <CreateCustomReducerForm
              availableFieldKeys={availableFieldKeys}
              stateChannels={stateChannels}
              newTargetField={newTargetField}
              newTargetFieldInput={newTargetFieldInput}
              newReducerName={newReducerName}
              newReducerCode={newReducerCode}
              newReducerDesc={newReducerDesc}
              onSelectTargetField={onSelectNewTargetField}
              onTargetFieldInputChange={setNewTargetFieldInput}
              onReducerNameChange={setNewReducerName}
              onReducerCodeChange={setNewReducerCode}
              onReducerDescChange={setNewReducerDesc}
              onSave={onCreateCustomReducer}
              onCancel={onResetNewReducerForm}
            />
          )}

          {/* Core Chat History Reducer Function Card */}
          <CoreChatHistoryCard
            hasCustomAddMessages={hasCustomAddMessages}
            onCustomize={onOpenCustomizeChatHistory}
          />

          {/* Custom Reducers List */}
          {customReducers.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 px-1">
                Custom Reducers ({customReducers.length})
              </span>
              {customReducers.map((r) => (
                <CustomReducerItem
                  key={r.id}
                  reducer={r}
                  isEditing={editingReducerId === r.id}
                  stateChannels={stateChannels}
                  availableFieldKeys={availableFieldKeys}
                  editReducerName={editReducerName}
                  editReducerCode={editReducerCode}
                  editReducerDesc={editReducerDesc}
                  editTargetField={editTargetField}
                  editTargetFieldInput={editTargetFieldInput}
                  onStartEdit={onStartEditCustomReducer}
                  onCancelEdit={onCancelEditCustomReducer}
                  onSaveEdit={onSaveEditCustomReducer}
                  onDelete={onDeleteCustomReducer}
                  onSelectEditTargetField={(val) => {
                    setEditTargetField(val);
                    setEditTargetFieldInput(val);
                  }}
                  onEditTargetFieldInputChange={(val) => {
                    setEditTargetFieldInput(val);
                    setEditTargetField(val);
                  }}
                  onEditReducerNameChange={setEditReducerName}
                  onEditReducerCodeChange={setEditReducerCode}
                  onEditReducerDescChange={setEditReducerDesc}
                />
              ))}
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
  );
}

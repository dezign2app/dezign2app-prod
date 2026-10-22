"use client";

import React from "react";
import { Bot, Plus, Trash2 } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { BindingSourceEditor } from "../BindingSourceEditor";
import { AvailableSource, StepBinding } from "../types";

export interface ConversationMessagesSectionProps {
  effectiveMessagesMode: "single" | "bulk";
  userMessageBinding: StepBinding;
  systemMessageBinding: StepBinding;
  aiMessageBinding: StepBinding;
  bulkMessagesBinding: StepBinding;
  hasSystemPrompt: boolean;
  hasAiMessage: boolean;
  availableSources: AvailableSource[];
  serviceNodeId?: string;
  onMessagesModeChange: (mode: "single" | "bulk") => void;
  onUserMessageBindingChange: (updated: StepBinding) => void;
  onSystemMessageBindingChange: (updated: StepBinding) => void;
  onAiMessageBindingChange: (updated: StepBinding) => void;
  onBulkMessagesBindingChange: (updated: StepBinding) => void;
  onAddSystemPrompt: () => void;
  onRemoveSystemPrompt: () => void;
  onAddAiMessage: () => void;
  onRemoveAiMessage: () => void;
}

export const ConversationMessagesSection: React.FC<ConversationMessagesSectionProps> = ({
  effectiveMessagesMode,
  userMessageBinding,
  systemMessageBinding,
  aiMessageBinding,
  bulkMessagesBinding,
  hasSystemPrompt,
  hasAiMessage,
  availableSources,
  serviceNodeId,
  onMessagesModeChange,
  onUserMessageBindingChange,
  onSystemMessageBindingChange,
  onAiMessageBindingChange,
  onBulkMessagesBindingChange,
  onAddSystemPrompt,
  onRemoveSystemPrompt,
  onAddAiMessage,
  onRemoveAiMessage,
}) => {
  return (
    <div className="flex flex-col gap-2.5 p-3.5 bg-blue-500/10 border border-blue-500/25 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-blue-400" />
          <Label className="text-xs font-bold text-foreground">
            Messages Channel Mapping
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-background/80 rounded-md p-0.5 border border-border/50 text-[10px]">
            <button
              type="button"
              className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                effectiveMessagesMode === "single"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onMessagesModeChange("single")}
            >
              Single Turn
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                effectiveMessagesMode === "bulk"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onMessagesModeChange("bulk")}
            >
              Bulk History Array
            </button>
          </div>
          <Badge
            variant="outline"
            className="text-[9px] font-mono border-blue-500/40 text-blue-300 bg-blue-500/15"
          >
            BaseMessage[]
          </Badge>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        {effectiveMessagesMode === "single" ? (
          <>
            Wraps the user input as a type-safe <code className="font-mono text-blue-300">HumanMessage</code> and appends it to conversation history using LangGraph's native <code className="font-mono text-blue-300">add_messages</code> reducer. Optionally pass a dynamic <code className="font-mono text-purple-300">SystemMessage</code> for run-specific instructions.
          </>
        ) : (
          <>
            Accepts a bulk array of chat messages (<code className="font-mono text-blue-300">&#123; role, content &#125;[]</code>) and converts each item into its corresponding LangChain message class (<code className="font-mono text-blue-300">HumanMessage</code>, <code className="font-mono text-purple-300">SystemMessage</code>, or <code className="font-mono text-emerald-300">AIMessage</code>) with native deduplication.
          </>
        )}
      </p>

      {effectiveMessagesMode === "single" ? (
        <div className="flex flex-col gap-2">
          {/* User Message Input */}
          <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center text-xs bg-background/60 p-2 rounded-lg border border-blue-500/20">
            <div className="flex flex-col min-w-0">
              <span className="font-mono font-bold text-blue-400 text-[11px] truncate bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                User Message
              </span>
              <span className="text-[8.5px] text-muted-foreground font-mono mt-0.5">
                HumanMessage
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
            <div className="min-w-0">
              <BindingSourceEditor
                binding={userMessageBinding}
                availableSources={availableSources}
                serviceNodeId={serviceNodeId}
                onChange={onUserMessageBindingChange}
              />
            </div>
            <div className="w-6" />
          </div>

          {/* Dynamic System Message Input (Optional) */}
          {hasSystemPrompt && (
            <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center text-xs bg-background/60 p-2 rounded-lg border border-purple-500/20">
              <div className="flex flex-col min-w-0">
                <span className="font-mono font-bold text-purple-400 text-[11px] truncate bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                  System Prompt
                </span>
                <span className="text-[8.5px] text-muted-foreground font-mono mt-0.5">
                  SystemMessage (opt)
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
              <div className="min-w-0">
                <BindingSourceEditor
                  binding={systemMessageBinding}
                  availableSources={availableSources}
                  serviceNodeId={serviceNodeId}
                  onChange={onSystemMessageBindingChange}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onRemoveSystemPrompt}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  title="Remove System Prompt mapping"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Dynamic Preceding AI Message Input (Optional) */}
          {hasAiMessage && (
            <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center text-xs bg-background/60 p-2 rounded-lg border border-emerald-500/20">
              <div className="flex flex-col min-w-0">
                <span className="font-mono font-bold text-emerald-400 text-[11px] truncate bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  AI Message
                </span>
                <span className="text-[8.5px] text-muted-foreground font-mono mt-0.5">
                  AIMessage (opt)
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
              <div className="min-w-0">
                <BindingSourceEditor
                  binding={aiMessageBinding}
                  availableSources={availableSources}
                  serviceNodeId={serviceNodeId}
                  onChange={onAiMessageBindingChange}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onRemoveAiMessage}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  title="Remove AI Message mapping"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Quick Add buttons for optional message mappings */}
          {(!hasSystemPrompt || !hasAiMessage) && (
            <div className="flex items-center gap-1.5 pt-1 text-xs">
              <span className="text-[10px] text-muted-foreground font-medium">
                Add optional message:
              </span>
              {!hasSystemPrompt && (
                <button
                  type="button"
                  onClick={onAddSystemPrompt}
                  className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50 transition-colors"
                >
                  <Plus className="w-3 h-3 text-purple-400" />
                  <span>System Prompt</span>
                </button>
              )}
              {!hasAiMessage && (
                <button
                  type="button"
                  onClick={onAddAiMessage}
                  className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-colors"
                >
                  <Plus className="w-3 h-3 text-emerald-400" />
                  <span>AI Message</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Bulk Messages Array Input */
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center text-xs bg-background/60 p-2 rounded-lg border border-blue-500/20">
            <div className="flex flex-col min-w-0">
              <span className="font-mono font-bold text-blue-400 text-[11px] truncate bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                Messages Array
              </span>
              <span className="text-[8.5px] text-muted-foreground font-mono mt-0.5">
                BaseMessage[]
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
            <div className="min-w-0">
              <BindingSourceEditor
                binding={bulkMessagesBinding}
                availableSources={availableSources}
                serviceNodeId={serviceNodeId}
                onChange={onBulkMessagesBindingChange}
              />
            </div>
            <div className="w-6" />
          </div>

          {/* Optional Prepended System Message in Bulk mode */}
          {hasSystemPrompt && (
            <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center text-xs bg-background/60 p-2 rounded-lg border border-purple-500/20">
              <div className="flex flex-col min-w-0">
                <span className="font-mono font-bold text-purple-400 text-[11px] truncate bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                  System Prompt
                </span>
                <span className="text-[8.5px] text-muted-foreground font-mono mt-0.5">
                  Prepend SystemMessage
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
              <div className="min-w-0">
                <BindingSourceEditor
                  binding={systemMessageBinding}
                  availableSources={availableSources}
                  serviceNodeId={serviceNodeId}
                  onChange={onSystemMessageBindingChange}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onRemoveSystemPrompt}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  title="Remove System Prompt mapping"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {!hasSystemPrompt && (
            <div className="flex items-center gap-1.5 pt-1 text-xs">
              <button
                type="button"
                onClick={onAddSystemPrompt}
                className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50 transition-colors"
              >
                <Plus className="w-3 h-3 text-purple-400" />
                <span>Prepend System Prompt (Optional)</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

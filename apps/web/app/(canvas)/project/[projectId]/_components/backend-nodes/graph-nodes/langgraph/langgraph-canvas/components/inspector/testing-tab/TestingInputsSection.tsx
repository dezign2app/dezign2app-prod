import React from "react";
import { MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import type { LangGraphInputChannel } from "@workspace/canvas";
import { LocalInput } from "../../../../../common";

export interface TestingInputsSectionProps {
  inputChannels: LangGraphInputChannel[];
  inputValues: Record<string, unknown>;
  setInputValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  chatMessage: string;
  setChatMessage: (msg: string) => void;
  handleExecute: (overrideMsg?: string) => void;
  isInputCollapsed: boolean;
  setIsInputCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export function TestingInputsSection({
  inputChannels,
  inputValues,
  setInputValues,
  chatMessage,
  setChatMessage,
  handleExecute,
  isInputCollapsed,
  setIsInputCollapsed,
}: TestingInputsSectionProps) {
  const messageChannel = inputChannels.find(
    (c) => c.key === "message" || c.key === "messages" || c.key === "prompt"
  );
  const otherChannels = inputChannels.filter((c) => c.key !== messageChannel?.key);

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border bg-card/60 transition-all">
      <div className="flex items-center justify-between pb-1 border-b border-border/40">
        <span className="font-mono uppercase text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
          <span>Input Payload</span>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
            {inputChannels.length} channels
          </Badge>
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 text-[10px] px-1 text-muted-foreground hover:text-foreground"
          onClick={() => setIsInputCollapsed((v) => !v)}
          title={isInputCollapsed ? "Show inputs" : "Hide inputs"}
        >
          {isInputCollapsed ? (
            <span className="flex items-center gap-0.5 text-[9px]">
              <ChevronDown className="w-3 h-3" /> Show Inputs
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-[9px]">
              <ChevronUp className="w-3 h-3" /> Hide Inputs
            </span>
          )}
        </Button>
      </div>

      {!isInputCollapsed && (
        <>
          {messageChannel ? (
            /* Configured message/prompt channel */
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                  <MessageSquare className="w-3 h-3 text-primary" /> {messageChannel.key}
                </Label>
                <span className="text-muted-foreground text-[9px]">({messageChannel.type})</span>
              </div>
              <LocalInput
                placeholder="Type message to invoke graph..."
                value={String(inputValues[messageChannel.key] ?? chatMessage ?? "")}
                onChange={(e) => {
                  const val = e.target.value;
                  setChatMessage(val);
                  setInputValues((prev) => ({ ...prev, [messageChannel.key]: val }));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleExecute((e.target as HTMLInputElement).value);
                  }
                }}
                className="h-8 text-xs bg-background font-mono"
              />
            </div>
          ) : inputChannels.length === 0 ? (
            /* Fallback default chat input when no channels defined */
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                <MessageSquare className="w-3 h-3 text-primary" /> User Message / Prompt
              </Label>
              <LocalInput
                placeholder="Type message to invoke graph..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleExecute((e.target as HTMLInputElement).value);
                  }
                }}
                className="h-8 text-xs bg-background"
              />
            </div>
          ) : null}

          {/* Remaining non-message dynamic channels */}
          {otherChannels.map((channel) => (
            <div key={channel.key} className="flex flex-col gap-1 pt-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-foreground font-medium">{channel.key}</span>
                <span className="text-muted-foreground text-[9px]">({channel.type})</span>
              </div>
              <LocalInput
                placeholder={`Enter ${channel.type} value...`}
                value={String(inputValues[channel.key] ?? "")}
                onChange={(e) =>
                  setInputValues((prev) => ({
                    ...prev,
                    [channel.key]:
                      channel.type === "number"
                        ? Number(e.target.value) || 0
                        : e.target.value,
                  }))
                }
                className="h-7 text-xs font-mono bg-background"
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

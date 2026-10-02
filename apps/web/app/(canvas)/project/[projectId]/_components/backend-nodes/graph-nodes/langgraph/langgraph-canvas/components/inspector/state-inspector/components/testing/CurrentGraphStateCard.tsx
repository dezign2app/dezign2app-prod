import React, { useState } from "react";
import { Database, Check, Copy, AlertCircle, Play, Code2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import type {
  LangGraphStateChannel,
  LangGraphCustomReducer,
} from "@/types/canvas";

export interface CurrentGraphStateCardProps {
  simulatedState: Record<string, unknown>;
  stateChannels: LangGraphStateChannel[];
  customReducers: LangGraphCustomReducer[];
  isEditingState: boolean;
  setIsEditingState: React.Dispatch<React.SetStateAction<boolean>>;
  rawStateInput: string;
  setRawStateInput: (val: string) => void;
  rawStateError: string | null;
  onSaveRawState: () => void;
  onSelectChannelToSimulate: (channelKey: string) => void;
  onSelectReducerForTesting: (reducerName: string, code?: string) => void;
  onNavigateToChannels?: () => void;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}

export function CurrentGraphStateCard({
  simulatedState,
  stateChannels,
  customReducers,
  isEditingState,
  setIsEditingState,
  rawStateInput,
  setRawStateInput,
  rawStateError,
  onSaveRawState,
  onSelectChannelToSimulate,
  onSelectReducerForTesting,
  onNavigateToChannels,
  copiedKey,
  onCopy,
}: CurrentGraphStateCardProps) {
  const [showCurrentStateRaw, setShowCurrentStateRaw] = useState(false);

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-card border border-border/70 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-bold text-foreground text-xs">
            Current Graph State
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            ({Object.keys(simulatedState).length} keys)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => setShowCurrentStateRaw((prev) => !prev)}
          >
            {showCurrentStateRaw ? "Channel View" : "Raw JSON"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => setIsEditingState((prev) => !prev)}
          >
            {isEditingState ? "Cancel Edit" : "Edit State"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={() =>
              onCopy(JSON.stringify(simulatedState, null, 2), "current_state")
            }
            title="Copy current state JSON"
          >
            {copiedKey === "current_state" ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>

      {/* If in edit raw state mode */}
      {isEditingState ? (
        <div className="flex flex-col gap-2 mt-1">
          <textarea
            value={rawStateInput}
            onChange={(e) => setRawStateInput(e.target.value)}
            rows={6}
            className="w-full text-xs font-mono bg-background p-2 rounded border border-border focus:border-blue-500 focus:outline-none resize-y"
            placeholder='{"messages": [], "count": 0}'
          />
          {rawStateError && (
            <div className="text-[10px] text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>{rawStateError}</span>
            </div>
          )}
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[11px]"
              onClick={() => setIsEditingState(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-6 text-[11px] bg-blue-600 text-white hover:bg-blue-700"
              onClick={onSaveRawState}
            >
              Apply New State
            </Button>
          </div>
        </div>
      ) : showCurrentStateRaw ? (
        <pre className="text-[10px] font-mono bg-background/80 p-2.5 rounded border border-border/50 max-h-48 overflow-y-auto overflow-x-auto text-muted-foreground">
          {JSON.stringify(simulatedState, null, 2)}
        </pre>
      ) : (
        <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
          {stateChannels.length === 0 ? (
            <div className="p-3 text-center text-muted-foreground text-xs border border-dashed rounded">
              No state channels configured.
              {onNavigateToChannels && (
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs text-blue-400 p-0 ml-1 h-auto"
                  onClick={onNavigateToChannels}
                >
                  Add channels now
                </Button>
              )}
            </div>
          ) : (
            stateChannels.map((ch) => {
              const val = simulatedState[ch.key];
              const matchedCustom = customReducers.find(
                (r) =>
                  r.name === ch.reducer ||
                  r.id === ch.reducer ||
                  r.targetField === ch.key,
              );
              const valStr =
                typeof val === "object" && val !== null
                  ? JSON.stringify(val)
                  : String(val ?? "");

              return (
                <div
                  key={ch.key}
                  className="flex items-center justify-between p-1.5 rounded bg-muted/20 hover:bg-muted/30 border border-border/40 font-mono text-[11px] group transition-colors gap-2"
                >
                  <div className="flex items-center gap-1.5 truncate min-w-0">
                    <span className="font-semibold text-foreground">
                      {ch.key}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] h-3.5 px-1 py-0 border-border text-muted-foreground font-sans shrink-0"
                    >
                      {ch.type}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="text-[9px] h-3.5 px-1 py-0 bg-blue-500/10 text-blue-300 border-0 shrink-0"
                    >
                      {matchedCustom ? matchedCustom.name : ch.reducer || "replace"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className="text-muted-foreground truncate max-w-[120px] text-[10px]"
                      title={valStr}
                    >
                      {valStr || <span className="italic opacity-50">empty</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSelectChannelToSimulate(ch.key)}
                        className="px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 text-[9px] font-sans flex items-center gap-0.5 cursor-pointer transition-colors"
                        title={`Populate payload to simulate update for '${ch.key}'`}
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Simulate</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onSelectReducerForTesting(
                            ch.reducer || "replace",
                            matchedCustom?.code || ch.customReducerCode || undefined,
                          )
                        }
                        className="px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 border border-purple-500/30 text-[9px] font-sans flex items-center gap-0.5 cursor-pointer transition-colors"
                        title={`Unit-test '${ch.reducer || "replace"}' in Reducer Playground`}
                      >
                        <Code2 className="w-2.5 h-2.5" />
                        <span>Test</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

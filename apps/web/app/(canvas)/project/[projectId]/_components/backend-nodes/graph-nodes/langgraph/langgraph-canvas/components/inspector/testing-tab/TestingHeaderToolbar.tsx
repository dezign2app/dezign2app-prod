import React from "react";
import {
  Play,
  RotateCcw,
  Loader2,
  Key,
  Plus,
  AlertCircle,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Badge } from "@workspace/ui/components/badge";
import { toast } from "sonner";
import type { LangGraphMemoryConfig } from "@workspace/canvas";
import {
  ExecutionMode,
  LLMProvider,
  PROVIDER_MODELS,
} from "./types";
import { LocalInput } from "../../../../../common";

export interface TestingHeaderToolbarProps {
  executionMode: ExecutionMode;
  setExecutionMode: (mode: ExecutionMode) => void;
  memoryConfig?: LangGraphMemoryConfig;
  isRunning: boolean;
  handleClearThread: () => void;
  handleExecute: () => void;
  threadId: string;
  setThreadId: (tid: string) => void;
  knownThreads: string[];
  handleNewThread: () => void;
  provider: LLMProvider;
  handleProviderChange: (p: LLMProvider) => void;
  modelName: string;
  setModelName: (m: string) => void;
  apiKey: string;
  handleSaveApiKey: (k: string) => void;
  showKeyInput: boolean;
  setShowKeyInput: React.Dispatch<React.SetStateAction<boolean>>;
}

export function TestingHeaderToolbar({
  executionMode,
  setExecutionMode,
  memoryConfig,
  isRunning,
  handleClearThread,
  handleExecute,
  threadId,
  setThreadId,
  knownThreads,
  handleNewThread,
  provider,
  handleProviderChange,
  modelName,
  setModelName,
  apiKey,
  handleSaveApiKey,
  showKeyInput,
  setShowKeyInput,
}: TestingHeaderToolbarProps) {
  return (
    <div className="p-3.5 border-b border-border/60 bg-background/50 flex flex-col gap-2.5 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-lg border ${
              executionMode === "server"
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}
          >
            <Play className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-foreground text-xs">
                {executionMode === "server" ? "Generated LangGraph Code" : "In-Browser Preview"}
              </h3>
              <Badge
                variant="outline"
                className={`text-[8.5px] px-1 py-0 h-3.5 font-mono ${
                  executionMode === "server"
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                }`}
              >
                {executionMode === "server" ? "Node.js v1.4" : "Browser"}
              </Badge>
              {memoryConfig?.enabled !== false && memoryConfig?.checkpointer === "postgres" && (
                <Badge
                  variant="outline"
                  className="text-[8.5px] px-1 py-0 h-3.5 font-mono bg-sky-500/15 text-sky-400 border-sky-500/30"
                >
                  PostgresSaver
                </Badge>
              )}
              {memoryConfig?.enabled !== false && memoryConfig?.checkpointer === "redis" && (
                <Badge
                  variant="outline"
                  className="text-[8.5px] px-1 py-0 h-3.5 font-mono bg-red-500/15 text-red-400 border-red-500/30"
                >
                  RedisSaver
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {executionMode === "server"
                ? "Running official @langchain/langgraph StateGraph"
                : "Actual LLM calls · Client-side preview"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] px-2 text-muted-foreground hover:text-foreground"
            onClick={handleClearThread}
            title="Clear checkpoints for active thread"
          >
            <RotateCcw className="w-3 h-3 mr-1" /> Clear
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs px-3 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm gap-1.5"
            disabled={isRunning}
            onClick={() => handleExecute()}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Run Graph</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Runtime Engine Switcher ── */}
      <div className="flex items-center justify-between p-1 bg-muted/40 rounded-lg border border-border/50 text-[10px]">
        <span className="text-muted-foreground font-mono text-[9px] px-1.5 uppercase font-semibold">
          Execution Engine:
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setExecutionMode("server");
              if (typeof window !== "undefined") {
                localStorage.setItem("dezign2app_lg_exec_mode", "server");
              }
              toast.info("Switched to Generated LangGraph (Node.js runtime)");
            }}
            className={`px-2 py-0.5 rounded text-[10px] transition-all font-medium ${
              executionMode === "server"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ⚡ Generated Code (Node.js)
          </button>
          <button
            type="button"
            onClick={() => {
              setExecutionMode("browser");
              if (typeof window !== "undefined") {
                localStorage.setItem("dezign2app_lg_exec_mode", "browser");
              }
              toast.info("Switched to Browser Preview");
            }}
            className={`px-2 py-0.5 rounded text-[10px] transition-all font-medium ${
              executionMode === "browser"
                ? "bg-background text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🌐 Browser Preview
          </button>
        </div>
      </div>

      {/* ── Browser Mode Storage Notice ── */}
      {executionMode === "browser" &&
        memoryConfig?.enabled !== false &&
        (memoryConfig?.checkpointer === "postgres" || memoryConfig?.checkpointer === "redis") && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] animate-in fade-in">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {memoryConfig.checkpointer === "postgres" ? "PostgreSQL" : "Redis"} checkpointer requires the Node.js runtime.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setExecutionMode("server");
                if (typeof window !== "undefined") {
                  localStorage.setItem("dezign2app_lg_exec_mode", "server");
                }
                toast.info("Switched to Generated LangGraph (Node.js runtime)");
              }}
              className="text-primary hover:underline font-semibold text-[9.5px] shrink-0 ml-1"
            >
              Switch to Node.js ↗
            </button>
          </div>
        )}

      {/* ── Thread & Memory Config ── */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="font-mono uppercase font-semibold">Thread ID (Memory)</span>
            <button
              onClick={handleNewThread}
              className="text-primary hover:underline flex items-center gap-0.5 text-[9px]"
            >
              <Plus className="w-2.5 h-2.5" /> New
            </button>
          </div>
          <Select value={threadId} onValueChange={setThreadId}>
            <SelectTrigger className="h-7 text-xs bg-background/80 font-mono">
              <SelectValue placeholder="Thread ID" />
            </SelectTrigger>
            <SelectContent>
              {knownThreads.map((t) => (
                <SelectItem key={t} value={t} className="font-mono text-xs">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="font-mono uppercase font-semibold">LLM Provider</span>
            <button
              onClick={() => setShowKeyInput((prev) => !prev)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-[9px]"
            >
              <Key className="w-2.5 h-2.5" /> {showKeyInput ? "Hide Key" : "API Key"}
            </button>
          </div>
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger className="h-7 text-xs bg-background/80 font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="groq">Groq (Ultra-fast LPU)</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic Claude</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Model selection */}
      <div className="flex flex-col gap-1 pt-0.5">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="font-mono uppercase font-semibold">Active Model</span>
          <span className="text-[9px] text-emerald-400 font-mono font-medium">Live In-Browser API</span>
        </div>
        <Select value={modelName} onValueChange={setModelName}>
          <SelectTrigger className="h-7 text-xs bg-background/80 font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_MODELS[provider]?.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
                {m.label} ({m.id})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* API Key Drawer */}
      {showKeyInput && (
        <div className="p-2.5 rounded-lg border border-primary/20 bg-primary/5 flex flex-col gap-1.5 animate-in fade-in duration-200">
          <Label className="text-[10px] text-muted-foreground font-mono">
            {provider.toUpperCase()} API Key (Stored in browser localStorage)
          </Label>
          <LocalInput
            type="password"
            placeholder={`Enter ${provider} api key...`}
            value={apiKey}
            onChange={(e) => handleSaveApiKey(e.target.value)}
            className="h-7 text-xs font-mono bg-background"
          />
        </div>
      )}
    </div>
  );
}

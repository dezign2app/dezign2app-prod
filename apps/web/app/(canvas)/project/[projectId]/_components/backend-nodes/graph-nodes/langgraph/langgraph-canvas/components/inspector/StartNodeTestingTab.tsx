"use client";

import React, { useState, useEffect } from "react";
import {
  Play,
  RotateCcw,
  Loader2,
  Key,
  Plus,
  MessageSquare,
  Check,
  Copy,
  Activity,
  AlertCircle,
  Sparkles,
  Bot,
  Terminal,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { LocalInput } from "../../../../common";
import { Label } from "@workspace/ui/components/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Badge } from "@workspace/ui/components/badge";
import { toast } from "sonner";
import { useSimulationStore } from "@/lib/stores/simulationStore";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  executeBrowserLangGraph,
  BrowserExecutionResult,
} from "@/lib/simulation/browserLangGraphRunner";
import {
  getBrowserCheckpoints,
  clearBrowserThread,
  listAllBrowserThreads,
  BrowserCheckpoint,
} from "@/lib/simulation/indexedDBCheckpointer";
import { getSimulationTable } from "@/lib/simulation/database";
import type {
  LangGraphCanvasNode,
  LangGraphCanvasEdge,
  LangGraphStateChannel,
  LangGraphInputChannel,
  LangGraphMemoryConfig,
} from "@workspace/canvas";

export interface StartNodeTestingTabProps {
  nodes: LangGraphCanvasNode[];
  edges: LangGraphCanvasEdge[];
  stateChannels: LangGraphStateChannel[];
  inputChannels: LangGraphInputChannel[];
  memoryConfig?: LangGraphMemoryConfig;
  graphLabel?: string;
}

const PROVIDER_MODELS: Record<string, Array<{ id: string; label: string }>> = {
  groq: [
    { id: "openai/gpt-oss-120b", label: "OpenAI GPT-OSS 120B (Groq LPU)" },
    { id: "openai/gpt-oss-20b", label: "OpenAI GPT-OSS 20B (Groq Fast)" },
    { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B (Groq)" },
    { id: "allam-2-7b", label: "Allam 2 7B (Groq)" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o Mini" },
    { id: "gpt-4o", label: "GPT-4o" },
  ],
  anthropic: [
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
  ],
};

export function StartNodeTestingTab({
  nodes,
  edges,
  stateChannels,
  inputChannels,
  memoryConfig,
  graphLabel = "LangGraph Agent",
}: StartNodeTestingTabProps) {
  // Execution state
  const [executionMode, setExecutionMode] = useState<"server" | "browser">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dezign2app_lg_exec_mode");
      if (saved === "browser" || saved === "server") return saved;
    }
    return "server";
  });
  const [isRunning, setIsRunning] = useState(false);
  const [threadId, setThreadId] = useState("session-1");
  const [knownThreads, setKnownThreads] = useState<string[]>(["session-1"]);
  const [activeSubTab, setActiveSubTab] = useState<"trace" | "state" | "checkpoints" | "db">("trace");

  // LLM Config
  const [provider, setProvider] = useState<"groq" | "openai" | "anthropic">("groq");
  const [modelName, setModelName] = useState<string>("openai/gpt-oss-120b");
  const [apiKey, setApiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Inputs state
  const [inputValues, setInputValues] = useState<Record<string, unknown>>({});
  const [chatMessage, setChatMessage] = useState("");

  // Outputs & Trace state
  const [executionResult, setExecutionResult] = useState<BrowserExecutionResult | null>(null);
  const [currentStepNode, setCurrentStepNode] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<BrowserCheckpoint[]>([]);
  const [dbTables, setDbTables] = useState<Array<{ name: string; rows: unknown[] }>>([]);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [isTraceExpanded, setIsTraceExpanded] = useState(false);
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);
  const [expandedTraceNodes, setExpandedTraceNodes] = useState<Record<number, boolean>>({});

  // Load API keys and saved threads on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedProvider = (localStorage.getItem("dezign2app_lg_provider") as typeof provider) || "groq";
      setProvider(savedProvider);
      const defaultMod = PROVIDER_MODELS[savedProvider]?.[0]?.id || "openai/gpt-oss-120b";
      setModelName(defaultMod);

      let savedKey = localStorage.getItem(`dezign2app_lg_key_${savedProvider}`) || "";
      if (!savedKey && savedProvider === "groq" && process.env.NEXT_PUBLIC_GROQ_API_KEY) {
        savedKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
      }
      if (savedKey) setApiKey(savedKey);
    }
    loadThreads();
    loadCheckpoints(threadId);
    loadDbTables();
  }, []);

  // Update checkpointer when thread changes
  useEffect(() => {
    loadCheckpoints(threadId);
  }, [threadId]);

  const loadThreads = async () => {
    try {
      const threads = await listAllBrowserThreads();
      if (threads.length > 0) {
        setKnownThreads(Array.from(new Set(["session-1", ...threads])));
      }
    } catch {
      // fallback
    }
  };

  const loadCheckpoints = async (tid: string) => {
    try {
      const cps = await getBrowserCheckpoints(tid);
      setCheckpoints(cps);
    } catch {
      setCheckpoints([]);
    }
  };

  const loadDbTables = async () => {
    try {
      const rows = await getSimulationTable("records");
      setDbTables([{ name: "records", rows }]);
    } catch {
      setDbTables([]);
    }
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    if (typeof window !== "undefined") {
      localStorage.setItem(`dezign2app_lg_key_${provider}`, key);
      localStorage.setItem("dezign2app_lg_provider", provider);
    }
  };

  const handleProviderChange = (val: typeof provider) => {
    setProvider(val);
    const newDefaultModel = PROVIDER_MODELS[val]?.[0]?.id || "";
    setModelName(newDefaultModel);
    if (typeof window !== "undefined") {
      localStorage.setItem("dezign2app_lg_provider", val);
      let k = localStorage.getItem(`dezign2app_lg_key_${val}`) || "";
      if (!k && val === "groq" && process.env.NEXT_PUBLIC_GROQ_API_KEY) {
        k = process.env.NEXT_PUBLIC_GROQ_API_KEY;
      }
      setApiKey(k);
    }
  };

  const handleNewThread = () => {
    const newTid = `session-${Math.floor(Math.random() * 900 + 100)}`;
    setThreadId(newTid);
    setKnownThreads((prev) => Array.from(new Set([...prev, newTid])));
    setExecutionResult(null);
    toast.success(`Started new memory thread: ${newTid}`);
  };

  const resolveCheckpointerConnection = () => {
    if (!memoryConfig || memoryConfig.enabled === false) return undefined;
    const engine = memoryConfig.checkpointer || "memory";
    if (engine !== "postgres" && engine !== "redis") return undefined;

    const allNodes = useBackendCanvasStore.getState().nodes;
    const targetId = memoryConfig.checkpointerNodeId;
    const targetNode = targetId
      ? allNodes.find((n) => n.id === targetId)
      : allNodes.find((n) =>
          engine === "postgres"
            ? n?.type === "database" && n.data?.dbEngine === "postgres"
            : n?.type === "redis_instance" || (n?.type === "database" && n.data?.dbEngine === "redis")
        );

    if (!targetNode?.data) {
      return {
        host: "localhost",
        port: engine === "postgres" ? 5432 : 6379,
        database: engine === "postgres" ? "postgres" : undefined,
        user: engine === "postgres" ? "postgres" : undefined,
        password: engine === "postgres" ? "postgres" : undefined,
        connectionStringEnv: memoryConfig.checkpointerEnvVar,
      };
    }

    const d = targetNode.data;
    return {
      host: d.host || "localhost",
      port: Number(d.port) || (engine === "postgres" ? 5432 : 6379),
      database: d.database || (engine === "postgres" ? "postgres" : undefined),
      user: d.user || d.username || (engine === "postgres" ? "postgres" : undefined),
      password: d.password,
      connectionString: d.connectionString,
      connectionStringEnv: d.connectionStringEnv || memoryConfig.checkpointerEnvVar,
    };
  };

  const handleClearThread = async () => {
    if (executionMode === "server") {
      try {
        const checkpointerConnection = resolveCheckpointerConnection();
        await fetch("/api/langgraph/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "clear",
            threadId,
            memoryConfig,
            checkpointerConnection,
          }),
        });
      } catch {}
    }
    await clearBrowserThread(threadId);
    setCheckpoints([]);
    setExecutionResult(null);
    useSimulationStore.setState({ currentNodeId: undefined, activeNodeIds: [] });
    toast.success(`Cleared checkpoints for ${threadId}`);
  };

  const handleExecute = async (overrideMsg?: string | React.SyntheticEvent) => {
    if (isRunning) return;
    setIsRunning(true);
    setCurrentStepNode(null);

    const explicitMsg =
      typeof overrideMsg === "string" ? overrideMsg : undefined;

    // Merge chatMessage into inputValues
    const finalInputs = { ...inputValues };
    const msgChannel = inputChannels.find(
      (c) => c.key === "message" || c.key === "messages" || c.key === "prompt"
    );
    const effectiveMsg =
      (explicitMsg !== undefined ? explicitMsg : chatMessage).trim() ||
      (msgChannel ? String(inputValues[msgChannel.key] ?? "").trim() : "");
    if (effectiveMsg) {
      finalInputs["messages"] = effectiveMsg;
      if (msgChannel) {
        finalInputs[msgChannel.key] = effectiveMsg;
      }
    }

    // Reset store highlights
    useSimulationStore.setState({
      status: "running",
      currentNodeId: "START",
      activeNodeIds: ["START"],
      activeEdgeIds: [],
    });

    try {
      let result: BrowserExecutionResult & { checkpoints?: BrowserCheckpoint[] };

      if (executionMode === "server") {
        const checkpointerConnection = resolveCheckpointerConnection();
        // Execute real Node.js StateGraph via Next.js backend API
        const res = await fetch("/api/langgraph/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodes,
            edges,
            stateChannels,
            inputChannels,
            memoryConfig,
            checkpointerConnection,
            inputValues: finalInputs,
            threadId,
            provider,
            apiKey: apiKey.trim() || undefined,
            modelName,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Server returned HTTP ${res.status}: ${errText}`);
        }

        result = await res.json();

        // Animate executed steps smoothly on the canvas
        if (Array.isArray(result.trace)) {
          for (const step of result.trace) {
            const stepNodeId = step.nodeId;
            if (stepNodeId) {
              setCurrentStepNode(stepNodeId);
              useSimulationStore.setState((prev) => ({
                currentNodeId: stepNodeId,
                activeNodeIds: Array.from(new Set([...prev.activeNodeIds, stepNodeId])),
              }));
              await new Promise((r) => setTimeout(r, 100));
            }
          }
        }

        if (Array.isArray(result.checkpoints) && result.checkpoints.length > 0) {
          setCheckpoints(result.checkpoints);
        }
      } else {
        // Client-side in-browser simulation runner fallback
        result = await executeBrowserLangGraph({
          nodes,
          edges,
          stateChannels,
          inputChannels,
          memoryConfig,
          inputValues: finalInputs,
          threadId,
          provider,
          apiKey: apiKey.trim() || undefined,
          modelName,
          onStepStart: (nodeId) => {
            setCurrentStepNode(nodeId);
            useSimulationStore.setState((prev) => ({
              currentNodeId: nodeId,
              activeNodeIds: Array.from(new Set([...prev.activeNodeIds, nodeId])),
            }));
          },
          onStepEnd: (_nodeId, _name, _delta) => {},
          onCheckpoint: (cp) => {
            setCheckpoints((prev) => [...prev, cp]);
          },
        });
        await loadCheckpoints(threadId);
      }

      setExecutionResult(result);
      useSimulationStore.setState({
        status: result.error ? "failed" : "completed",
        currentNodeId: undefined,
      });

      await loadDbTables();

      if (result.error) {
        toast.error(`Execution error: ${result.error}`);
      } else {
        toast.success(
          `Graph completed in ${result.totalDurationMs}ms (${
            executionMode === "server" ? "Node.js @langchain/langgraph" : "in-browser"
          })`,
        );
      }
      setChatMessage("");
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Execution failed: ${errMsg}`);
      useSimulationStore.setState({ status: "failed", currentNodeId: undefined });
      setExecutionResult({
        finalState: {},
        trace: [],
        totalDurationMs: 0,
        visitedNodes: [],
        error: errMsg,
      });
    } finally {
      setIsRunning(false);
      setCurrentStepNode(null);
    }
  };

  const copyStateJson = () => {
    if (!executionResult?.finalState) return;
    navigator.clipboard.writeText(JSON.stringify(executionResult.finalState, null, 2));
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    toast.success("State copied to clipboard");
  };

  const copyResponseText = () => {
    if (!executionResult?.latestAssistantResponse) return;
    navigator.clipboard.writeText(executionResult.latestAssistantResponse);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
    toast.success("Response copied to clipboard");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs bg-card/40">
      {/* ── Top Header Toolbar ── */}
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
                onClick={() => setShowKeyInput(!showKeyInput)}
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

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto hide-scrollbar p-3.5 flex flex-col gap-3.5">
        {/* Active Node Highlight Indicator */}
        {isRunning && currentStepNode && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 animate-pulse">
            <Activity className="w-3.5 h-3.5 animate-spin" />
            <span className="font-semibold text-xs">
              Executing node: <code className="font-mono bg-sky-500/20 px-1 rounded">{currentStepNode}</code>
            </span>
          </div>
        )}

        {/* ── Actual Error Display ── */}
        {executionResult?.error && (
          <div className="p-3.5 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive flex flex-col gap-2 shadow-sm animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
                <span>Actual Execution Error</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 text-[10px] px-1.5 gap-1 text-destructive hover:bg-destructive/20"
                onClick={() => {
                  navigator.clipboard.writeText(executionResult.error || "");
                  toast.success("Error message copied");
                }}
              >
                <Copy className="w-2.5 h-2.5" /> Copy Error
              </Button>
            </div>
            <p className="text-[11px] font-mono leading-relaxed bg-background/90 text-destructive p-2.5 rounded-lg border border-destructive/20 whitespace-pre-wrap select-text max-h-[180px] overflow-y-auto hide-scrollbar">
              {executionResult.error}
            </p>
          </div>
        )}

        {/* ── Actual Response Display ── */}
        {executionResult?.latestAssistantResponse && (
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col gap-2 shadow-sm animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-400">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Actual Output Response</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-1.5 py-0 h-4">
                  200 OK · {executionResult.totalDurationMs}ms
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 text-[10px] px-1.5 gap-1 text-muted-foreground hover:text-foreground"
                  onClick={copyResponseText}
                >
                  {copiedResponse ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  Copy
                </Button>
              </div>
            </div>
            <div className="text-xs leading-relaxed text-foreground bg-background/90 p-3 rounded-lg border border-border/60 select-text whitespace-pre-wrap font-sans max-h-[220px] overflow-y-auto hide-scrollbar">
              {executionResult.latestAssistantResponse}
            </div>
          </div>
        )}

        {/* ── Inputs Section ── */}
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
              {(() => {
                const messageChannel = inputChannels.find(
                  (c) => c.key === "message" || c.key === "messages" || c.key === "prompt"
                );
                const otherChannels = inputChannels.filter((c) => c.key !== messageChannel?.key);

                return (
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
                );
              })()}
            </>
          )}
        </div>

        {/* ── Results Tabs ── */}
        <div className="flex flex-col gap-2">
          <Tabs
            value={activeSubTab}
            onValueChange={(val) => setActiveSubTab(val as typeof activeSubTab)}
            className="w-full"
          >
            <TabsList className="w-full grid grid-cols-4 h-7 p-0.5 bg-muted/60">
              <TabsTrigger value="trace" className="text-[10px] py-1">
                Trace ({executionResult?.visitedNodes.length || 0})
              </TabsTrigger>
              <TabsTrigger value="state" className="text-[10px] py-1">
                State
              </TabsTrigger>
              <TabsTrigger value="checkpoints" className="text-[10px] py-1">
                Memory ({checkpoints.length})
              </TabsTrigger>
              <TabsTrigger value="db" className="text-[10px] py-1">
                DB ({dbTables.reduce((a, t) => a + t.rows.length, 0)})
              </TabsTrigger>
            </TabsList>

            {/* 1. Trace Tab */}
            <TabsContent value="trace" className="flex flex-col gap-2 pt-2 m-0">
              {executionResult ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 pb-0.5">
                    <span className="font-mono truncate max-w-[240px]" title={executionResult.visitedNodes.join(" → ")}>
                      Path: {executionResult.visitedNodes.join(" → ")}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono">{executionResult.totalDurationMs}ms</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-[10px] px-1.5 gap-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setIsTraceExpanded((v) => !v)}
                        title={isTraceExpanded ? "Collapse trace view" : "Expand trace view"}
                      >
                        {isTraceExpanded ? (
                          <>
                            <Minimize2 className="w-3 h-3" />
                            <span>Collapse</span>
                          </>
                        ) : (
                          <>
                            <Maximize2 className="w-3 h-3" />
                            <span>Expand</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <div
                    className={`flex flex-col gap-1.5 overflow-y-auto hide-scrollbar transition-all duration-200 ${
                      isTraceExpanded
                        ? "min-h-[460px] max-h-[750px]"
                        : "min-h-[300px] max-h-[500px]"
                    }`}
                  >
                    {executionResult.trace.map((t, idx) => {
                      const isFailed = t.status === "failed";
                      const isNodeExpanded = expandedTraceNodes[idx] ?? isTraceExpanded;
                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg border flex flex-col gap-1.5 text-[11px] ${
                            isFailed
                              ? "bg-destructive/10 border-destructive/30 text-destructive"
                              : "bg-background/80 border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isFailed ? "bg-destructive" : "bg-emerald-400"
                                }`}
                              />
                              {t.label}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-muted-foreground font-mono">
                                {t.nodeId}
                              </span>
                              {Boolean(t.output) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(JSON.stringify(t.output, null, 2));
                                    toast.success(`Copied output for ${t.label}`);
                                  }}
                                  title="Copy node output"
                                  className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          {Boolean(t.output) && (
                            <pre
                              className={`text-[9px] font-mono p-2 rounded overflow-auto hide-scrollbar transition-all ${
                                isNodeExpanded
                                  ? "max-h-[380px]"
                                  : "max-h-[260px]"
                              } ${
                                isFailed
                                  ? "bg-destructive/20 text-destructive border border-destructive/30"
                                  : "text-muted-foreground bg-muted/30"
                              }`}
                            >
                              {JSON.stringify(t.output, null, 2)}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 border rounded-xl border-dashed text-muted-foreground text-[11px]">
                  Click <strong>Run Graph</strong> to test in your browser.
                </div>
              )}
            </TabsContent>

            {/* 2. Final State Tab */}
            <TabsContent value="state" className="flex flex-col gap-2 pt-2 m-0">
              {executionResult?.finalState ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Active State Channels
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] px-2 gap-1"
                      onClick={copyStateJson}
                    >
                      {copiedKey ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      Copy JSON
                    </Button>
                  </div>
                  <pre
                    className={`p-2.5 rounded-lg bg-background border font-mono text-[10px] text-foreground overflow-y-auto hide-scrollbar transition-all ${
                      isTraceExpanded ? "max-h-[600px]" : "max-h-[380px]"
                    }`}
                  >
                    {JSON.stringify(executionResult.finalState, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-center p-6 border rounded-xl border-dashed text-muted-foreground text-[11px]">
                  No state recorded yet.
                </div>
              )}
            </TabsContent>

            {/* 3. Checkpoints Tab */}
            <TabsContent value="checkpoints" className="flex flex-col gap-2 pt-2 m-0">
              {checkpoints.length > 0 ? (
                <div
                  className={`flex flex-col gap-1.5 overflow-y-auto hide-scrollbar transition-all ${
                    isTraceExpanded ? "max-h-[600px]" : "max-h-[380px]"
                  }`}
                >
                  {checkpoints.map((cp, idx) => (
                    <div
                      key={cp.id}
                      className="p-2 rounded-lg border bg-background/80 flex flex-col gap-1 text-[10px]"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-primary font-bold">
                          Turn #{idx + 1} — {cp.stepName}
                        </span>
                        <span className="text-muted-foreground text-[9px]">
                          {new Date(cp.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        State keys: {Object.keys(cp.state).join(", ") || "(empty)"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-6 border rounded-xl border-dashed text-muted-foreground text-[11px]">
                  No checkpoints for thread <code>{threadId}</code>.
                </div>
              )}
            </TabsContent>

            {/* 4. DB Tables Tab */}
            <TabsContent value="db" className="flex flex-col gap-2 pt-2 m-0">
              {dbTables.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {dbTables.map((tbl) => (
                    <div key={tbl.name} className="flex flex-col gap-1 border rounded-lg p-2 bg-background/80">
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="font-bold text-foreground">Table: {tbl.name}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                          {tbl.rows.length} rows
                        </Badge>
                      </div>
                      <pre
                        className={`p-1.5 rounded bg-muted/30 font-mono text-[9px] overflow-y-auto hide-scrollbar transition-all ${
                          isTraceExpanded ? "max-h-[380px]" : "max-h-[240px]"
                        }`}
                      >
                        {JSON.stringify(tbl.rows, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-6 border rounded-xl border-dashed text-muted-foreground text-[11px]">
                  No simulation tables populated yet.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

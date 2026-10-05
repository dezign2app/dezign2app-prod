"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Activity,
  AlertCircle,
  Sparkles,
  Check,
  Copy,
  Terminal,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
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
import type { SimulationStepLogEntry, SimulationStepLogLevel } from "@/lib/simulation/types";

import {
  StartNodeTestingTabProps,
  ExecutionMode,
  LLMProvider,
  ActiveSubTab,
  TraceViewMode,
  BatchFormatMode,
  PROVIDER_MODELS,
  TestingHeaderToolbar,
  TestingInputsSection,
  TestingTraceTab,
  TestingLogsTab,
  TestingStateTab,
  TestingCheckpointsTab,
  TestingDbTab,
} from "./testing-tab";

export function StartNodeTestingTab({
  nodes,
  edges,
  stateChannels,
  inputChannels,
  memoryConfig,
}: StartNodeTestingTabProps) {
  // Execution state
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dezign2app_lg_exec_mode");
      if (saved === "browser" || saved === "server") return saved;
    }
    return "server";
  });
  const [isRunning, setIsRunning] = useState(false);
  const [threadId, setThreadId] = useState("session-1");
  const [knownThreads, setKnownThreads] = useState<string[]>(["session-1"]);
  const [activeSubTab, setActiveSubTab] = useState<ActiveSubTab>("trace");

  // LLM Config
  const [provider, setProvider] = useState<LLMProvider>("groq");
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
  const [traceNodeViews, setTraceNodeViews] = useState<Record<number, TraceViewMode>>({});
  const [batchFormatViews, setBatchFormatViews] = useState<Record<number, BatchFormatMode>>({});
  const [expandedBatchRaw, setExpandedBatchRaw] = useState<Record<string, boolean>>({});

  // Logs viewer state
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logLevelFilter, setLogLevelFilter] = useState<string>("all");
  const [logNodeFilter, setLogNodeFilter] = useState<string>("all");
  const [expandedLogDetails, setExpandedLogDetails] = useState<Record<string, boolean>>({});
  const [copiedAllLogs, setCopiedAllLogs] = useState(false);

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

  const handleProviderChange = (val: LLMProvider) => {
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
        trace: result.trace,
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

  // Consolidated execution logs across all steps configured in LangGraph
  const allLogs = useMemo<SimulationStepLogEntry[]>(() => {
    if (!executionResult) return [];
    if (executionResult.logs && executionResult.logs.length > 0) {
      return executionResult.logs;
    }
    const fromTrace = executionResult.trace.flatMap((t) => t.logs || []);
    if (fromTrace.length > 0) return fromTrace;
    return executionResult.trace.map((t) => ({
      timestamp: Date.now(),
      level: (t.status === "failed" ? "error" : "step") as SimulationStepLogLevel,
      message: `Step "${t.label}" (${t.nodeId}) executed with status: ${t.status}`,
      nodeId: t.nodeId,
      nodeLabel: t.label,
      details: t.output,
    }));
  }, [executionResult]);

  const allLogNodes = useMemo(() => {
    const map = new Map<string, string>();
    for (const log of allLogs) {
      if (log.nodeId) {
        map.set(log.nodeId, log.nodeLabel || log.nodeId);
      }
    }
    for (const n of nodes) {
      map.set(n.id, (n.data as { label?: string })?.label || n.id);
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [allLogs, nodes]);

  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      if (logLevelFilter !== "all" && log.level !== logLevelFilter) return false;
      if (logNodeFilter !== "all" && log.nodeId !== logNodeFilter) return false;
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase();
        const matchMsg = log.message.toLowerCase().includes(q);
        const matchLabel = log.nodeLabel?.toLowerCase().includes(q);
        const matchNode = log.nodeId?.toLowerCase().includes(q);
        const matchDetails = log.details ? JSON.stringify(log.details).toLowerCase().includes(q) : false;
        if (!matchMsg && !matchLabel && !matchNode && !matchDetails) return false;
      }
      return true;
    });
  }, [allLogs, logLevelFilter, logNodeFilter, logSearchQuery]);

  const logStats = useMemo(() => {
    const errorCount = allLogs.filter((l) => l.level === "error").length;
    const warnCount = allLogs.filter((l) => l.level === "warn").length;
    const llmCount = allLogs.filter((l) => l.level === "llm").length;
    const toolCount = allLogs.filter((l) => l.level === "tool").length;
    const stepCount = allLogs.filter((l) => l.level === "step").length;
    const configCount = allLogs.filter((l) => l.level === "config").length;
    const stateCount = allLogs.filter((l) => l.level === "state").length;
    return { errorCount, warnCount, llmCount, toolCount, stepCount, configCount, stateCount };
  }, [allLogs]);

  const handleCopyAllLogs = () => {
    if (allLogs.length === 0) return;
    const formatted = allLogs
      .map((l) => {
        const time = new Date(l.timestamp).toISOString();
        const node = l.nodeLabel ? `[${l.nodeLabel}]` : l.nodeId ? `[${l.nodeId}]` : "";
        const lvl = l.level.toUpperCase().padEnd(10);
        const details = l.details ? `\nDetails: ${JSON.stringify(l.details, null, 2)}` : "";
        return `${time} | ${lvl} | ${node} ${l.message}${details}`;
      })
      .join("\n\n");
    navigator.clipboard.writeText(formatted);
    setCopiedAllLogs(true);
    toast.success(`Copied ${allLogs.length} logs to clipboard`);
    setTimeout(() => setCopiedAllLogs(false), 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs bg-card/40">
      {/* ── Top Header Toolbar ── */}
      <TestingHeaderToolbar
        executionMode={executionMode}
        setExecutionMode={setExecutionMode}
        memoryConfig={memoryConfig}
        isRunning={isRunning}
        handleClearThread={handleClearThread}
        handleExecute={handleExecute}
        threadId={threadId}
        setThreadId={setThreadId}
        knownThreads={knownThreads}
        handleNewThread={handleNewThread}
        provider={provider}
        handleProviderChange={handleProviderChange}
        modelName={modelName}
        setModelName={setModelName}
        apiKey={apiKey}
        handleSaveApiKey={handleSaveApiKey}
        showKeyInput={showKeyInput}
        setShowKeyInput={setShowKeyInput}
      />

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
        <TestingInputsSection
          inputChannels={inputChannels}
          inputValues={inputValues}
          setInputValues={setInputValues}
          chatMessage={chatMessage}
          setChatMessage={setChatMessage}
          handleExecute={handleExecute}
          isInputCollapsed={isInputCollapsed}
          setIsInputCollapsed={setIsInputCollapsed}
        />

        {/* ── Results Tabs ── */}
        <div className="flex flex-col gap-2">
          <Tabs
            value={activeSubTab}
            onValueChange={(val) => setActiveSubTab(val as typeof activeSubTab)}
            className="w-full"
          >
            <TabsList className="w-full grid grid-cols-5 h-7 p-0.5 bg-muted/60">
              <TabsTrigger value="trace" className="text-[10px] py-1">
                Trace ({executionResult?.visitedNodes.length || 0})
              </TabsTrigger>
              <TabsTrigger value="logs" className="text-[10px] py-1 flex items-center justify-center gap-1">
                <Terminal className="w-2.5 h-2.5 text-blue-400" />
                <span>Logs</span>
                {allLogs.length > 0 && (
                  <span className="text-[8.5px] px-1 py-0 rounded bg-blue-500/20 text-blue-300 font-mono font-semibold">
                    {allLogs.length}
                  </span>
                )}
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
              <TestingTraceTab
                executionResult={executionResult}
                isTraceExpanded={isTraceExpanded}
                setIsTraceExpanded={setIsTraceExpanded}
                nodes={nodes}
                edges={edges}
                expandedTraceNodes={expandedTraceNodes}
                setExpandedTraceNodes={setExpandedTraceNodes}
                traceNodeViews={traceNodeViews}
                setTraceNodeViews={setTraceNodeViews}
                batchFormatViews={batchFormatViews}
                setBatchFormatViews={setBatchFormatViews}
                expandedBatchRaw={expandedBatchRaw}
                expandedLogDetails={expandedLogDetails}
                setExpandedLogDetails={setExpandedLogDetails}
                provider={provider}
                modelName={modelName}
              />
            </TabsContent>

            {/* 2. Logs Tab (All Steps Configured in LangGraph Node) */}
            <TabsContent value="logs" className="flex flex-col gap-2 pt-2 m-0">
              <TestingLogsTab
                allLogs={allLogs}
                filteredLogs={filteredLogs}
                allLogNodes={allLogNodes}
                logStats={logStats}
                logSearchQuery={logSearchQuery}
                setLogSearchQuery={setLogSearchQuery}
                logNodeFilter={logNodeFilter}
                setLogNodeFilter={setLogNodeFilter}
                logLevelFilter={logLevelFilter}
                setLogLevelFilter={setLogLevelFilter}
                copiedAllLogs={copiedAllLogs}
                handleCopyAllLogs={handleCopyAllLogs}
                expandedLogDetails={expandedLogDetails}
                setExpandedLogDetails={setExpandedLogDetails}
                isTraceExpanded={isTraceExpanded}
              />
            </TabsContent>

            {/* 3. Final State Tab */}
            <TabsContent value="state" className="flex flex-col gap-2 pt-2 m-0">
              <TestingStateTab
                finalState={executionResult?.finalState}
                isTraceExpanded={isTraceExpanded}
                copiedKey={copiedKey}
                copyStateJson={copyStateJson}
              />
            </TabsContent>

            {/* 4. Checkpoints Tab */}
            <TabsContent value="checkpoints" className="flex flex-col gap-2 pt-2 m-0">
              <TestingCheckpointsTab
                checkpoints={checkpoints}
                threadId={threadId}
                isTraceExpanded={isTraceExpanded}
              />
            </TabsContent>

            {/* 5. DB Tables Tab */}
            <TabsContent value="db" className="flex flex-col gap-2 pt-2 m-0">
              <TestingDbTab
                dbTables={dbTables}
                isTraceExpanded={isTraceExpanded}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

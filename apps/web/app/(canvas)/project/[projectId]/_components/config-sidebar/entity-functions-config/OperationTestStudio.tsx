import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  DbOperationFunction,
  DbOperationTestCase,
  CanvasEntityColumn,
} from "@workspace/canvas/types";
import { BackendNode } from "@/types/canvas";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { sanitizeForConvex } from "@/lib/utils/convexSanitizer";
import {
  generateDefaultParams,
  TestStudioHeader,
  TestCaseTabs,
  TestParamsForm,
  TestRunBar,
  TestResultViewer,
  ServerOfflineBanner,
} from "./test-studio";
import {
  testDatabaseOperation,
  checkDatabaseConnection,
} from "@/lib/services/databaseService";

export interface OperationTestStudioProps {
  selectedOp: DbOperationFunction;
  label: string;
  columns?: CanvasEntityColumn[];
  parentDb?: BackendNode;
  updateSelectedOp: (changes: Partial<DbOperationFunction>) => void;
}

export const OperationTestStudio: React.FC<OperationTestStudioProps> = React.memo(({
  selectedOp,
  label,
  columns,
  parentDb,
  updateSelectedOp,
}) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);

  // Connection settings
  const isRedis =
    parentDb?.type === "redis_instance" ||
    parentDb?.data?.dbEngine === "redis" ||
    selectedOp.id.startsWith("redis-");

  const engine = isRedis ? "redis" : parentDb?.data?.dbEngine || "sqlite";
  const isSqlite = engine === "sqlite";
  const host = parentDb?.data?.host || "localhost";
  const port: number | string = parentDb?.data?.port ?? (isRedis ? 6379 : isSqlite ? 0 : 5432);
  const dbFilePath = parentDb?.data?.dbFilePath || "dev.db";
  const dbFilePathEnv = parentDb?.data?.dbFilePathEnv || "DB_FILE_PATH";
  const connUri = isRedis
    ? `redis://${host}:${port}`
    : isSqlite
      ? `sqlite:${dbFilePath}`
      : `${host}:${port}`;
  const isParentConnected = parentDb?.data?.lastConnectionStatus?.connected === true;
  const isParentFailed = parentDb?.data?.lastConnectionStatus?.connected === false;
  const connectionError = parentDb?.data?.lastConnectionStatus?.error;

  // Studio Mode: live vs sandbox
  const [testMode, setTestMode] = useState<"live" | "sandbox">("live");
  const [executing, setExecuting] = useState(false);
  const [pingingParent, setPingingParent] = useState(false);

  // Local Test Cases state to avoid store updates on every keystroke
  const initialCases = useMemo(() => {
    if (selectedOp.testCases && selectedOp.testCases.length > 0) {
      return sanitizeForConvex(selectedOp.testCases);
    }
    return [
      {
        id: "case-1",
        name: "Standard Case",
        params: generateDefaultParams(selectedOp, label),
      },
    ];
  }, [selectedOp.testCases, selectedOp.params, label]);

  const [testCases, setTestCases] = useState<DbOperationTestCase[]>(initialCases);
  const [activeCaseId, setActiveCaseId] = useState<string>(initialCases[0]?.id || "case-1");
  const latestTestCasesRef = useRef(testCases);
  latestTestCasesRef.current = testCases;

  // Sync test cases when switching operation
  const prevOpIdRef = useRef(selectedOp.id);
  useEffect(() => {
    if (selectedOp.id !== prevOpIdRef.current) {
      prevOpIdRef.current = selectedOp.id;
      const cases =
        selectedOp.testCases && selectedOp.testCases.length > 0
          ? sanitizeForConvex(selectedOp.testCases)
          : [
              {
                id: "case-1",
                name: "Standard Case",
                params: generateDefaultParams(selectedOp, label),
              },
            ];
      setTestCases(cases);
      latestTestCasesRef.current = cases;
      setActiveCaseId(cases[0]?.id || "case-1");
    }
  }, [selectedOp.id, selectedOp.testCases, selectedOp.params, label]);

  // Debounced persistence to parent canvas store
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const persistTestCases = useCallback(
    (cases: DbOperationTestCase[], immediate = false) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (immediate) {
        updateSelectedOp({ testCases: cases });
      } else {
        debounceTimerRef.current = setTimeout(() => {
          updateSelectedOp({ testCases: cases });
        }, 500);
      }
    },
    [updateSelectedOp],
  );

  // Flush pending updates when unmounting
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        updateSelectedOp({ testCases: latestTestCasesRef.current });
      }
    };
  }, [updateSelectedOp]);

  // Active test case guaranteed non-null
  const activeCase: DbOperationTestCase =
    testCases.find((tc) => tc.id === activeCaseId) ||
    testCases[0] || {
      id: "case-1",
      name: "Standard Case",
      params: generateDefaultParams(selectedOp, label),
    };

  // Add Test Case
  const handleAddTestCase = () => {
    const newCaseId = `case-${Date.now()}`;
    const newCase: DbOperationTestCase = {
      id: newCaseId,
      name: `Test Case ${testCases.length + 1}`,
      params: generateDefaultParams(selectedOp, label),
    };
    const updated = [...testCases, newCase];
    setTestCases(updated);
    persistTestCases(updated, true);
    setActiveCaseId(newCaseId);
  };

  // Duplicate Test Case
  const handleDuplicateTestCase = (sourceCase: DbOperationTestCase) => {
    const newCaseId = `case-${Date.now()}`;
    const duplicated: DbOperationTestCase = {
      id: newCaseId,
      name: `${sourceCase.name} (Copy)`,
      params: JSON.parse(JSON.stringify(sourceCase.params)),
    };
    const updated = [...testCases, duplicated];
    setTestCases(updated);
    persistTestCases(updated, true);
    setActiveCaseId(newCaseId);
  };

  // Delete Test Case
  const handleDeleteTestCase = (caseId: string) => {
    if (testCases.length <= 1) return;
    const updated = testCases.filter((tc) => tc.id !== caseId);
    setTestCases(updated);
    persistTestCases(updated, true);
    if (activeCaseId === caseId) {
      setActiveCaseId(updated[0]?.id || "case-1");
    }
  };

  // Rename Test Case
  const handleRenameTestCase = (caseId: string, newName: string) => {
    const updated = testCases.map((c) =>
      c.id === caseId ? { ...c, name: newName } : c,
    );
    setTestCases(updated);
    persistTestCases(updated, true);
  };

  // Update a parameter value in the active test case
  const handleParamChange = useCallback(
    (paramName: string, value: unknown) => {
      setTestCases((prev) => {
        const updated = prev.map((tc) =>
          tc.id === activeCaseId
            ? { ...tc, params: { ...tc.params, [paramName]: value } }
            : tc,
        );
        persistTestCases(updated, false);
        return updated;
      });
    },
    [activeCaseId, persistTestCases],
  );

  // Ping parent DB
  const handlePingConnection = async () => {
    if (!parentDb) return;
    setPingingParent(true);
    try {
      const data = await checkDatabaseConnection({
        engine,
        connection: {
          host,
          port,
          connectionStringEnv: parentDb.data?.connectionStringEnv,
          dbFilePath,
          dbFilePathEnv,
        },
      });
      updateNode(parentDb.id, {
        data: {
          ...parentDb.data,
          lastConnectionStatus: {
            connected: !!data.success,
            latencyMs: data.latencyMs,
            checkedAt: new Date().toLocaleTimeString(),
            serverInfo: data.info,
            error: data.error,
          },
        },
      });
    } catch {
      // Ignored
    } finally {
      setPingingParent(false);
    }
  };

  // Auto-verify server connection if untested when in Live mode
  useEffect(() => {
    if (
      testMode === "live" &&
      parentDb &&
      parentDb.data?.lastConnectionStatus === undefined &&
      !pingingParent
    ) {
      handlePingConnection();
    }
  }, [testMode, parentDb?.id]);

  // Execute the active test case
  const handleRunTest = async () => {
    if (!activeCase || executing) return;
    setExecuting(true);

    // Immediately flush and persist any pending edits before running
    persistTestCases(testCases, true);

    try {
      const data = await testDatabaseOperation({
        engine,
        connection: {
          host,
          port,
          dbFilePath,
          dbFilePathEnv,
        },
        entity: {
          name: label,
          columns,
        },
        operation: {
          id: selectedOp.id,
          name: selectedOp.name,
          kind: selectedOp.kind,
          code: selectedOp.code,
          query: selectedOp.query,
          signature: selectedOp.signature,
          params: selectedOp.params,
        },
        args: activeCase.params,
        mode: testMode,
      });

      // Sync parent node connection status based on live test result
      if (parentDb && testMode === "live") {
        if (data.serverActive === false) {
          updateNode(parentDb.id, {
            data: {
              ...parentDb.data,
              lastConnectionStatus: {
                connected: false,
                checkedAt: new Date().toLocaleTimeString(),
                latencyMs: 0,
                error: data.error,
              },
            },
          });
        } else if (data.serverActive === true || data.success) {
          updateNode(parentDb.id, {
            data: {
              ...parentDb.data,
              lastConnectionStatus: {
                connected: true,
                checkedAt: new Date().toLocaleTimeString(),
                latencyMs: data.durationMs || 1,
              },
            },
          });
        }
      }

      const lastResult = {
        success: !!data.success,
        output: sanitizeForConvex(data.output),
        error: data.error,
        durationMs: data.durationMs,
        executedAt: new Date().toLocaleTimeString(),
        rawCommand: data.rawCommand,
      };

      const updated = testCases.map((tc) =>
        tc.id === activeCase.id ? { ...tc, lastResult } : tc,
      );
      setTestCases(updated);
      persistTestCases(updated, true);
    } catch (err) {
      if (parentDb && testMode === "live") {
        updateNode(parentDb.id, {
          data: {
            ...parentDb.data,
            lastConnectionStatus: {
              connected: false,
              checkedAt: new Date().toLocaleTimeString(),
              latencyMs: 0,
              error: err instanceof Error ? err.message : "Network error executing test",
            },
          },
        });
      }

      const lastResult = {
        success: false,
        error: err instanceof Error ? err.message : "Network error executing test",
        durationMs: 0,
        executedAt: new Date().toLocaleTimeString(),
        rawCommand: `${selectedOp.name}()`,
      };
      const updated = testCases.map((tc) =>
        tc.id === activeCase.id ? { ...tc, lastResult } : tc,
      );
      setTestCases(updated);
      persistTestCases(updated, true);
    } finally {
      setExecuting(false);
    }
  };

  // Keyboard shortcut: Ctrl/Cmd + Enter to run test
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRunTest();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCase, testMode]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      {/* 1. Header: Target Connection & Execution Mode Switcher */}
      <TestStudioHeader
        connUri={connUri}
        isParentConnected={isParentConnected}
        isParentFailed={isParentFailed}
        parentDb={parentDb}
        pingingParent={pingingParent}
        testMode={testMode}
        onPingConnection={handlePingConnection}
        onSetTestMode={setTestMode}
      />

      {/* 1.1 Server Not Active Error Banner */}
      {testMode === "live" && (!isParentConnected || isParentFailed) && (
        <ServerOfflineBanner
          connUri={connUri}
          engine={engine}
          host={host}
          port={port}
          error={connectionError}
          pingingParent={pingingParent}
          onPingConnection={handlePingConnection}
          onSwitchToSandbox={() => setTestMode("sandbox")}
        />
      )}

      {/* 2. Test Cases Tab Selector */}
      <TestCaseTabs
        testCases={testCases}
        activeCaseId={activeCase.id}
        onSelectCase={setActiveCaseId}
        onAddCase={handleAddTestCase}
        onDuplicateCase={handleDuplicateTestCase}
        onDeleteCase={handleDeleteTestCase}
        onRenameCase={handleRenameTestCase}
      />

      {/* 3. Parameter Inputs Form */}
      <TestParamsForm
        selectedOp={selectedOp}
        activeCase={activeCase}
        label={label}
        onParamChange={handleParamChange}
      />

      {/* 4. Action Trigger Bar */}
      <TestRunBar
        executing={executing}
        activeCase={activeCase}
        onRunTest={handleRunTest}
      />

      {/* 5. Live Command & Result Inspector */}
      {activeCase.lastResult && (
        <TestResultViewer
          lastResult={activeCase.lastResult}
          testMode={testMode}
          onSwitchToSandbox={() => setTestMode("sandbox")}
        />
      )}
    </div>
  );
});

OperationTestStudio.displayName = "OperationTestStudio";


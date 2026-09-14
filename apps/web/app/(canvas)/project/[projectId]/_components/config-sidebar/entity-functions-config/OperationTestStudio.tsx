import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { DbOperationFunction, DbOperationTestCase } from "@workspace/canvas/types";
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
} from "./test-studio";

export interface OperationTestStudioProps {
  selectedOp: DbOperationFunction;
  label: string;
  parentDb?: BackendNode;
  updateSelectedOp: (changes: Partial<DbOperationFunction>) => void;
}

export const OperationTestStudio: React.FC<OperationTestStudioProps> = ({
  selectedOp,
  label,
  parentDb,
  updateSelectedOp,
}) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);

  // Connection settings
  const isRedis =
    parentDb?.type === "redis_instance" ||
    parentDb?.data?.dbEngine === "redis" ||
    selectedOp.id.startsWith("redis-");

  const engine = isRedis ? "redis" : (parentDb?.data?.dbEngine as string) || "sqlite";
  const host = parentDb?.data?.host || "localhost";
  const port = parentDb?.data?.port || (isRedis ? 6379 : 5432);
  const connUri = isRedis ? `redis://${host}:${port}` : `${host}:${port}`;
  const isParentConnected = parentDb?.data?.lastConnectionStatus?.connected === true;

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
      }
    };
  }, []);

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
      const res = await fetch("/api/operations/check-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engine,
          connection: {
            host,
            port,
            connectionStringEnv: parentDb.data?.connectionStringEnv,
          },
        }),
      });
      const data = await res.json();
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

  // Execute the active test case
  const handleRunTest = async () => {
    if (!activeCase || executing) return;
    setExecuting(true);

    // Immediately flush and persist any pending edits before running
    persistTestCases(testCases, true);

    try {
      const res = await fetch("/api/operations/test-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engine,
          connection: {
            host,
            port,
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
        }),
      });

      const data = await res.json();

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
        parentDb={parentDb}
        pingingParent={pingingParent}
        testMode={testMode}
        onPingConnection={handlePingConnection}
        onSetTestMode={setTestMode}
      />

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
        />
      )}
    </div>
  );
};

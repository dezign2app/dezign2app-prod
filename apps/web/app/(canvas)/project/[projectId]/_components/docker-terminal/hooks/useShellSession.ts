"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { isElectron, getElectronAPI } from "@/lib/electron";
import { TerminalTab } from "../types";

interface UseShellSessionProps {
  projectId: string;
  outputDir: string;
  activeTab: TerminalTab;
}

export function useShellSession({ projectId, outputDir, activeTab }: UseShellSessionProps) {
  const inElectron = isElectron();
  const [shellLogs, setShellLogs] = useState<string[]>([]);
  const [shellActive, setShellActive] = useState<boolean>(false);

  // Dynamic PTY dimensions measured directly from wterm DOM grid
  const shellDimensionsRef = useRef<{ cols: number; rows: number }>({ cols: 100, rows: 20 });
  const shellIdRef = useRef<string>(`pty-${projectId}-${Date.now()}`);

  const handleShellResize = useCallback(
    (cols: number, rows: number) => {
      shellDimensionsRef.current = { cols, rows };
      if (inElectron) {
        const api = getElectronAPI();
        api?.terminal?.resize?.(shellIdRef.current, cols, rows);
      }
    },
    [inElectron],
  );

  // Interactive PTY Session Handler (Electron only)
  useEffect(() => {
    if (!inElectron || activeTab !== "shell") return;
    const api = getElectronAPI();
    if (!api?.terminal?.create) return;

    const ptyId = shellIdRef.current;
    let isSubscribed = true;
    const { cols, rows } = shellDimensionsRef.current;

    api.terminal.create(ptyId, outputDir || "", cols, rows).then(() => {
      if (!isSubscribed) return;
      setShellActive(true);
      setShellLogs((prev) =>
        prev.length === 0
          ? [`\x1b[36mConnected to Interactive Shell (${outputDir || "default"})\x1b[0m\r\n`]
          : prev,
      );
    });

    const cleanupData = api.terminal.onData(ptyId, (data: string) => {
      if (isSubscribed) {
        setShellLogs((prev) => [...prev, data]);
      }
    });

    const cleanupExit = api.terminal.onExit(ptyId, () => {
      if (isSubscribed) {
        setShellActive(false);
        setShellLogs((prev) => [...prev, "\r\n\x1b[31m[Shell Session Exited]\x1b[0m\r\n"]);
      }
    });

    return () => {
      isSubscribed = false;
      cleanupData();
      cleanupExit();
    };
  }, [inElectron, activeTab, outputDir]);

  const handleShellInput = useCallback(
    (data: string) => {
      if (inElectron) {
        const api = getElectronAPI();
        api?.terminal?.write(shellIdRef.current, data);
      }
    },
    [inElectron],
  );

  const clearShellLogs = useCallback(() => {
    setShellLogs([]);
  }, []);

  return {
    shellLogs,
    setShellLogs,
    shellActive,
    shellIdRef,
    handleShellResize,
    handleShellInput,
    clearShellLogs,
  };
}

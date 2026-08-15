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
  const [shellLogs, setShellLogs] = useState<string[]>(() => {
    if (!inElectron) {
      return [
        `\x1b[36mDezign2App Interactive Shell [Web Preview]\x1b[0m\r\n\x1b[90mWorkspace: ${outputDir || `/workspace/${projectId}`}\x1b[0m\r\n\x1b[90mType commands like "help", "pnpm dev", "clear".\x1b[0m\r\n\r\n\x1b[32mblueprint\x1b[0m \x1b[34m❯\x1b[0m `,
      ];
    }
    return [];
  });
  const [shellActive, setShellActive] = useState<boolean>(false);

  const shellDimensionsRef = useRef<{ cols: number; rows: number }>({ cols: 100, rows: 20 });
  const shellIdRef = useRef<string>(`pty-shell-${projectId}`);
  const ptyCreatedRef = useRef<boolean>(false);
  const prevOutputDirRef = useRef<string>(outputDir);

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
    if (!inElectron) return;
    const api = getElectronAPI();
    if (!api?.terminal?.create) return;

    const ptyId = shellIdRef.current;
    const { cols, rows } = shellDimensionsRef.current;

    if (!ptyCreatedRef.current) {
      ptyCreatedRef.current = true;
      api.terminal.create(ptyId, outputDir || "", cols, rows).then(() => {
        setShellActive(true);
        if (outputDir) {
          api?.terminal?.write?.(ptyId, `cd "${outputDir}"\r`);
        }
      });
    }

    const cleanupData = api.terminal.onData(ptyId, (data: string) => {
      setShellActive(true);
      setShellLogs((prev) => [...prev, data]);
    });

    const cleanupExit = api.terminal.onExit(ptyId, () => {
      setShellActive(false);
      setShellLogs((prev) => [...prev, "\r\n\x1b[31m[Shell Session Exited]\x1b[0m\r\n"]);
    });

    return () => {
      cleanupData();
      cleanupExit();
    };
  }, [inElectron, outputDir]);

  // Navigate PTY to new directory if user picks a different folder
  useEffect(() => {
    if (!inElectron || !ptyCreatedRef.current) return;
    if (outputDir && prevOutputDirRef.current !== outputDir) {
      prevOutputDirRef.current = outputDir;
      const api = getElectronAPI();
      api?.terminal?.write(shellIdRef.current, `cd "${outputDir}"\r`);
    }
  }, [inElectron, outputDir]);

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
    if (inElectron) {
      const api = getElectronAPI();
      api?.terminal?.write(shellIdRef.current, "\x0c");
    }
  }, [inElectron]);

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

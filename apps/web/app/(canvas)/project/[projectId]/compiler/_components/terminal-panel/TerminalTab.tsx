"use client";

import React from "react";
import { WTermTerminal, WTermTerminalHandle } from "@/components/terminal";
import { TerminalViewport } from "../../../_components/terminal/components/TerminalViewport";
import { TerminalSession, TerminalType } from "../../../_components/terminal/types";

interface TerminalTabProps {
  projectId?: string;
  sessions: TerminalSession[];
  activeSessionId: string | null;
  terminalRefs: React.MutableRefObject<Map<string, WTermTerminalHandle | null>>;
  onTerminalInput: (sessionId: string, data: string) => void;
  onTerminalResize: (sessionId: string, cols: number, rows: number) => void;
  onCreateSession: (type?: TerminalType, shell?: string, title?: string) => void;
  formattedLogs: string[];
}

export function TerminalTab({
  projectId,
  sessions,
  activeSessionId,
  terminalRefs,
  onTerminalInput,
  onTerminalResize,
  onCreateSession,
  formattedLogs,
}: TerminalTabProps) {
  if (projectId) {
    return (
      <TerminalViewport
        sessions={sessions}
        activeSessionId={activeSessionId}
        terminalRefs={terminalRefs}
        onTerminalInput={onTerminalInput}
        onTerminalResize={onTerminalResize}
        onNewTab={onCreateSession}
      />
    );
  }

  return (
    <WTermTerminal
      logs={formattedLogs}
      interactive={true}
      autoScroll={true}
      placeholder="Terminal active. Type commands or view build logs."
    />
  );
}

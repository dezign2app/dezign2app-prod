export interface TerminalLog {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "system";
  text: string;
}

export type TerminalPanelTab = "problems" | "output" | "terminal" | "ports";

export interface ServicePortInfo {
  port: number | string;
  name: string;
  type?: string;
  url?: string;
  status?: "running" | "ready" | "stopped";
}

export interface TerminalPanelProps {
  projectId?: string;
  outputDir?: string;
  logs?: TerminalLog[];
  onClearLogs?: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  activeTab?: TerminalPanelTab;
  onSelectTab?: (tab: TerminalPanelTab) => void;
  ports?: ServicePortInfo[];
  outputLogs?: string[];
}

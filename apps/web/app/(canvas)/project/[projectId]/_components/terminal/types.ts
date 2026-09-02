export interface TerminalProps {
  projectId: string;
  projectName?: string;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

export type TerminalType =
  | "shell"
  | "powershell"
  | "cmd"
  | "bash"
  | "zsh"
  | "custom";

export type ProcessStatus = "idle" | "running" | "stopped" | "error";

export interface DetectedPort {
  port: number;
  url: string;
  detectedAt: number;
}

export interface TerminalSession {
  id: string;
  title: string;
  type: TerminalType;
  shell?: string;
  logs?: string[];
  status: ProcessStatus;
  detectedPorts?: DetectedPort[];
  createdAt: number;
}

export interface ServiceEndpoint {
  name: string;
  port: string;
  url: string;
  type: "web" | "service" | "db" | "redis" | "kafka";
  healthUrl?: string;
  docsUrl?: string;
}

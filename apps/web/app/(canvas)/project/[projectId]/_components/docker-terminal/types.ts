export interface DockerCanvasTerminalProps {
  projectId: string;
  projectName?: string;
}

export type TerminalTab = "dev" | "docker" | "shell";

export type ProcessStatus = "idle" | "starting" | "building" | "running" | "stopped" | "error";

export interface ServiceEndpoint {
  name: string;
  port: string;
  url: string;
  type: "web" | "service" | "db" | "redis" | "kafka";
  healthUrl?: string;
  docsUrl?: string;
}

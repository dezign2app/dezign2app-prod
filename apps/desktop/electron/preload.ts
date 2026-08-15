import { contextBridge, ipcRenderer } from "electron";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
export interface CompiledFile {
  filename: string;
  content: string;
}

export interface ElectronAPI {
  /** True when running inside Electron */
  isElectron: true;

  /** Native OS platform */
  platform(): Promise<NodeJS.Platform>;

  /** File system */
  fs: {
    pickDirectory(): Promise<string | null>;
    writeProject(outputDir: string, files: CompiledFile[]): Promise<{ success: boolean; path: string }>;
  };

  /** Docker Compose runner */
  docker: {
    up(projectDir: string): void;
    down(projectDir: string): void;
    onLog(cb: (line: string) => void): () => void;
  };

  /** Browser-based Authentication */
  auth: {
    openBrowserLogin(url?: string): Promise<void>;
    onAuthCallback(cb: (data: { token?: string; ticket?: string; rawUrl?: string }) => void): () => void;
  };

  /** PTY terminal sessions */
  terminal: {
    create(id: string, cwd: string, cols: number, rows: number): Promise<{ success: boolean }>;
    write(id: string, data: string): void;
    resize(id: string, cols: number, rows: number): void;
    kill(id: string): void;
    onData(id: string, cb: (data: string) => void): () => void;
    onExit(id: string, cb: (code: number) => void): () => void;
  };
}

// ─────────────────────────────────────────────
//  Helper — event listener with cleanup
// ─────────────────────────────────────────────
function on(channel: string, cb: (...args: any[]) => void) {
  const handler = (_: Electron.IpcRendererEvent, ...args: any[]) => cb(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

// ─────────────────────────────────────────────
//  Expose API to renderer (window.electronAPI)
// ─────────────────────────────────────────────
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,

  platform: () => ipcRenderer.invoke("app:platform"),

  auth: {
    openBrowserLogin: (url?: string) =>
      ipcRenderer.invoke("auth:open-browser-login", url),
    onAuthCallback: (
      cb: (data: { token?: string; ticket?: string; rawUrl?: string }) => void
    ) => on("auth:callback", cb),
  },

  fs: {
    pickDirectory: () => ipcRenderer.invoke("fs:pick-directory"),
    writeProject: (outputDir: string, files: CompiledFile[]) =>
      ipcRenderer.invoke("fs:write-project", outputDir, files),
  },

  docker: {
    up: (projectDir: string) => ipcRenderer.send("docker:up", projectDir),
    down: (projectDir: string) => ipcRenderer.send("docker:down", projectDir),
    onLog: (cb: (line: string) => void) => on("docker:log", cb),
  },

  terminal: {
    create: (id: string, cwd: string, cols: number, rows: number) =>
      ipcRenderer.invoke("terminal:create", id, cwd, cols, rows),
    write: (id: string, data: string) =>
      ipcRenderer.send("terminal:write", id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send("terminal:resize", id, cols, rows),
    kill: (id: string) => ipcRenderer.send("terminal:kill", id),
    onData: (id: string, cb: (data: string) => void) =>
      on(`terminal:data:${id}`, cb),
    onExit: (id: string, cb: (code: number) => void) =>
      on(`terminal:exit:${id}`, cb),
  },
} satisfies ElectronAPI);

// ─────────────────────────────────────────────
//  TypeScript global type augmentation
// ─────────────────────────────────────────────
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

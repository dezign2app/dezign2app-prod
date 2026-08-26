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
    writeProject(
      outputDir: string,
      files: CompiledFile[],
      options?: { cleanStale?: boolean }
    ): Promise<{ success: boolean; path: string; writtenCount?: number; totalCount?: number }>;
    readFile(
      outputDir: string,
      relativePath: string
    ): Promise<{ success: boolean; content: string | null; path: string }>;
  };

  /** Docker Compose runner */
  docker: {
    up(projectDir: string): void;
    down(projectDir: string): void;
    write(data: string): void;
    onLog(cb: (line: string) => void): () => void;
    preflight(): Promise<{ ok: boolean; reason: string | null }>;
  };

  /** Dev runner (infra + pnpm dev) */
  dev: {
    run(projectDir: string): Promise<{ ok: boolean; reason: string | null }>;
    stop(projectDir: string): void;
    write(data: string): void;
    onLog(cb: (line: string) => void): () => void;
  };

  /** Shell / External links */
  shell: {
    openExternal(url: string): Promise<{ success: boolean }>;
  };

  /** Browser-based Authentication */
  auth: {
    openBrowserLogin(url?: string): Promise<void>;
    onAuthCallback(cb: (data: { token?: string; ticket?: string; rawUrl?: string }) => void): () => void;
  };

  /** PTY terminal sessions */
  terminal: {
    create(
      id: string,
      cwd: string,
      cols: number,
      rows: number,
      customShell?: string
    ): Promise<{ success: boolean }>;
    write(id: string, data: string): void;
    resize(id: string, cols: number, rows: number): void;
    kill(id: string): void;
    onData(id: string, cb: (data: string) => void): () => void;
    onExit(id: string, cb: (code: number) => void): () => void;
  };

  /** Silent OS-level network port reachability */
  network: {
    isPortOpen(port: number): Promise<boolean>;
  };
}

// ─────────────────────────────────────────────
//  Helper — event listener with cleanup
// ─────────────────────────────────────────────
function on<T>(channel: string, cb: (data: T) => void) {
  const handler = (_: Electron.IpcRendererEvent, data: T) => cb(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

// ─────────────────────────────────────────────
//  Expose API to renderer (window.electronAPI)
// ─────────────────────────────────────────────
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,

  platform: () => ipcRenderer.invoke("app:platform"),

  shell: {
    openExternal: (url: string) =>
      ipcRenderer.invoke("shell:open-external", url),
  },

  auth: {
    openBrowserLogin: (url?: string) =>
      ipcRenderer.invoke("auth:open-browser-login", url),
    onAuthCallback: (
      cb: (data: { token?: string; ticket?: string; rawUrl?: string }) => void
    ) => on("auth:callback", cb),
  },

  fs: {
    pickDirectory: () => ipcRenderer.invoke("fs:pick-directory"),
    writeProject: (
      outputDir: string,
      files: CompiledFile[],
      options?: { cleanStale?: boolean }
    ) => ipcRenderer.invoke("fs:write-project", outputDir, files, options),
    readFile: (outputDir: string, relativePath: string) =>
      ipcRenderer.invoke("fs:read-file", outputDir, relativePath),
  },

  docker: {
    up: (projectDir: string) => ipcRenderer.send("docker:up", projectDir),
    down: (projectDir: string) => ipcRenderer.send("docker:down", projectDir),
    write: (data: string) => ipcRenderer.send("docker:write", data),
    onLog: (cb: (line: string) => void) => on("docker:log", cb),
    preflight: () => ipcRenderer.invoke("docker:preflight"),
  },

  dev: {
    run: (projectDir: string) => ipcRenderer.invoke("dev:run", projectDir),
    stop: (projectDir: string) => ipcRenderer.send("dev:stop", projectDir),
    write: (data: string) => ipcRenderer.send("dev:write", data),
    onLog: (cb: (line: string) => void) => on("dev:log", cb),
  },

  terminal: {
    create: (
      id: string,
      cwd: string,
      cols: number,
      rows: number,
      customShell?: string
    ) => ipcRenderer.invoke("terminal:create", id, cwd, cols, rows, customShell),
    write: (id: string, data: string) =>
      ipcRenderer.send("terminal:write", id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send("terminal:resize", id, cols, rows),
    kill: (id: string) => ipcRenderer.send("terminal:kill", id),
    onData(id: string, cb: (data: string) => void) {
      return on(`terminal:data:${id}`, cb);
    },
    onExit(id: string, cb: (code: number) => void) {
      return on(`terminal:exit:${id}`, cb);
    },
  },

  network: {
    isPortOpen: (port: number) => ipcRenderer.invoke("network:isPortOpen", port),
  },
} satisfies ElectronAPI);

/**
 * Global type augmentation for window.electronAPI.
 * Injected by the Electron preload script when running inside the desktop app.
 * Undefined when running in a regular browser.
 */

export interface ElectronCompiledFile {
  filename: string;
  content: string;
}

export interface ElectronAPI {
  isElectron: true;
  platform(): Promise<NodeJS.Platform>;

  fs: {
    pickDirectory(): Promise<string | null>;
    writeProject(
      outputDir: string,
      files: ElectronCompiledFile[],
      options?: { cleanStale?: boolean; deletedFiles?: string[] }
    ): Promise<{
      success: boolean;
      path: string;
      writtenCount?: number;
      totalCount?: number;
    }>;
    deleteFiles?(
      outputDir: string,
      relativePaths: string[]
    ): Promise<{
      success: boolean;
      deletedCount: number;
      errors: string[];
    }>;
    readFile(
      outputDir: string,
      relativePath: string
    ): Promise<{
      success: boolean;
      content: string | null;
      path: string;
    }>;
    listDirectory?(
      outputDir: string
    ): Promise<{
      success: boolean;
      tree: Array<{ name: string; path: string; isFolder: boolean; children?: Array<any> }>;
      totalFiles: number;
      path: string;
    }>;
  };

  shell?: {
    openExternal(url: string): Promise<{ success: boolean }>;
  };

  auth: {
    openBrowserLogin(url?: string): Promise<void>;
    onAuthCallback(
      cb: (data: { token?: string; ticket?: string; rawUrl?: string }) => void
    ): () => void;
  };

  docker: {
    up(projectDir: string): void;
    down(projectDir: string): void;
    write(data: string): void;
    onLog(cb: (line: string) => void): () => void;
    preflight(): Promise<{ ok: boolean; reason: string | null }>;
  };

  dev: {
    run(projectDir: string): Promise<{ ok: boolean; reason: string | null }>;
    stop(projectDir: string): void;
    write(data: string): void;
    onLog(cb: (line: string) => void): () => void;
  };

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

  network?: {
    isPortOpen(port: number): Promise<boolean>;
  };

  workspace?: {
    setPath?(path: string): void;
    getPath?(): Promise<string | null>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

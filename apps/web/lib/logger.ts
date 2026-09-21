export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function normalizeLevel(raw: unknown): LogLevel | undefined {
  if (typeof raw !== "string") return undefined;
  const normalized = raw.trim().toLowerCase().replace(/['"]/g, "");
  if (normalized === "none") return "silent";
  return normalized in LOG_LEVELS ? (normalized as LogLevel) : undefined;
}

export function getActiveLogLevel(): LogLevel {
  // Browser runtime dynamic check (e.g. for devtools console toggling without rebuilding)
  if (typeof window !== "undefined") {
    const win = window as unknown as { __LOG_LEVEL__?: unknown; __LOG__?: unknown };
    const winLevel = normalizeLevel(win.__LOG_LEVEL__);
    if (winLevel) return winLevel;

    if (win.__LOG__ === true || win.__LOG__ === "true" || win.__LOG__ === 1) return "debug";
    if (win.__LOG__ === false || win.__LOG__ === "false" || win.__LOG__ === 0) return "silent";

    try {
      const storageLevel = normalizeLevel(window.localStorage?.getItem("LOG_LEVEL"));
      if (storageLevel) return storageLevel;

      const storageLog = window.localStorage?.getItem("LOG")?.trim().toLowerCase();
      if (storageLog === "true" || storageLog === "1") return "debug";
      if (storageLog === "false" || storageLog === "0") return "silent";
    } catch {
      // Storage access blocked or restricted
    }
  }

  const getEnvVar = (key: string): string | undefined => {
    try {
      if (typeof process !== "undefined" && process?.env) {
        return (process.env as Record<string, string | undefined>)[key];
      }
    } catch {
      // ignore
    }
    return undefined;
  };

  // 1. Explicit LOG_LEVEL / NEXT_PUBLIC_LOG_LEVEL takes precedence
  const explicitLevel =
    normalizeLevel(getEnvVar("NEXT_PUBLIC_LOG_LEVEL")) ||
    normalizeLevel(getEnvVar("LOG_LEVEL"));
  if (explicitLevel) return explicitLevel;

  // 2. Boolean LOG / NEXT_PUBLIC_LOG fallback
  const rawFlag = getEnvVar("NEXT_PUBLIC_LOG") ?? getEnvVar("LOG");
  if (rawFlag !== undefined) {
    const logFlag = rawFlag.trim().toLowerCase();
    if (logFlag === "true" || logFlag === "1") return "debug";
    if (logFlag === "false" || logFlag === "0") return "silent";
  }

  // 3. Default when unset: only errors are surfaced
  return "error";
}

export function isLevelEnabled(level: LogLevel): boolean {
  const activeLevel = getActiveLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[activeLevel];
}

export interface LoggerFn {
  (...args: unknown[]): void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  isLevelEnabled: (level: LogLevel) => boolean;
}

export const log: LoggerFn = Object.assign(
  (...args: unknown[]): void => {
    if (isLevelEnabled("debug")) {
      console.log(...args);
    }
  },
  {
    debug: (...args: unknown[]): void => {
      if (isLevelEnabled("debug")) {
        console.debug(...args);
      }
    },
    info: (...args: unknown[]): void => {
      if (isLevelEnabled("info")) {
        console.info(...args);
      }
    },
    warn: (...args: unknown[]): void => {
      if (isLevelEnabled("warn")) {
        console.warn(...args);
      }
    },
    error: (...args: unknown[]): void => {
      if (isLevelEnabled("error")) {
        console.error(...args);
      }
    },
    isLevelEnabled,
  },
);

export const logger = {
  log,
  debug: log.debug,
  info: log.info,
  warn: log.warn,
  error: log.error,
  isLevelEnabled,
  getActiveLogLevel,
};

export default log;

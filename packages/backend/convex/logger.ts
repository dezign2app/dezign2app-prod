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

  // 1. Explicit LOG_LEVEL takes precedence
  const explicitLevel = normalizeLevel(getEnvVar("LOG_LEVEL"));
  if (explicitLevel) return explicitLevel;

  // 2. Boolean LOG fallback: true/1 -> debug, false/0 -> silent
  const rawFlag = getEnvVar("LOG");
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

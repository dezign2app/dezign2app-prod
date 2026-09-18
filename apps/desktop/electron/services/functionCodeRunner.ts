import vm from "node:vm";
import ts from "typescript";

export interface ExecuteFunctionCodeOptions {
  code: string;
  name?: string;
  params?: { name: string; type?: string; required?: boolean }[];
  args?: Record<string, unknown>;
  db?: any;
  tableName?: string;
  safeTable?: string;
  timeoutMs?: number;
}

export interface FunctionCodeResult {
  success: boolean;
  output?: unknown;
  error?: string;
  rawCommand: string;
  durationMs: number;
  logs?: string[];
}

/**
 * Executes custom JavaScript or TypeScript database operation function code
 * inside a secure, sandboxed Node.js VM context with database helpers.
 */
export async function executeFunctionCode(
  options: ExecuteFunctionCodeOptions,
): Promise<FunctionCodeResult> {
  const start = performance.now();
  const {
    code,
    name = "operation",
    params = [],
    args = {},
    db,
    tableName = "table",
    safeTable = tableName,
    timeoutMs = 5000,
  } = options;

  const rawCode = (code || "").trim();

  // Format executed raw command: e.g. `$ test({ key: "conversations:1001" })`
  const argEntries = Object.entries(args);
  const formattedArgs =
    argEntries.length > 0
      ? `{ ${argEntries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")} }`
      : "";
  const rawCommand = `$ ${name}(${formattedArgs})`;

  if (!rawCode) {
    return {
      success: false,
      error: "No function implementation code provided to execute.",
      rawCommand,
      durationMs: 0,
    };
  }

  // 1. Prepare code for transpilation
  let codeToTranspile = rawCode;
  const paramNames = params.map((p) => p.name);

  // Check if code has function declaration or arrow function
  const hasFunctionDef =
    /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\b/.test(codeToTranspile) ||
    new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\b`).test(codeToTranspile) ||
    new RegExp(`(?:const|let|var)\\s+${name}\\s*=`).test(codeToTranspile) ||
    /(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>/.test(codeToTranspile);

  // If the user only wrote function body statements with `return`, wrap into a function
  if (!hasFunctionDef && /^\s*return\b/m.test(codeToTranspile)) {
    codeToTranspile = `async function ${name}(${paramNames.join(", ")}) {\n${codeToTranspile}\n}`;
  }

  // 2. Transpile TypeScript to CommonJS JavaScript
  let jsCode: string;
  try {
    jsCode = ts.transpileModule(codeToTranspile, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        removeComments: false,
      },
    }).outputText;
  } catch (transpileErr) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    return {
      success: false,
      error: `Transpilation error: ${transpileErr instanceof Error ? transpileErr.message : String(transpileErr)}`,
      rawCommand,
      durationMs,
    };
  }

  // 3. Setup sandbox context
  const contextExports: Record<string, unknown> = {};
  const contextModule = { exports: contextExports };
  const logs: string[] = [];

  // Setup prepared statement helpers if SQLite db is available
  const preparedStmts: Record<string, unknown> = {};
  if (db && typeof db.prepare === "function") {
    try {
      preparedStmts.stmtFindAll = db.prepare(`SELECT * FROM ${safeTable} LIMIT ? OFFSET ?`);
    } catch {}
    try {
      preparedStmts.stmtFindById = db.prepare(`SELECT * FROM ${safeTable} WHERE id = ? LIMIT 1`);
    } catch {}
    try {
      preparedStmts.stmtDelete = db.prepare(`DELETE FROM ${safeTable} WHERE id = ?`);
    } catch {}
  }

  const sandboxContext: Record<string, unknown> = {
    exports: contextExports,
    module: contextModule,
    console: {
      log: (...m: unknown[]) => logs.push(m.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(" ")),
      warn: (...m: unknown[]) => logs.push(m.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(" ")),
      error: (...m: unknown[]) => logs.push(m.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(" ")),
      info: (...m: unknown[]) => logs.push(m.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(" ")),
    },
    db,
    tableName: safeTable,
    safeTable,
    args: { ...args },
    ...args,
    ...preparedStmts,
    Date,
    Math,
    JSON,
    RegExp,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Promise,
    Buffer,
    setTimeout,
    clearTimeout,
    __result: undefined,
  };

  // 4. Run inside VM
  try {
    const vmContext = vm.createContext(sandboxContext);
    const script = new vm.Script(jsCode);
    script.runInContext(vmContext, { timeout: timeoutMs });

    // Locate the executable function in context
    type TargetFunction = (...a: unknown[]) => unknown;

    let targetFn: TargetFunction | null = null;

    if (typeof (vmContext.exports as Record<string, unknown>)?.[name] === "function") {
      targetFn = (vmContext.exports as Record<string, unknown>)[name] as TargetFunction;
    } else if (typeof vmContext[name] === "function") {
      targetFn = vmContext[name] as TargetFunction;
    } else if (typeof (vmContext.exports as Record<string, unknown>)?.default === "function") {
      targetFn = (vmContext.exports as Record<string, unknown>).default as TargetFunction;
    } else if (typeof (vmContext.module as { exports?: unknown })?.exports === "function") {
      targetFn = (vmContext.module as { exports: TargetFunction }).exports;
    } else {
      // Find the first exported or top-level function
      const expKeys = Object.keys(vmContext.exports as Record<string, unknown> || {});
      for (const k of expKeys) {
        if (typeof (vmContext.exports as Record<string, unknown>)[k] === "function") {
          targetFn = (vmContext.exports as Record<string, unknown>)[k] as TargetFunction;
          break;
        }
      }
      if (!targetFn) {
        const topKeys = Object.keys(vmContext);
        for (const k of topKeys) {
          if (
            k !== "console" &&
            k !== "setTimeout" &&
            k !== "clearTimeout" &&
            typeof vmContext[k] === "function" &&
            k[0] !== k[0]?.toUpperCase() // exclude classes/constructors like Date, Math
          ) {
            targetFn = vmContext[k] as TargetFunction;
            break;
          }
        }
      }
    }

function extractParamNames(code: string, fnName: string): { names: string[]; isDestructured: boolean } {
  const match =
    code.match(new RegExp(`(?:function\\s+${fnName}|function|const\\s+${fnName}\\s*=\\s*(?:async\\s*)?)\\s*\\(([^)]*)\\)`)) ||
    code.match(/(?:function|\(([^)]*)\)\s*=>)/);
  if (!match || !match[1]) return { names: [], isDestructured: false };
  const raw = match[1].trim();
  if (!raw) return { names: [], isDestructured: false };
  if (raw.startsWith("{")) return { names: [], isDestructured: true };
  const names = raw
    .split(",")
    .map((p) => {
      const withoutColon = p.trim().split(":")[0] ?? "";
      return withoutColon.split("=")[0]?.trim() ?? "";
    })
    .filter(Boolean);
  return { names, isDestructured: false };
}

    let output: unknown;
    if (targetFn) {
      const { names: codeParamNames, isDestructured } = extractParamNames(rawCode, name);
      const effectiveParamNames =
        params.length > 0
          ? params.map((p) => p.name)
          : codeParamNames.length > 0
            ? codeParamNames
            : [];

      if (targetFn.length === 0) {
        output = await Promise.resolve(targetFn());
      } else if (isDestructured) {
        output = await Promise.resolve(targetFn(args));
      } else if (effectiveParamNames.length > 0) {
        const positionalArgs = effectiveParamNames.map((pName) => args[pName]);
        output = await Promise.resolve(targetFn(...positionalArgs));
      } else if (targetFn.length === 1 && Object.keys(args).length === 1) {
        const singleVal = Object.values(args)[0];
        try {
          output = await Promise.resolve(targetFn(singleVal));
        } catch {
          output = await Promise.resolve(targetFn(args));
        }
      } else {
        output = await Promise.resolve(targetFn(args));
      }
    } else if (vmContext.__result !== undefined) {
      output = await Promise.resolve(vmContext.__result);
    } else {
      output = undefined;
    }

    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    return {
      success: true,
      output,
      rawCommand,
      durationMs: Math.max(0.4, durationMs),
      logs: logs.length > 0 ? logs : undefined,
    };
  } catch (runErr) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    return {
      success: false,
      error: runErr instanceof Error ? runErr.message : String(runErr),
      rawCommand,
      durationMs,
      logs: logs.length > 0 ? logs : undefined,
    };
  }
}

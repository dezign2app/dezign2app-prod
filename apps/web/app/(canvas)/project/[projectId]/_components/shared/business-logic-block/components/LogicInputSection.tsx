import React, { useState, useMemo } from "react";
import { Info, Code2, FileCode, Copy, Check, RotateCcw } from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { LocalTextarea } from "../../../backend-nodes/graph-nodes/shared";
import { LogicMode, ConnectedDbItem } from "../types";
import { toPascalCase, toVarName } from "../utils";

interface LogicInputSectionProps {
  activeMode: LogicMode;
  prompt?: string;
  onPromptChange?: (val: string) => void;
  promptPlaceholder?: string;
  code?: string;
  onCodeChange?: (val: string) => void;
  codePlaceholder?: string;
  codeLanguageLabel?: string;
  functionName?: string;
  inputTypeName?: string;
  outputTypeName?: string;
  isAsync?: boolean;
  inputSchema?: Array<{ name: string; type: string; required?: boolean }>;
  returnSchema?: Array<{ name: string; type: string; required?: boolean }>;
  onResetContext?: () => void;
  contextType?: "endpoint" | "db_operation" | "transformer" | "langgraph";
  connectedDatabases?: ConnectedDbItem[];
}

function formatInterfaceFields(
  fields?: Array<{ name: string; type: string; required?: boolean }>,
): string {
  if (!fields || fields.length === 0) return "  [key: string]: unknown;";
  return fields
    .map(
      (f) =>
        `  ${f.name || "field"}${f.required === false ? "?" : ""}: ${f.type || "string"};`,
    )
    .join("\n");
}

export const LogicInputSection = React.memo(function LogicInputSection({
  activeMode,
  prompt = "",
  onPromptChange,
  promptPlaceholder = "Describe the business logic in natural language (e.g., 'Validate user input, query the users table for active status, calculate discount, and return JSON summary')...",
  code = "",
  onCodeChange,
  codePlaceholder = "// Write inner function body statements (editable)\n// e.g.:\nconst usersList = await findAllUsers();\nawait publishKafkaEvent(KAFKA_TOPICS.USER_EVENT, { action: 'post', payload: body });\nreturn res.status(200).json({ success: true, data: usersList });",
  codeLanguageLabel = "TypeScript Function",
  functionName,
  inputTypeName,
  outputTypeName,
  isAsync,
  inputSchema,
  returnSchema,
  onResetContext,
  contextType,
  connectedDatabases = [],
}: LogicInputSectionProps) {
  const [viewMode, setViewMode] = useState<"framed" | "preview">("framed");
  const [copied, setCopied] = useState(false);

  const safeFunctionName = useMemo(() => {
    if (!functionName) return "";
    return toVarName(functionName);
  }, [functionName]);

  const inputName = useMemo(() => {
    if (inputTypeName) return inputTypeName;
    if (safeFunctionName) return `${toPascalCase(safeFunctionName)}Input`;
    if (functionName) return `${toPascalCase(functionName)}Input`;
    return "TransformInput";
  }, [inputTypeName, safeFunctionName, functionName]);

  const outputName = useMemo(() => {
    if (outputTypeName) return outputTypeName;
    if (safeFunctionName) return `${toPascalCase(safeFunctionName)}Output`;
    if (functionName) return `${toPascalCase(functionName)}Output`;
    return "TransformOutput";
  }, [outputTypeName, safeFunctionName, functionName]);

  const isDbOp = contextType === "db_operation";

  const inputFieldNames = useMemo(() => {
    return (inputSchema || []).map((f) => f.name?.trim()).filter(Boolean);
  }, [inputSchema]);

  const effectiveOutputName = useMemo(() => {
    if (outputTypeName) return outputTypeName;
    if (isDbOp) return "void";
    if (safeFunctionName) return `${toPascalCase(safeFunctionName)}Output`;
    if (functionName) return `${toPascalCase(functionName)}Output`;
    return "TransformOutput";
  }, [outputTypeName, isDbOp, safeFunctionName, functionName]);

  const returnTypeAnnotation = useMemo(() => {
    if (effectiveOutputName.startsWith("Promise<")) return effectiveOutputName;
    if (isAsync) return `Promise<${effectiveOutputName}>`;
    return effectiveOutputName;
  }, [effectiveOutputName, isAsync]);

  const asyncKw = isAsync ? "async " : "";

  const trimmedCode = (code || "").trim();
  const hasFullDecl = /^(export\s+)?(async\s+)?function\s+/m.test(trimmedCode);

  const fullFileContent = useMemo(() => {
    if (!functionName) return code;
    const bodyFormatted = trimmedCode
      ? trimmedCode
          .split("\n")
          .map((l) => `  ${l}`)
          .join("\n")
      : "  // TODO: implement function logic";

    if (isDbOp) {
      const dbParamSig = (inputSchema || [])
        .map((p) => `${p.name}${p.required === false ? "?" : ""}: ${p.type || "string"}`)
        .join(", ");
      const fnContent = hasFullDecl
        ? trimmedCode
        : `export ${asyncKw}function ${safeFunctionName || functionName}(${dbParamSig}): ${returnTypeAnnotation} {\n${bodyFormatted}\n}`;

      const otherDbImports = (connectedDatabases || [])
        .map((cd) => `import { ${cd.varName} } from "${cd.importPath}";`)
        .join("\n");
      const importsStr = otherDbImports
        ? `import { db } from "@/lib/db";\n${otherDbImports}\n\n`
        : `import { db } from "@/lib/db";\n\n`;

      return `${importsStr}${fnContent}\n`;
    }

    const paramSignature =
      inputFieldNames.length > 0
        ? `{ ${inputFieldNames.join(", ")} }: ${inputName}`
        : `input: ${inputName}`;

    const fnContent = hasFullDecl
      ? trimmedCode
      : `export ${asyncKw}function ${safeFunctionName}(${paramSignature}): ${returnTypeAnnotation} {\n${bodyFormatted}\n}`;

    return `export interface ${inputName} {\n${formatInterfaceFields(inputSchema)}\n}\n\nexport interface ${effectiveOutputName} {\n${formatInterfaceFields(returnSchema)}\n}\n\n${fnContent}\n`;
  }, [
    functionName,
    safeFunctionName,
    inputFieldNames,
    inputName,
    effectiveOutputName,
    returnTypeAnnotation,
    asyncKw,
    trimmedCode,
    hasFullDecl,
    code,
    inputSchema,
    returnSchema,
    isDbOp,
    connectedDatabases,
  ]);

  const handleCopy = () => {
    if (!fullFileContent) return;
    navigator.clipboard.writeText(fullFileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (activeMode === "natural_language") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <span>Natural Language Prompt / Spec</span>
          </Label>
          <div className="flex items-center gap-1.5">
            {onResetContext && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onResetContext}
                className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1 border border-border/40 hover:bg-secondary cursor-pointer"
                title="Reset prompt to default schema context"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset Context</span>
              </Button>
            )}
            <span className="text-[9px] font-mono text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded border border-border/50">
              ✨ AI Transformation
            </span>
          </div>
        </div>

        <LocalTextarea
          value={prompt}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onPromptChange?.(e.target.value)}
          placeholder={promptPlaceholder}
          data-gramm="false"
          className="text-xs min-h-[120px] resize-y bg-background leading-relaxed placeholder:text-muted-foreground/50 border-border/50 focus-visible:ring-1 focus-visible:ring-ring"
        />

        <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground leading-tight bg-secondary/20 p-2 rounded border border-border/40">
          <Info className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
          <span>
            {contextType === "db_operation"
              ? "Specify query logic and directives using the schema context above. Use AI Generate Code to produce clean, type-safe database query functions."
              : "Write instructions in plain language. The AI compiler will automatically convert this into production code when generating the microservice."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold text-muted-foreground font-mono flex items-center gap-1.5">
          <span>{codeLanguageLabel}</span>
          {functionName && (
            <span className="text-amber-400/90 font-bold">({functionName})</span>
          )}
        </Label>

        {functionName ? (
          <div className="flex items-center gap-1">
            <div className="flex items-center bg-secondary/40 p-0.5 rounded-md border border-border/40 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setViewMode("framed")}
                className={`px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 ${
                  viewMode === "framed"
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code2 size={10} />
                <span>Function</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 ${
                  viewMode === "preview"
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileCode size={10} />
                <span>Full File</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="h-6 px-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground bg-secondary/30 hover:bg-secondary/60 rounded border border-border/40 transition-colors flex items-center gap-1"
              title="Copy complete TypeScript function file"
            >
              {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        ) : (
          <span className="text-[9px] font-mono text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded border border-border/50">
            {"</> Direct Logic"}
          </span>
        )}
      </div>

      {viewMode === "preview" && functionName ? (
        <div className="flex flex-col rounded-lg border border-border/60 bg-secondary/15 overflow-hidden shadow-inner">
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border/40 font-mono text-[10px] text-muted-foreground select-none">
            <span>
              {isDbOp
                ? `src/db/helpers/${functionName}.ts (Generated TypeScript File)`
                : `src/${functionName}.ts (Generated TypeScript File)`}
            </span>
          </div>
          <pre className="p-3 text-[11px] font-mono leading-relaxed text-foreground/90 overflow-x-auto whitespace-pre bg-background/50 selection:bg-purple-500/20">
            {fullFileContent}
          </pre>
        </div>
      ) : functionName && (!hasFullDecl || isDbOp) ? (
        <div className="flex flex-col rounded-lg border border-border/60 bg-secondary/15 overflow-hidden shadow-inner">
          {/* Top Outer Function Signature Bar */}
          <div className="px-3 py-2 bg-muted/40 border-b border-border/40 text-xs font-mono select-none overflow-x-auto">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-purple-400 font-semibold">export</span>
              {isAsync && <span className="text-sky-400 font-semibold">async</span>}
              <span className="text-blue-400 font-semibold">function</span>
              <span className="text-amber-300 font-bold">{safeFunctionName || functionName}</span>
              <span className="text-muted-foreground">( </span>
              {isDbOp ? (
                inputSchema && inputSchema.length > 0 ? (
                  inputSchema.map((param, idx) => (
                    <React.Fragment key={param.name || idx}>
                      {idx > 0 && <span className="text-muted-foreground">, </span>}
                      <span className="text-emerald-400 font-medium">{param.name}</span>
                      {param.required === false && <span className="text-amber-400">?</span>}
                      <span className="text-muted-foreground">: </span>
                      <span className="text-cyan-400 font-medium">{param.type || "string"}</span>
                    </React.Fragment>
                  ))
                ) : null
              ) : inputFieldNames.length > 0 ? (
                <>
                  <span className="text-muted-foreground">&#123; </span>
                  <span className="text-emerald-400 font-medium">
                    {inputFieldNames.join(", ")}
                  </span>
                  <span className="text-muted-foreground"> &#125;</span>
                  <span className="text-muted-foreground"> : </span>
                  <span className="text-cyan-400 font-medium">{inputName}</span>
                </>
              ) : (
                <>
                  <span className="text-emerald-400 font-medium">input</span>
                  <span className="text-muted-foreground"> : </span>
                  <span className="text-cyan-400 font-medium">{inputName}</span>
                </>
              )}
              <span className="text-muted-foreground"> ): </span>
              <span className="text-cyan-400 font-medium">{returnTypeAnnotation}</span>
              <span className="text-muted-foreground font-bold">&#123;</span>
            </div>
          </div>

          {/* Inner Editable Body Area */}
          <div className="p-2 pl-5 bg-background/50">
            <LocalTextarea
              value={code}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onCodeChange?.(e.target.value)}
              placeholder={codePlaceholder}
              debounceMs={400}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              data-gramm="false"
              className="w-full text-[11px] min-h-[140px] resize-y bg-transparent border-0 focus-visible:ring-0 shadow-none font-mono leading-relaxed placeholder:text-muted-foreground/40 pl-0 focus:outline-none"
            />
          </div>

          {/* Bottom Outer Function Closing Brace Bar */}
          <div className="px-3 py-1.5 bg-muted/40 border-t border-border/40 text-xs font-mono text-muted-foreground select-none">
            <span className="font-bold text-muted-foreground">&#125;</span>
          </div>
        </div>
      ) : (
        <LocalTextarea
          value={code}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onCodeChange?.(e.target.value)}
          placeholder={codePlaceholder}
          debounceMs={400}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          data-gramm="false"
          className="text-[11px] min-h-[140px] resize-y bg-background font-mono leading-relaxed placeholder:text-muted-foreground/40 border-border/50 focus-visible:ring-1 focus-visible:ring-ring"
        />
      )}

      {functionName ? (
        <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground leading-tight bg-secondary/20 p-2 rounded border border-border/40 font-mono">
          <Info className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
          <span>
            {isDbOp ? (
              <>
                Database clients available: <code className="text-emerald-400 font-semibold">db</code> (primary)
                {connectedDatabases && connectedDatabases.length > 0 && (
                  <>
                    {connectedDatabases.map((cd) => (
                      <React.Fragment key={cd.id}>
                        {", "}
                        <code className={cd.isRedis ? "text-amber-400 font-semibold" : "text-blue-400 font-semibold"}>
                          {cd.varName}
                        </code>
                        <span className="text-[9px] text-muted-foreground"> ({cd.label})</span>
                      </React.Fragment>
                    ))}
                  </>
                )}
                {". "}
                Helper statements: <code className="text-emerald-400 font-semibold">stmtFindAll</code>,{" "}
                <code className="text-emerald-400 font-semibold">stmtFindById</code>,{" "}
                <code className="text-emerald-400 font-semibold">stmtDelete</code>. Return type:{" "}
                <code className="text-cyan-400 font-semibold">{returnTypeAnnotation}</code>.
              </>
            ) : (
              <>
                Parameters accessible via{" "}
                <code className="text-emerald-400 font-semibold">
                  {inputFieldNames.length > 0
                    ? `{ ${inputFieldNames.join(", ")} }`
                    : "input"}
                </code>{" "}
                (<code className="text-cyan-400">{inputName}</code>). Return shape must match{" "}
                <code className="text-cyan-400">{effectiveOutputName}</code>.
              </>
            )}
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground leading-tight bg-secondary/20 p-2 rounded border border-border/40 font-mono">
          <Info className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
          <span>Write inner function body statements.</span>
        </div>
      )}
    </div>
  );
});
LogicInputSection.displayName = "LogicInputSection";


"use client";

import React, { useRef, useState } from "react";
import Editor, { type OnMount, type BeforeMount } from "@monaco-editor/react";

type Monaco = Parameters<OnMount>[1];
type EditorInstance = Parameters<OnMount>[0];
import {
  FileCode,
  Check,
  Copy,
  Download,
  Save,
  RotateCcw,
  Sparkles,
  X,
  Code2,
  CheckCircle2,
  AlertCircle,
  FileJson,
  FileText,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { toast } from "sonner";

export interface PageCodeEditorProps {
  activeFilePath: string;
  fileContent: string;
  onChange: (value: string) => void;
  onSave?: () => Promise<void> | void;
  isDirty: boolean;
  isSaving: boolean;
  openTabs: string[];
  onSelectTab: (filePath: string) => void;
  onCloseTab: (filePath: string) => void;
  isCurrentPageNode?: boolean;
  hasCustomAiCode?: boolean;
  onResetToCompiler?: () => void;
}

function getLanguageFromPath(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".jsx")) return "typescript";
  if (path.endsWith(".ts") || path.endsWith(".js")) return "typescript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".css") || path.endsWith(".scss")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "yaml";
  return "plaintext";
}

function getTabIcon(path: string) {
  if (path.endsWith(".tsx") || path.endsWith(".jsx")) {
    return <Code2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
  }
  if (path.endsWith(".ts") || path.endsWith(".js")) {
    return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
  }
  if (path.endsWith(".json")) {
    return <FileJson className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  }
  if (path.endsWith(".css")) {
    return <FileText className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
  }
  return <FileCode className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
}

export function PageCodeEditor({
  activeFilePath,
  fileContent,
  onChange,
  onSave,
  isDirty,
  isSaving,
  openTabs,
  onSelectTab,
  onCloseTab,
  isCurrentPageNode,
  hasCustomAiCode,
  onResetToCompiler,
}: PageCodeEditorProps) {
  const editorRef = useRef<EditorInstance | null>(null);
  const [copied, setCopied] = useState(false);

  const handleEditorBeforeMount: BeforeMount = (monaco) => {
    if (!monaco?.languages?.typescript) return;

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.Latest,
      allowNonTextFiles: true,
      allowJs: true,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    });

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [
        2307, // Cannot find module '...' or its corresponding type declarations.
        2792, // Cannot find module '...'. Did you mean to set the 'moduleResolution' option to 'nodenext'?
        2686, // 'React' refers to a UMD global, but the current file is a module.
        7016, // Could not find a declaration file for module '...'
        2304, // Cannot find name '...'
        17004, // Cannot use JSX unless the '--jsx' flag is provided
      ],
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.Latest,
      allowNonTextFiles: true,
      allowJs: true,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    });
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Register Ctrl+S / Cmd+S save command inside Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (onSave) {
        onSave();
      }
    });
  };

  const handleCopy = () => {
    if (!fileContent) return;
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!fileContent) return;
    const filename = activeFilePath.split("/").pop() || "code.tsx";
    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: filename,
    });
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const fileName = activeFilePath.split("/").pop() || activeFilePath;
  const language = getLanguageFromPath(activeFilePath);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-[#0d1117] overflow-hidden select-none font-sans">
      {/* File Tabs Bar */}
      <div className="flex items-center bg-[#161b22] border-b border-border/40 overflow-x-auto no-scrollbar shrink-0 px-1 pt-1">
        {openTabs.map((tabPath) => {
          const isActive = tabPath === activeFilePath;
          const tabName = tabPath.split("/").pop() || tabPath;

          return (
            <div
              key={tabPath}
              onClick={() => onSelectTab(tabPath)}
              className={`group flex items-center gap-2 px-3 py-1.5 text-xs font-mono rounded-t border-t border-x cursor-pointer transition-colors shrink-0 max-w-[200px] ${
                isActive
                  ? "bg-[#0d1117] border-border/60 text-foreground font-medium border-b-transparent shadow-sm"
                  : "bg-transparent border-transparent text-muted-foreground hover:bg-[#1f242c] hover:text-foreground"
              }`}
            >
              {getTabIcon(tabPath)}
              <span className="truncate flex-1">{tabName}</span>

              {isActive && isDirty && (
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
              )}

              {openTabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tabPath);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-opacity"
                  title="Close tab"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Editor Sub-Header Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#12161f] border-b border-border/30 text-xs font-mono select-none shrink-0">
        {/* Left: File path breadcrumb + Status indicators */}
        <div className="flex items-center gap-2 min-w-0 truncate">
          <span className="text-muted-foreground truncate hidden sm:inline">{activeFilePath}</span>
          <span className="text-foreground font-semibold sm:hidden truncate">{fileName}</span>

          {isCurrentPageNode && (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/30 shrink-0 font-sans"
            >
              <Sparkles className="w-2.5 h-2.5 mr-1" /> Page Node
            </Badge>
          )}

          {hasCustomAiCode && (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 h-4 bg-purple-500/10 text-purple-400 border-purple-500/30 shrink-0 font-sans"
            >
              AI-Edited
            </Badge>
          )}

          {/* Sync status */}
          <div className="flex items-center gap-1 shrink-0">
            {isDirty ? (
              <span className="text-[10px] text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span className="hidden md:inline">Unsaved (Ctrl+S)</span>
              </span>
            ) : (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span className="hidden md:inline">Synced</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Manual Save Button */}
          {onSave && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isDirty ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onSave()}
                  disabled={isSaving || !isDirty}
                  className={`h-6 px-2 text-[11px] gap-1 rounded font-sans transition-all ${
                    isDirty
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Save className="w-3 h-3" />
                  <span>{isSaving ? "Saving..." : "Save"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save to local disk and cloud (Ctrl+S)</TooltipContent>
            </Tooltip>
          )}

          {/* Reset custom code to compiler */}
          {hasCustomAiCode && onResetToCompiler && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResetToCompiler}
                  className="h-6 px-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 rounded font-sans"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden lg:inline">Reset</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset to compiler-generated baseline</TooltipContent>
            </Tooltip>
          )}

          {/* Copy code */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1 rounded font-sans"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span className="hidden md:inline">{copied ? "Copied" : "Copy"}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy code to clipboard</TooltipContent>
          </Tooltip>

          {/* Download */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1 rounded font-sans"
              >
                <Download className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download file</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Monaco Code Editor */}
      <div className="flex-1 min-h-0 relative">
        <Editor
          height="100%"
          path={activeFilePath}
          language={language}
          value={fileContent}
          theme="vs-dark"
          onChange={(val) => onChange(val || "")}
          beforeMount={handleEditorBeforeMount}
          onMount={handleEditorMount}
          options={{
            fontSize: 13,
            fontFamily: "JetBrains Mono, Menlo, Monaco, Consolas, monospace",
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            lineNumbers: "on",
            glyphMargin: false,
            folding: true,
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            padding: { top: 10, bottom: 10 },
            smoothScrolling: true,
            cursorBlinking: "smooth",
            formatOnPaste: true,
            formatOnType: true,
            wordWrap: "off",
          }}
        />
      </div>
    </div>
  );
}

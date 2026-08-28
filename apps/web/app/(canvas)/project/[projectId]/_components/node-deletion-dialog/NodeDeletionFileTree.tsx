"use client";

import React, { useState } from "react";
import {
  Search,
  Copy,
  Check,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  FolderTree,
  List,
} from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { AffectedFileTreeNode, AffectedItem } from "./types";
import { getFileIcon } from "./utils";

interface NodeDeletionFileTreeProps {
  totalAffectedCount: number;
  deletedCount: number;
  modifiedCount: number;
  filterType: "all" | "deleted" | "modified";
  onFilterChange: (type: "all" | "deleted" | "modified") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  fileTree: AffectedFileTreeNode[];
  filteredFiles: AffectedItem[];
  selectedFilePath: string | null;
  onSelectFile: (path: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onCopyPath: (path: string, e: React.MouseEvent) => void;
  copiedPath: string | null;
  sidebarWidth: number;
  showCodePreview: boolean;
  hasFiles: boolean;
}

export function NodeDeletionFileTree({
  totalAffectedCount,
  deletedCount,
  modifiedCount,
  filterType,
  onFilterChange,
  searchQuery,
  onSearchChange,
  fileTree,
  filteredFiles,
  selectedFilePath,
  onSelectFile,
  expandedFolders,
  onToggleFolder,
  onCopyPath,
  copiedPath,
  sidebarWidth,
  showCodePreview,
  hasFiles,
}: NodeDeletionFileTreeProps): React.JSX.Element {
  const [viewMode, setViewMode] = useState<"tree" | "flat">("tree");

  const renderTreeNode = (node: AffectedFileTreeNode, level: number = 0): React.ReactNode => {
    if (node.isFolder) {
      const isExpanded = expandedFolders.has(node.path);
      return (
        <div key={node.path} className="select-none">
          <div
            onClick={() => onToggleFolder(node.path)}
            style={{ paddingLeft: `${level * 14 + 6}px` }}
            className="flex items-center justify-between py-1 pr-2 rounded-md hover:bg-zinc-800/50 cursor-pointer text-[11px] font-mono text-zinc-300 transition-colors group"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-zinc-500 hover:text-zinc-300">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              )}
              <span className="font-medium text-zinc-200 truncate">{node.name}</span>
            </div>

            <div className="flex items-center gap-1 text-zinc-500 text-[9px] font-mono">
              {node.deletedCount ? <span>{node.deletedCount} del</span> : null}
              {node.modifiedCount ? <span>{node.modifiedCount} mod</span> : null}
            </div>
          </div>

          {isExpanded && node.children && (
            <div className="space-y-0.5">
              {node.children.map((child) => renderTreeNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    const isSelected = selectedFilePath === node.path;
    return (
      <div
        key={node.path}
        onClick={() => onSelectFile(node.path)}
        style={{ paddingLeft: `${level * 14 + 6}px` }}
        className={cn(
          "group flex items-center justify-between py-1 pr-2 rounded-md cursor-pointer text-[11px] font-mono transition-colors border",
          isSelected
            ? "bg-zinc-800 text-zinc-100 border-zinc-700 font-medium"
            : "border-transparent hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200",
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
          {getFileIcon(node.name)}

          <span className={cn("truncate", isSelected ? "text-zinc-100 font-medium" : "text-zinc-300")}>
            {node.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[8px] px-1 py-0.2 rounded font-mono font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/60 shrink-0 tracking-wider uppercase">
            {node.type === "deleted" ? "DEL" : "MOD"}
          </span>

          <button
            type="button"
            onClick={(e) => onCopyPath(node.path, e)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-700/60"
            title="Copy relative file path"
          >
            {copiedPath === node.path ? (
              <Check className="w-3 h-3 text-zinc-300" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col border-b sm:border-b-0 overflow-hidden shrink-0",
        showCodePreview && hasFiles ? "w-full sm:w-auto" : "w-full",
      )}
      style={
        showCodePreview && hasFiles
          ? { width: `${sidebarWidth}px`, minWidth: "180px", maxWidth: "550px" }
          : undefined
      }
    >
      {/* Filter Tabs & Search Bar */}
      <div className="p-2 border-b border-zinc-800 bg-zinc-900/30 space-y-2">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onFilterChange("all")}
              className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded transition-colors",
                filterType === "all"
                  ? "bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700/60"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40",
              )}
            >
              All ({totalAffectedCount})
            </button>
            <button
              type="button"
              onClick={() => onFilterChange("deleted")}
              className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded transition-colors",
                filterType === "deleted"
                  ? "bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700/60"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40",
              )}
            >
              Del ({deletedCount})
            </button>
            <button
              type="button"
              onClick={() => onFilterChange("modified")}
              className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded transition-colors",
                filterType === "modified"
                  ? "bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700/60"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40",
              )}
            >
              Mod ({modifiedCount})
            </button>
          </div>

          {/* Toggle Tree / Flat View */}
          <div className="flex items-center bg-zinc-900 p-0.5 rounded border border-zinc-800">
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={cn(
                "p-1 rounded transition-colors",
                viewMode === "tree"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
              title="Folder Tree View"
            >
              <FolderTree className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("flat")}
              className={cn(
                "p-1 rounded transition-colors",
                viewMode === "flat"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
              title="Flat List View"
            >
              <List className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter files..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-6 pl-7 pr-2 text-[11px] font-mono bg-zinc-900/60 border border-zinc-800 rounded text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition-all"
          />
        </div>
      </div>

      {/* Scrollable File List / Tree */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
        {totalAffectedCount === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-500">
            No generated monorepo files will be affected.
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-500">
            No files matching search filter.
          </div>
        ) : viewMode === "tree" ? (
          <div className="space-y-0.5">
            {fileTree.map((node) => renderTreeNode(node, 0))}
          </div>
        ) : (
          filteredFiles.map((file) => {
            const lastSlash = file.path.lastIndexOf("/");
            const dir = lastSlash !== -1 ? file.path.slice(0, lastSlash + 1) : "";
            const name = lastSlash !== -1 ? file.path.slice(lastSlash + 1) : file.path;
            const isSelected = selectedFilePath === file.path;

            return (
              <div
                key={file.path}
                onClick={() => onSelectFile(file.path)}
                className={cn(
                  "group flex items-center justify-between py-1 px-2 rounded cursor-pointer text-[11px] font-mono transition-colors border",
                  isSelected
                    ? "bg-zinc-800 text-zinc-100 border-zinc-700 font-medium"
                    : "border-transparent hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200",
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1.5">
                  <span className="text-[8px] px-1 py-0.2 rounded font-mono bg-zinc-800 text-zinc-400 border border-zinc-700/60 shrink-0 tracking-wider uppercase">
                    {file.type === "deleted" ? "DEL" : "MOD"}
                  </span>

                  <span className="truncate">
                    <span className="text-zinc-500 text-[10px]">{dir}</span>
                    <span className={cn("font-medium", isSelected ? "text-zinc-100" : "text-zinc-300")}>
                      {name}
                    </span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => onCopyPath(file.path, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-700/60 shrink-0"
                  title="Copy file path"
                >
                  {copiedPath === file.path ? (
                    <Check className="w-3 h-3 text-zinc-300" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

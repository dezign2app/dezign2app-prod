"use client";

import React, { useState, useMemo } from "react";
import { Resizable } from "re-resizable";
import {
  Folder,
  FolderOpen,
  FileCode,
  Search,
  FolderSync,
  ChevronRight,
  ChevronDown,
  Sparkles,
  FileText,
  Code2,
  FileJson,
  Layers,
  X,
  RefreshCw,
  FolderPlus,
  HardDrive,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { FileTreeNode } from "../../../_components/compiler";

export interface PageFileExplorerProps {
  isOpen: boolean;
  onToggle: () => void;
  outputDir: string;
  onPickDirectory?: () => void;
  fileTree: FileTreeNode[];
  activePath: string;
  pageDefaultPath?: string;
  pageName: string;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelectFile: (path: string) => void;
  totalFiles: number;
  onRefreshFiles?: () => void;
  isLoading?: boolean;
}

function getFileIcon(filename: string) {
  if (filename.startsWith(".env")) {
    return <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  }
  if (filename.startsWith(".git") || filename === ".gitignore") {
    return <FileCode className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
  }
  if (filename === "package.json") {
    return <FileJson className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  }
  if (filename.endsWith(".tsx") || filename.endsWith(".jsx")) {
    return <Code2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
  }
  if (filename.endsWith(".ts") || filename.endsWith(".js") || filename.endsWith(".mjs")) {
    return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
  }
  if (filename.endsWith(".json")) {
    return <FileJson className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  }
  if (filename.endsWith(".yaml") || filename.endsWith(".yml")) {
    return <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  }
  if (filename.endsWith(".css") || filename.endsWith(".scss")) {
    return <FileText className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
  }
  if (filename.endsWith(".md")) {
    return <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
  }
  return <FileCode className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
}

interface TreeItemProps {
  node: FileTreeNode;
  depth?: number;
  activePath: string;
  pageDefaultPath?: string;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelectFile: (path: string) => void;
  searchFilter: string;
}

function TreeItem({
  node,
  depth = 0,
  activePath,
  pageDefaultPath,
  expandedPaths,
  onToggleExpand,
  onSelectFile,
  searchFilter,
}: TreeItemProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isActive = activePath === node.path;
  const isCurrentPage =
    pageDefaultPath &&
    (node.path === pageDefaultPath ||
      node.path.endsWith(pageDefaultPath) ||
      (pageDefaultPath.endsWith("/page.tsx") && node.path.endsWith("/page.tsx")));

  const matchesSearch = useMemo(() => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const checkNode = (n: FileTreeNode): boolean => {
      if (n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q)) return true;
      if (n.children) return n.children.some(checkNode);
      return false;
    };
    return checkNode(node);
  }, [node, searchFilter]);

  if (!matchesSearch) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isFolder) {
      onToggleExpand(node.path);
    } else {
      onSelectFile(node.path);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={`group flex items-center justify-between gap-1.5 py-1 px-2 text-xs font-mono rounded-md cursor-pointer transition-colors ${
          isActive
            ? "bg-primary/15 text-primary font-semibold border-l-2 border-primary"
            : isCurrentPage
            ? "hover:bg-sidebar-accent/70 text-sidebar-foreground font-medium"
            : "hover:bg-sidebar-accent/50 text-muted-foreground hover:text-sidebar-foreground"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
          {node.isFolder ? (
            <>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-amber-400/90 shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
              )}
            </>
          ) : (
            <>
              <span className="w-3.5 shrink-0" />
              {getFileIcon(node.name)}
            </>
          )}
          <span className="truncate">{node.name}</span>
        </div>

        {isCurrentPage && !node.isFolder && (
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 h-4 bg-primary/10 text-primary border-primary/30 shrink-0 font-sans font-medium"
          >
            Page
          </Badge>
        )}
      </div>

      {node.isFolder && (isExpanded || Boolean(searchFilter.trim())) && node.children && (
        <div className="space-y-0.5 mt-0.5">
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              pageDefaultPath={pageDefaultPath}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              onSelectFile={onSelectFile}
              searchFilter={searchFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PageFileExplorer({
  isOpen,
  onToggle,
  outputDir,
  onPickDirectory,
  fileTree,
  activePath,
  pageDefaultPath,
  pageName,
  expandedPaths,
  onToggleExpand,
  onSelectFile,
  totalFiles,
  onRefreshFiles,
  isLoading,
}: PageFileExplorerProps) {
  const [searchFilter, setSearchFilter] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(250);

  const folderName = useMemo(() => {
    if (!outputDir) return "";
    const clean = outputDir.replace(/[\\/]+$/, "");
    return clean.split(/[\\/]/).pop() || clean;
  }, [outputDir]);

  if (!isOpen) return null;

  return (
    <Resizable
      size={{ width: sidebarWidth, height: "100%" }}
      minWidth={190}
      maxWidth={460}
      enable={{ right: true }}
      onResizeStop={(e, direction, ref, d) => {
        setSidebarWidth((prev) => Math.max(190, Math.min(460, prev + d.width)));
      }}
      handleClasses={{
        right:
          "w-1.5 bg-sidebar-border hover:bg-primary/50 cursor-col-resize transition-colors z-20",
      }}
      className="bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 select-none relative z-20 h-full font-sans"
    >
      {/* Top Header */}
      <div className="h-10 px-3 border-b border-sidebar-border flex items-center justify-between shrink-0 bg-sidebar-accent/30">
        <div className="flex items-center gap-1.5 min-w-0">
          <HardDrive className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground truncate">
            Local Files
          </span>
          <Badge
            variant="secondary"
            className="text-[9px] px-1.5 py-0 h-4 bg-sidebar-accent text-muted-foreground border border-sidebar-border font-mono shrink-0"
          >
            {totalFiles}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {onRefreshFiles && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded"
                  onClick={onRefreshFiles}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin text-primary" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reload local files from disk</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded"
                onClick={onToggle}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Collapse File Explorer</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Local Folder Status / Picker Bar */}
      <div className="p-2.5 border-b border-sidebar-border bg-sidebar-accent/15 space-y-2">
        <div className="flex items-center justify-between gap-1 text-xs">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <FolderSync className={`w-3.5 h-3.5 shrink-0 ${outputDir ? "text-emerald-400" : "text-amber-400"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-sidebar-foreground truncate">
                {outputDir ? folderName : "No Folder Selected"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate font-mono">
                {outputDir || "Pick your local workspace folder"}
              </p>
            </div>
          </div>

          {onPickDirectory && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPickDirectory}
                  className="h-6 px-2 text-[10px] border-sidebar-border bg-sidebar hover:bg-sidebar-accent text-sidebar-foreground shrink-0 gap-1 font-medium"
                >
                  <Folder className="w-3 h-3 text-amber-400" />
                  <span>{outputDir ? "Change" : "Select"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Choose local repository folder on disk</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Search Bar */}
        {totalFiles > 0 && (
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search local files..."
              className="w-full text-xs bg-sidebar-accent/60 border border-sidebar-border rounded-md pl-7 pr-6 py-1 text-sidebar-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-sidebar-ring font-mono"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-sidebar-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pinned Quick Action: Current Page File */}
      {pageDefaultPath && (
        <div className="p-2 border-b border-sidebar-border/60 bg-primary/5">
          <div
            onClick={() => onSelectFile(pageDefaultPath)}
            className={`flex items-center justify-between gap-1.5 p-1.5 rounded-md cursor-pointer transition-colors ${
              activePath === pageDefaultPath
                ? "bg-primary/20 text-primary font-semibold border border-primary/30"
                : "hover:bg-sidebar-accent text-sidebar-foreground"
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-medium block truncate font-mono">
                  {pageDefaultPath.split("/").pop()}
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                  {pageName} (Target Page)
                </span>
              </div>
            </div>
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-primary/10 text-primary border-primary/20 font-sans">
              Active
            </Badge>
          </div>
        </div>
      )}

      {/* Directory File Tree Scroll Area */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0">
        {!outputDir ? (
          <div className="p-4 text-center space-y-2.5 my-auto">
            <div className="w-10 h-10 rounded-full bg-sidebar-accent border border-sidebar-border mx-auto flex items-center justify-center text-muted-foreground">
              <FolderPlus className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-sidebar-foreground">No Local Folder</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Select your project directory on disk to view, browse, and edit local files.
              </p>
            </div>
            {onPickDirectory && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-sidebar-border bg-sidebar hover:bg-sidebar-accent text-sidebar-foreground"
                onClick={onPickDirectory}
              >
                <Folder className="w-3.5 h-3.5 mr-1 text-amber-400" /> Select Folder
              </Button>
            )}
          </div>
        ) : fileTree.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-xs">
            {isLoading ? "Reading local directory files..." : "No files found in folder"}
          </div>
        ) : (
          fileTree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              activePath={activePath}
              pageDefaultPath={pageDefaultPath}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              onSelectFile={onSelectFile}
              searchFilter={searchFilter}
            />
          ))
        )}
      </div>
    </Resizable>
  );
}

import React from "react";
import { FileCode, FileText } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { AffectedFileTreeNode, AffectedItem } from "./types";

/**
 * Extracts a human-readable label from a BackendNode in a strictly type-safe way.
 */
export function getNodeLabel(node: BackendNode): string {
  if (!node.data) return "Untitled";
  return (
    node.data.label ||
    node.data.appSlug ||
    node.data.appName ||
    node.data.pageSlug ||
    node.data.tableName ||
    node.data.hookName ||
    node.data.functionName ||
    "Untitled"
  );
}

/**
 * Transforms a flat list of affected files into a nested hierarchical tree structure.
 */
export function buildAffectedFileTree(items: AffectedItem[]): AffectedFileTreeNode[] {
  const root: AffectedFileTreeNode[] = [];

  items.forEach((item) => {
    const parts = item.path.split("/");
    let current = root;

    parts.forEach((part, idx) => {
      const isLast = idx === parts.length - 1;
      const currentPath = parts.slice(0, idx + 1).join("/");
      let node = current.find((n) => n.name === part);

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          isFolder: !isLast,
          type: isLast ? item.type : undefined,
          deletedCount: 0,
          modifiedCount: 0,
          children: isLast ? undefined : [],
        };
        current.push(node);
      }

      if (item.type === "deleted") {
        node.deletedCount = (node.deletedCount || 0) + 1;
      } else if (item.type === "modified") {
        node.modifiedCount = (node.modifiedCount || 0) + 1;
      }

      if (!isLast && node.children) {
        current = node.children;
      }
    });
  });

  const sortNodes = (nodes: AffectedFileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => {
      if (n.children) sortNodes(n.children);
    });
  };

  sortNodes(root);
  return root;
}

/**
 * Returns all folder paths in the tree so they can be expanded by default.
 */
export function getAllFolderPaths(nodes: AffectedFileTreeNode[]): string[] {
  const paths: string[] = [];
  const traverse = (list: AffectedFileTreeNode[]) => {
    list.forEach((n) => {
      if (n.isFolder) {
        paths.push(n.path);
        if (n.children) traverse(n.children);
      }
    });
  };
  traverse(nodes);
  return paths;
}

/**
 * Returns appropriate icon based on file extension.
 */
export function getFileIcon(filename: string): React.JSX.Element {
  if (
    filename.endsWith(".tsx") ||
    filename.endsWith(".ts") ||
    filename.endsWith(".jsx") ||
    filename.endsWith(".js")
  ) {
    return React.createElement(FileCode, { className: "w-3.5 h-3.5 text-blue-400 shrink-0" });
  }
  if (filename.endsWith(".json") || filename.endsWith(".lock")) {
    return React.createElement(FileCode, { className: "w-3.5 h-3.5 text-amber-400 shrink-0" });
  }
  if (filename.endsWith(".md") || filename.endsWith(".txt")) {
    return React.createElement(FileText, { className: "w-3.5 h-3.5 text-emerald-400 shrink-0" });
  }
  return React.createElement(FileCode, { className: "w-3.5 h-3.5 text-slate-400 shrink-0" });
}

"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import {
  History,
  GitCommit,
  RotateCcw,
  Eye,
  Loader2,
  Clock,
  Plus,
  Minus,
  FileCode,
} from "lucide-react";
import { toast } from "sonner";
import { VersionListItem } from "@/types/versions";

interface VersionHistoryDrawerProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onPreviewVersion?: (versionId: Id<"project_versions">) => void;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function VersionHistoryDrawer({
  projectId,
  isOpen,
  onClose,
  onPreviewVersion,
}: VersionHistoryDrawerProps): React.JSX.Element {
  const versions = useQuery(
    api.canvas.getProjectVersions,
    isOpen ? { projectId: projectId as Id<"projects"> } : "skip",
  );

  const restoreVersion = useMutation(api.canvas.restoreProjectVersion);

  const [versionToRestore, setVersionToRestore] = useState<VersionListItem | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleConfirmRestore = async (): Promise<void> => {
    if (!versionToRestore) return;

    try {
      setIsRestoring(true);
      const result = await restoreVersion({
        projectId: projectId as Id<"projects">,
        versionId: versionToRestore._id,
      });

      if (result) {
        toast.success(
          `Successfully restored project to version v${result.restoredVersionNumber}`,
        );
        setVersionToRestore(null);
        onClose();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to restore version";
      toast.error(errorMessage);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[440px] p-0 flex flex-col">
          <div className="p-5 border-b bg-background">
            <SheetHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <SheetTitle className="text-base font-semibold">
                  Version History & Commits
                </SheetTitle>
              </div>
              <SheetDescription className="text-xs text-muted-foreground">
                Audit history of all project commits, checkpoints, and rollback snapshots.
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-hidden">
            {versions === undefined ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-muted-foreground gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-xs">Loading commit history...</p>
              </div>
            ) : versions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-3">
                <div className="p-3 rounded-full bg-muted">
                  <GitCommit className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">No commits yet</p>
                  <p className="text-xs">
                    Create your first version checkpoint from the toolbar to track changes.
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-full px-5 py-4">
                <div className="space-y-3">
                  {versions.map((ver, idx) => (
                    <div
                      key={ver._id}
                      className="p-3.5 rounded-lg border bg-card/60 hover:bg-card/90 transition-colors space-y-2.5 relative group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant={idx === 0 ? "default" : "secondary"}
                              className="text-[10px] h-5 px-1.5 font-mono"
                            >
                              v{ver.versionNumber}
                            </Badge>
                            {idx === 0 && (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-5 px-1.5 text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
                              >
                                Latest
                              </Badge>
                            )}
                            {ver.isAutoSave && (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-5 px-1.5 text-muted-foreground"
                              >
                                Auto-save
                              </Badge>
                            )}
                          </div>
                          <h4 className="text-xs font-semibold text-foreground pt-1 truncate">
                            {ver.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {onPreviewVersion && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Preview this version"
                              onClick={() => {
                                onPreviewVersion(ver._id);
                                onClose();
                              }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            title="Restore this version"
                            onClick={() => setVersionToRestore(ver)}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {ver.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {ver.description}
                        </p>
                      )}

                      {/* Change diff summary badges */}
                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground pt-0.5">
                        {ver.changeSummary.nodesAdded > 0 && (
                          <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-mono">
                            <Plus className="w-3 h-3 mr-0.5" />
                            {ver.changeSummary.nodesAdded} nodes
                          </span>
                        )}
                        {ver.changeSummary.nodesDeleted > 0 && (
                          <span className="flex items-center text-rose-600 dark:text-rose-400 font-mono">
                            <Minus className="w-3 h-3 mr-0.5" />
                            {ver.changeSummary.nodesDeleted} nodes
                          </span>
                        )}
                        {ver.changeSummary.nodesModified > 0 && (
                          <span className="flex items-center text-amber-600 dark:text-amber-400 font-mono">
                            ~{ver.changeSummary.nodesModified} mod
                          </span>
                        )}
                        {ver.changeSummary.edgesAdded > 0 && (
                          <span className="flex items-center text-blue-600 dark:text-blue-400 font-mono">
                            +{ver.changeSummary.edgesAdded} edges
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="w-4 h-4 text-[9px]">
                            {ver.authorAvatar && (
                              <AvatarImage src={ver.authorAvatar} alt={ver.authorName} />
                            )}
                            <AvatarFallback>{getInitials(ver.authorName)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[130px]">{ver.authorName}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelativeTime(ver.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Restore Confirmation Dialog */}
      <AlertDialog
        open={Boolean(versionToRestore)}
        onOpenChange={(open) => !open && setVersionToRestore(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Project to Checkpoint?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed space-y-2">
              <span>
                You are about to restore the canvas to{" "}
                <strong>v{versionToRestore?.versionNumber}</strong> (
                <em>{versionToRestore?.title}</em>).
              </span>
              <span className="block text-muted-foreground">
                This will overwrite the current live canvas with this snapshot. A new
                rollback commit will be created automatically, so no history is lost.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmRestore();
              }}
              disabled={isRestoring}
              className="bg-primary hover:bg-primary/90"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Confirm Restore
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

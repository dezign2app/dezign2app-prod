"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";
import { Label } from "@workspace/ui/components/label";
import { GitCommit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";

interface CreateCommitDialogProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CreateCommitDialog({
  projectId,
  isOpen,
  onClose,
}: CreateCommitDialogProps): React.JSX.Element {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createVersion = useMutation(api.canvas.createProjectVersion);

  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please provide a commit message");
      return;
    }

    try {
      setIsSubmitting(true);
      const versionId = await createVersion({
        projectId: projectId as Id<"projects">,
        title: title.trim(),
        description: description.trim() || undefined,
        isAutoSave: false,
      });

      if (versionId) {
        toast.success("Checkpoint committed successfully!");
        setTitle("");
        setDescription("");
        onClose();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create commit";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <GitCommit className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Create Version Checkpoint
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Snapshot the current canvas state into the project history.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="commit-title" className="text-xs font-medium">
              Commit Message <span className="text-destructive">*</span>
            </Label>
            <Input
              id="commit-title"
              placeholder="e.g. Added Stripe webhook & order table"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm"
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commit-desc" className="text-xs font-medium">
              Description (Optional)
            </Label>
            <Textarea
              id="commit-desc"
              placeholder="Details about architectural changes, new endpoints, or configuration updates..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-sm min-h-[80px] resize-none"
              disabled={isSubmitting}
            />
          </div>

          <div className="rounded-md bg-muted/50 p-2.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Current snapshot size:</span>
            <div className="flex gap-3 font-medium text-foreground">
              <span>{nodes.length} nodes</span>
              <span>{edges.length} connections</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <GitCommit className="w-3.5 h-3.5 mr-1.5" />
                  Commit Checkpoint
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

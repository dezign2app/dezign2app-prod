import React, { useState } from "react";
import { Lock, Edit2, Check, Trash } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { WebAppZone } from "@workspace/canvas";
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

interface ProtectedZoneHeaderProps {
  currentZone: WebAppZone;
  onUpdateZoneName: (name: string) => void;
  onDeleteZone?: () => void;
}

export const ProtectedZoneHeader = ({
  currentZone,
  onUpdateZoneName,
  onDeleteZone,
}: ProtectedZoneHeaderProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2 border-b border-border/50 pb-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-primary/15 text-primary rounded border border-primary/20 shadow-sm flex items-center gap-1">
            <Lock className="w-3 h-3" /> PROTECTED ZONE
          </span>
          {isEditingName ? (
            <div className="flex items-center gap-1.5">
              <Input
                className="text-base font-semibold h-8 w-[220px] bg-background/50"
                value={currentZone.name}
                onChange={(e) => onUpdateZoneName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") setIsEditingName(false);
                }}
              />
              <button
                onClick={() => setIsEditingName(false)}
                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <span className="text-lg font-semibold tracking-tight text-foreground">
                {currentZone.name}
              </span>
              <button
                onClick={() => setIsEditingName(true)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-opacity"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {onDeleteZone && (
          <>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 transition-colors shrink-0 cursor-pointer"
              title="Delete this section"
            >
              <Trash className="w-3.5 h-3.5" />
              <span>Delete Section</span>
            </button>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogContent
                onClick={(e) => e.stopPropagation()}
                className="bg-[#111216] border-zinc-800 text-zinc-100 max-w-md shadow-2xl ring-1 ring-white/10"
              >
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-zinc-100 font-semibold">
                    Delete Section "{currentZone.name}"?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400 text-xs leading-relaxed">
                    Are you sure you want to delete this access control section? All access rules, redirect configurations, and canvas connection handles will be removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    onClick={() => setDeleteDialogOpen(false)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 hover:text-zinc-100"
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setDeleteDialogOpen(false);
                      onDeleteZone();
                    }}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
                  >
                    Delete Section
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
      <span className="text-sm text-muted-foreground">
        Configure rule conditions, redirects by failure reason, and custom access logic for this zone cluster.
      </span>
    </div>
  );
};

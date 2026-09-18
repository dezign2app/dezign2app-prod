import React from "react";
import { Check, Trash } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { FunctionEditorFooterProps } from "./types";

export const FunctionEditorFooter: React.FC<FunctionEditorFooterProps> = React.memo(({
  onDelete,
  onDone,
}) => {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-border/40">
      <Button
        variant="destructive"
        size="sm"
        className="h-8 gap-1 text-xs cursor-pointer"
        onClick={onDelete}
      >
        <Trash size={13} /> Delete Function
      </Button>

      <Button
        variant="default"
        size="sm"
        className="h-8 gap-1 text-xs cursor-pointer"
        onClick={onDone}
      >
        <Check size={13} /> Done
      </Button>
    </div>
  );
});

FunctionEditorFooter.displayName = "FunctionEditorFooter";

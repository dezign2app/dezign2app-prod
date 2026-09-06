"use client";

import React from "react";
import { Layers } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export interface SectionNotFoundStateProps {
  onClose: () => void;
}

export const SectionNotFoundState: React.FC<SectionNotFoundStateProps> = ({ onClose }) => {
  return (
    <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
        <Layers size={18} />
      </div>
      <p>Section not found. It may have been deleted or renamed.</p>
      <Button
        size="sm"
        variant="outline"
        className="text-xs cursor-pointer"
        onClick={onClose}
      >
        Close Drawer
      </Button>
    </div>
  );
};

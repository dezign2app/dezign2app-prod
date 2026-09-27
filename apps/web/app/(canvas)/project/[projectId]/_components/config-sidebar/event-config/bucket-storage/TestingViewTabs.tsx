import React from "react";
import { Wifi, Play, FileCode } from "lucide-react";
import type { TestingViewMode } from "@workspace/canvas/types";

interface TestingViewTabsProps {
  viewMode: TestingViewMode;
  onSelect: (mode: TestingViewMode) => void;
}

const TAB_CONFIG: { mode: TestingViewMode; icon: React.ElementType; label: string }[] = [
  { mode: "operations", icon: Play, label: "Test Operations" },
  { mode: "connection", icon: Wifi, label: "Test Connection" },
  { mode: "suite", icon: FileCode, label: "Vitest Suite" },
];

export const TestingViewTabs: React.FC<TestingViewTabsProps> = ({ viewMode, onSelect }) => (
  <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-card/60 border border-border/80">
    <div className="grid grid-cols-3 w-full gap-1">
      {TAB_CONFIG.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onSelect(mode)}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md font-medium text-xs transition-all cursor-pointer ${
            viewMode === mode
              ? "bg-amber-500 text-black shadow-sm font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <Icon size={12} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  </div>
);

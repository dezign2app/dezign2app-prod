"use client";

import React from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";

interface HeroCanvasControlsProps {
  zoom: number;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleFitView: () => void;
}

export const HeroCanvasControls: React.FC<HeroCanvasControlsProps> = ({
  zoom,
  handleZoomIn,
  handleZoomOut,
  handleFitView,
}) => {
  return (
    <div className="absolute bottom-3.5 left-4 z-40 flex items-center bg-[#121217]/95 backdrop-blur-md border border-zinc-800 rounded-lg shadow-xl p-1 gap-1 text-zinc-300 select-none">
      <button
        onClick={handleZoomOut}
        className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
        title="Zoom Out (Ctrl + Scroll Down)"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={handleFitView}
        className="px-2 py-0.5 rounded hover:bg-zinc-800 hover:text-white text-[11px] font-mono min-w-[44px] text-center font-medium"
        title="Reset to Fit View"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        onClick={handleZoomIn}
        className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
        title="Zoom In (Ctrl + Scroll Up)"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      <div className="w-[1px] h-4 bg-zinc-800 mx-0.5" />
      <button
        onClick={handleFitView}
        className="px-2 py-1 rounded hover:bg-zinc-800 hover:text-emerald-400 transition-colors text-[10px] font-mono flex items-center gap-1.5"
        title="Fit Entire Topology into Window"
      >
        <Maximize2 className="w-3 h-3" />
        <span>Fit Canvas</span>
      </button>
    </div>
  );
};

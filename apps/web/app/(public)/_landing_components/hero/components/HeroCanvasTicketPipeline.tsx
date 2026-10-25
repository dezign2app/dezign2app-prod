"use client";

import React from "react";
import { Check, Code2, Terminal } from "lucide-react";
import { TICKETS, type TicketDef, type AgentStep } from "../aiWorkerData";

interface HeroCanvasTicketPipelineProps {
  activeTicket: TicketDef;
  selectedTicketIndex: number;
  setSelectedTicketIndex: (idx: number) => void;
  workerStep: number;
  setWorkerStep: (step: number) => void;
  currentStep: AgentStep;
  activeConsoleTab: "terminal" | "diff" | "bench";
  setActiveConsoleTab: (tab: "terminal" | "diff" | "bench") => void;
  isConsoleOpen: boolean;
  setIsConsoleOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const HeroCanvasTicketPipeline: React.FC<HeroCanvasTicketPipelineProps> = ({
  activeTicket,
  selectedTicketIndex,
  setSelectedTicketIndex,
  workerStep,
  setWorkerStep,
  currentStep,
  activeConsoleTab,
  setActiveConsoleTab,
  isConsoleOpen,
  setIsConsoleOpen,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between border-b border-zinc-800/80 bg-[#0d0e12] px-4 py-2 gap-2 text-xs font-mono">
      {/* Left: Active Ticket Pill & Switcher */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#12131a] border border-zinc-800 text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-zinc-400 font-bold">{activeTicket.displayNumber}</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-200 font-medium truncate max-w-[200px] sm:max-w-[280px]">
            {activeTicket.title}
          </span>
        </div>

        {/* Ticket Selector Switcher */}
        <div className="flex items-center gap-0.5 bg-[#09090d] p-0.5 rounded border border-zinc-800">
          {TICKETS.map((tk, tIdx) => (
            <button
              key={tk.id}
              onClick={() => {
                setSelectedTicketIndex(tIdx);
                setWorkerStep(0);
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                selectedTicketIndex === tIdx
                  ? "bg-zinc-800 text-white font-bold"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title={tk.title}
            >
              {tk.displayNumber}
            </button>
          ))}
        </div>
      </div>

      {/* Center: Interactive 6-Step Pipeline Strip */}
      <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar py-0.5">
        {activeTicket.steps.map((st, idx) => {
          const isPast = idx < workerStep;
          const isCurrent = idx === workerStep;

          return (
            <button
              key={st.id}
              onClick={() => setWorkerStep(idx)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono transition-all shrink-0 ${
                isCurrent
                  ? "bg-cyan-950/70 text-cyan-200 border border-cyan-500/60 font-semibold shadow-xs"
                  : isPast
                  ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {isPast ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : isCurrent ? (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
              )}
              <span>{st.title}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Drawer toggles for Code Diff & Terminal */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => {
            setActiveConsoleTab("diff");
            setIsConsoleOpen((p) => (activeConsoleTab === "diff" ? !p : true));
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono border transition-colors ${
            isConsoleOpen && activeConsoleTab === "diff"
              ? "bg-zinc-800 text-white border-zinc-600 font-semibold"
              : "bg-zinc-900 text-zinc-400 hover:text-white border-zinc-800"
          }`}
          title="Inspect generated code diff"
        >
          <Code2 className="w-3 h-3 text-emerald-400" />
          <span>Diff (+{currentStep.diffPreview?.additions || 0})</span>
        </button>

        <button
          onClick={() => {
            setActiveConsoleTab("terminal");
            setIsConsoleOpen((p) => (activeConsoleTab === "terminal" ? !p : true));
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono border transition-colors ${
            isConsoleOpen && activeConsoleTab === "terminal"
              ? "bg-zinc-800 text-white border-zinc-600 font-semibold"
              : "bg-zinc-900 text-zinc-400 hover:text-white border-zinc-800"
          }`}
          title="Inspect live agent logs"
        >
          <Terminal className="w-3 h-3 text-cyan-400" />
          <span>Logs</span>
        </button>
      </div>
    </div>
  );
};

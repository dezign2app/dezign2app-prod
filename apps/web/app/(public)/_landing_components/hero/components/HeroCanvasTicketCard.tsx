"use client";

import React from "react";
import { motion } from "framer-motion";
import { Bot, ChevronDown, ChevronUp, CheckCircle2, Clock } from "lucide-react";
import { TICKETS, type TicketDef } from "../aiWorkerData";

interface HeroCanvasTicketCardProps {
  activeTicket: TicketDef;
  workerStep: number;
  setWorkerStep: (step: number) => void;
  selectedTicketIndex: number;
  setSelectedTicketIndex: (idx: number) => void;
  isTicketCardMinimized: boolean;
  setIsTicketCardMinimized: (minimized: boolean) => void;
}

export const HeroCanvasTicketCard: React.FC<HeroCanvasTicketCardProps> = ({
  activeTicket,
  workerStep,
  setWorkerStep,
  selectedTicketIndex,
  setSelectedTicketIndex,
  isTicketCardMinimized,
  setIsTicketCardMinimized,
}) => {
  return (
    <div className="absolute top-3.5 left-4 z-40 select-none">
      {isTicketCardMinimized ? (
        <button
          onClick={() => setIsTicketCardMinimized(false)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d0e14]/98 border border-zinc-800 shadow-xl backdrop-blur-md text-xs font-mono text-zinc-200 hover:border-zinc-700 transition-all hover:scale-102"
        >
          <Bot className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="font-bold text-white">Ticket {activeTicket.displayNumber}</span>
          <span className="text-zinc-500">·</span>
          <span className={workerStep === 5 ? "text-emerald-400 font-bold" : "text-cyan-300"}>
            {workerStep === 5 ? "Solved (100%)" : `Step ${workerStep + 1}/6`}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 ml-1" />
        </button>
      ) : (
        <div className="w-[320px] sm:w-[350px] rounded-xl border border-zinc-800/90 bg-[#0d0e14]/98 backdrop-blur-xl shadow-2xl shadow-black/80 p-3 flex flex-col gap-2.5 text-left ring-1 ring-cyan-500/20">
          {/* Card Header & Ticket Switcher */}
          <div className="flex items-start justify-between gap-2 border-b border-zinc-800/80 pb-2">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-300">
                  {activeTicket.displayNumber}
                </span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 uppercase">
                  {activeTicket.priority}
                </span>
                <span className="text-[9px] font-mono text-zinc-500 truncate">
                  {activeTicket.tag}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white font-sans leading-snug truncate">
                {activeTicket.title}
              </h4>
            </div>

            <button
              onClick={() => setIsTicketCardMinimized(true)}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors shrink-0"
              title="Minimize Ticket Card"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Ticket Description Summary */}
          <p className="text-[10px] text-zinc-400 font-sans leading-relaxed line-clamp-2">
            {activeTicket.summary}
          </p>

          {/* Progress Bar */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-zinc-400">Resolution Progress</span>
              <span className={workerStep === 5 ? "text-emerald-400 font-bold" : "text-cyan-300 font-bold"}>
                {Math.round(((workerStep + 1) / 6) * 100)}% {workerStep === 5 ? "(PR Merged)" : ""}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
              <motion.div
                className={`h-full rounded-full ${
                  workerStep === 5
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                    : "bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-500"
                }`}
                animate={{ width: `${((workerStep + 1) / 6) * 100}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
              />
            </div>
          </div>

          {/* Multi-Step Checklist */}
          <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
            {activeTicket.steps.map((st, idx) => {
              const isPast = idx < workerStep;
              const isCurrent = idx === workerStep;

              return (
                <button
                  key={st.id}
                  onClick={() => setWorkerStep(idx)}
                  className={`flex items-center justify-between px-2 py-1 rounded text-left transition-all ${
                    isCurrent
                      ? "bg-cyan-950/40 border border-cyan-500/50 text-white shadow-xs"
                      : isPast
                      ? "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
                      : "text-zinc-600 hover:bg-zinc-900/40 hover:text-zinc-400"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {isPast ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : isCurrent ? (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-cyan-400 flex items-center justify-center shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      </span>
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                    )}
                    <span className="text-[10px] font-mono truncate">
                      {idx + 1}. {st.title}
                    </span>
                  </div>
                  <span
                    className={`text-[8px] font-mono px-1 py-0.2 rounded shrink-0 ${
                      isCurrent
                        ? "bg-cyan-500/20 text-cyan-300 font-bold"
                        : "text-zinc-600"
                    }`}
                  >
                    {st.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Ticket Switcher Pills Footer */}
          <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2 text-[9px] font-mono">
            <span className="text-zinc-500">Switch Ticket:</span>
            <div className="flex items-center gap-1">
              {TICKETS.map((tk, tIdx) => (
                <button
                  key={tk.id}
                  onClick={() => {
                    setSelectedTicketIndex(tIdx);
                    setWorkerStep(0);
                  }}
                  className={`px-1.5 py-0.5 rounded transition-all ${
                    selectedTicketIndex === tIdx
                      ? "bg-zinc-800 text-cyan-300 border border-zinc-700 font-bold"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  {tk.displayNumber}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

"use client";

import React from "react";
import { Terminal, Code2, Zap, Play, Pause, ChevronDown, ChevronUp } from "lucide-react";
import type { AgentStep } from "../aiWorkerData";

interface HeroCanvasConsoleProps {
  currentStep: AgentStep;
  workerStep: number;
  setWorkerStep: React.Dispatch<React.SetStateAction<number>>;
  isConsoleMinimized: boolean;
  setIsConsoleMinimized: (minimized: boolean) => void;
  activeConsoleTab: "terminal" | "diff" | "bench";
  setActiveConsoleTab: (tab: "terminal" | "diff" | "bench") => void;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  playbackSpeed: 1 | 2;
  setPlaybackSpeed: React.Dispatch<React.SetStateAction<1 | 2>>;
}

export const HeroCanvasConsole: React.FC<HeroCanvasConsoleProps> = ({
  currentStep,
  workerStep,
  setWorkerStep,
  isConsoleMinimized,
  setIsConsoleMinimized,
  activeConsoleTab,
  setActiveConsoleTab,
  isPlaying,
  setIsPlaying,
  playbackSpeed,
  setPlaybackSpeed,
}) => {
  return (
    <div className="absolute bottom-3.5 right-4 z-40 select-none">
      {isConsoleMinimized ? (
        <button
          onClick={() => setIsConsoleMinimized(false)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d0e14]/98 border border-zinc-800 shadow-xl backdrop-blur-md text-xs font-mono text-zinc-200 hover:border-zinc-700 transition-all hover:scale-102"
        >
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-white font-bold">Agent Terminal</span>
          <span className="text-zinc-600">·</span>
          <span className="text-emerald-400 font-semibold">{currentStep.terminalLogs.length} logs</span>
          <ChevronUp className="w-3.5 h-3.5 text-zinc-400 ml-1" />
        </button>
      ) : (
        <div className="w-[330px] sm:w-[420px] rounded-xl border border-zinc-800/90 bg-[#0d0e14]/98 backdrop-blur-xl shadow-2xl shadow-black/80 p-3 flex flex-col gap-2 text-left ring-1 ring-cyan-500/20">
          {/* Header & Tabs */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveConsoleTab("terminal")}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  activeConsoleTab === "terminal"
                    ? "bg-zinc-800 text-cyan-300 border border-zinc-700 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Terminal className="w-3 h-3 text-cyan-400" />
                <span>Logs</span>
              </button>

              <button
                onClick={() => setActiveConsoleTab("diff")}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  activeConsoleTab === "diff"
                    ? "bg-zinc-800 text-cyan-300 border border-zinc-700 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Code2 className="w-3 h-3 text-emerald-400" />
                <span>Code Diff</span>
              </button>

              {currentStep.benchMetrics && (
                <button
                  onClick={() => setActiveConsoleTab("bench")}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    activeConsoleTab === "bench"
                      ? "bg-zinc-800 text-cyan-300 border border-zinc-700 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Metrics</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Play / Pause */}
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
              </button>

              {/* Speed toggle */}
              <button
                onClick={() => setPlaybackSpeed((s) => (s === 1 ? 2 : 1))}
                className="px-1.5 py-0.5 rounded text-[9px] font-mono text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
                title="Toggle Speed"
              >
                {playbackSpeed}x
              </button>

              {/* Minimize */}
              <button
                onClick={() => setIsConsoleMinimized(true)}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Minimize Console"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tab 1: Terminal Logs */}
          {activeConsoleTab === "terminal" && (
            <div className="bg-[#08090d] rounded-lg p-2.5 font-mono text-[10px] text-zinc-300 h-[115px] overflow-y-auto flex flex-col gap-1 border border-zinc-800/80 scrollbar-thin scrollbar-thumb-zinc-800">
              {currentStep.terminalLogs.map((log, lIdx) => (
                <div key={lIdx} className="leading-relaxed">
                  <span className="text-zinc-500 select-none">
                    {log.slice(0, 10)}
                  </span>
                  <span className={log.includes("PASS") || log.includes("✓") || log.includes("CLOSED") ? "text-emerald-400" : log.includes("Synthesizing") || log.includes("Patched") ? "text-cyan-300 font-semibold" : "text-zinc-300"}>
                    {log.slice(10)}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-1 text-cyan-400 mt-1">
                <span>❯ agent-executing-step-{workerStep + 1}</span>
                <span className="w-1.5 h-3 bg-cyan-400 animate-pulse" />
              </div>
            </div>
          )}

          {/* Tab 2: Code Diff */}
          {activeConsoleTab === "diff" && (
            <div className="bg-[#08090d] rounded-lg p-2 font-mono text-[9.5px] h-[115px] overflow-y-auto flex flex-col gap-0.5 border border-zinc-800/80 scrollbar-thin scrollbar-thumb-zinc-800">
              <div className="flex items-center justify-between text-[8px] text-zinc-500 border-b border-zinc-900 pb-1 mb-1">
                <span className="truncate text-zinc-400 font-semibold">{currentStep.diffPreview?.filename || "route.ts"}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-emerald-400 font-bold">+{currentStep.diffPreview?.additions || 0}</span>
                  <span className="text-rose-400 font-bold">-{currentStep.diffPreview?.deletions || 0}</span>
                </div>
              </div>
              {currentStep.diffPreview?.lines.map((ln, lIdx) => (
                <div
                  key={lIdx}
                  className={`px-1 py-0.2 rounded-xs whitespace-pre font-mono ${
                    ln.type === "add"
                      ? "bg-emerald-950/40 text-emerald-300"
                      : ln.type === "remove"
                      ? "bg-rose-950/40 text-rose-300"
                      : "text-zinc-500"
                  }`}
                >
                  {ln.text}
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Bench & QA Metrics */}
          {activeConsoleTab === "bench" && currentStep.benchMetrics && (
            <div className="grid grid-cols-2 gap-1.5 bg-[#08090d] rounded-lg p-2.5 border border-zinc-800/80 h-[115px]">
              <div className="flex flex-col justify-center bg-zinc-950/80 p-2 rounded border border-zinc-900">
                <span className="text-[8px] font-mono uppercase text-zinc-500">Synthetic Traffic</span>
                <span className="text-xs font-bold font-mono text-emerald-400 mt-0.5">{currentStep.benchMetrics.throughput}</span>
                <span className="text-[8px] font-mono text-zinc-500">Error rate: {currentStep.benchMetrics.errorRate}</span>
              </div>
              <div className="flex flex-col justify-center bg-zinc-950/80 p-2 rounded border border-zinc-900">
                <span className="text-[8px] font-mono uppercase text-zinc-500">p99 Latency</span>
                <span className="text-xs font-bold font-mono text-cyan-300 mt-0.5">{currentStep.benchMetrics.p99Latency}</span>
                <span className="text-[8px] font-mono text-emerald-400 font-semibold">{currentStep.benchMetrics.testSuitePassed}</span>
              </div>
            </div>
          )}

          {/* Step Scrubber Footer */}
          <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 pt-0.5">
            <span className="truncate">Step: <strong className="text-cyan-300">{currentStep.title}</strong></span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWorkerStep((s) => Math.max(0, s - 1))}
                disabled={workerStep === 0}
                className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300"
              >
                Prev
              </button>
              <button
                onClick={() => setWorkerStep((s) => (s + 1) % 6)}
                className="px-2 py-0.5 rounded bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

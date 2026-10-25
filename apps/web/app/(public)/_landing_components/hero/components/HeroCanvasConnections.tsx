"use client";

import React from "react";
import { motion } from "framer-motion";
import type { Connection, CanvasMode, TrafficIntensity } from "../types";
import type { TicketDef, AgentStep, AiConnectionDef } from "../aiWorkerData";

interface HeroCanvasConnectionsProps {
  activeConnections: (Connection | AiConnectionDef)[];
  selectedNode: string | null;
  hoveredNode: string | null;
  activeMode: CanvasMode;
  trafficIntensity: TrafficIntensity;
  reduceMotion: boolean | null;
  currentStep: AgentStep | null;
  workerStep: number;
  activeTicket: TicketDef;
  canvasWidth: number;
  canvasHeight: number;
}

export const HeroCanvasConnections: React.FC<HeroCanvasConnectionsProps> = ({
  activeConnections,
  selectedNode,
  hoveredNode,
  activeMode,
  trafficIntensity,
  reduceMotion,
  currentStep,
  workerStep,
  activeTicket,
  canvasWidth,
  canvasHeight,
}) => {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
    >
      {activeConnections.map((conn) => {
        const activeFocusNode = selectedNode || hoveredNode;
        const isHighlighted =
          activeFocusNode &&
          (conn.id.includes(activeFocusNode) ||
            ((activeFocusNode === "chat-page" || activeFocusNode === "page-ref") &&
              conn.isReturn));

        const particleDuration =
          activeMode === "infrastructure" && trafficIntensity === "burst"
            ? conn.isReturn
              ? 1.8
              : 1.9
            : conn.isReturn
            ? 3.4
            : 3.8;

        return (
          <g key={conn.id}>
            {/* Connection Line */}
            <path
              d={conn.d}
              fill="none"
              stroke={
                isHighlighted
                  ? "#e4e4e7"
                  : conn.isReturn
                  ? "#10b981"
                  : conn.color || "#27272a"
              }
              strokeWidth={conn.isReturn || isHighlighted ? "2.2" : "1.6"}
              strokeDasharray={conn.isReturn ? "5 3" : "4 4"}
              strokeOpacity={
                isHighlighted ? "1" : conn.isReturn ? "0.85" : "0.55"
              }
            />

            {/* Micro Edge Label */}
            <text
              x={conn.labelPos.x}
              y={conn.labelPos.y}
              fill={conn.isReturn ? "#34d399" : "#71717a"}
              fontSize="9"
              fontFamily="monospace"
              textAnchor="middle"
              className="select-none font-medium"
            >
              {conn.label}
            </text>

            {/* Pulsing Animated Particle */}
            {!reduceMotion && (
              <motion.circle
                key={`${conn.id}-${activeMode}`}
                r={conn.isReturn ? "3.5" : "3"}
                fill={conn.isReturn ? "#34d399" : conn.color || "#a1a1aa"}
                animate={{ offsetDistance: ["0%", "100%"] }}
                transition={{
                  duration: particleDuration,
                  repeat: Infinity,
                  ease: "linear",
                  delay: conn.delay,
                }}
                style={{ offsetPath: `path('${conn.d}')` }}
              />
            )}
          </g>
        );
      })}

      {/* Laser Beam from AI Worker to Targeted Active Node */}
      {activeMode === "ai-worker" && currentStep && !reduceMotion && (
        <g key={`worker-laser-${workerStep}-${activeTicket.id}`}>
          <defs>
            <linearGradient id="workerLaserGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <motion.path
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0.65, 1, 0.65] }}
            transition={{
              pathLength: { duration: 0.3 },
              opacity: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
            }}
            d={`M ${currentStep.agentTarget.x + 24} ${currentStep.agentTarget.y + 44} C ${currentStep.agentTarget.x + 24} ${(currentStep.agentTarget.y + currentStep.targetNodeCenter.y) / 2}, ${currentStep.targetNodeCenter.x} ${(currentStep.agentTarget.y + currentStep.targetNodeCenter.y) / 2}, ${currentStep.targetNodeCenter.x} ${currentStep.targetNodeCenter.y}`}
            fill="none"
            stroke="url(#workerLaserGrad)"
            strokeWidth="2.2"
            strokeDasharray="5 4"
          />
          <circle
            cx={currentStep.targetNodeCenter.x}
            cy={currentStep.targetNodeCenter.y}
            r="6"
            fill="#38bdf8"
            className="animate-ping"
            opacity="0.8"
          />
          <circle
            cx={currentStep.targetNodeCenter.x}
            cy={currentStep.targetNodeCenter.y}
            r="3.5"
            fill="#f0f9ff"
          />
        </g>
      )}
    </svg>
  );
};

"use client";

import React from "react";
import { motion } from "framer-motion";
import type { Connection, CanvasMode, TrafficIntensity } from "../types";
import type { TicketDef, AgentStep, AiConnectionDef } from "../aiWorkerData";
import type { SecurityVectorDef, SecurityStep } from "../ethicalHackerData";

interface HeroCanvasConnectionsProps {
  activeConnections: (Connection | AiConnectionDef)[];
  selectedNode: string | null;
  hoveredNode: string | null;
  activeInfraId?: string | null;
  activeMode: CanvasMode;
  trafficIntensity: TrafficIntensity;
  reduceMotion: boolean | null;
  currentStep: AgentStep | null;
  workerStep: number;
  activeTicket: TicketDef;
  securityStep?: number;
  activeSecurityStep?: SecurityStep | null;
  activeVector?: SecurityVectorDef | null;
  canvasWidth: number;
  canvasHeight: number;
}

export const HeroCanvasConnections: React.FC<HeroCanvasConnectionsProps> = ({
  activeConnections,
  selectedNode,
  hoveredNode,
  activeInfraId,
  activeMode,
  trafficIntensity,
  reduceMotion,
  currentStep,
  workerStep,
  activeTicket,
  securityStep = 0,
  activeSecurityStep,
  activeVector,
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
          (activeFocusNode &&
            (conn.id.includes(activeFocusNode) ||
              ((activeFocusNode === "chat-page" || activeFocusNode === "page-ref") &&
                conn.isReturn))) ||
          (activeInfraId && conn.id.includes(activeInfraId));

        const isSecurityMode = activeMode === "ethical-hacker";
        const isTargetedConn =
          isSecurityMode &&
          activeSecurityStep &&
          conn.id.includes(activeSecurityStep.activeNodeId);

        const particleDuration =
          activeMode === "infrastructure" && trafficIntensity === "burst"
            ? conn.isReturn
              ? 1.8
              : 1.9
            : isSecurityMode
            ? 2.2
            : conn.isReturn
            ? 3.4
            : 3.8;

        const particleFill = isSecurityMode
          ? isTargetedConn
            ? securityStep === 4
              ? "#34d399"
              : "#f43f5e"
            : "#a1a1aa"
          : conn.isReturn
          ? "#34d399"
          : conn.color || "#a1a1aa";

        const strokeColor =
          isSecurityMode && isTargetedConn
            ? securityStep === 4
              ? "#10b981"
              : "#f43f5e"
            : isHighlighted
            ? "#e4e4e7"
            : conn.isReturn
            ? "#10b981"
            : conn.color || "#27272a";

        return (
          <g key={conn.id}>
            {/* Connection Line */}
            <path
              d={conn.d}
              fill="none"
              stroke={strokeColor}
              strokeWidth={conn.isReturn || isHighlighted || (isSecurityMode && isTargetedConn) ? "2.2" : "1.6"}
              strokeDasharray={conn.isReturn ? "5 3" : "4 4"}
              strokeOpacity={
                isHighlighted || (isSecurityMode && isTargetedConn)
                  ? "1"
                  : conn.isReturn
                  ? "0.85"
                  : "0.55"
              }
            />

            {/* Micro Edge Label */}
            <text
              x={conn.labelPos.x}
              y={conn.labelPos.y}
              fill={
                isSecurityMode && isTargetedConn
                  ? securityStep === 4
                    ? "#34d399"
                    : "#fb7185"
                  : conn.isReturn
                  ? "#34d399"
                  : "#71717a"
              }
              fontSize="9"
              fontFamily="monospace"
              textAnchor="middle"
              className="select-none font-medium"
            >
              {isSecurityMode && isTargetedConn
                ? securityStep === 4
                  ? "403 blocked"
                  : "exploit probe"
                : conn.label}
            </text>

            {/* Pulsing Animated Particle */}
            {!reduceMotion && (
              <motion.circle
                key={`${conn.id}-${activeMode}-${securityStep}`}
                r={conn.isReturn || (isSecurityMode && isTargetedConn) ? "3.5" : "3"}
                fill={particleFill}
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

      {/* Laser Beam from Ethical Hacker Red Team Drone to Targeted Node */}
      {activeMode === "ethical-hacker" && activeSecurityStep && !reduceMotion && (
        <g key={`security-laser-${securityStep}-${activeVector?.id}`}>
          <defs>
            <linearGradient id="securityLaserGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={securityStep === 4 ? "#10b981" : "#f43f5e"} stopOpacity="0.95" />
              <stop offset="100%" stopColor={securityStep === 4 ? "#059669" : "#be123c"} stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <motion.path
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0.65, 1, 0.65] }}
            transition={{
              pathLength: { duration: 0.3 },
              opacity: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
            }}
            d={`M ${activeSecurityStep.agentTarget.x + 22} ${activeSecurityStep.agentTarget.y + 44} C ${activeSecurityStep.agentTarget.x + 22} ${(activeSecurityStep.agentTarget.y + activeSecurityStep.targetNodeCenter.y) / 2}, ${activeSecurityStep.targetNodeCenter.x} ${(activeSecurityStep.agentTarget.y + activeSecurityStep.targetNodeCenter.y) / 2}, ${activeSecurityStep.targetNodeCenter.x} ${activeSecurityStep.targetNodeCenter.y}`}
            fill="none"
            stroke="url(#securityLaserGrad)"
            strokeWidth="2.2"
            strokeDasharray="4 3"
          />
          <circle
            cx={activeSecurityStep.targetNodeCenter.x}
            cy={activeSecurityStep.targetNodeCenter.y}
            r="7"
            fill={securityStep === 4 ? "#10b981" : "#f43f5e"}
            className="animate-ping"
            opacity="0.8"
          />
          <circle
            cx={activeSecurityStep.targetNodeCenter.x}
            cy={activeSecurityStep.targetNodeCenter.y}
            r="3.5"
            fill="#ffffff"
          />
        </g>
      )}
    </svg>
  );
};

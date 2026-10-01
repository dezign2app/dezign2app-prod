import React from "react";
import { Handle, Position, Connection } from "@xyflow/react";
import {
  HANDLE_LLM_IN,
  HANDLE_LLM_OUT,
  HANDLE_TOOL_IN,
  HANDLE_TOOL_OUT,
  HANDLE_MIDDLEWARE_IN,
  HANDLE_MIDDLEWARE_OUT,
  HANDLE_MEMORY_IN,
  HANDLE_MEMORY_OUT,
  HANDLE_STATE_IN,
  HANDLE_STATE_OUT,
} from "../../constants";

export const NodeHandles: React.FC = () => {
  return (
    <>
      {/* Target Handles for LLM, Tools, Middleware */}
      <Handle
        type="target"
        position={Position.Top}
        id={HANDLE_LLM_IN}
        style={{ left: "16.6%" }}
        isValidConnection={(connection: Connection) =>
          connection.sourceHandle === HANDLE_LLM_OUT ||
          Boolean(connection.source?.startsWith("llm_"))
        }
        className="!bg-sky-400 !w-3.5 !h-3.5 !border-2 !border-background hover:!scale-125 transition-transform !-top-[7px]"
        title="Connect LLM (llm_out)"
      />
      <Handle
        type="target"
        position={Position.Top}
        id={HANDLE_TOOL_IN}
        style={{ left: "50%" }}
        isValidConnection={(connection: Connection) =>
          connection.sourceHandle === HANDLE_TOOL_OUT ||
          Boolean(connection.source?.startsWith("tool_"))
        }
        className="!bg-emerald-500 !w-3.5 !h-3.5 !border-2 !border-background hover:!scale-125 transition-transform !-top-[7px]"
        title="Connect Tool Node (tool_out)"
      />
      <Handle
        type="target"
        position={Position.Top}
        id={HANDLE_MIDDLEWARE_IN}
        style={{ left: "83.3%" }}
        isValidConnection={(connection: Connection) =>
          connection.sourceHandle === HANDLE_MIDDLEWARE_OUT ||
          Boolean(connection.source?.startsWith("mw_"))
        }
        className="!bg-purple-500 !w-3.5 !h-3.5 !border-2 !border-background hover:!scale-125 transition-transform !-top-[7px]"
        title="Connect Middleware (middleware_out)"
      />

      {/* Target Handle for State Reducer Ref (mutations) */}
      <Handle
        type="target"
        position={Position.Bottom}
        id={HANDLE_STATE_IN}
        style={{ left: "50%" }}
        isValidConnection={(connection: Connection) =>
          connection.sourceHandle === HANDLE_STATE_OUT ||
          Boolean(connection.source?.startsWith("state_ref_")) ||
          Boolean(connection.source?.startsWith("reducer_ref_"))
        }
        className="!bg-amber-400 !w-3.5 !h-3.5 !border-2 !border-background hover:!scale-125 transition-transform !-bottom-[7px]"
        title="Connect State Reducer Ref (state_in)"
      />

      {/* Execution Flow Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!bg-foreground !w-3.5 !h-3.5 !border-2 !border-background hover:!scale-125 transition-transform !-left-[7px]"
        title="Input Flow"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!bg-foreground !w-3.5 !h-3.5 !border-2 !border-background hover:!scale-125 transition-transform !-right-[7px]"
        title="Output Flow"
      />
    </>
  );
};

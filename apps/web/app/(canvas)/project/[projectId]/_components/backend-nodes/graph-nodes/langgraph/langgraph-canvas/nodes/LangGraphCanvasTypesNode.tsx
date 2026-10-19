import React, { useState, useEffect } from "react";
import { NodeProps, Handle, Position, useReactFlow } from "@xyflow/react";
import { Braces, Trash, Plus, FileCode, Check } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import type { LangGraphTypesNode, LangGraphCanvasNode, CustomTypeItem } from "@workspace/canvas";
import {
  LANGGRAPH_CANVAS_NODE_TYPES,
  HANDLE_TYPES_OUT,
} from "../constants";
import { LocalInput } from "../../../common";

export const LangGraphCanvasTypesNode = ({
  id,
  data,
  selected,
}: NodeProps<LangGraphTypesNode>) => {
  const { setNodes, setEdges } = useReactFlow<LangGraphCanvasNode>();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(data.label || "Custom Types");

  useEffect(() => {
    setNameValue(data.label || "Custom Types");
  }, [data.label]);

  const updateTypesData = (changes: Partial<typeof data>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id && n.type === LANGGRAPH_CANVAS_NODE_TYPES
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const handleNameSave = () => {
    setIsEditingName(false);
    const trimmed = nameValue.trim() || "Custom Types";
    setNameValue(trimmed);
    if (trimmed !== data.label) {
      updateTypesData({ label: trimmed });
    }
  };

  const handleDelete = () => {
    if (data.onDeleteTypes) {
      data.onDeleteTypes();
    } else {
      setNodes((nodes) => nodes.filter((node) => node.id !== id));
      setEdges((edges) =>
        edges.filter((edge) => edge.source !== id && edge.target !== id),
      );
    }
  };

  const typesList: CustomTypeItem[] = Array.isArray(data.types) ? data.types : [];
  const typeCount = typesList.length;

  return (
    <div
      className={`rounded-xl bg-card border-2 min-w-[240px] max-w-[320px] flex flex-col transition-all duration-200 shadow-md relative group ${
        selected
          ? "border-cyan-500 ring-2 ring-cyan-500/20 shadow-cyan-500/10"
          : "border-border hover:border-cyan-500/40 hover:shadow-cyan-500/5"
      }`}
    >
      <Handle
        type="source"
        position={Position.Right}
        id={HANDLE_TYPES_OUT}
        className="!bg-cyan-500 !w-3.5 !h-3.5 !border-2 !border-background hover:!scale-125 transition-transform !-right-[7px] z-10"
        title="Connect to Agent, State, or Types Ref node"
      />

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/40 gap-2 bg-muted/20">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Braces className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <LocalInput
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={handleNameSave}
                  onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
                  className="h-6 text-xs px-1.5 py-0 font-medium"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-emerald-400 hover:text-emerald-300"
                  onClick={handleNameSave}
                >
                  <Check className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <span
                className="text-xs font-semibold truncate cursor-pointer hover:underline text-foreground"
                onDoubleClick={() => setIsEditingName(true)}
                title="Double click to rename"
              >
                {data.label || "Custom Types"}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
              <FileCode className="w-3 h-3 text-cyan-400/70" />
              TypeScript Schemas
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Badge
            variant="outline"
            className="text-[10px] h-5 px-1.5 font-mono border-cyan-500/30 text-cyan-400 bg-cyan-500/10"
          >
            {typeCount} {typeCount === 1 ? "type" : "types"}
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            title="Delete Types node"
          >
            <Trash className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Types list preview */}
      <div className="p-3 flex flex-col gap-1.5 max-h-[180px] overflow-y-auto hide-scrollbar">
        {typesList.length === 0 ? (
          <div className="text-center py-2.5 px-2 text-[11px] text-muted-foreground/70 italic border border-dashed border-border/60 rounded-lg">
            No types defined yet. Select node to configure types &amp; schemas.
          </div>
        ) : (
          typesList.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between px-2 py-1.5 rounded-md bg-secondary/30 border border-border/40 text-[11px] font-mono group/item hover:border-cyan-500/30 transition-colors"
            >
              <span className="font-semibold text-foreground truncate mr-2">
                {t.name}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded text-cyan-400 bg-cyan-500/10 font-bold border border-cyan-500/20">
                  {t.kind}
                </span>
                {t.fields && t.fields.length > 0 && (
                  <span className="text-[9px] text-muted-foreground font-mono">
                    {t.fields.length} {t.fields.length === 1 ? "field" : "fields"}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 bg-muted/10 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="text-[9px] font-mono text-cyan-400/80">
          out: types_out
        </span>
        <span className="text-[9px]">Click to inspect</span>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from "react";
import { NodeProps, NodeResizer } from "@xyflow/react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { Plus, Trash, ShieldCheck, Workflow, Table2, Boxes } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";

export const SchemaGroupNode = ({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<BackendNode>) => {
  const addTableNode = useBackendCanvasStore((s) => s.addTableNode);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const deleteNode = useBackendCanvasStore((s) => s.deleteNode);
  const setNodesPendingDeletion = useBackendCanvasStore(
    (s) => s.setNodesPendingDeletion,
  );
  const nodes = useBackendCanvasStore((s) => s.nodes);

  const [isEditing, setIsEditing] = useState(!data.label);
  const [editValue, setEditValue] = useState(data.label || "");
  const [editDescription, setEditDescription] = useState(
    data.description || "",
  );
  const [isError, setIsError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditValue(data.label || "");
    if (!data.label) {
      setIsEditing(true);
    }
  }, [data.label]);

  useEffect(() => {
    if (isEditing) {
      setEditDescription(data.description || "");
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [isEditing, data.description]);

  const handleRename = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue === "") {
      if (!data.label || data.label.trim() === "") {
        deleteNode(id);
        return;
      }
      setEditValue(data.label);
      setIsError(false);
      setIsEditing(false);
      return;
    }

    if (
      trimmedValue !== data.label ||
      editDescription !== (data.description || "")
    ) {
      const isDuplicate = nodes.some(
        (n) =>
          n.type === "group" && n.id !== id && n.data.label === trimmedValue,
      );
      if (isDuplicate) {
        setIsError(true);
        setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }

      updateNode(id, {
        data: {
          ...data,
          label: trimmedValue,
          description: editDescription,
        },
      });
      setEditValue(trimmedValue);
    }

    setIsError(false);
    setIsEditing(false);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (e.relatedTarget instanceof Node && containerRef.current?.contains(e.relatedTarget)) {
      return;
    }
    handleRename();
  };

  const handleAddTable = () => {
    addTableNode(id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === id);
    if (node) setNodesPendingDeletion([node]);
  };

  return (
    <>
      <div
        className={cn(
          "bg-secondary/10 border-2 rounded-xl backdrop-blur-sm relative pointer-events-auto group",
          selected
            ? "border-primary border-dashed"
            : "border-border border-dashed",
        )}
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <div
          ref={containerRef}
          className="absolute top-0 left-0 bg-secondary/80 px-4 py-1.5 rounded-br-lg rounded-tl-lg border-r-2 border-b-2 border-border flex flex-col gap-0.5 cursor-text min-w-[150px]"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
            setEditValue(data.label || "");
            setEditDescription(data.description || "");
          }}
        >
          {isEditing ? (
            <div className="flex flex-col gap-1 nodrag">
              <input
                ref={inputRef}
                value={editValue}
                placeholder="Group Name"
                onChange={(e) => {
                  setEditValue(e.target.value);
                  if (isError) setIsError(false);
                }}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRename();
                  } else if (e.key === "Escape") {
                    if (!data.label || data.label.trim() === "") {
                      deleteNode(id);
                      return;
                    }
                    setEditValue(data.label);
                    setEditDescription(data.description || "");
                    setIsError(false);
                    setIsEditing(false);
                  }
                }}
                className={cn(
                  "bg-transparent border-none outline-none p-0 m-0 w-full focus:ring-0 text-sm font-semibold placeholder:text-muted-foreground/50",
                  isError && "text-red-500",
                )}
              />
              <input
                value={editDescription}
                placeholder="description"
                onChange={(e) => setEditDescription(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRename();
                    if (
                      data.label === "" &&
                      !nodes.some(
                        (n) =>
                          n.parentId === id ||
                          n.data?.groupId === id,
                      )
                    ) {
                      deleteNode(id);
                    } else {
                      setEditValue(data.label);
                      setEditDescription(data.description || "");
                      setIsError(false);
                      setIsEditing(false);
                    }
                  }
                }}
                className="bg-transparent border-none outline-none p-0 m-0 w-full focus:ring-0 text-[10px] text-muted-foreground placeholder:text-muted-foreground/30 font-normal"
              />
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                {(() => {
                  const lbl = (data.label || "").toLowerCase();
                  if (lbl.includes("auth")) {
                    return <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
                  }
                  if (lbl.includes("langgraph")) {
                    return <Workflow className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
                  }
                  return <Table2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
                })()}
                <span className="font-semibold text-xs tracking-tight">
                  {data.label || "Untitled Group"}
                </span>
                {data.badge && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 font-mono bg-background/50 border-border/60"
                  >
                    {data.badge}
                  </Badge>
                )}
              </div>
              {data.description ? (
                <span className="text-[10px] text-muted-foreground/75 font-normal max-w-[240px] truncate">
                  {data.description}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground/30 font-normal italic">
                  double-click to describe
                </span>
              )}
            </div>
          )}
        </div>
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleAddTable}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <NodeResizer
        color="#3b82f6"
        isVisible={selected}
        minWidth={450}
        minHeight={300}
      />
    </>
  );
};

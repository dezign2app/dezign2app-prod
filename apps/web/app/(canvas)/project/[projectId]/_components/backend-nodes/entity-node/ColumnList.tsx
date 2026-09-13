import React, { useState } from "react";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { ColumnItem, ColumnRow } from "./ColumnRow";

export interface ColumnListProps {
  nodeId: string;
  items?: ColumnItem[];
  updateNode: (id: string, changes: Partial<BackendNode>) => void;
  data: BackendNode["data"];
  isVector: boolean;
  defaultCollapsed?: boolean;
  title?: string;
  badge?: string;
}

export const ColumnList = ({
  nodeId,
  items = [],
  updateNode,
  data,
  isVector,
  defaultCollapsed = false,
  title,
  badge,
}: ColumnListProps) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingType, setEditingType] = useState("TEXT");
  const [nameError, setNameError] = useState(false);

  const handleAdd = () => {
    setIsCollapsed(false);
    const newItems = [...items, { name: "", type: "TEXT" }];
    updateNode(nodeId, { data: { ...data, columns: newItems } });
    setEditingIndex(newItems.length - 1);
    setEditingName("");
    setEditingType("TEXT");
    setNameError(false);
  };

  const handleUpdate = (index: number, changes: Partial<ColumnItem>) => {
    let newCols = [...items];
    if (
      changes.name &&
      changes.name.trim() !== "" &&
      changes.name !== items[index]?.name
    ) {
      const isDuplicate = newCols.some(
        (c, idx) =>
          idx !== index && c.name.toLowerCase() === changes.name!.toLowerCase(),
      );
      if (isDuplicate) {
        setNameError(true);
        return;
      }
    }
    newCols[index] = { ...newCols[index]!, ...changes };
    updateNode(nodeId, { data: { ...data, columns: newCols } });
  };

  const handleDelete = (index: number) => {
    let newCols = [...items];
    newCols.splice(index, 1);
    updateNode(nodeId, { data: { ...data, columns: newCols } });
  };

  return (
    <div className="flex flex-col">
      <div
        className="px-3 py-1 bg-secondary/40 border-t border-b text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex justify-between items-center group cursor-pointer select-none hover:bg-secondary/60 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-1.5">
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          <span>{title || "Columns"} ({items.length})</span>
          {badge && (
            <span className="text-[9px] font-mono px-1 py-0 rounded bg-red-500/20 text-red-600 dark:text-red-400 font-bold lowercase">
              {badge}
            </span>
          )}
        </div>
        <div
          className="opacity-0 group-hover:opacity-100 cursor-pointer text-muted-foreground hover:text-foreground transition-all p-0.5"
          onClick={(e) => {
            e.stopPropagation();
            handleAdd();
          }}
          title="Add Column"
        >
          <Plus size={12} />
        </div>
      </div>
      {!isCollapsed && (
        <div className="flex flex-col">
          {items.map((col, i) => (
            <ColumnRow
              key={i}
              nodeId={nodeId}
              col={col}
              index={i}
              isEditing={editingIndex === i}
              setEditingIndex={setEditingIndex}
              editingName={editingName}
              setEditingName={setEditingName}
              editingType={editingType}
              setEditingType={setEditingType}
              handleUpdate={handleUpdate}
              handleDelete={handleDelete}
              isVector={isVector}
              nameError={nameError && editingIndex === i}
              setNameError={setNameError}
            />
          ))}
        </div>
      )}
    </div>
  );
};

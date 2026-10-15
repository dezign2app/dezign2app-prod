import React, { useState } from "react";
import { Plus, Trash, AlertTriangle, Check } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { ColumnItem } from "./ColumnRow";
import { NodeDeletionDialog } from "../../node-deletion-dialog/NodeDeletionDialog";

import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";

export interface IndexListProps {
  id: string;
  indexes?: NonNullable<BackendNode["data"]["indexes"]>;
  columns?: ColumnItem[];
  data: BackendNode["data"];
  updateNode: (id: string, changes: Partial<BackendNode>) => void;
}

interface IndexEditRowProps {
  index: number;
  initialItem: NonNullable<BackendNode["data"]["indexes"]>[0];
  /** Persist to store WITHOUT closing the edit row */
  onCommit: (
    index: number,
    item: NonNullable<BackendNode["data"]["indexes"]>[0],
  ) => void;
  /** Persist to store AND close the edit row */
  onSave: (
    index: number,
    item: NonNullable<BackendNode["data"]["indexes"]>[0],
  ) => void;
  onCancel: () => void;
  onDelete: (index: number) => void;
  columns: ColumnItem[];
  currentTable: string;
  tableNames: Set<string>;
}

const IndexEditRow = ({
  index,
  initialItem,
  onCommit,
  onSave,
  onCancel,
  onDelete,
  columns,
  currentTable,
  tableNames,
}: IndexEditRowProps) => {
  const [name, setName] = useState(initialItem.name || "");
  const [isUnique, setIsUnique] = useState(!!initialItem.isUnique);
  const [selectedCols, setSelectedCols] = useState<string[]>(() =>
    (initialItem.columns || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const nameTrimmed = name.trim();
  const conflictsWithTable = Boolean(
    nameTrimmed && tableNames.has(nameTrimmed.toLowerCase()),
  );

  const handleSave = () => {
    const finalName = name.trim();
    if (!finalName) {
      onDelete(index);
      return;
    }
    onSave(index, {
      name: finalName,
      isUnique,
      columns: selectedCols.join(", "),
    });
  };

  const handleNameChange = (val: string) => {
    setName(val);
    onCommit(index, {
      name: val,
      isUnique,
      columns: selectedCols.join(", "),
    });
  };

  const handleUniqueChange = (checked: boolean) => {
    setIsUnique(checked);
    onCommit(index, {
      name: name.trim(),
      isUnique: checked,
      columns: selectedCols.join(", "),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (!initialItem.name.trim()) {
        onDelete(index);
      } else {
        onCancel();
      }
    }
  };

  const toggleColumn = (colName: string) => {
    const isSelected = selectedCols.includes(colName);
    let newCols = [...selectedCols];
    if (isSelected) {
      newCols = newCols.filter((c) => c !== colName);
    } else {
      newCols.push(colName);
    }
    setSelectedCols(newCols);

    let nextName = name.trim();
    const isAuto =
      !nextName ||
      nextName === `idx_${currentTable}` ||
      nextName.startsWith(`idx_${currentTable}_`) ||
      nextName.startsWith("idx_") ||
      tableNames.has(nextName.toLowerCase());

    if (isAuto && newCols.length > 0) {
      nextName = `idx_${currentTable}_${newCols.join("_")}`;
      setName(nextName);
    }

    onCommit(index, {
      name: nextName,
      isUnique,
      columns: newCols.join(", "),
    });
  };

  const firstCol = selectedCols[0] || columns[0]?.name;
  const recommendedSuffix = firstCol
    ? `_${firstCol}`
    : nameTrimmed
      ? `_${nameTrimmed}`
      : "";
  const recommendedName = `idx_${currentTable}${recommendedSuffix}`;

  return (
    <div className="flex flex-col px-3 py-1.5 border-b last:border-b-0 text-xs relative group/row hover:bg-secondary/20 nodrag">
      <div
        className="flex flex-col gap-1 w-full nodrag"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            handleSave();
          }
        }}
      >
        <div className="flex items-center gap-1.5">
          <Input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className={cn(
              "h-6 text-xs flex-1 nodrag",
              conflictsWithTable &&
                "border-amber-500/70 focus-visible:ring-amber-500/30",
            )}
            placeholder={`e.g. idx_${currentTable}_${columns[0]?.name || "col"}`}
            autoFocus
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="checkbox"
              id={`unique-${index}`}
              checked={isUnique}
              onChange={(e) => handleUniqueChange(e.target.checked)}
              className="w-3 h-3 cursor-pointer nodrag"
            />
            <label
              htmlFor={`unique-${index}`}
              className="text-[10px] cursor-pointer select-none"
            >
              UQ
            </label>
          </div>
          <Button
            size="icon"
            variant="ghost"
            type="button"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground nodrag"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleSave}
            title="Save index"
          >
            <Check size={13} />
          </Button>
        </div>

        {conflictsWithTable && (
          <div className="flex flex-col gap-1 text-[10px] text-amber-500 bg-amber-500/10 p-1.5 rounded border border-amber-500/20 mt-0.5 nodrag">
            <div className="flex items-center gap-1 font-semibold">
              <AlertTriangle size={11} className="shrink-0" />
              <span>Name conflicts with table &quot;{nameTrimmed}&quot;</span>
            </div>
            <span className="text-[9px] text-muted-foreground leading-tight">
              In PostgreSQL, index names share the schema namespace and cannot
              match table names.
            </span>
            <div
              className="text-[9px] underline font-semibold text-amber-500 hover:text-amber-400 text-left cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setName(recommendedName);
                onCommit(index, {
                  name: recommendedName,
                  isUnique,
                  columns: selectedCols.join(", "),
                });
              }}
            >
              Use recommended: {recommendedName}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1 mt-1 max-h-32 overflow-y-auto pr-1">
          {columns
            .filter((c) => c.name.trim() !== "")
            .map((col) => {
              const isSelected = selectedCols.includes(col.name);
              return (
                <div
                  key={col.name}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleColumn(col.name);
                  }}
                  className={cn(
                    "nodrag px-1.5 py-0.5 rounded text-[10px] cursor-pointer border transition-colors select-none",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-muted-foreground border-border hover:border-primary",
                  )}
                >
                  {col.name}
                </div>
              );
            })}
          {columns.filter((c) => c.name.trim() !== "").length === 0 && (
            <span className="text-[10px] text-muted-foreground italic px-1">
              Add columns to table first
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

interface IndexViewRowProps {
  index: number;
  idxObj: NonNullable<BackendNode["data"]["indexes"]>[0];
  onStartEdit: () => void;
  onDeleteRequest: (
    item: NonNullable<BackendNode["data"]["indexes"]>[0],
  ) => void;
  tableNames: Set<string>;
}

const IndexViewRow = ({
  idxObj,
  onStartEdit,
  onDeleteRequest,
  tableNames,
}: IndexViewRowProps) => {
  const nameTrimmed = (idxObj.name || "").trim();
  const conflictsWithTable = Boolean(
    nameTrimmed && tableNames.has(nameTrimmed.toLowerCase()),
  );

  return (
    <div className="flex flex-col px-3 py-1.5 border-b last:border-b-0 text-xs relative group/row hover:bg-secondary/20 nodrag">
      <div
        className="flex flex-col w-full cursor-pointer nodrag"
        onClick={onStartEdit}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="font-medium truncate max-w-[120px]">
              {idxObj.name}
            </span>
            {conflictsWithTable && (
              <span
                className="text-[8px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1 py-0.2 rounded font-mono uppercase tracking-wider shrink-0"
                title={`Index name "${idxObj.name}" conflicts with table "${idxObj.name}" in PostgreSQL.`}
              >
                table conflict
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {idxObj.isUnique && (
              <span className="text-[9px] bg-purple-500/10 text-purple-600 px-1 rounded font-bold">
                UQ
              </span>
            )}
            <div
              className="opacity-0 group-hover/row:opacity-100 flex items-center justify-center p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteRequest(idxObj);
              }}
              title="Delete Index"
            >
              <Trash size={12} />
            </div>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground truncate w-full mt-0.5">
          ({idxObj.columns || "no columns"})
        </div>
      </div>
    </div>
  );
};

export const IndexList = ({
  id,
  indexes = [],
  columns = [],
  data,
  updateNode,
}: IndexListProps) => {
  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [indexToDelete, setIndexToDelete] = useState<{
    index: number;
    item: NonNullable<BackendNode["data"]["indexes"]>[0];
  } | null>(null);

  const currentTable = (data.tableName || data.label || "table").toLowerCase();
  const entityNodes = allNodes.filter((n) => n.type === "entity");
  const tableNames = new Set(
    entityNodes
      .map((n) => (n.data?.label || n.data?.tableName || "").toLowerCase())
      .filter(Boolean),
  );

  const syncNodeDataWithIndexes = (
    nextIndexes: NonNullable<BackendNode["data"]["indexes"]>,
  ) => {
    const latestNodes = useBackendCanvasStore.getState().nodes;
    const latestNode = latestNodes.find((n) => n.id === id);
    const baseData = latestNode?.data || data;
    const nextData = { ...baseData, indexes: nextIndexes };
    if (baseData.dbOperations && baseData.dbOperations.length > 0) {
      const parentDb = latestNodes.find((n) => n.id === baseData.databaseId);
      const engine =
        parentDb?.data?.dbEngine || parentDb?.data?.dbType || "postgres";
      nextData.dbOperations = getEntityDbOperations(
        { data: nextData },
        latestNodes,
        engine,
      );
    }
    return nextData;
  };

  const addIndex = () => {
    const latestNodes = useBackendCanvasStore.getState().nodes;
    const latestNode = latestNodes.find((n) => n.id === id);
    const currIdxs = latestNode?.data?.indexes || indexes;
    const nextIndexes = [...currIdxs, { name: "", columns: "" }];
    updateNode(id, {
      data: syncNodeDataWithIndexes(nextIndexes),
    });
    setEditingIndex(currIdxs.length);
  };

  /** Persist to store, keep editing */
  const commitIndex = (
    idx: number,
    item: NonNullable<BackendNode["data"]["indexes"]>[0],
  ) => {
    const latestNodes = useBackendCanvasStore.getState().nodes;
    const latestNode = latestNodes.find((n) => n.id === id);
    const currIdxs = latestNode?.data?.indexes || indexes;
    const newIndexes = [...currIdxs];
    newIndexes[idx] = item;
    updateNode(id, { data: syncNodeDataWithIndexes(newIndexes) });
  };

  /** Persist to store and close the edit row */
  const saveIndex = (
    idx: number,
    item: NonNullable<BackendNode["data"]["indexes"]>[0],
  ) => {
    commitIndex(idx, item);
    setEditingIndex(null);
  };

  const deleteIndex = (i: number) => {
    const latestNodes = useBackendCanvasStore.getState().nodes;
    const latestNode = latestNodes.find((n) => n.id === id);
    const currIdxs = latestNode?.data?.indexes || indexes;
    const newIdxs = [...currIdxs];
    newIdxs.splice(i, 1);
    updateNode(id, { data: syncNodeDataWithIndexes(newIdxs) });
    setEditingIndex((prev) => {
      if (prev === null) return null;
      if (prev === i) return null;
      if (prev > i) return prev - 1;
      return prev;
    });
  };

  return (
    <>
      <div className="px-3 py-1 bg-secondary/40 border-t border-b text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex justify-between items-center group">
        Indexes
        <div
          className="opacity-0 group-hover:opacity-100 cursor-pointer text-muted-foreground hover:text-foreground transition-all"
          onClick={addIndex}
        >
          <Plus size={12} />
        </div>
      </div>
      <div className="flex flex-col">
        {indexes.map((idxObj, i) => {
          const isEditing = editingIndex === i;
          return isEditing ? (
            <IndexEditRow
              key={`edit-${i}`}
              index={i}
              initialItem={idxObj}
              onCommit={commitIndex}
              onSave={saveIndex}
              onCancel={() => setEditingIndex(null)}
              onDelete={deleteIndex}
              columns={columns}
              currentTable={currentTable}
              tableNames={tableNames}
            />
          ) : (
            <IndexViewRow
              key={`view-${i}`}
              index={i}
              idxObj={idxObj}
              onStartEdit={() => setEditingIndex(i)}
              onDeleteRequest={(item) =>
                setIndexToDelete({ index: i, item })
              }
              tableNames={tableNames}
            />
          );
        })}
      </div>

      {indexToDelete && (
        <NodeDeletionDialog
          open={!!indexToDelete}
          onOpenChange={(open) => !open && setIndexToDelete(null)}
          deletionTarget={{
            type: "index",
            nodeId: id,
            indexItem: indexToDelete.item,
            onConfirm: () => {
              deleteIndex(indexToDelete.index);
              setIndexToDelete(null);
            },
          }}
        />
      )}
    </>
  );
};

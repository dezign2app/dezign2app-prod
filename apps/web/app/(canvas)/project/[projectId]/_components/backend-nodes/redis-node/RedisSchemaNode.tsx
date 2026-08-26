import React, { useRef } from "react";
import { NodeProps, Handle, Position } from "@xyflow/react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { ColumnList } from "../entity-node/ColumnList";
import { RedisConfig } from "../entity-node/RedisConfig";
import { DbOperationsList } from "../entity-node/DbOperationsList";
import { RedisSchemaHeader } from "./components/RedisSchemaHeader";
import { RedisSchemaDescription } from "./components/RedisSchemaDescription";
import { useRedisSchemaName } from "./hooks/useRedisSchemaName";
import { useRedisInstanceConnection } from "./hooks/useRedisInstanceConnection";
import { syncHashColumns } from "./utils";

export const RedisSchemaNode = ({ id, data, selected }: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const setActiveConfigItem = useBackendCanvasStore(
    (s) => s.setActiveConfigItem,
  );
  const setNodesPendingDeletion = useBackendCanvasStore(
    (s) => s.setNodesPendingDeletion,
  );
  const nodeRef = useRef<HTMLDivElement>(null);

  const nameController = useRedisSchemaName(id, data, updateNode);
  const { redisInstanceNodes, dbThemeColor, handleInstanceChange } =
    useRedisInstanceConnection(id, data, updateNode);

  const redisStructure = data.redisDataStructure || "hash";

  const openSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveConfigItem({
      type: "redisSchema",
      id: id,
      nodeId: id,
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cols = data.columns || [];
    const isEmpty = cols.length === 0;
    if (!isEmpty) {
      const node = useBackendCanvasStore
        .getState()
        .nodes.find((n) => n.id === id);
      if (node) setNodesPendingDeletion([node]);
    } else {
      useBackendCanvasStore.getState().deleteNode(id);
    }
  };

  const handleUpdateNodeWithSync = (
    targetNodeId: string,
    changes: Partial<BackendNode>,
  ) => {
    const syncedChanges = syncHashColumns(changes, redisStructure);
    updateNode(targetNodeId, syncedChanges);
  };

  return (
    <div
      ref={nodeRef}
      tabIndex={-1}
      onDoubleClick={openSettings}
      className={cn(
        "shadow-md rounded-xl bg-card border-2 min-w-[280px] max-w-[370px] focus:outline-none transition-all",
        selected ? "border-primary" : "border-border",
      )}
      style={{
        borderColor: dbThemeColor ? dbThemeColor : undefined,
        boxShadow: selected
          ? `0 0 0 2px ${dbThemeColor || "var(--primary)"}50, 0 4px 6px -1px rgba(0, 0, 0, 0.1)`
          : undefined,
      }}
    >
      {/* Top Handle for Redis Instance Node connection */}
      <Handle
        type="target"
        position={Position.Top}
        id="database-entity-target"
        className="w-3 h-3 border-2 border-background !-top-1.5"
        style={{ backgroundColor: dbThemeColor }}
      />

      {/* Header with inline name edit, badge, actions & instance selector */}
      <RedisSchemaHeader
        id={id}
        label={data.label || "User_Cache"}
        redisStructure={redisStructure}
        dbThemeColor={dbThemeColor}
        isEditingName={nameController.isEditingName}
        setIsEditingName={nameController.setIsEditingName}
        editingName={nameController.editingName}
        setEditingName={nameController.setEditingName}
        nameError={nameController.nameError}
        setNameError={nameController.setNameError}
        inputRef={nameController.inputRef}
        saveName={nameController.saveName}
        cancelEdit={nameController.cancelEdit}
        openSettings={openSettings}
        onDelete={handleDelete}
        currentDatabaseId={data.databaseId}
        redisInstanceNodes={redisInstanceNodes}
        onInstanceChange={handleInstanceChange}
      />

      {/* Description */}
      <RedisSchemaDescription
        value={data.description}
        onChange={(val) =>
          updateNode(id, { data: { ...data, description: val } })
        }
      />

      {/* Redis Key & Structure Settings */}
      <RedisConfig id={id} data={data} updateNode={updateNode} />

      {/* Schema Columns (for Hash or JSON structures) */}
      {(redisStructure === "hash" || redisStructure === "json") && (
        <ColumnList
          nodeId={id}
          items={data.columns || []}
          updateNode={handleUpdateNodeWithSync}
          data={data}
          isVector={false}
        />
      )}

      {/* DB / Redis Operations list */}
      <DbOperationsList nodeId={id} data={data} updateNode={updateNode} />
    </div>
  );
};

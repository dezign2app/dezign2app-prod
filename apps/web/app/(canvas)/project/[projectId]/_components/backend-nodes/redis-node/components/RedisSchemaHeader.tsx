import React from "react";
import { DatabaseZap, Settings, Trash } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import { BackendNode } from "@/types/canvas";
import { RedisSchemaInstanceSelect } from "./RedisSchemaInstanceSelect";

export interface RedisSchemaHeaderProps {
  id: string;
  label: string;
  redisStructure: string;
  dbThemeColor: string;
  isEditingName: boolean;
  setIsEditingName: (val: boolean) => void;
  editingName: string;
  setEditingName: (val: string) => void;
  nameError: boolean;
  setNameError: (val: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  saveName: (e?: React.SyntheticEvent) => void;
  cancelEdit: () => void;
  openSettings: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  currentDatabaseId?: string;
  redisInstanceNodes: BackendNode[];
  onInstanceChange: (val: string) => void;
}

export const RedisSchemaHeader = ({
  label,
  redisStructure,
  dbThemeColor,
  isEditingName,
  setIsEditingName,
  editingName,
  setEditingName,
  nameError,
  setNameError,
  inputRef,
  saveName,
  cancelEdit,
  openSettings,
  onDelete,
  currentDatabaseId,
  redisInstanceNodes,
  onInstanceChange,
}: RedisSchemaHeaderProps) => {
  return (
    <div className="px-3 py-2 border-b flex flex-col gap-1.5 group rounded-t-[10px] bg-red-500/10 text-red-700 dark:text-red-400">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center flex-1 min-w-0">
          <DatabaseZap
            size={14}
            className="mr-2 shrink-0 text-red-500"
            style={{ color: dbThemeColor }}
          />
          {isEditingName ? (
            <div className="flex flex-1 items-center gap-1">
              <Input
                ref={inputRef}
                value={editingName}
                onChange={(e) => {
                  setEditingName(e.target.value);
                  if (nameError) setNameError(false);
                }}
                className={cn(
                  "h-6 text-xs px-1",
                  nameError &&
                    "border-destructive focus-visible:ring-destructive",
                )}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName(e);
                  if (e.key === "Escape") cancelEdit();
                }}
                onBlur={saveName}
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="font-bold text-xs cursor-pointer hover:opacity-80 transition-colors truncate text-red-700 dark:text-red-300"
                style={{ color: dbThemeColor }}
                onClick={() => setIsEditingName(true)}
              >
                {label || "User_Cache"}
              </span>
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 uppercase font-mono bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 shrink-0"
              >
                {redisStructure}
              </Badge>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          <div
            className="opacity-0 group-hover:opacity-100 flex items-center justify-center p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Configure Redis Schema"
            onClick={openSettings}
          >
            <Settings size={14} />
          </div>
          <div
            className="opacity-0 group-hover:opacity-100 flex items-center justify-center p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
            title="Delete Redis Schema"
            onClick={onDelete}
          >
            <Trash size={14} />
          </div>
        </div>
      </div>

      {/* Redis Instance Association Dropdown */}
      <RedisSchemaInstanceSelect
        currentDatabaseId={currentDatabaseId}
        dbThemeColor={dbThemeColor}
        redisInstanceNodes={redisInstanceNodes}
        onInstanceChange={onInstanceChange}
      />
    </div>
  );
};

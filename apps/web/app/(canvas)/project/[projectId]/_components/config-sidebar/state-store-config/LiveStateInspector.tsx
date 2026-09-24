"use client";

import React, { useState } from "react";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Textarea } from "@workspace/ui/components/textarea";
import { Badge } from "@workspace/ui/components/badge";
import { Activity, RotateCcw, Edit3, Check, X, FileJson, ListTree } from "lucide-react";
import { StoreState, isJsonObject } from "./types";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";

export interface LiveStateInspectorProps {
  sandboxState: StoreState;
  onResetDefaults: () => void;
  onUpdateSandboxState?: (newState: StoreState) => void;
}

export const LiveStateInspector: React.FC<LiveStateInspectorProps> = ({
  sandboxState,
  onResetDefaults,
  onUpdateSandboxState,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const entries = Object.entries(sandboxState);

  const handleStartEdit = () => {
    setEditText(JSON.stringify(sandboxState, null, 2));
    setEditError(null);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    try {
      const parsed = JSON.parse(editText);
      if (!isJsonObject(parsed)) {
        setEditError("Root state must be a valid JSON object.");
        return;
      }
      onUpdateSandboxState?.(parsed);
      setIsEditing(false);
      toast.success("Updated live sandbox state");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Invalid JSON syntax");
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError(null);
  };

  return (
    <div className="p-3 rounded-lg bg-card border border-border space-y-2.5 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity size={13} className="text-foreground" />
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Live Sandbox State
          </Label>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono text-muted-foreground bg-muted border-border">
            {entries.length} {entries.length === 1 ? "field" : "fields"}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {onUpdateSandboxState && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={isEditing ? handleCancelEdit : handleStartEdit}
              className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
              title={isEditing ? "Cancel edit" : "Edit state values"}
            >
              <Edit3 size={10} />
              <span>{isEditing ? "Cancel" : "Seed / Edit"}</span>
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetDefaults}
            className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
            title="Reset all fields to default initial state"
          >
            <RotateCcw size={10} />
            <span>Reset</span>
          </Button>
        </div>
      </div>

      {/* Direct JSON State Editor Mode */}
      {isEditing ? (
        <div className="space-y-1.5">
          <Textarea
            value={editText}
            onChange={(e) => {
              setEditText(e.target.value);
              if (editError) setEditError(null);
            }}
            className="h-32 text-[11px] font-mono bg-background resize-y p-2 leading-relaxed border-border text-foreground"
            placeholder='{ "count": 0, "conversations": [] }'
          />
          {editError && (
            <p className="text-[10px] text-destructive font-mono">{editError}</p>
          )}
          <div className="flex items-center justify-end gap-1.5 pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancelEdit}
              className="h-6 text-[10px] px-2"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveEdit}
              className="h-6 text-[10px] px-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1"
            >
              <Check size={10} />
              <span>Apply State</span>
            </Button>
          </div>
        </div>
      ) : (
        /* Formatted Live State Tree */
        <div className="p-2.5 rounded-md bg-muted font-mono text-[11px] border border-border max-h-48 overflow-y-auto space-y-1">
          {entries.length === 0 ? (
            <span className="text-muted-foreground italic">No state defined</span>
          ) : (
            entries.map(([key, val]) => {
              const isArray = Array.isArray(val);
              const isNull = val === null;

              return (
                <div
                  key={key}
                  className="flex items-start justify-between gap-2 py-1 border-b border-border last:border-0"
                >
                  <span className="text-foreground font-semibold">{key}:</span>
                  <span
                    className={cn(
                      "truncate max-w-[200px] text-right font-medium",
                      isNull ? "text-muted-foreground italic" : "text-foreground",
                    )}
                    title={
                      typeof val === "object" && val !== null
                        ? JSON.stringify(val, null, 2)
                        : String(val ?? "null")
                    }
                  >
                    {isArray
                      ? `Array(${val.length}) ${JSON.stringify(val)}`
                      : typeof val === "object" && val !== null
                      ? JSON.stringify(val)
                      : String(val ?? "null")}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

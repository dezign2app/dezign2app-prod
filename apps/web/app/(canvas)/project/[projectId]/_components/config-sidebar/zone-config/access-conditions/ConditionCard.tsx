import React from "react";
import { Trash2, Database, Key } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { ConditionPrimitive, SessionClaimConfig } from "@workspace/canvas";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import {
  getClaimKey,
  getClaimTag,
  getNormalizedOp,
  getLeafValues,
  getLeafSingleVal,
  getClaimColumnInfo,
} from "./utils";
import { ConditionValuesControl } from "./ConditionValuesControl";

interface ConditionCardProps {
  idx: number;
  leaf: ConditionPrimitive;
  authClaims: SessionClaimConfig[];
  allNodes: BackendNode[];
  onRemoveCondition: (index: number) => void;
  onUpdateCondition?: (index: number, condition: ConditionPrimitive) => void;
  onClaimChange: (idx: number, newClaimKey: string) => void;
  onOperatorChange: (idx: number, leaf: ConditionPrimitive, newOp: string) => void;
  onValuesChange: (idx: number, leaf: ConditionPrimitive, text: string) => void;
  onSingleValChange: (idx: number, leaf: ConditionPrimitive, val: string) => void;
}

export const ConditionCard: React.FC<ConditionCardProps> = ({
  idx,
  leaf,
  authClaims,
  allNodes,
  onRemoveCondition,
  onUpdateCondition,
  onClaimChange,
  onOperatorChange,
  onValuesChange,
  onSingleValChange,
}) => {
  const isAuth = leaf.type === "auth";
  const currentClaimKey = getClaimKey(leaf);
  const claimTag = getClaimTag(leaf);
  const normalizedOp = getNormalizedOp(leaf);
  const values = getLeafValues(leaf);
  const singleVal = getLeafSingleVal(leaf);

  const colInfo = getClaimColumnInfo(currentClaimKey, authClaims, allNodes);

  const isListOp = normalizedOp === "in" || normalizedOp === "notIn";
  const isSingleValOp = normalizedOp === "eq" || normalizedOp === "neq";

  const isClaimDeleted =
    !isAuth &&
    currentClaimKey !== "org" &&
    currentClaimKey !== "access" &&
    authClaims.length > 0 &&
    !authClaims.some((c) => c.key === currentClaimKey);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3 rounded-lg bg-background border text-xs shadow-xs transition-colors",
        isClaimDeleted ? "border-destructive/60 bg-destructive/5" : "border-border/60"
      )}
    >
      {/* Card Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono min-w-0">
          <span className="font-semibold text-indigo-500 dark:text-indigo-400 uppercase text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 shrink-0">
            {claimTag}
          </span>
          <span className="text-muted-foreground text-xs font-semibold shrink-0">{"->"}</span>
          <span className="text-[11px] text-foreground font-medium truncate">
            {isAuth
              ? `auth.${leaf.op}`
              : `${currentClaimKey} ${normalizedOp} ${
                  isListOp
                    ? `[${values.join(", ")}]`
                    : isSingleValOp
                    ? `"${singleVal}"`
                    : ""
                }`}
          </span>

          {isClaimDeleted && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-destructive/15 text-destructive font-mono border border-destructive/30 shrink-0 font-medium">
              ⚠️ Deleted from AuthConfig
            </span>
          )}
        </div>

        <button
          onClick={() => onRemoveCondition(idx)}
          className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer shrink-0"
          title="Delete condition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Schema Info Badge if mapped to Database Table Column */}
      {!isAuth && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          <Database className="w-3 h-3 text-amber-500 shrink-0" />
          <span>
            DB Column:{" "}
            <strong className="text-foreground">
              {colInfo.entityName ? `${colInfo.entityName}.${colInfo.columnName}` : colInfo.columnName}
            </strong>{" "}
            ({colInfo.dataType.toUpperCase()})
          </span>
        </div>
      )}

      {/* Configurable Fields Body */}
      {isAuth ? (
        /* Sign-in Condition (Except Sign-in) */
        <div className="flex items-center gap-2 pt-1 border-t border-border/30">
          <span className="text-[11px] text-muted-foreground font-mono shrink-0 font-medium">
            State:
          </span>
          <Select
            value={leaf.op}
            onValueChange={(val: "signedIn" | "signedOut") =>
              onUpdateCondition?.(idx, { type: "auth", op: val })
            }
          >
            <SelectTrigger className="h-7 text-xs font-mono bg-background flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="font-mono">
              <SelectItem value="signedIn" className="text-xs font-mono">
                signedIn (Authenticated)
              </SelectItem>
              <SelectItem value="signedOut" className="text-xs font-mono">
                signedOut (Guest Only)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        /* Other Claims: Selectable from Configured Auth Claims & Database Schema */
        <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            {/* Claim Selection (from AuthConfig) */}
            <div className="sm:col-span-7 flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Key className="w-2.5 h-2.5 text-indigo-400" /> Claim Field
              </span>
              <Select
                value={currentClaimKey}
                onValueChange={(val) => onClaimChange(idx, val)}
              >
                <SelectTrigger
                  className={cn(
                    "h-7 text-xs font-mono bg-background truncate",
                    isClaimDeleted && "border-destructive text-destructive font-semibold"
                  )}
                >
                  <SelectValue placeholder="Select claim..." />
                </SelectTrigger>
                <SelectContent className="font-mono">
                  {authClaims.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-semibold text-indigo-400 uppercase border-b border-border">
                        Configured Auth Claims
                      </div>
                      {authClaims.map((claim) => (
                        <SelectItem
                          key={`claim-sel-${claim.key}`}
                          value={claim.key}
                          className="text-xs font-mono"
                        >
                          {claim.key || claim.targetValue}
                        </SelectItem>
                      ))}
                    </>
                  )}

                  {isClaimDeleted && (
                    <SelectItem
                      value={currentClaimKey}
                      className="text-xs font-mono text-destructive"
                    >
                      ⚠️ {currentClaimKey} (Deleted)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Operator Selection */}
            <div className="sm:col-span-5 flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground font-medium">
                Operator
              </span>
              <Select
                value={normalizedOp}
                onValueChange={(val) => onOperatorChange(idx, leaf, val)}
              >
                <SelectTrigger className="h-7 text-xs font-mono bg-background">
                  <SelectValue placeholder="Operator" />
                </SelectTrigger>
                <SelectContent className="font-mono">
                  <SelectItem value="in" className="text-xs font-mono">
                    in [...]
                  </SelectItem>
                  <SelectItem value="notIn" className="text-xs font-mono">
                    not in [...]
                  </SelectItem>
                  <SelectItem value="eq" className="text-xs font-mono">
                    = (equals)
                  </SelectItem>
                  <SelectItem value="neq" className="text-xs font-mono">
                    != (not eq)
                  </SelectItem>
                  <SelectItem value="truthy" className="text-xs font-mono">
                    is present
                  </SelectItem>
                  <SelectItem value="falsy" className="text-xs font-mono">
                    is missing
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <ConditionValuesControl
            idx={idx}
            leaf={leaf}
            colInfo={colInfo}
            isListOp={isListOp}
            isSingleValOp={isSingleValOp}
            values={values}
            singleVal={singleVal}
            onValuesChange={onValuesChange}
            onSingleValChange={onSingleValChange}
          />
        </div>
      )}
    </div>
  );
};

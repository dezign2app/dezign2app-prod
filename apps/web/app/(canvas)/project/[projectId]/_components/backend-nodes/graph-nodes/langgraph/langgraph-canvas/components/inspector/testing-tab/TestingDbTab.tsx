import React from "react";
import { Badge } from "@workspace/ui/components/badge";

export interface TestingDbTabProps {
  dbTables: Array<{ name: string; rows: unknown[] }>;
  isTraceExpanded: boolean;
}

export function TestingDbTab({ dbTables, isTraceExpanded }: TestingDbTabProps) {
  if (dbTables.length === 0) {
    return (
      <div className="text-center p-6 border rounded-xl border-dashed text-muted-foreground text-[11px]">
        No simulation tables populated yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {dbTables.map((tbl) => (
        <div key={tbl.name} className="flex flex-col gap-1 border rounded-lg p-2 bg-background/80">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="font-bold text-foreground">Table: {tbl.name}</span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
              {tbl.rows.length} rows
            </Badge>
          </div>
          <pre
            className={`p-1.5 rounded bg-muted/30 font-mono text-[9px] overflow-y-auto hide-scrollbar transition-all ${
              isTraceExpanded ? "max-h-[380px]" : "max-h-[240px]"
            }`}
          >
            {JSON.stringify(tbl.rows, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}

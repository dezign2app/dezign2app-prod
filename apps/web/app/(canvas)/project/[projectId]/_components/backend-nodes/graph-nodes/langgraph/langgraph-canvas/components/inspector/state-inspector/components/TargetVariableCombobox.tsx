import React from "react";
import { Database, Link2, Check } from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@workspace/ui/components/combobox";
import type { LangGraphStateChannel } from "@/types/canvas";

interface TargetVariableComboboxProps {
  availableFieldKeys: string[];
  stateChannels: LangGraphStateChannel[];
  value: string;
  onSelectValue: (val: string) => void;
  inputValue: string;
  onInputValueChange: (text: string) => void;
  autoFocus?: boolean;
  labelSize?: "default" | "small";
  placeholder?: string;
  badgeLabel?: string;
}

export function TargetVariableCombobox({
  availableFieldKeys,
  stateChannels,
  value,
  onSelectValue,
  inputValue,
  onInputValueChange,
  autoFocus = false,
  labelSize = "default",
  placeholder = "Search state variable (e.g. messages, scores)...",
  badgeLabel,
}: TargetVariableComboboxProps) {
  const isSmall = labelSize === "small";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label
          className={`${
            isSmall ? "text-[9px]" : "text-[10px]"
          } text-muted-foreground font-mono flex items-center gap-1`}
        >
          <Link2 className="w-3 h-3 text-purple-400" />
          Target State Variable to Update
        </Label>
        <span
          className={`${
            isSmall ? "text-[8px]" : "text-[9px]"
          } text-muted-foreground`}
        >
          Select or type variable
        </span>
      </div>
      <Combobox
        items={availableFieldKeys}
        value={value}
        onValueChange={(val) => {
          if (typeof val === "string" && val.trim()) {
            onSelectValue(val.trim());
          }
        }}
        inputValue={inputValue}
        onInputValueChange={onInputValueChange}
      >
        <ComboboxInput
          placeholder={placeholder}
          className="h-7 text-xs font-mono bg-background w-full"
          autoFocus={autoFocus}
        />
        <ComboboxContent
          className="w-[300px] p-0 shadow-2xl border border-border/80 bg-popover text-popover-foreground rounded-xl z-50 overflow-hidden"
          align="start"
          sideOffset={4}
        >
          <ComboboxEmpty className="py-2.5 px-3 text-xs text-muted-foreground text-center">
            {availableFieldKeys.length === 0
              ? "No state channels yet. Type a variable name."
              : "No matching channels. Type to use custom variable."}
          </ComboboxEmpty>
          <ComboboxList className="max-h-56 overflow-y-auto no-scrollbar p-1 bg-popover text-popover-foreground hide-scrollbar">
            {(fieldKey: string) => {
              const ch = stateChannels.find((c) => c.key === fieldKey);
              return (
                <ComboboxItem
                  key={fieldKey}
                  value={fieldKey}
                  className="flex items-center justify-between py-1.5 px-2 text-xs font-mono cursor-pointer rounded-md gap-2"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Database className="w-3 h-3 text-blue-400 shrink-0" />
                    <span className="font-semibold text-foreground truncate">
                      {fieldKey}
                    </span>
                  </div>
                  {ch?.type && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-4 text-muted-foreground font-mono shrink-0"
                    >
                      {ch.type}
                    </Badge>
                  )}
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {value && (
        <span className="text-[9px] text-purple-300/90 font-mono flex items-center gap-1 pl-0.5">
          <Check className="w-2.5 h-2.5 text-purple-400" />
          {badgeLabel ? (
            <>
              {badgeLabel}{" "}
              <span className="font-bold text-foreground">"{value}"</span>
            </>
          ) : (
            <>
              Will tie this reducer directly to{" "}
              <span className="font-bold text-foreground">"{value}"</span> channel
            </>
          )}
        </span>
      )}
    </div>
  );
}

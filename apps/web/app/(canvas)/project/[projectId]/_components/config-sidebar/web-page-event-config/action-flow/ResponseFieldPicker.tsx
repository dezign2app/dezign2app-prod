import React from "react";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import type { ResponseFieldPickerProps } from "./types";
import { extractResponseFieldSuggestions } from "./utils";

export const ResponseFieldPicker: React.FC<ResponseFieldPickerProps> = ({
  value,
  onChange,
  endpoint,
  placeholder = "e.g. presignedUrl or data.url",
  disabled = false,
}) => {
  const suggestions = extractResponseFieldSuggestions(endpoint);

  return (
    <div className="space-y-1.5">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-8 text-xs bg-background font-mono"
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] text-muted-foreground mr-1">
            Suggestions:
          </span>
          {suggestions.slice(0, 5).map((sug) => (
            <Badge
              key={sug}
              variant="outline"
              onClick={() => {
                if (!disabled) onChange(sug);
              }}
              className={`text-[10px] py-0 px-1.5 cursor-pointer font-mono hover:bg-primary/10 transition-colors ${
                value === sug
                  ? "bg-primary/15 text-primary border-primary/40 font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              {sug}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

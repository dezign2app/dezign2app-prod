import React, { useState, useEffect, useCallback } from "react";
import { Textarea } from "@workspace/ui/components/textarea";

export interface RedisSchemaDescriptionProps {
  value?: string;
  onChange: (value: string) => void;
}

export const RedisSchemaDescription = React.memo(({
  value = "",
  onChange,
}: RedisSchemaDescriptionProps) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = useCallback(() => {
    if (localValue !== value) {
      onChange(localValue);
    }
  }, [localValue, value, onChange]);

  return (
    <div className="px-3 py-1.5 bg-secondary/10 border-b nodrag">
      <Textarea
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Describe cache schema / invalidation rules..."
        className="h-10 text-xs min-h-[36px] bg-transparent border-none shadow-none resize-none focus-visible:ring-0 p-0 placeholder:text-muted-foreground/50"
      />
    </div>
  );
});

RedisSchemaDescription.displayName = "RedisSchemaDescription";

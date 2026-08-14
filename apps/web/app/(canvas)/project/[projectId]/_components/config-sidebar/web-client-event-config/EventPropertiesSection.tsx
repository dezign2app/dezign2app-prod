import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Sparkles } from "lucide-react";

interface EventPropertiesSectionProps {
  eventName: string;
  eventType: string;
  customEvent: string;
  eventOptions: readonly string[];
  isNavigateToPage: boolean;
  setEventName: (val: string) => void;
  setEventType: (val: string) => void;
  setCustomEvent: (val: string) => void;
  handleUpdateEvent: (
    name: string,
    finalEvent: string,
  ) => void;
}

export const EventPropertiesSection: React.FC<EventPropertiesSectionProps> = ({
  eventName,
  eventType,
  customEvent,
  eventOptions,
  setEventName,
  setEventType,
  setCustomEvent,
  handleUpdateEvent,
}) => {
  return (
    <AccordionItem
      value="settings"
      className="border rounded-xl overflow-hidden bg-card"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/20 transition-colors [&>svg]:shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          <span className="text-xs font-semibold">Event Properties</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-2">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 p-3 bg-secondary/10 border rounded-lg">
            <div className="grid gap-1">
              <Label className="text-xs font-mono text-muted-foreground">
                Action Name
              </Label>
              <Input
                className="h-8 text-xs bg-background"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                onBlur={() =>
                  handleUpdateEvent(
                    eventName,
                    eventType === "other" ? customEvent : eventType,
                  )
                }
                placeholder="e.g. submitOrder, fetchUserProfile"
              />
            </div>

            <div className="grid gap-1">
              <Label className="text-xs font-mono text-muted-foreground">
                Trigger Event Type
              </Label>
              <div className="flex flex-col gap-1">
                <Select
                  value={eventType}
                  onValueChange={(v) => {
                    setEventType(v);
                    handleUpdateEvent(
                      eventName,
                      v === "other" ? customEvent : v,
                    );
                  }}
                >
                  <SelectTrigger className="h-8 text-xs w-full bg-background focus:ring-1 focus:ring-ring focus:ring-offset-0">
                    <SelectValue placeholder="Event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventOptions.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-xs">
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {eventType === "other" && (
                  <Input
                    value={customEvent}
                    onChange={(e) => setCustomEvent(e.target.value)}
                    onBlur={() =>
                      handleUpdateEvent(
                        eventName,
                        customEvent,
                      )
                    }
                    placeholder="Custom event"
                    className="h-8 text-xs w-full"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

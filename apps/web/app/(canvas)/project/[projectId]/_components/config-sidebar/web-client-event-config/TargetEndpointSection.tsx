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
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { BackendNode } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas";
import { Server, Route, CheckCircle2, Info } from "lucide-react";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  PUT: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  PATCH: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  WS: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  SSE: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  RTC: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30",
};

export function getMethodColor(method: string) {
  return (
    METHOD_COLORS[method?.toUpperCase()] ||
    "bg-secondary/40 text-secondary-foreground border-border"
  );
}

interface TargetEndpointSectionProps {
  currentServiceId: string;
  currentEndpointId: string;
  serviceNodes: BackendNode[];
  availableEndpoints: Endpoint[];
  linkedTargetNode: BackendNode | null | undefined;
  endpoint: Endpoint | null | undefined;
  handleServiceChange: (serviceId: string) => void;
  handleEndpointChange: (endpointId: string) => void;
}

export const TargetEndpointSection: React.FC<TargetEndpointSectionProps> = ({
  currentServiceId,
  currentEndpointId,
  serviceNodes,
  availableEndpoints,
  linkedTargetNode,
  endpoint,
  handleServiceChange,
  handleEndpointChange,
}) => {
  return (
    <AccordionItem
      value="connection"
      className="border rounded-xl overflow-hidden bg-card"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/20 transition-colors [&>svg]:shrink-0">
        <div className="flex items-center gap-2">
          <Server size={14} className="text-primary" />
          <span className="text-xs font-semibold">
            Target Service & Endpoint
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-5 pt-2">
        <div className="flex flex-col gap-4">
          {/* Select Service */}
          <div className="flex flex-col gap-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Server size={10} />
              Target Service
            </Label>
            <Select
              value={currentServiceId || "none"}
              onValueChange={handleServiceChange}
            >
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="Choose target service…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="none"
                  className="text-xs text-muted-foreground"
                >
                  None
                </SelectItem>
                {serviceNodes.map((sn) => (
                  <SelectItem key={sn.id} value={sn.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                        {sn.type}
                      </span>
                      <span className="font-medium">
                        {sn.data.label || "Untitled Service"}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {serviceNodes.length === 0 && (
              <p className="text-[11px] text-amber-500 flex items-center gap-1.5 mt-1">
                <Info size={11} className="shrink-0" />
                No service nodes on canvas.
              </p>
            )}
          </div>

          {/* Select Endpoint */}
          <div className="flex flex-col gap-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Route size={10} />
              Target Endpoint
            </Label>
            <Select
              value={currentEndpointId || "none"}
              onValueChange={handleEndpointChange}
              disabled={!linkedTargetNode}
            >
              <SelectTrigger className="h-9 text-xs bg-background disabled:opacity-50">
                <SelectValue
                  placeholder={
                    linkedTargetNode
                      ? availableEndpoints.length > 0
                        ? "Choose target endpoint…"
                        : "No endpoints defined on this service"
                      : "Select a service first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="none"
                  className="text-xs text-muted-foreground"
                >
                  None
                </SelectItem>
                {availableEndpoints.map((ep) => (
                  <SelectItem key={ep.id} value={ep.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getMethodColor(ep.type || "GET")}`}
                      >
                        {ep.type || "GET"}
                      </span>
                      <span className="font-mono">{ep.name || ep.id}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active Connection Badge */}
          {linkedTargetNode && endpoint && (
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Connected Endpoint
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="secondary"
                  className="text-[10px] gap-1 px-2 py-0.5 font-medium"
                >
                  <Server size={9} />
                  {linkedTargetNode.data.label}
                </Badge>
                <span className="text-muted-foreground text-xs">→</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] gap-1 px-2 py-0.5 border font-mono ${getMethodColor(endpoint.type || "GET")}`}
                >
                  <span className="font-bold not-italic">
                    {endpoint.type || "GET"}
                  </span>
                  {endpoint.name}
                </Badge>
              </div>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

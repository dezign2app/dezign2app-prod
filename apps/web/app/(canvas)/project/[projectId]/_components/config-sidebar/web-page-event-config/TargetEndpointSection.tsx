import React, { useState } from "react";
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
import { Button } from "@workspace/ui/components/button";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint, EndpointWithNode } from "@workspace/canvas";
import {
  Server,
  Route,
  CheckCircle2,
  Info,
  Plus,
  Trash2,
  UploadCloud,
  Layers,
  ArrowRight,
} from "lucide-react";

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

export interface ActionStepItem {
  step: number;
  label: string;
  edgeId: string;
  targetNodeId: string;
  targetNode?: BackendNode;
  endpointId?: string;
  endpoint?: Endpoint;
  isStorageRef?: boolean;
  operationName?: string;
  bucketName?: string;
  edge: BackendEdge;
}

export interface TargetEndpointSectionProps {
  steps?: ActionStepItem[];
  currentServiceId: string;
  currentEndpointId: string;
  serviceNodes: BackendNode[];
  availableEndpoints: Endpoint[];
  linkedTargetNode: BackendNode | null | undefined;
  endpoint: Endpoint | null | undefined;
  allEndpoints?: EndpointWithNode[];
  getServiceEndpoints?: (serviceNode: BackendNode) => Endpoint[];
  handleServiceChange: (serviceId: string) => void;
  handleEndpointChange: (endpointId: string) => void;
  onAddStep?: (serviceId: string, endpointId: string) => void;
  onUpdateStep?: (
    edgeId: string,
    serviceId: string,
    endpointId: string,
  ) => void;
  onDeleteStep?: (edgeId: string) => void;
}

export const TargetEndpointSection: React.FC<TargetEndpointSectionProps> = ({
  steps = [],
  currentServiceId,
  currentEndpointId,
  serviceNodes,
  availableEndpoints,
  linkedTargetNode,
  endpoint,
  allEndpoints = [],
  getServiceEndpoints,
  handleServiceChange,
  handleEndpointChange,
  onAddStep,
  onUpdateStep,
  onDeleteStep,
}) => {
  const [showAddStep, setShowAddStep] = useState(false);
  const [addServiceId, setAddServiceId] = useState<string>("");
  const [addEndpointId, setAddEndpointId] = useState<string>("");

  const resolveServiceEndpoints = (sn?: BackendNode | null): Endpoint[] => {
    if (!sn) return [];
    if (getServiceEndpoints) return getServiceEndpoints(sn);
    const persisted = allEndpoints.filter(
      (ep) => ep.nodeId === sn.id,
    );
    const results: Endpoint[] = [...persisted];
    if (sn.data?.endpoints) {
      for (const ep of sn.data.endpoints) {
        if (!results.find((r) => r.id === ep.id)) results.push(ep);
      }
    }
    if (sn.data?.routeGroups) {
      for (const group of sn.data.routeGroups) {
        for (const ep of group.endpoints || []) {
          if (!results.find((r) => r.id === ep.id)) results.push(ep);
        }
      }
    }
    return results;
  };

  const addServiceNode = serviceNodes.find((sn) => sn.id === addServiceId);
  const addAvailableEndpoints = resolveServiceEndpoints(addServiceNode);

  const handleAddStepSubmit = () => {
    if (!addServiceId || !addEndpointId || !onAddStep) return;
    onAddStep(addServiceId, addEndpointId);
    setAddServiceId("");
    setAddEndpointId("");
    setShowAddStep(false);
  };

  const hasMultiSteps = steps.length > 0;

  return (
    <AccordionItem
      value="connection"
      className="border rounded-xl overflow-hidden bg-card"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/20 transition-colors [&>svg]:shrink-0">
        <div className="flex items-center gap-2">
          <Server size={14} className="text-primary" />
          <span className="text-xs font-semibold">
            {hasMultiSteps && steps.length > 1
              ? `Action Flow (${steps.length} Steps)`
              : "Target Service & Endpoint"}
          </span>
          {hasMultiSteps && steps.length > 1 && (
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0 font-mono"
            >
              Multi-step
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-5 pt-2">
        <div className="flex flex-col gap-4">
          {hasMultiSteps ? (
            /* Render Ordered Step Cards */
            <div className="flex flex-col gap-3">
              {steps.map((st) => {
                const isStorage = Boolean(st.isStorageRef);
                const stepServiceEndpoints = resolveServiceEndpoints(
                  st.targetNode,
                );

                return (
                  <div
                    key={st.edgeId}
                    className="flex flex-col gap-2.5 p-3 rounded-lg border bg-secondary/15 transition-all"
                  >
                    {/* Step Card Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                          {st.label}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          {isStorage
                            ? "Step " + st.label + ": Direct Storage Upload"
                            : "Step " + st.label + ": Service Endpoint"}
                        </span>
                      </div>
                      {onDeleteStep && (
                        <button
                          type="button"
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          onClick={() => onDeleteStep(st.edgeId)}
                          title="Remove this step"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    {isStorage ? (
                      /* Storage Bucket Ref step presentation */
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="secondary"
                            className="text-[10px] gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-medium"
                          >
                            <UploadCloud size={11} />
                            🪣 {st.bucketName || "Bucket"} Ref
                          </Badge>
                          <span className="text-muted-foreground text-xs">
                            ›
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-foreground">
                            {st.operationName}()
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold font-mono"
                          >
                            PUT
                          </Badge>
                        </div>
                        <div className="p-2 rounded bg-amber-500/5 border border-amber-500/20 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
                          <Info
                            size={12}
                            className="text-amber-500 shrink-0 mt-0.5"
                          />
                          <span>
                            Executes <strong>PUT /&lt;presignedUrl&gt;</strong>{" "}
                            directly to storage with the file payload using the
                            upload URL returned from Step 1.
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Service Endpoint step presentation */
                      <div className="flex flex-col gap-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Service Selector for this step */}
                          <div className="flex flex-col gap-1">
                            <Label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                              Service
                            </Label>
                            <Select
                              value={st.targetNodeId}
                              onValueChange={(newServiceId) => {
                                if (onUpdateStep && newServiceId !== "none") {
                                  const targetSn = serviceNodes.find(
                                    (sn) => sn.id === newServiceId,
                                  );
                                  const eps = resolveServiceEndpoints(targetSn);
                                  const defaultEpId = eps[0]?.id || "";
                                  onUpdateStep(
                                    st.edgeId,
                                    newServiceId,
                                    defaultEpId,
                                  );
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs bg-background">
                                <SelectValue placeholder="Choose service…" />
                              </SelectTrigger>
                              <SelectContent>
                                {serviceNodes.map((sn) => (
                                  <SelectItem
                                    key={sn.id}
                                    value={sn.id}
                                    className="text-xs"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[8px] font-bold uppercase text-muted-foreground bg-secondary px-1 py-0.2 rounded">
                                        {sn.type}
                                      </span>
                                      <span>
                                        {sn.data.label || "Untitled Service"}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Endpoint Selector for this step */}
                          <div className="flex flex-col gap-1">
                            <Label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                              Endpoint
                            </Label>
                            <Select
                              value={st.endpointId || "none"}
                              onValueChange={(newEpId) => {
                                if (
                                  onUpdateStep &&
                                  newEpId !== "none" &&
                                  st.targetNodeId
                                ) {
                                  onUpdateStep(
                                    st.edgeId,
                                    st.targetNodeId,
                                    newEpId,
                                  );
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs bg-background">
                                <SelectValue placeholder="Choose endpoint…" />
                              </SelectTrigger>
                              <SelectContent>
                                {stepServiceEndpoints.map((ep) => (
                                  <SelectItem
                                    key={ep.id}
                                    value={ep.id}
                                    className="text-xs"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`text-[8px] font-bold px-1 py-0.2 rounded border ${getMethodColor(ep.type || "GET")}`}
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
                        </div>

                        {st.targetNode && st.endpoint && (
                          <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground pt-0.5">
                            <Badge
                              variant="secondary"
                              className="text-[9px] gap-1 px-1.5 py-0.5 font-medium"
                            >
                              <Server size={9} />
                              {st.targetNode.data?.label || "Service"}
                            </Badge>
                            <ArrowRight size={10} />
                            <Badge
                              variant="outline"
                              className={`text-[9px] gap-1 px-1.5 py-0.5 border font-mono ${getMethodColor(st.endpoint.type || "GET")}`}
                            >
                              <span className="font-bold">
                                {st.endpoint.type || "GET"}
                              </span>
                              {st.endpoint.name}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Step Action */}
              {onAddStep && (
                <div className="mt-1">
                  {!showAddStep ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-xs gap-1.5 border-dashed text-muted-foreground hover:text-foreground"
                      onClick={() => setShowAddStep(true)}
                    >
                      <Plus size={12} />
                      Add Step to Action
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-2.5 p-3 rounded-lg border border-dashed bg-secondary/10">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                          <Plus size={11} />
                          Add Step {steps.length + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-1.5 text-muted-foreground"
                          onClick={() => {
                            setShowAddStep(false);
                            setAddServiceId("");
                            setAddEndpointId("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <Label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                            Target Service
                          </Label>
                          <Select
                            value={addServiceId}
                            onValueChange={(val) => {
                              setAddServiceId(val);
                              const sn = serviceNodes.find((n) => n.id === val);
                              const eps = resolveServiceEndpoints(sn);
                              setAddEndpointId(eps[0]?.id || "");
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs bg-background">
                              <SelectValue placeholder="Choose service…" />
                            </SelectTrigger>
                            <SelectContent>
                              {serviceNodes.map((sn) => (
                                <SelectItem
                                  key={sn.id}
                                  value={sn.id}
                                  className="text-xs"
                                >
                                  {sn.data.label || "Untitled Service"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                            Target Endpoint
                          </Label>
                          <Select
                            value={addEndpointId}
                            onValueChange={setAddEndpointId}
                            disabled={!addServiceId}
                          >
                            <SelectTrigger className="h-8 text-xs bg-background disabled:opacity-50">
                              <SelectValue
                                placeholder={
                                  addServiceId
                                    ? addAvailableEndpoints.length > 0
                                      ? "Choose endpoint…"
                                      : "No endpoints"
                                    : "Select service first"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {addAvailableEndpoints.map((ep) => (
                                <SelectItem
                                  key={ep.id}
                                  value={ep.id}
                                  className="text-xs"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`text-[8px] font-bold px-1 py-0.2 rounded border ${getMethodColor(ep.type || "GET")}`}
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
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        className="text-xs gap-1.5 h-8 mt-1"
                        disabled={!addServiceId || !addEndpointId}
                        onClick={handleAddStepSubmit}
                      >
                        <Plus size={12} />
                        Confirm Step {steps.length + 1}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Single Target Initial Configuration (0 steps) */
            <>
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
            </>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

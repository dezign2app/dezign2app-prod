import React from "react";
import { Plus, Trash2, Globe, Server, ArrowRight } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type {
  ApiCallStepProps,
  FrontendRequestFieldBinding,
  FrontendFieldSource,
} from "./types";
import { ResponseFieldPicker } from "./ResponseFieldPicker";
import { ensureActionServiceConnection } from "./actionStepCanvasSync";

type SourceKindOption = "user_input" | "state_var" | "literal" | "prev_response";

export const ApiCallStep: React.FC<ApiCallStepProps> = ({
  draft,
  canvasStep,
  stepIndex,
  allSteps,
  allCanvasSteps,
  serviceNodes = [],
  allNodes = [],
  endpoints = [],
  webPageNodeId,
  actionId,
  onChange,
}) => {
  const bindings = draft.requestBindings || [];
  const priorSteps = allSteps.slice(0, stepIndex);

  // Available services: either passed serviceNodes or filtered from allNodes
  const availableServices =
    serviceNodes.length > 0
      ? serviceNodes
      : allNodes.filter(
          (n) =>
            n.type === "service" ||
            n.type === "api_gateway" ||
            n.type === "serverless" ||
            n.type === "worker",
        );

  const currentServiceId = draft.serviceNodeId || canvasStep?.targetNodeId || "";
  const currentEndpointId = draft.endpointId || canvasStep?.endpointId || "";

  // Available endpoints for the currently selected service
  const serviceEndpoints = endpoints.filter(
    (ep) => ep.nodeId === currentServiceId,
  );

  const handleServiceSelect = (newServiceId: string) => {
    const eps = endpoints.filter((ep) => ep.nodeId === newServiceId);
    const defaultEpId = eps[0]?.id || "";

    let newEdgeId: string | undefined;
    if (webPageNodeId && actionId && defaultEpId) {
      newEdgeId = ensureActionServiceConnection({
        webPageNodeId,
        actionId,
        serviceNodeId: newServiceId,
        endpointId: defaultEpId,
        stepOrder: stepIndex + 1,
      });
    }

    onChange({
      ...draft,
      serviceNodeId: newServiceId,
      endpointId: defaultEpId,
      edgeId: newEdgeId || draft.edgeId,
    });
  };

  const handleEndpointSelect = (newEndpointId: string) => {
    let newEdgeId: string | undefined;
    if (webPageNodeId && actionId && currentServiceId) {
      newEdgeId = ensureActionServiceConnection({
        webPageNodeId,
        actionId,
        serviceNodeId: currentServiceId,
        endpointId: newEndpointId,
        stepOrder: stepIndex + 1,
      });
    }

    onChange({
      ...draft,
      endpointId: newEndpointId,
      edgeId: newEdgeId || draft.edgeId,
    });
  };

  const handleAddBinding = () => {
    const newBinding: FrontendRequestFieldBinding = {
      id: `bind-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      targetField: "",
      source: { kind: "user_input", fieldName: "" },
    };
    onChange({
      ...draft,
      requestBindings: [...bindings, newBinding],
    });
  };

  const handleUpdateBinding = (
    bindingId: string,
    updater: (prev: FrontendRequestFieldBinding) => FrontendRequestFieldBinding,
  ) => {
    const next = bindings.map((b) => (b.id === bindingId ? updater(b) : b));
    onChange({
      ...draft,
      requestBindings: next,
    });
  };

  const handleDeleteBinding = (bindingId: string) => {
    const next = bindings.filter((b) => b.id !== bindingId);
    onChange({
      ...draft,
      requestBindings: next,
    });
  };

  const handleKindChange = (
    bindingId: string,
    newKind: SourceKindOption,
  ) => {
    handleUpdateBinding(bindingId, (b) => {
      let nextSource: FrontendFieldSource;
      if (newKind === "literal") {
        nextSource = { kind: "literal", value: "" };
      } else if (newKind === "state_var") {
        nextSource = { kind: "state_var", stateKey: "" };
      } else if (newKind === "prev_response") {
        const firstPrior = priorSteps[0];
        nextSource = {
          kind: "prev_response",
          stepId: firstPrior?.id || "",
          fieldPath: "",
        };
      } else {
        nextSource = { kind: "user_input", fieldName: "" };
      }
      return { ...b, source: nextSource };
    });
  };

  return (
    <div className="space-y-3 pt-1 text-xs">
      {/* Target Service & Endpoint Selection */}
      <div className="p-2.5 rounded-lg border bg-secondary/15 space-y-2">
        <div className="flex items-center gap-1.5 font-medium text-foreground text-[11px]">
          <Server size={13} className="text-primary" />
          <span>Target Service & Endpoint (Auto-Draws Canvas Edge)</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Service Node
            </Label>
            <Select
              value={currentServiceId}
              onValueChange={handleServiceSelect}
            >
              <SelectTrigger className="h-7 text-xs bg-background">
                <SelectValue placeholder="Select target service" />
              </SelectTrigger>
              <SelectContent>
                {availableServices.map((sn) => (
                  <SelectItem key={sn.id} value={sn.id}>
                    {sn.data?.label || sn.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Endpoint
            </Label>
            <Select
              value={currentEndpointId}
              onValueChange={handleEndpointSelect}
              disabled={!currentServiceId}
            >
              <SelectTrigger className="h-7 text-xs bg-background">
                <SelectValue placeholder="Select endpoint" />
              </SelectTrigger>
              <SelectContent>
                {serviceEndpoints.map((ep) => (
                  <SelectItem key={ep.id} value={ep.id}>
                    [{ep.type || "POST"}] {ep.name || ep.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Request Field Bindings */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-xs font-semibold text-foreground">
            Request Field Bindings
          </span>
          <p className="text-[11px] text-muted-foreground">
            Map data from user input, state, or previous responses into request
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddBinding}
          className="h-7 text-[11px] px-2 flex items-center gap-1 border-dashed"
        >
          <Plus size={12} />
          Add Field
        </Button>
      </div>

      {bindings.length === 0 ? (
        <div className="p-3 border border-dashed rounded-md bg-muted/20 text-center">
          <p className="text-xs text-muted-foreground">
            No field bindings configured. Default payload will be forwarded.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {bindings.map((binding, bIdx) => {
            const kind = binding.source.kind;
            return (
              <div
                key={binding.id || bIdx}
                className="p-2.5 rounded-md border bg-card/60 space-y-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label className="text-[10px] text-muted-foreground">
                      Request Field Name
                    </Label>
                    <Input
                      value={binding.targetField}
                      onChange={(e) =>
                        handleUpdateBinding(binding.id, (prev) => ({
                          ...prev,
                          targetField: e.target.value,
                        }))
                      }
                      placeholder="e.g. userId, fileKey, query"
                      className="h-7 text-xs bg-background"
                    />
                  </div>
                  <div className="w-36">
                    <Label className="text-[10px] text-muted-foreground">
                      Source Type
                    </Label>
                    <Select
                      value={kind}
                      onValueChange={(val: SourceKindOption) =>
                        handleKindChange(binding.id, val)
                      }
                    >
                      <SelectTrigger className="h-7 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user_input">User Input</SelectItem>
                        <SelectItem value="state_var">State Var</SelectItem>
                        <SelectItem value="literal">Static Value</SelectItem>
                        {priorSteps.length > 0 && (
                          <SelectItem value="prev_response">
                            Prior Response
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBinding(binding.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive self-end"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>

                {/* Source details input */}
                <div className="pt-1">
                  {binding.source.kind === "literal" && (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Literal Value
                      </Label>
                      <Input
                        value={binding.source.value}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleUpdateBinding(binding.id, (prev) => ({
                            ...prev,
                            source: { kind: "literal", value: val },
                          }));
                        }}
                        placeholder="Static string value"
                        className="h-7 text-xs bg-background"
                      />
                    </div>
                  )}

                  {binding.source.kind === "state_var" && (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        State Variable Key
                      </Label>
                      <Input
                        value={binding.source.stateKey}
                        onChange={(e) => {
                          const key = e.target.value;
                          handleUpdateBinding(binding.id, (prev) => ({
                            ...prev,
                            source: { kind: "state_var", stateKey: key },
                          }));
                        }}
                        placeholder="e.g. currentUser, selectedItem"
                        className="h-7 text-xs bg-background font-mono"
                      />
                    </div>
                  )}

                  {binding.source.kind === "user_input" && (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Form Field / Input Name
                      </Label>
                      <Input
                        value={binding.source.fieldName}
                        onChange={(e) => {
                          const name = e.target.value;
                          handleUpdateBinding(binding.id, (prev) => ({
                            ...prev,
                            source: { kind: "user_input", fieldName: name },
                          }));
                        }}
                        placeholder="e.g. email, file, query"
                        className="h-7 text-xs bg-background"
                      />
                    </div>
                  )}

                  {binding.source.kind === "prev_response" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          From Step
                        </Label>
                        <Select
                          value={binding.source.stepId}
                          onValueChange={(val) => {
                            handleUpdateBinding(binding.id, (prev) => ({
                              ...prev,
                              source: {
                                kind: "prev_response",
                                stepId: val,
                                fieldPath:
                                  prev.source.kind === "prev_response"
                                    ? prev.source.fieldPath
                                    : "",
                              },
                            }));
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs bg-background">
                            <SelectValue placeholder="Select step" />
                          </SelectTrigger>
                          <SelectContent>
                            {priorSteps.map((pStep, pIdx) => (
                              <SelectItem key={pStep.id} value={pStep.id}>
                                Step {pIdx + 1}: {pStep.name || pStep.type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          Response Field Path
                        </Label>
                        <ResponseFieldPicker
                          value={binding.source.fieldPath}
                          onChange={(val) => {
                            handleUpdateBinding(binding.id, (prev) => ({
                              ...prev,
                              source: {
                                kind: "prev_response",
                                stepId:
                                  prev.source.kind === "prev_response"
                                    ? prev.source.stepId
                                    : priorSteps[0]?.id || "",
                                fieldPath: val,
                              },
                            }));
                          }}
                          placeholder="e.g. data.id or token"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { StepNodeData } from "@workspace/canvas";
import { InspectorSidebar } from "../../InspectorSidebar";
import { InspectorTabContent } from "../InspectorTabContent";

const dummyStepData: StepNodeData = {
  label: "Test Step",
  stepId: "step-1",
  stepType: "custom_code",
};

describe("Inspector Close Buttons", () => {
  it("renders close button in InspectorTabContent and calls onClose on click", () => {
    const handleClose = vi.fn();

    render(
      <InspectorTabContent
        selectedStepData={dummyStepData}
        onDeleteStep={vi.fn()}
        onUpdateStep={vi.fn()}
        stateChannels={[]}
        onClose={handleClose}
      />,
    );

    const closeButton = screen.getByRole("button", {
      name: /close inspector/i,
    });
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders floating close button in InspectorSidebar and calls onClose on click", () => {
    const handleClose = vi.fn();

    render(
      <InspectorSidebar
        selectedNodeId="step-1"
        selectedStepData={dummyStepData}
        onDeleteStep={vi.fn()}
        onUpdateStep={vi.fn()}
        stateChannels={[]}
        onClose={handleClose}
      />,
    );

    const sidebarCloseButton = screen.getByRole("button", {
      name: /close inspector sidebar/i,
    });
    expect(sidebarCloseButton).toBeInTheDocument();

    fireEvent.click(sidebarCloseButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose in InspectorSidebar when Escape key is pressed", () => {
    const handleClose = vi.fn();

    render(
      <InspectorSidebar
        selectedNodeId="step-1"
        selectedStepData={dummyStepData}
        onDeleteStep={vi.fn()}
        onUpdateStep={vi.fn()}
        stateChannels={[]}
        onClose={handleClose}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when selectedNodeId is null", () => {
    const { container } = render(
      <InspectorSidebar
        selectedNodeId={null}
        selectedStepData={dummyStepData}
        onDeleteStep={vi.fn()}
        onUpdateStep={vi.fn()}
        stateChannels={[]}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});

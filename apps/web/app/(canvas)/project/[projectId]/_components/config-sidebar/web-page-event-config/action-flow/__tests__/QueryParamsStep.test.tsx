import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { BackendNode } from "@workspace/canvas";
import { QueryParamsStep } from "../QueryParamsStep";
import { createDefaultFrontendStep } from "../frontendStepFactory";
import { formatStepCodePreview } from "../FrontendStepRowHeader";
import { getActionFlowRuntime } from "../utils";
import type { FrontendActionStepDraft } from "../types";

interface MockPopoverProps {
  children?: React.ReactNode;
  open?: boolean;
}

interface MockPopoverSubProps {
  children?: React.ReactNode;
}

interface MockSelectProps {
  children?: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}

interface MockSelectSubProps {
  children?: React.ReactNode;
}

interface MockSelectValueProps {
  placeholder?: string;
}

interface MockSelectItemProps {
  children?: React.ReactNode;
  value?: string;
}

vi.mock("@workspace/ui/components/popover", () => ({
  Popover: ({ children, open }: MockPopoverProps) => (
    <div data-testid="mock-popover" data-open={open}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: MockPopoverSubProps) => <>{children}</>,
  PopoverContent: ({ children }: MockPopoverSubProps) => (
    <div data-testid="mock-popover-content">{children}</div>
  ),
}));

vi.mock("@workspace/ui/components/select", () => ({
  Select: ({ children, value, onValueChange }: MockSelectProps) => (
    <div
      data-testid="mock-select"
      data-value={value}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        const element = e.target;
        if (element instanceof HTMLElement) {
          const target = element.closest("[data-value]");
          if (target && onValueChange) {
            const val = target.getAttribute("data-value");
            if (val !== null) {
              onValueChange(val);
            }
          }
        }
      }}
    >
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: MockSelectSubProps) => (
    <button type="button">{children}</button>
  ),
  SelectValue: ({ placeholder }: MockSelectValueProps) => <span>{placeholder}</span>,
  SelectContent: ({ children }: MockSelectSubProps) => <div>{children}</div>,
  SelectGroup: ({ children }: MockSelectSubProps) => <div>{children}</div>,
  SelectLabel: ({ children }: MockSelectSubProps) => <div>{children}</div>,
  SelectSeparator: () => <hr />,
  SelectItem: ({ children, value }: MockSelectItemProps) => (
    <div data-testid="select-item" data-value={value}>
      {children}
    </div>
  ),
}));

describe("Update Query Params Action Step", () => {
  const dummyPageNode: BackendNode = {
    id: "page-1",
    type: "webPage",
    position: { x: 0, y: 0 },
    fractionalIndex: "a0",
    data: {
      label: "/dashboard",
      queryParams: [
        { id: "q1", name: "tab", type: "string", required: false },
        { id: "q2", name: "page", type: "number", required: false },
        { id: "q3", name: "filter", type: "string", required: false },
      ],
      pathParams: [{ id: "p1", name: "id", type: "string", required: false }],
    },
  };

  it("creates a valid default update_query_params draft", () => {
    const draft = createDefaultFrontendStep("update_query_params", 1);
    expect(draft.type).toBe("update_query_params");
    expect(draft.order).toBe(1);
    expect(draft.queryParamMode).toBe("set");
    expect(draft.queryParamNavMode).toBe("replace");
    expect(draft.queryParamScroll).toBe(false);
    expect(draft.queryParamValueSource?.kind).toBe("literal");
    expect(draft.queryParamsUpdates).toBeDefined();
    expect(draft.queryParamsUpdates?.length).toBe(1);
  });

  it("formats inline code preview properly for set, remove, and toggle", () => {
    const setDraft: FrontendActionStepDraft = {
      id: "step-1",
      order: 1,
      type: "update_query_params",
      queryParamKey: "tab",
      queryParamMode: "set",
      queryParamNavMode: "replace",
      queryParamValueSource: { kind: "literal", value: "analytics" },
    };
    expect(formatStepCodePreview(setDraft, [dummyPageNode], [])).toBe(
      'queryParams.set("tab", "analytics") (replace)',
    );

    const removeDraft: FrontendActionStepDraft = {
      id: "step-2",
      order: 2,
      type: "update_query_params",
      queryParamKey: "filter",
      queryParamMode: "remove",
      queryParamNavMode: "push",
    };
    expect(formatStepCodePreview(removeDraft, [dummyPageNode], [])).toBe(
      'queryParams.delete("filter") (push)',
    );

    const toggleDraft: FrontendActionStepDraft = {
      id: "step-3",
      order: 3,
      type: "update_query_params",
      queryParamKey: "drawer",
      queryParamMode: "toggle",
      queryParamNavMode: "replace",
    };
    expect(formatStepCodePreview(toggleDraft, [dummyPageNode], [])).toBe(
      'queryParams.toggle("drawer") (replace)',
    );
  });

  it("formats inline code preview properly for multiple batch query parameters", () => {
    const multiDraft: FrontendActionStepDraft = {
      id: "step-batch",
      order: 1,
      type: "update_query_params",
      queryParamNavMode: "replace",
      queryParamsUpdates: [
        {
          key: "limit",
          mode: "set",
          valueSource: { kind: "literal", value: "25" },
        },
        {
          key: "offset",
          mode: "set",
          valueSource: { kind: "literal", value: "50" },
        },
      ],
    };

    expect(formatStepCodePreview(multiDraft, [dummyPageNode], [])).toBe(
      "queryParams.update(2 params: limit, offset) (replace)",
    );
  });

  it("renders QueryParamsStep with page query param suggestions and handles key update", () => {
    const draft: FrontendActionStepDraft = {
      id: "step-1",
      order: 1,
      type: "update_query_params",
      queryParamKey: "tab",
      queryParamMode: "set",
      queryParamNavMode: "replace",
      queryParamValueSource: { kind: "literal", value: "overview" },
      queryParamsUpdates: [
        {
          key: "tab",
          mode: "set",
          valueSource: { kind: "literal", value: "overview" },
        },
      ],
    };
    const handleChange = vi.fn();

    render(
      <QueryParamsStep
        draft={draft}
        allSteps={[draft]}
        stepIndex={0}
        allNodes={[dummyPageNode]}
        webPageNodeId="page-1"
        onChange={handleChange}
      />,
    );

    expect(screen.getByText("Parameter Key")).toBeDefined();
    expect(screen.getByText("Source / Action")).toBeDefined();
    expect(screen.getByText("Value")).toBeDefined();
    expect(screen.getByText("Browser History")).toBeDefined();

    // Change key input via Combobox input
    const keyInput = screen.getByPlaceholderText(
      "e.g. limit, page, tab, query",
    );
    fireEvent.change(keyInput, { target: { value: "category" } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        queryParamKey: "category",
        queryParamsUpdates: [
          {
            key: "category",
            mode: "set",
            valueSource: { kind: "literal", value: "overview" },
          },
        ],
      }),
    );
  });

  it("updates literal value on change", () => {
    const draft: FrontendActionStepDraft = {
      id: "step-1",
      order: 1,
      type: "update_query_params",
      queryParamKey: "tab",
      queryParamMode: "set",
      queryParamNavMode: "replace",
      queryParamValueSource: { kind: "literal", value: "overview" },
      queryParamsUpdates: [
        {
          key: "tab",
          mode: "set",
          valueSource: { kind: "literal", value: "overview" },
        },
      ],
    };
    const handleChange = vi.fn();

    render(
      <QueryParamsStep
        draft={draft}
        allSteps={[draft]}
        stepIndex={0}
        allNodes={[dummyPageNode]}
        webPageNodeId="page-1"
        onChange={handleChange}
      />,
    );

    const valueInput = screen.getByPlaceholderText("e.g. details, active, 1");
    fireEvent.change(valueInput, { target: { value: "settings" } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        queryParamValueSource: { kind: "literal", value: "settings" },
        queryParamsUpdates: [
          {
            key: "tab",
            mode: "set",
            valueSource: { kind: "literal", value: "settings" },
          },
        ],
      }),
    );
  });

  it("adds and updates batch query parameters", () => {
    const draft: FrontendActionStepDraft = {
      id: "step-1",
      order: 1,
      type: "update_query_params",
      queryParamKey: "tab",
      queryParamMode: "set",
      queryParamsUpdates: [
        {
          key: "tab",
          mode: "set",
          valueSource: { kind: "literal", value: "overview" },
        },
      ],
    };
    const handleChange = vi.fn();

    render(
      <QueryParamsStep
        draft={draft}
        allSteps={[draft]}
        stepIndex={0}
        allNodes={[dummyPageNode]}
        webPageNodeId="page-1"
        onChange={handleChange}
      />,
    );

    const addBtn = screen.getByText("Add Parameter");
    fireEvent.click(addBtn);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        queryParamsUpdates: [
          {
            key: "tab",
            mode: "set",
            valueSource: { kind: "literal", value: "overview" },
          },
          {
            key: "",
            mode: "set",
            valueSource: { kind: "literal", value: "" },
          },
        ],
      }),
    );
  });

  it("removes a query parameter from the list", () => {
    const draft: FrontendActionStepDraft = {
      id: "step-1",
      order: 1,
      type: "update_query_params",
      queryParamKey: "limit",
      queryParamMode: "set",
      queryParamsUpdates: [
        {
          key: "limit",
          mode: "set",
          valueSource: { kind: "literal", value: "20" },
        },
        {
          key: "offset",
          mode: "set",
          valueSource: { kind: "literal", value: "40" },
        },
      ],
    };
    const handleChange = vi.fn();

    render(
      <QueryParamsStep
        draft={draft}
        allSteps={[draft]}
        stepIndex={0}
        allNodes={[dummyPageNode]}
        webPageNodeId="page-1"
        onChange={handleChange}
      />,
    );

    const deleteButtons = screen.getAllByTitle("Remove parameter");
    expect(deleteButtons.length).toBe(2);

    // Remove the second parameter (offset)
    const targetButton = deleteButtons[1];
    if (!targetButton) {
      throw new Error("Expected second delete button to exist");
    }
    fireEvent.click(targetButton);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        queryParamsUpdates: [
          {
            key: "limit",
            mode: "set",
            valueSource: { kind: "literal", value: "20" },
          },
        ],
      }),
    );
  });

  it("formats runtime execution plan for single and multiple parameters", () => {
    const singleDraft: FrontendActionStepDraft = {
      id: "step-1",
      order: 1,
      type: "update_query_params",
      queryParamKey: "tab",
      queryParamMode: "set",
      queryParamNavMode: "replace",
      queryParamScroll: false,
      queryParamValueSource: { kind: "literal", value: "settings" },
    };

    const singleRuntime = getActionFlowRuntime(
      { id: "act-1", name: "onTabClick" },
      [],
      [singleDraft],
    );

    expect(singleRuntime).toContain("Runtime execution plan for: onTabClick");
    expect(singleRuntime).toContain(
      '[UPDATE QUERY PARAMS] SET "tab" = "settings" (replace, scroll: false)',
    );

    const batchDraft: FrontendActionStepDraft = {
      id: "step-2",
      order: 2,
      type: "update_query_params",
      queryParamNavMode: "push",
      queryParamScroll: true,
      queryParamsUpdates: [
        {
          key: "page",
          mode: "set",
          valueSource: { kind: "literal", value: "2" },
        },
        {
          key: "filter",
          mode: "remove",
        },
      ],
    };

    const batchRuntime = getActionFlowRuntime(
      { id: "act-2", name: "onFilterChange" },
      [],
      [batchDraft],
    );

    expect(batchRuntime).toContain(
      '[UPDATE QUERY PARAMS] (SET "page" = "2", REMOVE "filter") (push, scroll: true)',
    );
  });
});

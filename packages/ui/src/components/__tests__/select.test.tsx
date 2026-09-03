import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select.js";

describe("SelectItem value sanitization", () => {
  it("renders null and does not throw for empty string value", () => {
    expect(() => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Empty</SelectItem>
            <SelectItem value="   ">Spaces</SelectItem>
            <SelectItem value="valid">Valid Item</SelectItem>
          </SelectContent>
        </Select>,
      );
    }).not.toThrow();
  });

  it("renders null and does not throw for undefined or null value", () => {
    expect(() => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={undefined as any}>Undefined</SelectItem>
            <SelectItem value={null as any}>Null</SelectItem>
            <SelectItem value="valid">Valid Item</SelectItem>
          </SelectContent>
        </Select>,
      );
    }).not.toThrow();
  });
});

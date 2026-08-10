import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the workstation title", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Chip Sim Workstation" })).toBeVisible();
  });
});

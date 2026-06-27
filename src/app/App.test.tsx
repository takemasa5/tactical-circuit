import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App.tsx";

describe("App", () => {
  it("displays the application name", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Tactical Circuit" }),
    ).toBeInTheDocument();
  });
});

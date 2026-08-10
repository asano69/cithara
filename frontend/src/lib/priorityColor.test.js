import { describe, it, expect } from "vitest";
import { priorityToHsl } from "./priorityColor";

describe("priorityToHsl", () => {
  it("returns gray at priority 0", () => {
    expect(priorityToHsl(0)).toBe("hsl(210.0, 0.0%, 60.0%)");
  });

  it("stays gray up to priority 3", () => {
    expect(priorityToHsl(1)).toBe("hsl(210.0, 0.0%, 60.0%)");
    expect(priorityToHsl(3)).toBe("hsl(210.0, 0.0%, 60.0%)");
  });

  it("returns yellow at priority 6", () => {
    expect(priorityToHsl(6)).toBe("hsl(45.0, 90.0%, 55.0%)");
  });

  it("returns red at priority 10", () => {
    expect(priorityToHsl(10)).toBe("hsl(0.0, 75.0%, 50.0%)");
  });

  it("interpolates between the gray and yellow stops", () => {
    // Halfway between the gray (3) and yellow (6) stops.
    expect(priorityToHsl(4.5)).toBe("hsl(127.5, 45.0%, 57.5%)");
  });

  it("interpolates between the yellow and red stops", () => {
    // Halfway between the yellow (6) and red (10) stops.
    expect(priorityToHsl(8)).toBe("hsl(22.5, 82.5%, 52.5%)");
  });

  it("clamps out-of-range values", () => {
    expect(priorityToHsl(-5)).toBe(priorityToHsl(0));
    expect(priorityToHsl(99)).toBe(priorityToHsl(10));
  });

  it("treats a missing priority as 0", () => {
    expect(priorityToHsl(undefined)).toBe(priorityToHsl(0));
  });
});

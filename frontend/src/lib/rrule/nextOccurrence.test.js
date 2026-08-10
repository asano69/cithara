import { describe, it, expect, vi, afterEach } from "vitest";
import { currentCycleUtcStrings } from "./nextOccurrence";

afterEach(() => {
  vi.useRealTimers();
});

describe("currentCycleUtcStrings", () => {
  it("returns null when dtstart or rrule is missing", () => {
    expect(currentCycleUtcStrings("", "FREQ=DAILY")).toBeNull();
    expect(currentCycleUtcStrings("20260101T090000Z", "")).toBeNull();
  });

  it("bounds the current cycle between the previous and next daily occurrence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T15:00:00Z"));

    const bounds = currentCycleUtcStrings(
      "20260101T090000Z",
      "FREQ=DAILY;INTERVAL=1",
    );

    expect(bounds.startUtc).toBe("20260105T090000Z");
    expect(bounds.endUtc).toBe("20260106T090000Z");
  });

  it("measures the interval forward when there is no occurrence before the first one", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-31T00:00:00Z"));

    const bounds = currentCycleUtcStrings(
      "20260101T090000Z",
      "FREQ=DAILY;INTERVAL=1",
    );

    // next occurrence is dtstart itself (Jan 1); no occurrence exists
    // before it, so the 1-day gap to the following occurrence (Jan 2) is
    // projected backwards to size the cycle.
    expect(bounds.startUtc).toBe("20251231T090000Z");
    expect(bounds.endUtc).toBe("20260101T090000Z");
  });

  it("uses the rule's true weekly interval even when dtstart is off-pattern", () => {
    // dtstart is a Monday, but the rule only fires on Tuesdays -- e.g.
    // right after the "shift to today" button moved dtstart off the
    // pattern. The cycle length must still be a full week, not the ~1 day
    // gap from dtstart to the first Tuesday.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T10:00:00Z")); // Monday

    const bounds = currentCycleUtcStrings(
      "20260810T090000Z", // Monday 09:00
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU",
    );

    expect(bounds.endUtc).toBe("20260811T090000Z"); // Tuesday (next)
    expect(bounds.startUtc).toBe("20260804T090000Z"); // Tuesday, 7 days earlier
  });

  it("returns null when there are no more occurrences", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));

    const bounds = currentCycleUtcStrings("20260101T090000Z", "FREQ=DAILY;COUNT=1");

    expect(bounds).toBeNull();
  });

  it("returns null for an unparsable rrule", () => {
    const bounds = currentCycleUtcStrings("20260101T090000Z", "NOT_VALID");
    expect(bounds).toBeNull();
  });
});

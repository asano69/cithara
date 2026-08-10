// Computes a note's next scheduled occurrence on the client, for display
// purposes only (e.g. Home.jsx's note cards). The actual notification
// firing is still driven by the Go scheduler; this just mirrors the same
// RRULE evaluation with rrule.js so the UI can show a human-readable next
// time without an extra request.
import { RRule } from "rrule";

// Converts a real Date instant back into the canonical "YYYYMMDDTHHMMSSZ"
// UTC string format used to store dtstart (see README).
function toUtcDtstartString(date) {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${mo}${d}T${h}${mi}${s}Z`;
}

// Returns the next occurrence at or after now for a note's dtstart/rrule
// pair, in the same canonical UTC string format as dtstart itself. Returns
// "" if the rule is invalid or has no more occurrences.
export function nextOccurrenceUtcString(dtstart, rrule) {
  if (!dtstart || !rrule) return "";
  try {
    const options = RRule.parseString(`DTSTART:${dtstart}\nRRULE:${rrule}`);
    const next = new RRule(options).after(new Date(), false);
    return next ? toUtcDtstartString(next) : "";
  } catch {
    return "";
  }
}

// Returns the bounds of the *current* cycle -- the start and end of the
// interval the progress bar should be showing -- as canonical UTC
// strings. `endUtc` is always the next actual occurrence. `startUtc` is
// derived by measuring the rule's true recurring interval rather than by
// assuming dtstart itself lies exactly one interval before `next`:
// dtstart may not align to the rule's pattern at all (e.g. right after
// the "shift to today" button moves it off-pattern), which would
// otherwise produce an artificially short first cycle. Returns null if
// the rule is invalid or has no more occurrences.
export function currentCycleUtcStrings(dtstart, rrule) {
  if (!dtstart || !rrule) return null;
  try {
    const options = RRule.parseString(`DTSTART:${dtstart}\nRRULE:${rrule}`);
    const rule = new RRule(options);
    const now = new Date();

    const next = rule.after(now, false);
    if (!next) return null; // no more occurrences: nothing to animate

    // Preferred: the occurrence immediately before `next` is a real
    // occurrence of the pattern, so the gap between them is the rule's
    // true interval (handles variable-length intervals like "monthly"
    // correctly too).
    const beforeNext = rule.before(next, false);

    let start;
    if (beforeNext) {
      start = beforeNext;
    } else {
      // No earlier occurrence exists yet (we're in the very first cycle,
      // before dtstart has produced any occurrence). Measure the
      // interval going forward instead, then project it backwards from
      // `next` -- this can land before dtstart, which is fine: it's only
      // used to size the cycle, not shown to the user directly.
      const afterNext = rule.after(next, false);
      start = afterNext
        ? new Date(next.getTime() - (afterNext.getTime() - next.getTime()))
        : options.dtstart; // only a single occurrence exists at all
    }

    return {
      startUtc: toUtcDtstartString(start),
      endUtc: toUtcDtstartString(next),
    };
  } catch {
    return null;
  }
}

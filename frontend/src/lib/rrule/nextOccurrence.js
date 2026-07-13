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

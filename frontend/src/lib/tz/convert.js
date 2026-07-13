// Pure UTC <-> naive wall-clock conversion for a given IANA timezone.
// No PocketBase dependency here on purpose, so this stays trivially
// unit-testable (see convert.test.js). The timezone itself is resolved
// elsewhere (see settings.js).

const UTC_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;
const NAIVE_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/;

// Converts a canonical UTC dtstart ("YYYYMMDDTHHMMSSZ") into a naive
// "YYYYMMDDTHHMMSS" wall-clock string in tzId, for display/editing.
// Non-matching input (empty, or an already-naive legacy record) is
// returned unchanged.
export function utcToLocal(utcStr, tzId) {
  const m = UTC_RE.exec(utcStr ?? "");
  if (!m) return utcStr ?? "";

  const [, y, mo, d, h, mi, s] = m;
  const instant = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  const p = partsInTz(instant, tzId);
  return `${p.year}${p.month}${p.day}T${p.hour}${p.minute}${p.second}`;
}

// Converts a naive "YYYYMMDDTHHMMSS" wall-clock string (interpreted in
// tzId) into a canonical UTC dtstart string, for saving.
export function localToUtc(naiveStr, tzId) {
  const m = NAIVE_RE.exec(naiveStr ?? "");
  if (!m) return naiveStr ?? "";

  const [, y, mo, d, h, mi, s] = m;
  const wanted = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);

  // JS has no "make an instant from wall-clock time in an arbitrary
  // timezone" primitive, so this guesses the instant, checks what wall
  // time it actually shows in tzId, and corrects by the difference.
  // One correction is enough except right at a DST transition, so it
  // iterates a couple of times to converge.
  let instant = new Date(wanted);
  for (let i = 0; i < 2; i++) {
    const p = partsInTz(instant, tzId);
    const shown = Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour,
      +p.minute,
      +p.second,
    );
    instant = new Date(instant.getTime() + (wanted - shown));
  }
  return formatUtc(instant);
}

function partsInTz(date, tzId) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tzId,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
}

function formatUtc(date) {
  const p = partsInTz(date, "UTC");
  return `${p.year}${p.month}${p.day}T${p.hour}${p.minute}${p.second}Z`;
}

// Formats a naive "YYYYMMDDTHHMMSS" wall-clock string for display, e.g.
// "2026/07/12 06:00".
export function formatNaive(naiveStr) {
  const m = NAIVE_RE.exec(naiveStr ?? "");
  if (!m) return "";
  const [, y, mo, d, h, mi] = m;
  return `${y}/${mo}/${d} ${h}:${mi}`;
}

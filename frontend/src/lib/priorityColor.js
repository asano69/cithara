// Maps a Gotify notification priority (0-10) to an HSL color for the
// priority indicator bar on each note card, so priority can be scanned
// at a glance. Colors are linearly interpolated between four fixed stops
// (gray -> blue -> yellow -> red) instead of sweeping the full hue wheel,
// so the low end stays a calm gray rather than passing through green/cyan.
const STOPS = [
  { priority: 0, hue: 210, saturation: 0, lightness: 60 }, // gray
  { priority: 3, hue: 210, saturation: 0, lightness: 60 }, // gray (flat through 3)
  { priority: 6, hue: 45, saturation: 90, lightness: 55 }, // yellow
  { priority: 10, hue: 0, saturation: 75, lightness: 50 }, // red
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Returns an "hsl(...)" string for the given priority. Values outside
// 0-10 are clamped; a missing/undefined priority is treated as 0.
export function priorityToHsl(priority) {
  const p = Math.min(10, Math.max(0, priority ?? 0));

  let lower = STOPS[0];
  let upper = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (p >= STOPS[i].priority && p <= STOPS[i + 1].priority) {
      lower = STOPS[i];
      upper = STOPS[i + 1];
      break;
    }
  }

  const span = upper.priority - lower.priority;
  const t = span === 0 ? 0 : (p - lower.priority) / span;

  const hue = lerp(lower.hue, upper.hue, t);
  const saturation = lerp(lower.saturation, upper.saturation, t);
  const lightness = lerp(lower.lightness, upper.lightness, t);

  return `hsl(${hue.toFixed(1)}, ${saturation.toFixed(1)}%, ${lightness.toFixed(1)}%)`;
}

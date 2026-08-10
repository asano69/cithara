// A single note's card on the Home page: label, countdown to the next
// occurrence, and the shift/edit actions. Split out of Home.jsx so the
// list container and the card rendering can be maintained independently.
import { createSignal, createMemo, onMount, onCleanup, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Tooltip } from "@kobalte/core/tooltip";
import { Progress } from "@kobalte/core/progress";
import Hourglass from "lucide-solid/icons/hourglass";
import { utcToLocal, formatNaive } from "../lib/tz";
import { nextOccurrenceUtcString, currentCycleUtcStrings } from "../lib/rrule";
import {
  formatRemaining,
  computeCycleRemainingFraction,
} from "../lib/noteSchedule";
import { priorityToHsl } from "../lib/priorityColor";

export default function NoteCard(props) {
  const [now, setNow] = createSignal(Date.now());
  onMount(() => {
    // Ticks every second. Both the remaining-time text and the progress
    // bar are recomputed off this same clock, so a cycle boundary (the
    // bar reaching 0%) is picked up on the very next tick -- no separate
    // timer or manual re-render trigger is needed.
    const intervalId = setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => clearInterval(intervalId));
  });

  const nextUtc = createMemo(() => {
    now();
    return nextOccurrenceUtcString(props.note.dtstart, props.note.rrule);
  });
  const remaining = createMemo(() => formatRemaining(nextUtc(), now()));

  // Bounds of the current cycle (previous occurrence -> next occurrence).
  // Recomputed every tick of `now` (and whenever the note itself changes,
  // e.g. via the shift buttons), so once `now` crosses the cycle's end
  // this naturally flips to the following cycle -- the bar returns to
  // 100% on its own.
  const cycle = createMemo(() => {
    now();
    return currentCycleUtcStrings(props.note.dtstart, props.note.rrule);
  });

  // Fraction of the current cycle remaining, from 1 (cycle just started)
  // down to 0 (next occurrence due now).
  const progress = createMemo(() => {
    const c = cycle();
    return c
      ? computeCycleRemainingFraction(c.startUtc, c.endUtc, now())
      : null;
  });

  return (
    <li class="flex items-stretch overflow-hidden rounded-md border border-[var(--color-border-soft)] bg-[var(--color-field)] shadow-[0_1px_3px_0_var(--color-shadow)]">
      {/* Priority indicator: gray (low) -> yellow -> red (high), flush
          against the card's left edge (no gap/padding). See
          lib/priorityColor.js for the color mapping. */}
      <div
        class="w-1.5 shrink-0"
        style={{ "background-color": priorityToHsl(props.note.priority) }}
        aria-hidden="true"
      />
      <div class="flex flex-1 flex-col gap-1 p-3">
        <div>
          <div class="flex items-baseline justify-between gap-1">
            {/* Description shows as a tooltip on hover/focus of the title;
                notes without a description just render a plain h2. */}
            <Show
              when={props.note.description}
              fallback={<h2 class="font-serif text-xl">{props.note.label}</h2>}
            >
              <Tooltip>
                <Tooltip.Trigger
                  as="h2"
                  tabIndex={0}
                  class="cursor-default font-serif text-xl focus:outline-none"
                >
                  {props.note.label}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content class="max-w-xs rounded-md border border-[var(--color-border-soft)] bg-[var(--color-field)] px-3 py-2 text-sm text-[var(--color-text)] shadow-[0_1px_3px_0_var(--color-shadow)]">
                    <Tooltip.Arrow />
                    {props.note.description}
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip>
            </Show>
            {remaining() && (
              <span class="flex items-center gap-1 whitespace-nowrap font-serif text-lg">
                <Hourglass class="h-4 w-4 transition-transform duration-500 hover:rotate-[360deg]" />
                {remaining()}
              </span>
            )}
          </div>

          <Show when={progress() !== null}>
            <Progress value={Math.round(progress() * 100)} class="mt-1 w-full">
              <Progress.Track class="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
                <Progress.Fill
                  class="h-full rounded-full bg-[var(--color-progress)] transition-[width]"
                  style={{ width: "var(--kb-progress-fill-width)" }}
                />
              </Progress.Track>
            </Progress>
          </Show>

          <div class="mt-1 flex flex-col gap-0.5 font-mono text-sm">
            <span>RRULE: {props.note.rrule || "—"}</span>
            <span>
              Next: {formatNaive(utcToLocal(nextUtc(), props.tz)) || "—"}
            </span>
            <span>
              Base: {formatNaive(utcToLocal(props.note.dtstart, props.tz))}
            </span>
            <span>
              Last:{" "}
              {props.note.lastNotified
                ? formatNaive(utcToLocal(props.note.lastNotified, props.tz))
                : "—"}
            </span>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn" onClick={() => props.onShift(-1)}>
            -1 day
          </button>
          <button type="button" class="btn" onClick={() => props.onShift(0)}>
            Today
          </button>
          <button type="button" class="btn" onClick={() => props.onShift(1)}>
            +1 day
          </button>
          <A href={`/edit/${props.note.id}`} class="btn">
            Edit
          </A>
        </div>
      </div>
    </li>
  );
}

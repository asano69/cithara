import { createSignal, createResource, onCleanup, onMount, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import {
  DragDropProvider,
  DragDropSensors,
  SortableProvider,
  createSortable,
  closestCenter,
} from "@thisbeyond/solid-dnd";
import NavBar from "../components/NavBar";
import pb from "../lib/pb";
import { loadTimezone, localToUtc, utcToLocal, formatNaive } from "../lib/tz";
import { nextOccurrenceUtcString } from "../lib/rrule";
// Matches the naive local "YYYYMMDDTHHMMSS" format produced by converting
// a stored UTC dtstart with utcToLocal (see NoteForm.jsx).
const DTSTART_RE = /^(\d{4})(\d{2})(\d{2})T(\d{6})$/;

// Matches the canonical UTC dtstart/next-occurrence string format
// ("YYYYMMDDTHHMMSSZ"), used here to compute a countdown.
const UTC_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;

// Shifts the date part of a naive local dtstart string by `deltaDays`,
// keeping the time-of-day unchanged. Returns "" if it doesn't match the
// expected format.
function shiftDtstart(naiveLocal, deltaDays) {
  const match = DTSTART_RE.exec(naiveLocal);
  if (!match) return "";
  const [, y, mo, d, time] = match;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}T${time}`;
}

// Replaces the date part of a naive local dtstart string with today's
// local calendar date, keeping the time-of-day unchanged.
function setDtstartToday(naiveLocal) {
  const match = DTSTART_RE.exec(naiveLocal);
  const time = match ? match[4] : "000000";
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}T${time}`;
}


// Formats the time remaining until a canonical UTC "YYYYMMDDTHHMMSSZ"
// string, as "Xd Yh Zm". referenceMs lets callers pass a reactive "now"
// signal so the countdown updates live. Returns "" if utcStr is empty,
// unparsable, or already in the past.
function formatRemaining(utcStr, referenceMs) {
  const m = UTC_RE.exec(utcStr ?? "");
  if (!m) return "";

  const [, y, mo, d, h, mi, s] = m;
  const target = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  const diffMs = target.getTime() - referenceMs;
  if (diffMs <= 0) return "";

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}


function NoteItem(props) {
  // The whole item is the drag source (not just the ⋮⋮ icon): solid-dnd's
  // handle-only pattern relies on spreading dragActivators onto a
  // sub-element, which is broken on Solid >=1.6 (solidjs/solid#1328).
  // Making the whole row draggable sidesteps that bug. The pointer sensor
  // still requires a movement threshold before a drag starts, so clicking
  // the Edit link or the day-shift buttons still works normally.
  const sortable = createSortable(props.note.id);

  // Drives the countdown display; ticks once a minute so "Xd Yh Zm" stays
  // current without needing a full note reload.
  const [now, setNow] = createSignal(Date.now());
  onMount(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 60000);
    onCleanup(() => clearInterval(intervalId));
  });

  const nextUtc = () =>
    nextOccurrenceUtcString(props.note.dtstart, props.note.rrule);
  const remaining = () => formatRemaining(nextUtc(), now());

  return (
    <li
      use:sortable
      classList={{ "opacity-40": sortable.isActiveDraggable }}
      class="flex items-start gap-3 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-field)] p-4 shadow-[0_1px_3px_0_var(--color-shadow)]"
    >
      <div
        class="mt-1 cursor-grab select-none text-lg leading-none text-[var(--color-border-soft)]"
        title="Drag to reorder"
        aria-label="Drag to reorder"
      >
        ⋮⋮
      </div>

      <div class="flex flex-1 flex-col gap-2">
        <div>
          <h2 class="font-serif text-xl">{props.note.label}</h2>
          {props.note.description && (
            <p class="text-sm text-[var(--color-border-soft)]">
              {props.note.description}
            </p>
          )}
          <div class="mt-1 flex flex-col gap-0.5 font-mono text-xs text-[var(--color-border-soft)]">
            <span>
              Next:{" "}
              {formatNaive(utcToLocal(nextUtc(), props.tz)) || "—"}
              {remaining() && ` (⏳️${remaining()})`}
            </span>
            <span>
              Base: {formatNaive(utcToLocal(props.note.dtstart, props.tz))}
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



function HomeContent(props) {
  const [notes, setNotes] = createSignal([]);

  const loadNotes = async () => {
    const list = await pb.collection("notes").getFullList({ sort: "position" });
    setNotes(list);
  };

  onMount(loadNotes);

  const ids = () => notes().map((note) => note.id);

  // Persists position for every note whose position actually changed,
  // then reloads from the server so the UI reflects the confirmed state.
  const persistOrder = async (orderedNotes) => {
    await Promise.all(
      orderedNotes.map((note, i) => {
        const position = i + 1;
        if (note.position === position) return null;
        return pb.collection("notes").update(note.id, { position });
      }),
    );
    await loadNotes();
  };

  const onDragEnd = ({ draggable, droppable }) => {
    if (!draggable || !droppable) return;
    const currentIds = ids();
    const fromIndex = currentIds.indexOf(draggable.id);
    const toIndex = currentIds.indexOf(droppable.id);
    if (fromIndex === toIndex) return;

    const reordered = [...notes()];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setNotes(reordered);
    persistOrder(reordered);
  };

  // Shifts a note's dtstart by deltaDays (0 means "jump to today"). The
  // stored value is UTC, so it's converted to naive local, shifted, and
  // converted back before saving.
  const handleShift = async (note, deltaDays) => {
    const naiveLocal = utcToLocal(note.dtstart, props.tz);
    const shifted =
      deltaDays === 0
        ? setDtstartToday(naiveLocal)
        : shiftDtstart(naiveLocal, deltaDays);
    if (!shifted) return;
    await pb.collection("notes").update(note.id, {
      dtstart: localToUtc(shifted, props.tz),
    });
    await loadNotes();
  };

  return (
    <div class="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center bg-[var(--color-bg)] px-6 py-12 text-[var(--color-text)]">
      <NavBar />
      <DragDropProvider onDragEnd={onDragEnd} collisionDetector={closestCenter}>
        <DragDropSensors />
        <ul class="flex w-full flex-col gap-3">
          <SortableProvider ids={ids()}>
            <For each={notes()}>
              {(note) => (
                <NoteItem
                  note={note}
                  tz={props.tz}
                  onShift={(delta) => handleShift(note, delta)}
                />
              )}
            </For>
          </SortableProvider>
        </ul>
      </DragDropProvider>
    </div>
  );
}

// Resolved once here so the rest of the page can treat every dtstart
// conversion as a plain synchronous function.
export default function Home() {
  const [tz] = createResource(loadTimezone);
  return (
    <Show when={tz()}>
      <HomeContent tz={tz()} />
    </Show>
  );
}

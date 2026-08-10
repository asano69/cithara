import { createSignal, createMemo, onMount, onCleanup, createResource, For, Show } from "solid-js";
import Undo from "lucide-solid/icons/undo";
import Redo from "lucide-solid/icons/redo";
import pb from "../lib/pb";
import { loadTimezone, localToUtc, utcToLocal } from "../lib/tz";
import { nextOccurrenceUtcString } from "../lib/rrule";
import { shiftDtstart, setDtstartToday, parseUtcMs } from "../lib/noteSchedule";
import { pushShift, undoShift, redoShift } from "../lib/shiftHistory";
import NoteCard from "../components/NoteCard";

function HomeContent(props) {
  const [notes, setNotes] = createSignal([]);
  const [now, setNow] = createSignal(Date.now());
  const [history, setHistory] = createSignal([]);
  const [pointer, setPointer] = createSignal(0);
  const [historyError, setHistoryError] = createSignal("");

  onMount(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 60000);
    onCleanup(() => clearInterval(intervalId));
  });

  const loadNotes = async () => {
    const list = await pb.collection("notes").getFullList({ sort: "created" });
    setNotes(list);
  };

  onMount(loadNotes);

  const canUndo = () => pointer() > 0;
  const canRedo = () => pointer() < history().length;

  const handleUndo = async () => {
    setHistoryError("");
    try {
      const next = await undoShift(history(), pointer());
      if (next === null) return;
      setPointer(next);
      await loadNotes();
    } catch (err) {
      console.error("undo failed:", err?.response ?? err);
      setHistoryError(err?.response?.message ?? "Failed to undo.");
    }
  };

  const handleRedo = async () => {
    setHistoryError("");
    try {
      const next = await redoShift(history(), pointer());
      if (next === null) return;
      setPointer(next);
      await loadNotes();
    } catch (err) {
      console.error("redo failed:", err?.response ?? err);
      setHistoryError(err?.response?.message ?? "Failed to redo.");
    }
  };

  // Always keeps the list ordered by soonest next occurrence, so it stays
  // correct both after edits and as time passes and "now" ticks forward.
  // Notes with no more occurrences sort to the end.
  const sortedNotes = createMemo(() => {
    now();
    return [...notes()]
      .map((note) => ({
        note,
        nextMs: parseUtcMs(nextOccurrenceUtcString(note.dtstart, note.rrule)),
      }))
      .sort((a, b) => {
        if (a.nextMs === null && b.nextMs === null) return 0;
        if (a.nextMs === null) return 1;
        if (b.nextMs === null) return -1;
        return a.nextMs - b.nextMs;
      })
      .map((entry) => entry.note);
  });

  // Shifts a note's dtstart by deltaDays (0 means "jump to today"). The
  // stored value is UTC, so it's converted to naive local, shifted, and
  // converted back before saving. The shift is recorded in the shared
  // undo/redo history via pushShift.
  const handleShift = async (note, deltaDays) => {
    const naiveLocal = utcToLocal(note.dtstart, props.tz);
    const shifted =
      deltaDays === 0
        ? setDtstartToday(naiveLocal)
        : shiftDtstart(naiveLocal, deltaDays);
    if (!shifted) return;

    setHistoryError("");
    try {
      const result = await pushShift(history(), pointer(), {
        note: note.id,
        prevDtstart: note.dtstart,
        newDtstart: localToUtc(shifted, props.tz),
      });
      setHistory(result.entries);
      setPointer(result.pointer);
      await loadNotes();
    } catch (err) {
      console.error("shift failed:", err?.response ?? err);
      setHistoryError(err?.response?.message ?? "Failed to shift the date.");
    }
  };

  return (
    <div class="flex w-full flex-col gap-3">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn"
          onClick={handleUndo}
          disabled={!canUndo()}
          aria-label="Undo"
        >
          <Undo class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="btn"
          onClick={handleRedo}
          disabled={!canRedo()}
          aria-label="Redo"
        >
          <Redo class="h-4 w-4" />
        </button>
        {historyError() && (
          <p class="text-sm text-[#dc3545]">{historyError()}</p>
        )}
      </div>

      <ul class="flex w-full flex-col gap-3">
        <For each={sortedNotes()}>
          {(note) => (
            <NoteCard
              note={note}
              tz={props.tz}
              onShift={(delta) => handleShift(note, delta)}
            />
          )}
        </For>
      </ul>
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

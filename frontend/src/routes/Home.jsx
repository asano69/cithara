import { createSignal, createMemo, onMount, onCleanup, createResource, For, Show } from "solid-js";
import { ToggleGroup } from "@kobalte/core/toggle-group";
import Undo from "lucide-solid/icons/undo";
import Redo from "lucide-solid/icons/redo";
import CalendarClock from "lucide-solid/icons/calendar-clock";
import CalendarCheck from "lucide-solid/icons/calendar-check";
import pb from "../lib/pb";
import { loadTimezone, localToUtc, utcToLocal } from "../lib/tz";
import { nextOccurrenceUtcString } from "../lib/rrule";
import { shiftDtstart, setDtstartToday, parseUtcMs } from "../lib/noteSchedule";
import { pushShift, undoShift, redoShift } from "../lib/shiftHistory";
import { loadSortMode, saveSortMode } from "../lib/sortMode";
import { showToast } from "../lib/toast";
import NoteCard from "../components/NoteCard";

function HomeContent(props) {
  const [notes, setNotes] = createSignal([]);
  const [now, setNow] = createSignal(Date.now());
  const [history, setHistory] = createSignal([]);
  const [pointer, setPointer] = createSignal(0);
  const [historyError, setHistoryError] = createSignal("");
  const [sortMode, setSortMode] = createSignal(props.initialSortMode);

  onMount(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 60000);
    onCleanup(() => clearInterval(intervalId));
  });

  const loadNotes = async () => {
    const list = await pb.collection("notes").getFullList({ sort: "created" });
    setNotes(list);
  };

  onMount(loadNotes);

  // The scheduler can update a note's lastNotified server-side (when a
  // notification fires) while this screen stays open. Subscribing to
  // PocketBase's realtime updates keeps the local `notes` signal in sync
  // instead of it going stale until the next explicit reload.
  onMount(async () => {
    await pb.collection("notes").subscribe("*", (e) => {
      if (e.action === "update") {
        setNotes((prev) =>
          prev.map((n) => (n.id === e.record.id ? e.record : n)),
        );
      } else if (e.action === "delete") {
        setNotes((prev) => prev.filter((n) => n.id !== e.record.id));
      } else if (e.action === "create") {
        setNotes((prev) => [...prev, e.record]);
      }
    });
    onCleanup(() => {
      pb.collection("notes").unsubscribe("*");
    });
  });

  const canUndo = () => pointer() > 0;
  const canRedo = () => pointer() < history().length;

  const handleUndo = async () => {
    setHistoryError("");
    try {
      const next = await undoShift(history(), pointer());
      if (next === null) return;
      setPointer(next);
      await loadNotes();
      showToast("Undo successful.");
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
      showToast("Redo successful.");
    } catch (err) {
      console.error("redo failed:", err?.response ?? err);
      setHistoryError(err?.response?.message ?? "Failed to redo.");
    }
  };

  const handleSortModeChange = (mode) => {
    setSortMode(mode);
    saveSortMode(mode);
  };

  // Keeps the list ordered by soonest next occurrence ("next" mode) or
  // most recently notified first ("last" mode), so it stays correct both
  // after edits and as time passes and "now" ticks forward. Notes with no
  // value for the active mode sort to the end.
  const sortedNotes = createMemo(() => {
    now();
    const mode = sortMode();
    return [...notes()]
      .map((note) => ({
        note,
        sortMs:
          mode === "last"
            ? parseUtcMs(note.lastNotified)
            : parseUtcMs(nextOccurrenceUtcString(note.dtstart, note.rrule)),
      }))
      .sort((a, b) => {
        if (a.sortMs === null && b.sortMs === null) return 0;
        if (a.sortMs === null) return 1;
        if (b.sortMs === null) return -1;
        return mode === "last" ? b.sortMs - a.sortMs : a.sortMs - b.sortMs;
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
      const message =
        deltaDays === 0
          ? "Reset to today."
          : deltaDays > 0
            ? "Shifted +1 day."
            : "Shifted -1 day.";
      showToast(message);
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
        <ToggleGroup
          value={sortMode()}
          onChange={(value) => value && handleSortModeChange(value)}
          class="flex gap-1"
        >
          <ToggleGroup.Item
            value="next"
            aria-label="Sort by next occurrence"
            class="btn data-[pressed]:bg-[var(--color-active-bg)] data-[pressed]:border-[var(--color-active-border)]"
          >
            <CalendarClock class="h-4 w-4" />
          </ToggleGroup.Item>
          <ToggleGroup.Item
            value="last"
            aria-label="Sort by last notified"
            class="btn data-[pressed]:bg-[var(--color-active-bg)] data-[pressed]:border-[var(--color-active-border)]"
          >
            <CalendarCheck class="h-4 w-4" />
          </ToggleGroup.Item>
        </ToggleGroup>
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
  const [initialSortMode] = createResource(loadSortMode);
  return (
    <Show when={tz() && initialSortMode()}>
      <HomeContent tz={tz()} initialSortMode={initialSortMode()} />
    </Show>
  );
}

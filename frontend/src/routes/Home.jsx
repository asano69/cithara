import { createSignal, createMemo, onMount, onCleanup, createResource, For, Show } from "solid-js";
import pb from "../lib/pb";
import { loadTimezone, localToUtc, utcToLocal } from "../lib/tz";
import { nextOccurrenceUtcString } from "../lib/rrule";
import { shiftDtstart, setDtstartToday, parseUtcMs } from "../lib/noteSchedule";
import NoteCard from "../components/NoteCard";

function HomeContent(props) {
  const [notes, setNotes] = createSignal([]);
  const [now, setNow] = createSignal(Date.now());

  onMount(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 60000);
    onCleanup(() => clearInterval(intervalId));
  });

  const loadNotes = async () => {
    const list = await pb.collection("notes").getFullList({ sort: "created" });
    setNotes(list);
  };

  onMount(loadNotes);

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

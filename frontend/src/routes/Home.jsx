import { onMount, onCleanup, createSignal, For } from "solid-js";
import { A } from "@solidjs/router";
import Sortable from "sortablejs";
import NavBar from "../components/NavBar";
import pb from "../lib/pb";

// Matches the floating DATE-TIME format written by NewEntry.jsx:
// "YYYYMMDDTHHMMSS" (no trailing "Z", so this is never UTC).
const DTSTART_RE = /^(\d{4})(\d{2})(\d{2})T(\d{6})$/;

// Shifts the date part of a dtstart string by `deltaDays`, keeping the
// time-of-day unchanged. Returns "" if dtstart doesn't match the expected
// format.
function shiftDtstart(dtstart, deltaDays) {
  const match = DTSTART_RE.exec(dtstart);
  if (!match) return "";
  const [, y, mo, d, time] = match;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}T${time}`;
}

// Replaces the date part of a dtstart string with today's local calendar
// date, keeping the time-of-day unchanged.
function setDtstartToday(dtstart) {
  const match = DTSTART_RE.exec(dtstart);
  const time = match ? match[4] : "000000";
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}T${time}`;
}

function NoteItem(props) {
  return (
    <li
      data-id={props.note.id}
      class="flex items-start gap-3 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-field)] p-4 shadow-[0_1px_3px_0_var(--color-shadow)]"
    >
      <div
        class="drag-handle mt-1 cursor-grab select-none text-lg leading-none text-[var(--color-border-soft)]"
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
          <p class="mt-1 break-all font-mono text-xs text-[var(--color-border-soft)]">
            {props.note.rrule} · DTSTART:{props.note.dtstart}
          </p>
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

export default function Home() {
  const [notes, setNotes] = createSignal([]);
  let listRef;
  let sortable;

  const loadNotes = async () => {
    const list = await pb
      .collection("notes")
      .getFullList({ sort: "position" });
    setNotes(list);
  };

onMount(async () => {
  await loadNotes();
  sortable = Sortable.create(listRef, {
    handle: ".drag-handle",
    animation: 150,
    onEnd: (evt) => {
      const { oldIndex, newIndex, from, item } = evt;
      if (oldIndex === newIndex) return;

      // SortableJS already moved `item` in the real DOM before this
      // callback fires. Move it back to its original slot so Solid's
      // <For> starts from the DOM layout it still recognizes, and let
      // the reactive update below (via handleReorder -> setNotes) own
      // the actual reordering instead of fighting with sortable's move.
      const referenceNode = from.children[oldIndex];
      if (referenceNode) {
        from.insertBefore(item, referenceNode);
      } else {
        from.appendChild(item);
      }

      handleReorder(oldIndex, newIndex);
    },
  });
});

  onCleanup(() => sortable?.destroy());

  // Moves the note at fromIndex to toIndex, then persists the new
  // position for every note whose position actually changed.
  const handleReorder = async (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    const reordered = [...notes()];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setNotes(reordered);

    await Promise.all(
      reordered.map((note, i) => {
        const position = i + 1;
        if (note.position === position) return null;
        return pb.collection("notes").update(note.id, { position });
      }),
    );
    await loadNotes();
  };

  // Shifts a note's dtstart by deltaDays (0 means "jump to today").
  const handleShift = async (note, deltaDays) => {
    const dtstart =
      deltaDays === 0
        ? setDtstartToday(note.dtstart)
        : shiftDtstart(note.dtstart, deltaDays);
    if (!dtstart) return;
    await pb.collection("notes").update(note.id, { dtstart });
    await loadNotes();
  };

  return (
    <div class="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center bg-[var(--color-bg)] px-6 py-12 text-[var(--color-text)]">
      <NavBar />
      <ul ref={listRef} class="flex w-full flex-col gap-3">
        <For each={notes()}>
          {(note) => (
            <NoteItem note={note} onShift={(delta) => handleShift(note, delta)} />
          )}
        </For>
      </ul>
    </div>
  );
}

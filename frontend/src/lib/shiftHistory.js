// Undo/redo for the Home page's shift buttons (-1 day / Today / +1 day).
// History is persisted in PocketBase (collection "shift_history") plus a
// single pointer value in the "settings" collection, so the undo/redo
// stack survives page reloads and is shared across devices -- consistent
// with this app's "server as dumb storage" design (see docs/DESIGN.md).
//
// Model: entries are ordered by `seq` (1, 2, 3, ...). `pointer` is how
// many entries, from the start, are currently applied -- i.e. the
// current state corresponds to entries[0..pointer). Undo decrements
// pointer and reverts entries[pointer-1]. Redo increments pointer and
// reapplies entries[pointer]. Performing a new shift while pointer is
// behind the end discards the "redo tail" (entries with seq > pointer),
// matching standard undo/redo UX.

import pb from "./pb";

const POINTER_KEY = "shiftHistoryPointer";

// Loads the full history (ordered by seq) and the current pointer.
export async function loadShiftHistory() {
  const entries = await pb
    .collection("shift_history")
    .getFullList({ sort: "seq" });

  const pointer = await loadPointer();

  return { entries, pointer };
}

async function loadPointer() {
  try {
    const record = await pb
      .collection("settings")
      .getFirstListItem(`key="${POINTER_KEY}"`);

    return parseInt(record.value, 10) || 0;
  } catch {
    return 0;
  }
}

async function savePointer(pointer) {
  try {
    const record = await pb
      .collection("settings")
      .getFirstListItem(`key="${POINTER_KEY}"`);

    await pb.collection("settings").update(record.id, {
      value: String(pointer),
    });
  } catch {
    await pb.collection("settings").create({
      key: POINTER_KEY,
      value: String(pointer),
    });
  }
}

// Records a shift (prevDtstart -> newDtstart) for noteId, applies it to
// the note, and discards any redo tail. Returns the updated
// { entries, pointer }.
export async function pushShift(
  entries,
  pointer,
  { note, prevDtstart, newDtstart },
) {
  const tail = entries.slice(pointer);

  for (const entry of tail) {
    await pb.collection("shift_history").delete(entry.id);
  }

  const kept = entries.slice(0, pointer);
  const seq = (kept.at(-1)?.seq ?? 0) + 1;

  const created = await pb.collection("shift_history").create({
    note,
    prevDtstart,
    newDtstart,
    seq,
  });

  await pb.collection("notes").update(note, {
    dtstart: newDtstart,
  });

  const nextEntries = [...kept, created];
  const nextPointer = nextEntries.length;

  await savePointer(nextPointer);

  return {
    entries: nextEntries,
    pointer: nextPointer,
  };
}

// Reverts the most recently applied shift. Returns the new pointer, or
// null if there is nothing to undo.
export async function undoShift(entries, pointer) {
  if (pointer <= 0) return null;

  const entry = entries[pointer - 1];

  await pb.collection("notes").update(entry.note, {
    dtstart: entry.prevDtstart,
  });

  const nextPointer = pointer - 1;

  await savePointer(nextPointer);

  return nextPointer;
}

// Reapplies the next shift after an undo. Returns the new pointer, or
// null if there is nothing to redo.
export async function redoShift(entries, pointer) {
  if (pointer >= entries.length) return null;

  const entry = entries[pointer];

  await pb.collection("notes").update(entry.note, {
    dtstart: entry.newDtstart,
  });

  const nextPointer = pointer + 1;

  await savePointer(nextPointer);

  return nextPointer;
}

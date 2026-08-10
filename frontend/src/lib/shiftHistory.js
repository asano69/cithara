// Undo/redo for the Home page's shift buttons (-1 day / Today / +1 day).
// The history stack lives entirely in memory (owned by Home.jsx's signals)
// -- it is not persisted, so it resets on reload or navigation. This is a
// deliberate simplicity tradeoff: no extra collection, no pointer to keep
// in sync with the server.
//
// Model: entries are ordered oldest-to-newest. `pointer` is how many
// entries, from the start, are currently applied -- i.e. the current
// state corresponds to entries[0..pointer). Undo decrements pointer and
// reverts entries[pointer-1]. Redo increments pointer and reapplies
// entries[pointer]. Performing a new shift while pointer is behind the
// end discards the "redo tail" (entries after pointer), matching
// standard undo/redo UX.

import pb from "./pb";

// Applies a shift (prevDtstart -> newDtstart) to note, discards any redo
// tail, and returns the updated { entries, pointer }.
export async function pushShift(
  entries,
  pointer,
  { note, prevDtstart, newDtstart },
) {
  await pb.collection("notes").update(note, { dtstart: newDtstart });

  const kept = entries.slice(0, pointer);
  const nextEntries = [...kept, { note, prevDtstart, newDtstart }];
  return { entries: nextEntries, pointer: nextEntries.length };
}

// Reverts the most recently applied shift. Returns the new pointer, or
// null if there is nothing to undo.
export async function undoShift(entries, pointer) {
  if (pointer <= 0) return null;
  const entry = entries[pointer - 1];
  await pb.collection("notes").update(entry.note, {
    dtstart: entry.prevDtstart,
  });
  return pointer - 1;
}

// Reapplies the next shift after an undo. Returns the new pointer, or
// null if there is nothing to redo.
export async function redoShift(entries, pointer) {
  if (pointer >= entries.length) return null;
  const entry = entries[pointer];
  await pb.collection("notes").update(entry.note, {
    dtstart: entry.newDtstart,
  });
  return pointer + 1;
}

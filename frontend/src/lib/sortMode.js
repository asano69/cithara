// Persists the note list's sort mode ("next" or "last") to the
// "settings" collection, using the same key/value record pattern as
// lib/tz/settings.js's TZ record.
import pb from "./pb";

const SORT_MODE_KEY = "SORT_MODE";
const DEFAULT_SORT_MODE = "next";

// Loads the persisted sort mode, falling back to the default when unset
// or on any error (e.g. no record yet).
export async function loadSortMode() {
  try {
    const record = await pb
      .collection("settings")
      .getFirstListItem(`key="${SORT_MODE_KEY}"`);
    return record.value === "last" ? "last" : DEFAULT_SORT_MODE;
  } catch {
    return DEFAULT_SORT_MODE;
  }
}

// Persists mode, creating the settings record on first use and updating
// it thereafter.
export async function saveSortMode(mode) {
  try {
    const record = await pb
      .collection("settings")
      .getFirstListItem(`key="${SORT_MODE_KEY}"`);
    await pb.collection("settings").update(record.id, { value: mode });
  } catch {
    await pb.collection("settings").create({ key: SORT_MODE_KEY, value: mode });
  }
}

// Shared form used by both the "new entry" and "edit entry" routes. Reuses
// RRuleBuilder for the recurrence rule and saves directly to PocketBase.
import { createSignal, createResource, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import RRuleBuilder from "./RRuleBuilder/RRuleBuilder";
import Button from "./Button";
import { BuilderStoreProvider, useBuilderStoreContext } from "../lib/rrule";
import { loadTimezone, localToUtc, utcToLocal } from "../lib/tz";
import pb from "../lib/pb";

// Combines the RRuleBuilder's date-only startDate with a separately
// entered time-of-day into a naive local "YYYYMMDDTHHMMSS" string, then
// converts it to the canonical UTC dtstart string stored in the database.
// All tz-awareness lives here on the client now (see CLAUDE.md, "don't use
// timezones" — the server never sees or converts timezones at all).
function toDtstartString(date, time, tz) {
  if (!date) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const [hh, mm] = (time || "00:00").split(":");
  const naiveLocal = `${y}${m}${d}T${hh.padStart(2, "0")}${mm.padStart(2, "0")}00`;
  return localToUtc(naiveLocal, tz);
}

// The store's rruleString includes a leading "DTSTART:" line, but dtstart
// is stored in its own field. rrule-go's StrToRRule() expects the bare
// rule value (no "RRULE:" prefix), so that's stripped here too.
function extractRRuleLine(rruleString) {
  if (!rruleString) return "";
  const line = rruleString.split("\n").find((l) => l.startsWith("RRULE:"));
  return (line ?? rruleString).replace(/^RRULE:/, "");
}

// Reconstructs the "DTSTART:...\nRRULE:..." string RRuleBuilder expects,
// from the stored UTC dtstart/rrule fields, so an existing note's
// recurrence can be loaded back into the builder for editing. dtstart is
// converted to naive local time first, then a "Z" is appended so
// RRule.parseString reads the digits as-is via its UTC accessors —
// matching how buildRRuleString.js serializes it in the first place.
function toBuilderRRuleString(dtstart, rrule, tz) {
  if (!dtstart || !rrule) return "";
  const naiveLocal = utcToLocal(dtstart, tz);
  return `DTSTART:${naiveLocal}Z\nRRULE:${rrule}`;
}

// Extracts "HH:MM" from a naive local dtstart string ("YYYYMMDDTHHMMSS").
function extractTime(naiveLocal) {
  const match = /^\d{8}T(\d{2})(\d{2})\d{2}$/.exec(naiveLocal ?? "");
  return match ? `${match[1]}:${match[2]}` : "09:00";
}

// New notes are appended after the current last one. Good enough for a
// single-user app; see README's note on why full LexoRank isn't needed.
async function nextPosition() {
  try {
    const last = await pb
      .collection("notes")
      .getFirstListItem("", { sort: "-position" });
    return last.position + 1;
  } catch {
    return 1;
  }
}

function NoteFormFields(props) {
  const store = useBuilderStoreContext();
  const navigate = useNavigate();
  const [label, setLabel] = createSignal(props.note?.label ?? "");
  const [description, setDescription] = createSignal(
    props.note?.description ?? "",
  );
  const [time, setTime] = createSignal(
    extractTime(utcToLocal(props.note?.dtstart, props.tz)),
  );
  const [pending, setPending] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [error, setError] = createSignal("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!store.validateForm()) {
      setError(
        "Please complete the recurrence rule (e.g. select at least one weekday).",
      );
      return;
    }

    setError("");
    setPending(true);
    try {
      const data = {
        label: label(),
        description: description(),
        dtstart: toDtstartString(store.startDate(), time(), props.tz),
        rrule: extractRRuleLine(store.rruleString()),
      };
      if (props.note) {
        await pb.collection("notes").update(props.note.id, data);
      } else {
        data.position = await nextPosition();
        await pb.collection("notes").create(data);
      }
      navigate("/");
    } catch (err) {
      console.error("save note failed:", err?.response ?? err);
      setError(err?.response?.message ?? "Failed to save the entry.");
    } finally {
      setPending(false);
    }
  };

  // Deletes the note being edited. Only rendered when props.note exists,
  // so there is nothing to delete on the "new entry" form.
  const handleDelete = async () => {
    if (
      !window.confirm(`Delete "${props.note.label}"? This cannot be undone.`)
    ) {
      return;
    }
    setError("");
    setDeleting(true);
    try {
      await pb.collection("notes").delete(props.note.id);
      navigate("/");
    } catch (err) {
      console.error("delete note failed:", err?.response ?? err);
      setError(err?.response?.message ?? "Failed to delete the entry.");
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} class="flex w-full flex-col gap-6">
      <label class="flex flex-col gap-1 text-sm">
        <span>Label</span>
        <input
          type="text"
          value={label()}
          onInput={(e) => setLabel(e.target.value)}
          required
          autofocus
          class="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)] px-2 py-1 text-[var(--color-text)]"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span>Description</span>
        <textarea
          value={description()}
          onInput={(e) => setDescription(e.target.value)}
          rows="3"
          class="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)] px-2 py-1 text-[var(--color-text)]"
        />
      </label>

      <RRuleBuilder
        enableYearlyInterval
        rruleString={toBuilderRRuleString(
          props.note?.dtstart,
          props.note?.rrule,
          props.tz,
        )}
      />

      <label class="flex flex-col gap-1 text-sm">
        <span>Notify at</span>
        <input
          type="time"
          value={time()}
          onInput={(e) => setTime(e.target.value)}
          required
          class="w-32 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)] px-2 py-1 text-[var(--color-text)]"
        />
      </label>

      {error() && <p class="text-sm text-[#dc3545]">{error()}</p>}

      <div class="flex flex-wrap items-center">
        <button type="submit" class="btn" disabled={pending() || deleting()}>
          {pending() ? "Saving…" : "Save"}
        </button>
        {props.note && (
          <Button
            variant="danger"
            value={deleting() ? "Deleting…" : "Delete"}
            disabled={pending() || deleting()}
            onClick={handleDelete}
          />
        )}
      </div>
    </form>
  );
}

// props.note: pass an existing PocketBase note record to edit it, or omit
// to create a new one.
export default function NoteForm(props) {
  // Resolved once here so every conversion in NoteFormFields can stay a
  // plain synchronous function.
  const [tz] = createResource(loadTimezone);

  return (
    <BuilderStoreProvider>
      <Show when={tz()}>
        <NoteFormFields note={props.note} tz={tz()} />
      </Show>
    </BuilderStoreProvider>
  );
}

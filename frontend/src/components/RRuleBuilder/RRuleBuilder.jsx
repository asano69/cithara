// Ported from RRuleBuilder/RRuleBuilder.tsx.
// MUI LocalizationProvider + DatePicker -> native <input type="date">.
// No dateAdapter prop is needed: Stage 1 dropped the luxon adapter, so
// the store already works with plain Dates (see CLAUDE.md, "dates are naive").

import { onMount, Show, createSignal, createEffect } from "solid-js";
import { Frequency } from "rrule";
import { useBuilderStoreContext } from "../../lib/rrule/builderStoreContext";
import RepeatSelect from "./Repeat/Repeat";
import End from "./End/End";

function toDateInputValue(date) {
  if (!date) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromDateInputValue(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export default function RRuleBuilder(props) {
  const store = useBuilderStoreContext();

  // Local editable copy of the RRULE string, for the "raw RRULE" text
  // field below. DTSTART is deliberately excluded from this field --
  // it's already editable via the "Start Date" input above, so showing
  // it twice would invite the two to disagree. On commit, the DTSTART
  // line is silently re-attached (read from the store, which already
  // reflects the "Start Date" input) before parsing, so the user's start
  // date is preserved even though they never see or edit it here.
  //
  // Editing it and committing (blur/Enter) re-parses the whole rule via
  // setStoreFromRRuleString and pushes the result back into the other
  // fields -- two-way binding between the text and the inputs.
  //
  // The field is synced *from* the store only while the user isn't
  // actively editing it, so a field-driven rebuild (e.g. toggling a
  // weekday) doesn't clobber what they're mid-typing. The reverse
  // direction (text -> fields) only happens on commit, and only once the
  // string parses successfully -- on a parse error the field keeps
  // showing exactly what the user typed, alongside the error, so they
  // can fix it instead of losing their edit.
  const [rruleText, setRRuleText] = createSignal("");
  const [editingRRuleText, setEditingRRuleText] = createSignal(false);
  const [rruleTextError, setRRuleTextError] = createSignal("");

  // Splits a "DTSTART:...\nRRULE:..." string (store.rruleString()'s
  // format) into its DTSTART line and the bare rule body (the
  // "RRULE:" prefix stripped off, since the text field shows/edits only
  // the body -- e.g. "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE").
  // Splits a "DTSTART:...\nRRULE:..." string (store.rruleString()'s
  // format) into its DTSTART line and the bare rule body (the
  // "RRULE:" prefix stripped off, since the text field shows/edits only
  // the body -- e.g. "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE").
  const extractDtstartLine = (full) =>
    (full ?? "").split("\n").find((l) => l.startsWith("DTSTART:")) ?? "";
  const extractRuleBody = (full) => {
    const line = (full ?? "")
      .split("\n")
      .find((l) => l.startsWith("RRULE:"));
    return line ? line.slice("RRULE:".length) : "";
  };

  createEffect(() => {
    if (!editingRRuleText()) {
      setRRuleText(extractRuleBody(store.rruleString()));
    }
  });

  const commitRRuleText = () => {
    const dtstartLine = extractDtstartLine(store.rruleString());
    const ruleLine = `RRULE:${rruleText()}`;
    const fullString = dtstartLine
      ? `${dtstartLine}\n${ruleLine}`
      : ruleLine;
    store.setStoreFromRRuleString(fullString);
    const error = store.validationErrors.rruleString ?? "";
    setRRuleTextError(error);
    setEditingRRuleText(Boolean(error));
  };

  const showStartDate = () => props.showStartDate ?? true;
  const enableResponsiveLayout = () => props.enableResponsiveLayout ?? true;
  const enableYearlyInterval = () => props.enableYearlyInterval ?? false;
  const startLabel = () => props.lang?.startDatePickerLabel ?? "Start Date";
  const endLabel = () => props.lang?.endDatePickerLabel ?? "End Date";

  // Runs once on mount, mirroring the original's "init the store" effect.
  onMount(() => {
    if (!showStartDate()) {
      store.setStartDate(null);
    }
    if (props.onChange) {
      store.setOnChange(props.onChange);
    }

    if (props.rruleString) {
      store.setStoreFromRRuleString(props.rruleString);
    } else {
      store.setFrequency(props.defaultFrequency ?? Frequency.WEEKLY);
      if (props.initialStartDate && showStartDate()) {
        store.setStartDate(props.initialStartDate);
      }
    }
  });

  return (
    <div class="flex flex-col gap-4">
      <Show when={showStartDate()}>
        <label class="flex flex-col gap-1 text-sm">
          <span>{startLabel()}</span>
          <input
            type="date"
            value={toDateInputValue(store.startDate())}
            onInput={(e) =>
              store.setStartDate(fromDateInputValue(e.target.value))
            }
            class="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)] px-2 py-1 text-[var(--color-text)]"
          />
        </label>
      </Show>

      <RepeatSelect
        frequencySelected={store.frequency()}
        onFrequencyChange={store.setFrequency}
        repeatDetails={store.repeatDetails}
        setRepeatDetails={store.setRepeatDetails}
        radioValue={store.radioValue}
        setRadioValue={store.setRadioValue}
        enableYearlyInterval={enableYearlyInterval()}
        enableResponsiveLayout={enableResponsiveLayout()}
      />

      <End
        endDetails={store.endDetails}
        setEndDetails={store.setEndDetails}
        minEndDate={store.minEndDate()}
        datePickerEndLabel={endLabel()}
      />

      <label class="flex flex-col gap-1 text-sm">
        <span>RRULE</span>
        <textarea
          rows="2"
          value={rruleText()}
          onInput={(e) => {
            setEditingRRuleText(true);
            setRRuleText(e.target.value);
          }}
          onBlur={commitRRuleText}
          onKeyDown={(e) => {
            // Enter commits the edit instead of inserting a newline;
            // Shift+Enter still allows a literal newline (needed for the
            // two-line "DTSTART:...\nRRULE:..." form).
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          class="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)] px-2 py-1 font-mono text-xs text-[var(--color-text)]"
        />
        <Show when={rruleTextError()}>
          <span class="text-[#dc3545]">{rruleTextError()}</span>
        </Show>
      </label>
    </div>
  );
}

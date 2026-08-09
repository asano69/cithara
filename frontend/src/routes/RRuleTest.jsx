// Temporary page for manually testing RRuleBuilder during Stage 5
// integration. Not part of the app's real navigation flow yet — just a
// place to click around and see the generated RRULE string update live.

import { createSignal } from "solid-js";
import RRuleBuilder from "../components/RRuleBuilder/RRuleBuilder";
import { BuilderStoreProvider, useBuilderStoreContext } from "../lib/rrule";

// Small helper component so it can read the RRULE string from the same
// store the builder writes to, without prop-drilling from the page level.
function RRulePreview() {
  const store = useBuilderStoreContext();
  return (
    <pre class="w-full overflow-x-auto rounded-md border border-[var(--color-border-soft)] bg-[var(--color-panel)] p-4 text-sm text-[var(--color-text)]">
      {store.rruleString() ?? "(no rule yet)"}
    </pre>
  );
}

export default function RRuleTest() {
  const [lastChange, setLastChange] = createSignal("");

  return (
    <>
      <h1 class="font-serif text-4xl">RRule Builder (test)</h1>

      <BuilderStoreProvider>
        <RRuleBuilder onChange={setLastChange} enableYearlyInterval />
        <RRulePreview />
      </BuilderStoreProvider>

      <div class="text-sm text-[var(--color-border-soft)]">
        Last onChange value: {lastChange() || "(none)"}
      </div>
    </>
  );
}

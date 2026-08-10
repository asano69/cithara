// Temporary page for manually testing RRuleBuilder during Stage 5
// integration. Not part of the app's real navigation flow yet — just a
// place to click around and see the generated RRULE string update live.

import { createSignal } from "solid-js";
import RRuleBuilder from "../components/RRuleBuilder/RRuleBuilder";
import { BuilderStoreProvider } from "../lib/rrule";

// RRuleBuilder now has its own editable "RRULE string" field (see
// RRuleBuilder.jsx), so a separate read-only preview here would just
// duplicate that display.
export default function RRuleTest() {
  const [lastChange, setLastChange] = createSignal("");

  return (
    <>
      <h1 class="font-serif text-4xl">RRule Builder (test)</h1>

      <BuilderStoreProvider>
        <RRuleBuilder onChange={setLastChange} enableYearlyInterval />
      </BuilderStoreProvider>

      <div class="text-sm text-[var(--color-border-soft)]">
        Last onChange value: {lastChange() || "(none)"}
      </div>
    </>
  );
}

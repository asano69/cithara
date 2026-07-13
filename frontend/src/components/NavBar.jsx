import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { A } from "@solidjs/router";
import pb from "../lib/pb";
import { loadTimezone, formatNowInTz } from "../lib/tz";

export default function NavBar(props) {
  const [refreshing, setRefreshing] = createSignal(false);
  const [tz, setTz] = createSignal(null);
  const [clock, setClock] = createSignal("");

  const handleLogout = () => pb.authStore.clear();

  onMount(async () => {
    const resolvedTz = await loadTimezone();
    setTz(resolvedTz);
    setClock(formatNowInTz(resolvedTz));

    // A minute is plenty of precision for a clock display.
    const intervalId = setInterval(() => {
      setClock(formatNowInTz(resolvedTz));
    }, 60000);
    onCleanup(() => clearInterval(intervalId));
  });

  return (
    <div class="mb-10 flex w-full flex-wrap items-center justify-between gap-y-3">
      <div class="flex flex-wrap items-center gap-4">
        <A
          href="/"
          class="font-serif text-4xl flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <img src="/favicon.svg" alt="" class="h-12 w-12" />
          <h1>Cithara</h1>
        </A>
        <Show when={tz()}>
          <span class="text-sm text-[var(--color-border-soft)]">
            {clock()} ({tz()})
          </span>
        </Show>
      </div>
      <nav class="flex flex-wrap items-center gap-3">
        <A href="/new" class="btn">
          New
        </A>
        <A href="/stats" class="btn">
          Stats
        </A>
        <A href="/settings" class="btn">
          Settings
        </A>
        <A href="/rrule-test" class="btn">
          RRule
        </A>
        <button type="button" class="btn" onClick={handleLogout}>
          Log out
        </button>
      </nav>
    </div>
  );
}

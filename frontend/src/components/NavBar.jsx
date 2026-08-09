import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { A } from "@solidjs/router";
import pb from "../lib/pb";
import { loadTimezone, formatNowInTz } from "../lib/tz";
import Logo from "./Logo";

export default function NavBar() {
  const [tz, setTz] = createSignal(null);
  const [clock, setClock] = createSignal("");

  const handleLogout = () => pb.authStore.clear();

onMount(() => {
    let intervalId;

    loadTimezone().then((resolvedTz) => {
      setTz(resolvedTz);
      setClock(formatNowInTz(resolvedTz));

      // Ticks every second now that seconds are shown (debugging aid).
      intervalId = setInterval(() => {
        setClock(formatNowInTz(resolvedTz));
      }, 1000);
    });

    onCleanup(() => clearInterval(intervalId));
  });


return (
    <div class="mb-10 flex w-full flex-wrap items-center justify-between gap-y-3">
      <div class="flex flex-wrap items-center gap-4">
        <Logo linkable />
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

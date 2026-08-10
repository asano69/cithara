import { onMount, createSignal, Show, For } from "solid-js";
import pb from "../lib/pb";

// Debug view of the scheduler's in-memory next-occurrence calculation for
// each note (GET /api/schedule/debug, see internal/scheduler.Snapshot).
// Nothing shown here is persisted — this just exposes what the scheduler
// currently believes, so a mismatch against what was saved from the note
// form is easy to spot.
function ScheduleDebug() {
  const [entries, setEntries] = createSignal([]);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await pb.send("/api/schedule/debug", { method: "GET" });
      setEntries(data ?? []);
    } catch (err) {
      setError(
        err?.response?.message ?? err?.message ?? "Failed to load schedule.",
      );
    } finally {
      setLoading(false);
    }
  };

  onMount(load);

  return (
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h2 class="font-serif text-2xl">Schedule (debug)</h2>
        <button type="button" class="btn" onClick={load} disabled={loading()}>
          {loading() ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error() && <p class="text-sm text-[#dc3545]">{error()}</p>}

      <Show when={!loading() && !error() && entries().length === 0}>
        <p class="text-sm text-[var(--color-border-soft)]">
          No scheduled notes.
        </p>
      </Show>

      <Show when={entries().length > 0}>
        <div class="overflow-x-auto rounded-md border border-[var(--color-border-soft)]">
          <table class="w-full text-left text-sm">
            <thead class="bg-[var(--color-panel)]">
              <tr>
                <th class="px-3 py-2">Label</th>
                <th class="px-3 py-2">DTSTART</th>
                <th class="px-3 py-2">RRULE</th>
                <th class="px-3 py-2">Next</th>
              </tr>
            </thead>
            <tbody>
              <For each={entries()}>
                {(e) => (
                  <tr class="border-t border-[var(--color-border-soft)]">
                    <td class="px-3 py-2">{e.label}</td>
                    <td class="px-3 py-2 font-mono">{e.dtstart}</td>
                    <td class="px-3 py-2 font-mono">{e.rrule}</td>
                    <td class="px-3 py-2 font-mono">{e.next}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
}

// Timeline of past notification delivery attempts (GET
// /api/notifications/history, see scheduler.recordHistory), newest first.
function NotificationHistory() {
  const [entries, setEntries] = createSignal([]);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await pb.send("/api/notifications/history", {
        method: "GET",
      });
      setEntries(data ?? []);
    } catch (err) {
      setError(
        err?.response?.message ??
          err?.message ??
          "Failed to load notification history.",
      );
    } finally {
      setLoading(false);
    }
  };

  onMount(load);

  return (
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h2 class="font-serif text-2xl">Notification history</h2>
        <button type="button" class="btn" onClick={load} disabled={loading()}>
          {loading() ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error() && <p class="text-sm text-[#dc3545]">{error()}</p>}

      <Show when={!loading() && !error() && entries().length === 0}>
        <p class="text-sm text-[var(--color-border-soft)]">
          No notifications yet.
        </p>
      </Show>

      <Show when={entries().length > 0}>
        <ul class="flex flex-col gap-2">
          <For each={entries()}>
            {(e) => (
              <li class="rounded-md border border-[var(--color-border-soft)] px-3 py-2 text-sm">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-semibold">{e.label}</span>
                  <span
                    class={
                      e.success
                        ? "text-[var(--color-progress)]"
                        : "text-[#dc3545]"
                    }
                  >
                    {e.success ? "sent" : "failed"}
                  </span>
                </div>
                <div class="font-mono text-xs text-[var(--color-border-soft)]">
                  {e.created} · {e.provider}
                </div>
                {!e.success && e.error && (
                  <div class="text-xs text-[#dc3545]">{e.error}</div>
                )}
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}

export default function Stats() {
  return (
    <>
      <h1 class="font-serif text-4xl">Stats</h1>
      <ScheduleDebug />
      <NotificationHistory />
    </>
  );
}

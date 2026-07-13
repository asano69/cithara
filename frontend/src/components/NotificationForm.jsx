// Shared form for both creating and editing a notification connection
// (same create/edit reuse pattern as NoteForm.jsx: one component, an
// optional existing record to pre-fill, saves directly to PocketBase).
import { createSignal } from "solid-js";
import pb from "../lib/pb";
import { testGotifyConnection } from "../lib/gotify";

// props.notification: pass an existing PocketBase notifications record to
// edit it, or omit/pass null to create a new one.
// props.onDone: called after a successful save.
// props.onCancel: optional, shows a Cancel button when provided.
export default function NotificationForm(props) {
  const [provider, setProvider] = createSignal(
    props.notification?.provider ?? "gotify",
  );
  const [endpoint, setEndpoint] = createSignal(
    props.notification?.endpoint ?? "",
  );
  const [token, setToken] = createSignal(props.notification?.token ?? "");
  const [channel, setChannel] = createSignal(props.notification?.channel ?? "");
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal("");
  const [testing, setTesting] = createSignal(false);
  const [testResult, setTestResult] = createSignal(null); // { ok, message }

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await testGotifyConnection({ endpoint: endpoint(), token: token() });
      setTestResult({ ok: true, message: "Connection succeeded." });
    } catch (err) {
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const data = {
        provider: provider(),
        endpoint: endpoint(),
        token: token(),
        channel: channel(),
      };
      if (props.notification) {
        await pb
          .collection("notifications")
          .update(props.notification.id, data);
      } else {
        await pb.collection("notifications").create(data);
      }
      if (props.onDone) props.onDone();
    } catch (err) {
      console.error("save notification failed:", err?.response ?? err);
      setError(err?.response?.message ?? "Failed to save the connection.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      class="flex w-full flex-col gap-4 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-field)] p-6 shadow-[0_1px_3px_0_var(--color-shadow)]"
    >
      <label class="flex flex-col gap-1 text-sm">
        <span>Provider</span>
        <select
          value={provider()}
          onChange={(e) => setProvider(e.target.value)}
          class="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)] px-2 py-1 text-[var(--color-text)]"
        >
          <option value="gotify">Gotify</option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span>Endpoint URL</span>
        <input
          type="url"
          value={endpoint()}
          onInput={(e) => setEndpoint(e.target.value)}
          placeholder="https://gotify.example.com"
          required
          class="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)] px-2 py-1 text-[var(--color-text)]"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span>App Token</span>
        <input
          type="password"
          value={token()}
          onInput={(e) => setToken(e.target.value)}
          required
          autocomplete="off"
          class="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)] px-2 py-1 text-[var(--color-text)]"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span>Channel (optional)</span>
        <input
          type="text"
          value={channel()}
          onInput={(e) => setChannel(e.target.value)}
          class="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)] px-2 py-1 text-[var(--color-text)]"
        />
      </label>

      {testResult() && (
        <p
          class={
            testResult().ok
              ? "text-sm text-[var(--color-progress)]"
              : "text-sm text-[#dc3545]"
          }
        >
          {testResult().message}
        </p>
      )}
      {error() && <p class="text-sm text-[#dc3545]">{error()}</p>}

      <div class="flex flex-wrap gap-2">
        <button type="submit" class="btn" disabled={pending()}>
          {pending() ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          class="btn"
          onClick={handleTest}
          disabled={testing() || !endpoint() || !token()}
        >
          {testing() ? "Testing…" : "Test connection"}
        </button>
        {props.onCancel && (
          <button type="button" class="btn" onClick={props.onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

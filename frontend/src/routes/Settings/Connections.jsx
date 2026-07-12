// Settings section for managing notification (Gotify) connections. Lists
// existing "notifications" records as cards and reuses NotificationForm for
// both adding a new connection and editing an existing one — the same
// create/edit reuse pattern as NoteForm.jsx / EditEntry.jsx.
import { createSignal, onMount, For, Show } from "solid-js";
import pb from "../../lib/pb";
import NotificationForm from "../../components/NotificationForm";

export default function Connections() {
  const [connections, setConnections] = createSignal([]);
  const [editing, setEditing] = createSignal(null); // null = list, "new" = create form, record = edit form

  const loadConnections = async () => {
    const list = await pb
      .collection("notifications")
      .getFullList({ sort: "-created" });
    setConnections(list);
  };

  onMount(loadConnections);

  const handleDone = async () => {
    setEditing(null);
    await loadConnections();
  };

  const handleDelete = async (id) => {
    await pb.collection("notifications").delete(id);
    await loadConnections();
  };

  return (
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h2 class="font-serif text-2xl">Connections</h2>
        <Show when={editing() === null}>
          <button type="button" class="btn" onClick={() => setEditing("new")}>
            + Add Connection
          </button>
        </Show>
      </div>

      <Show when={editing() !== null}>
        <NotificationForm
          notification={editing() === "new" ? null : editing()}
          onDone={handleDone}
          onCancel={() => setEditing(null)}
        />
      </Show>

      <Show when={editing() === null}>
        <ul class="flex flex-col gap-3">
          <For each={connections()}>
            {(conn) => (
              <li class="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-field)] p-4 shadow-[0_1px_3px_0_var(--color-shadow)]">
                <div>
                  <p class="font-semibold">{conn.provider}</p>
                  <p class="text-sm text-[var(--color-border-soft)]">
                    {conn.endpoint}
                    {conn.channel ? ` · ${conn.channel}` : ""}
                  </p>
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="btn"
                    onClick={() => setEditing(conn)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="btn"
                    onClick={() => handleDelete(conn.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            )}
          </For>
          <Show when={connections().length === 0}>
            <p class="text-sm text-[var(--color-border-soft)]">
              No connections yet.
            </p>
          </Show>
        </ul>
      </Show>
    </div>
  );
}

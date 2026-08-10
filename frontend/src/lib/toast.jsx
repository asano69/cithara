import { Toast, toaster } from "@kobalte/core/toast";

// Thin wrapper around Kobalte's render-prop toast API, so callers just
// pass a message instead of building the toast markup themselves.
export function showToast(message) {
  toaster.show((props) => (
    <Toast
      toastId={props.toastId}
      class="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-field)] px-4 py-3 text-sm text-[var(--color-text)] shadow-[0_1px_3px_0_var(--color-shadow)]"
    >
      <Toast.Description>{message}</Toast.Description>
    </Toast>
  ));
}

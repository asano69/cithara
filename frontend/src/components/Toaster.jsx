import { Toast } from "@kobalte/core/toast";
import { Portal } from "solid-js/web";

// Renders the toast viewport once for the whole app (mounted from
// AppShell). Toasts themselves are triggered elsewhere via lib/toast.jsx's
// showToast().
export default function Toaster() {
  return (
    <Portal>
      <Toast.Region placement="bottom-end">
        <Toast.List class="fixed bottom-4 right-4 z-50 flex flex-col gap-2" />
      </Toast.Region>
    </Portal>
  );
}

import Admin from "./Admin";
import Connections from "./Connections";

// Settings page: each section (e.g. Admin) lives in its own file and is
// laid out here one after another — no tabs, no extra state. Add further
// sections the same way as the app grows.
export default function Settings() {
  return (
    <div class="flex w-full flex-col gap-12">
      <Connections />
      <Admin />
    </div>
  );
}

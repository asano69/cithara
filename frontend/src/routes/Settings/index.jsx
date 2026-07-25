import NavBar from "../../components/NavBar";
import Admin from "./Admin";
import Connections from "./Connections";

// Settings page: each section (e.g. Admin) lives in its own file and is
// laid out here one after another — no tabs, no extra state. Add further
// sections the same way as the app grows.
export default function Settings() {
  return (
    <div class="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-12 bg-[var(--color-bg)] px-6 py-12 text-[var(--color-text)]">
      <NavBar />

      <Connections />
      <Admin />
    </div>
  );
}

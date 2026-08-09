import { createSignal, onCleanup, Show } from "solid-js";

import pb from "./pb";
import Login from "../routes/Login";

// AuthGate blocks the whole app behind Login until a valid superuser
// session exists, tracking pb.authStore so it reacts immediately to
// both login and logout.
export default function AuthGate(props) {
  const [authed, setAuthed] = createSignal(pb.authStore.isValid);
  const unsubscribe = pb.authStore.onChange(() =>
    setAuthed(pb.authStore.isValid),
  );
  onCleanup(unsubscribe);

  return (
    <Show when={authed()} fallback={<Login />}>
      {props.children}
    </Show>
  );
}

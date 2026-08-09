// Edit page for an existing note. Loads the record by id, then renders
// the same NoteForm used for creation, pre-filled.
import { Show, createResource } from "solid-js";
import { useParams } from "@solidjs/router";
import NoteForm from "../components/NoteForm";
import pb from "../lib/pb";

export default function EditEntry() {
  const params = useParams();
  const [note] = createResource(
    () => params.id,
    (id) => pb.collection("notes").getOne(id),
  );

  return (
    <>
      <h1 class="font-serif text-4xl">Edit Entry</h1>
      <Show when={note()}>
        <NoteForm note={note()} />
      </Show>
    </>
  );
}

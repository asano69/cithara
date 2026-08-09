// New entry creation page. The form itself lives in NoteForm.jsx, shared
// with EditEntry.jsx.
import NoteForm from "../components/NoteForm";

export default function NewEntry() {
  return (
    <>
      <h1 class="font-serif text-4xl">New Entry</h1>
      <NoteForm />
    </>
  );
}

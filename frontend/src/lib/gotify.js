// Calls kithara's own /api/notifications/test route instead of hitting the
// user's Gotify server directly from the browser. A direct browser->Gotify
// request gets blocked by CORS (Gotify doesn't send an
// Access-Control-Allow-Origin header for arbitrary browser origins), so the
// kithara backend makes the outbound request server-side and reports the
// result back over the same origin as the rest of the app's API.
import pb from "./pb";

export async function testGotifyConnection({ endpoint, token }) {
  if (!endpoint || !token) {
    throw new Error("Endpoint and token are required.");
  }

  try {
    await pb.send("/api/notifications/test", {
      method: "POST",
      body: { endpoint, token },
    });
  } catch (err) {
    throw new Error(
      err?.response?.message ?? err?.message ?? "Connection failed.",
    );
  }
}

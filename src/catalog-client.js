export async function musicRequest(path, { signal, body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      signal,
      ...(body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Couldn’t connect. Please try again.");
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    console.error("[Needle API]", {
      code: "API_NOT_CONNECTED",
      path: path.split("?")[0],
      status: response.status,
      contentType,
    });
    throw new Error("Music is temporarily unavailable. Please try again.");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Music is temporarily unavailable. Please try again.");
  }
  if (!response.ok)
    throw new Error(data.error || "The music request failed. Try again.");
  return data;
}
export async function resolvePlaylist(
  tracks,
  { signal, progress = () => {} } = {},
) {
  // Keep provider previews from the playlist itself; only search for missing clips.
  const results = tracks.map((input) =>
    input.preview ? { input, track: input.preview } : null,
  );
  const pending = tracks
    .map((input, index) => ({ input, index }))
    .filter((item) => !results[item.index]);
  let done = results.filter(Boolean).length;
  progress(done, tracks.length);
  for (let i = 0; i < pending.length; i += 4) {
    signal?.throwIfAborted();
    const batch = pending.slice(i, i + 4);
    const data = await musicRequest("/api/resolve", {
      signal,
      body: {
        tracks: batch.map((item) => ({
          title: item.input.title,
          artist: item.input.artist,
        })),
      },
    });
    if (!Array.isArray(data.results) || data.results.length !== batch.length)
      throw new Error("Couldn’t load these songs. Please try again.");
    data.results.forEach((result, index) => {
      results[batch[index].index] = result;
    });
    done += batch.length;
    progress(done, tracks.length);
  }
  return results;
}

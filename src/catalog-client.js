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
    throw new Error(
      "Could not reach the music server. Check your connection and try again.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The music server returned an unreadable response. Make sure the Node server is running.",
    );
  }
  if (!response.ok)
    throw new Error(data.error || "The music request failed. Try again.");
  return data;
}
export async function resolvePlaylist(
  tracks,
  { signal, progress = () => {} } = {},
) {
  const results = [];
  progress(0, tracks.length);
  for (let i = 0; i < tracks.length; i += 8) {
    signal?.throwIfAborted();
    const data = await musicRequest("/api/resolve", {
      signal,
      body: { tracks: tracks.slice(i, i + 8) },
    });
    if (
      !Array.isArray(data.results) ||
      data.results.length !== Math.min(8, tracks.length - i)
    )
      throw new Error(
        "The music server returned an incomplete match report. Retry the import.",
      );
    results.push(...data.results);
    progress(results.length, tracks.length);
  }
  return results;
}

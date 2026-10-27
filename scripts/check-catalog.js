import { createCatalogService, fetchUpstream } from "../server/catalog.js";
const service = createCatalogService();
let failed = false;
for (const artist of ["KR$NA", "Seedhe Maut", "Raftaar"]) {
  try {
    const { tracks } = await service.search(artist);
    console.log(`${artist}: ${tracks.length} playable preview results`);
    if (!tracks.length) {
      failed = true;
      continue;
    }
    const response = await fetchUpstream(tracks[0].url, {
      headers: { Range: "bytes=0-4095" },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !/audio|octet-stream/i.test(contentType))
      throw new Error(
        `Preview endpoint returned HTTP ${response.status} (${contentType}).`,
      );
    const reader = response.body.getReader();
    const chunk = await reader.read();
    await reader.cancel();
    if (chunk.done || !chunk.value.length)
      throw new Error("Preview contained no audio bytes.");
    console.log(
      `  Audio endpoint delivered ${chunk.value.length} bytes (${contentType}). Opening-of-song playback is NOT guaranteed.`,
    );
  } catch (error) {
    failed = true;
    console.error(`${artist}: ${error.message}`);
  }
}
const playlist = process.argv[2];
if (playlist) {
  try {
    const result = await service.playlist(playlist);
    console.log(
      `Spotify public metadata: ${result.tracks.length} listed tracks; complete playlist not guaranteed.`,
    );
  } catch (error) {
    failed = true;
    console.error(`Spotify: ${error.message}`);
  }
}
process.exitCode = failed ? 1 : 0;

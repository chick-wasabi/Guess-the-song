import { createCatalogService, fetchUpstream } from "../server/catalog.js";
const service = createCatalogService();
const input = process.argv.slice(2).find((v) => !v.startsWith("--"));
if (!input) {
  console.error(
    "Usage: npm run check:catalog -- <public Spotify playlist URL or search text> [--all]",
  );
  process.exit(1);
}
let tracks;
if (input.startsWith("https://")) {
  const playlist = await service.playlist(input);
  tracks = playlist.tracks.filter((t) => t.preview).map((t) => t.preview);
  console.log(
    `Listed: ${playlist.tracks.length}; direct previews: ${tracks.length}. Public-page completeness is not guaranteed.`,
  );
} else {
  ({ tracks } = await service.search(input));
  console.log(`Search returned ${tracks.length} preview recordings.`);
}
if (!tracks.length) throw new Error("No playable previews found.");
const selected = process.argv.includes("--all") ? tracks : tracks.slice(0, 1);
for (const track of selected) {
  const response = await fetchUpstream(track.url, {
    headers: { Range: "bytes=0-4095" },
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  const type = response.headers.get("content-type") || "";
  if (!response.ok || !/audio|octet-stream/i.test(type))
    throw new Error(`Audio delivery failed: HTTP ${response.status} (${type})`);
  const reader = response.body.getReader();
  const chunk = await reader.read();
  await reader.cancel();
  if (chunk.done || !chunk.value.length)
    throw new Error("Audio contained no bytes.");
  console.log(`Audio verified (${response.status}, ${type}): ${track.title}`);
}
console.log(
  `Verified ${selected.length} audio endpoints. Preview positions are provider-selected, not necessarily original-song openings.`,
);

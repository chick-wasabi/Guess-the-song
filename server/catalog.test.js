import { test } from "node:test";
import assert from "node:assert/strict";
import {
  playlistId,
  parseSpotifyPlaylist,
  previewTrack,
  findMatch,
  parseTrackList,
  createCatalogService,
} from "./catalog.js";
const raw = (id = 1, title = "No Cap", artist = "KR$NA") => ({
  id,
  title,
  artist: { name: artist },
  preview: `https://cdnt-preview.dzcdn.net/api/preview-${id}.mp3`,
  link: `https://www.deezer.com/track/${id}`,
  readable: true,
});
const html = (entity) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { state: { data: { entity } } } } })}</script></html>`;
test("Spotify URL parsing accepts share links but rejects credentialed links and arbitrary destinations", () => {
  const id = "1234567890123456789012";
  assert.equal(
    playlistId(`https://open.spotify.com/playlist/${id}?si=example`),
    id,
  );
  assert.equal(
    playlistId(`https://open.spotify.com/intl-en/playlist/${id}`),
    id,
  );
  for (const value of [
    `http://open.spotify.com/playlist/${id}`,
    `https://open.spotify.com.evil.test/playlist/${id}`,
    `https://user:pass@open.spotify.com/playlist/${id}`,
    `https://open.spotify.com/track/${id}`,
    "https://localhost/",
    "spotify:playlist:test",
  ])
    assert.throws(
      () => playlistId(value),
      (e) => e.code === "INVALID_PLAYLIST",
    );
});
test("public embed parser reports partial visibility and never treats preview audio as Spotify playback", () => {
  const playlist = parseSpotifyPlaylist(
    html({
      name: "My rap",
      trackCount: 100,
      trackList: [
        {
          title: "No Cap",
          subtitle: "KR$NA",
          uri: "spotify:track:1234567890123456789012",
          audioPreview: { url: "https://audio.example/ignored" },
        },
      ],
    }),
  );
  assert.equal(playlist.tracks.length, 1);
  assert.equal(playlist.total, 100);
  assert.equal(playlist.completeness, "public-preview");
  assert.ok(playlist.warning.includes("only part"));
  assert.equal(playlist.tracks[0].url, undefined);
});
test("private/unavailable/changed Spotify pages fail clearly", () => {
  for (const body of [
    "<html>Log in</html>",
    html({}),
    html({ trackList: [] }),
    '<script id="__NEXT_DATA__">bad json</script>',
  ])
    assert.throws(() => parseSpotifyPlaylist(body));
});
test("only playable provider audio and attribution links survive normalization", () => {
  assert.equal(previewTrack(raw()).source, "deezer");
  for (const input of [
    { ...raw(), preview: null },
    { ...raw(), readable: false },
    { ...raw(), preview: "http://cdnt-preview.dzcdn.net/x.mp3" },
    { ...raw(), preview: "https://cdnt-preview.dzcdn.net.evil.test/x" },
    { ...raw(), link: "javascript:alert(1)" },
    { ...raw(), artist: {} },
  ])
    assert.equal(previewTrack(input), null);
});
test("playlist matching requires exact artist/title and preserves distinct versions", () => {
  const base = previewTrack(raw());
  assert.equal(findMatch({ title: "No Cap", artist: "KR$NA" }, [base]), base);
  assert.equal(
    findMatch({ title: "No Cap (Live)", artist: "KR$NA" }, [base]),
    null,
  );
  assert.equal(
    findMatch({ title: "No Cap", artist: "Another Artist" }, [base]),
    null,
  );
  assert.equal(findMatch({ title: "Cap", artist: "KR$NA" }, [base]), null);
});
test("pasted names need no music download and keep hyphens in titles", () => {
  assert.deepEqual(parseTrackList("KR$NA - No Cap\nArtist - Song - Remix"), [
    { artist: "KR$NA", title: "No Cap" },
    { artist: "Artist", title: "Song - Remix" },
  ]);
  assert.throws(() => parseTrackList("Unknown formatting"));
});
test("catalog search fetches only the fixed provider and caches successful responses", async () => {
  let calls = 0;
  const service = createCatalogService({
    fetchImpl: async (url) => {
      calls++;
      assert.equal(url.hostname, "api.deezer.com");
      assert.equal(url.searchParams.get("q"), "KR$NA");
      return new Response(JSON.stringify({ data: [raw()] }));
    },
  });
  assert.equal((await service.search("KR$NA")).tracks.length, 1);
  await service.search("KR$NA");
  assert.equal(calls, 1);
  await assert.rejects(service.search("x"));
});
test("network denial, provider error and rate limits remain explicit failures", async () => {
  const denied = createCatalogService({
    fetchImpl: async () => {
      throw new Error("proxy private detail");
    },
  });
  await assert.rejects(
    denied.search("Raftaar"),
    (e) =>
      e.code === "NETWORK_BLOCKED" && !e.message.includes("private detail"),
  );
  const busy = createCatalogService({
    fetchImpl: async () => new Response("", { status: 429 }),
  });
  await assert.rejects(busy.search("Raftaar"), (e) => e.status === 429);
  const rejected = createCatalogService({
    fetchImpl: async () => new Response(JSON.stringify({ error: { code: 4 } })),
  });
  await assert.rejects(
    rejected.search("Raftaar"),
    (e) => e.code === "PROVIDER_ERROR",
  );
});
test("resolve preserves an unmatched track instead of selecting a wrong recording", async () => {
  const service = createCatalogService({
    fetchImpl: async () => new Response(JSON.stringify({ data: [raw()] })),
  });
  const { results } = await service.resolve([
    { title: "No Cap", artist: "KR$NA" },
    { title: "No Cap", artist: "Someone else" },
  ]);
  assert.equal(results[0].track.id, "deezer:1");
  assert.equal(results[1].track, null);
  await assert.rejects(
    service.resolve(Array(9).fill({ title: "No Cap", artist: "KR$NA" })),
  );
});

test("public metadata parser supports base64 embed formats and artist arrays", () => {
  const entity = {
    name: "Mix",
    trackList: [
      { title: "Song", artists: [{ name: "Artist A" }, { name: "Artist B" }] },
    ],
  };
  for (const [id, payload] of [
    ["resource", entity],
    ["initial-state", { data: { entity } }],
  ]) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
    const parsed = parseSpotifyPlaylist(
      `<script id="${id}">${encoded}</script>`,
    );
    assert.equal(parsed.tracks[0].artist, "Artist A, Artist B");
    assert.equal(parsed.tracks[0].title, "Song");
  }
});

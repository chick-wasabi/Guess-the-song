import { test } from "node:test";
import assert from "node:assert/strict";
import { matches, trackFromFile, CLIPS, POINTS } from "./game.js";
test("all clue lengths have decreasing rewards", () => {
  assert.deepEqual(CLIPS, [0.1, 0.5, 1, 2, 5, 10]);
  assert.equal(POINTS.length, CLIPS.length);
  assert.ok(POINTS.every((p, i) => i === 0 || p < POINTS[i - 1]));
});
test("answers ignore punctuation and case but reject partial titles", () => {
  const song = {
    title: "Frère Jacques",
    artist: "Traditional",
    aliases: ["Brother John"],
  };
  assert.ok(matches("frere jacques!", song));
  assert.ok(matches("Brother John", song));
  assert.equal(matches("Frere", song), false);
});
test("local file metadata keeps multi-part titles", () => {
  assert.deepEqual(
    trackFromFile({ name: "Artist - Song - Remix.mp3" }, "blob:test"),
    {
      id: "blob:test",
      title: "Song - Remix",
      artist: "Artist",
      url: "blob:test",
    },
  );
});

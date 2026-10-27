import { test } from "node:test";
import assert from "node:assert/strict";
import { matches, CLIPS, POINTS } from "./game.js";
test("all clue lengths have decreasing rewards", () => {
  assert.deepEqual(CLIPS, [0.1, 0.5, 1, 2, 5, 10]);
  assert.equal(POINTS.length, CLIPS.length);
  assert.ok(POINTS.every((p, i) => i === 0 || p < POINTS[i - 1]));
});
test("answers ignore case and punctuation but reject partial titles", () => {
  const song = { title: "No Cap", artist: "KR$NA" };
  assert.ok(matches("NO CAP!", song));
  assert.ok(matches("No Cap KR$NA", song));
  assert.equal(matches("Cap", song), false);
});
test("non-Latin song titles cannot collapse into empty correct answers", () => {
  const song = { title: "नमस्ते", artist: "कलाकार" };
  assert.equal(matches("गीत", song), false);
  assert.ok(matches("नमस्ते", song));
});

test("Hindi vowel marks distinguish song titles", () => {
  assert.equal(matches("कल", { title: "काल", artist: "कलाकार" }), false);
});

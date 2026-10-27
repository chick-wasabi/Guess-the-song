import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { fetchUpstream } from "../server/catalog.js";
const playlist = process.argv[2];
if (!playlist)
  throw new Error("Pass the public Spotify playlist URL to verify.");
const base = process.env.NEEDLE_TEST_URL || "http://127.0.0.1:5173";
const response = await fetch(
  base + "/api/playlist?url=" + encodeURIComponent(playlist),
);
const data = await response.json();
assert.equal(response.status, 200);
const exact = data.tracks.filter((t) => t.preview);
assert.ok(exact.length);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let actualAudioRequests = 0,
    lastAudioUrl;
  // Chromium in cloud does not inherit the platform HTTP proxy. Deliver real
  // upstream audio through that approved proxy; no fixture audio is substituted.
  await page.route(
    /^https:\/\/(p\.scdn\.co|audio-ssl\.itunes\.apple\.com)\//,
    async (route) => {
      lastAudioUrl = route.request().url();
      const range = route.request().headers().range;
      const r = await fetchUpstream(lastAudioUrl, {
        headers: range ? { Range: range } : {},
        signal: AbortSignal.timeout(20000),
      });
      assert.ok(r.ok);
      const body = Buffer.from(await r.arrayBuffer());
      actualAudioRequests++;
      const headers = {};
      for (const name of ["content-type", "content-range", "accept-ranges"]) {
        const value = r.headers.get(name);
        if (value) headers[name] = value;
      }
      await route.fulfill({ status: r.status, headers, body });
    },
  );
  await page.addInitScript(() => {
    window.__plays = [];
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.__liveAudio = this;
      const entry = {};
      window.__plays.push(entry);
      this.addEventListener(
        "playing",
        () => (entry.start = performance.now()),
        { once: true },
      );
      this.addEventListener("pause", () => (entry.stop = performance.now()), {
        once: true,
      });
      this.addEventListener("ended", () => (entry.ended = performance.now()), {
        once: true,
      });
      return original.call(this);
    };
  });
  await page.goto(base);
  await page.locator("#paste-playlist").click();
  await page.locator("#playlist-url").fill(playlist);
  await page.getByRole("button", { name: "Find my songs" }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("#play-import") &&
      !document.querySelector("#play-import").disabled,
    {},
    { timeout: 60000 },
  );
  console.log("Import UI:", await page.locator("#library-status").innerText());
  await page.screenshot({
    path: "/tmp/needle-live-import.png",
    fullPage: true,
  });
  await page.locator("#play-import").click();
  await page.locator("#play").click();
  await page.waitForFunction(
    () => window.__plays[0]?.stop,
    {},
    { timeout: 20000 },
  );
  const first = await page.evaluate(() => window.__plays[0]);
  const clueMs = first.stop - first.start;
  assert.ok(clueMs >= 70 && clueMs < 450, `0.1-second clue took ${clueMs} ms`);
  console.log("Real Spotify clue duration:", Math.round(clueMs), "ms");
  const song = exact.find((t) => t.preview.url === lastAudioUrl);
  assert.ok(song, "Played audio must belong to the imported playlist");
  await page.locator("#guess").fill(song.title);
  await page.locator("#guess-form button").click();
  assert.equal(await page.locator(".clip-heading h2").innerText(), song.title);
  assert.match(await page.locator(".score-block strong").innerText(), /1,000/);
  await page.locator("#play").click();
  await page.waitForFunction(
    () => window.__plays[1]?.start,
    {},
    { timeout: 20000 },
  );
  await page.waitForFunction(
    () => window.__liveAudio.paused && window.__liveAudio.currentTime >= 19,
    {},
    { timeout: 35000 },
  );
  const reveal = await page.evaluate(() => ({
    current: window.__liveAudio.currentTime,
    duration: window.__liveAudio.duration,
  }));
  assert.ok(reveal.current >= 19 && reveal.current <= 31);
  console.log("Real reveal playback:", reveal.current.toFixed(2), "seconds");
  assert.ok(actualAudioRequests > 0);
  console.log(
    "PASS: real playlist import, actual preview decoding, 0.1-second clue, correct guess/scoring, and reveal playback.",
  );
  await page.screenshot({
    path: "/tmp/needle-live-reveal.png",
    fullPage: true,
  });
} finally {
  await browser.close();
}

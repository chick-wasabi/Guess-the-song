import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const audio = readFileSync("tests/fixtures/clip.wav");
const track = (id = 1, title = "No Cap", artist = "KR$NA") => ({
  id: `apple:${id}`,
  title,
  artist,
  url: `https://audio-ssl.itunes.apple.com/test-${id}.m4a`,
  source: "apple",
  sourceUrl: `https://music.apple.com/in/song/${id}`,
  clipKind: "preview",
});
async function mockCatalog(page, tracks = [track()]) {
  await page.route("**/api/search?*", (r) => r.fulfill({ json: { tracks } }));
  await page.route("https://audio-ssl.itunes.apple.com/**", (r) =>
    r.fulfill({ contentType: "audio/wav", body: audio }),
  );
}
async function loadMusic(page) {
  await page.locator("#quick-query").fill("KR$NA");
  await page.getByRole("button", { name: "Find songs", exact: true }).click();
  await expect(page.locator(".track-row").first()).toBeVisible();
  await page.locator("#select-results").click();
  await page.locator("#play-selection").click();
}
test("real audio decoding stops at 0.1 seconds; replaying an old clue cannot restore points", async ({
  page,
}) => {
  await mockCatalog(page);
  await page.addInitScript(() => {
    window.audioEvents = [];
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      this.addEventListener(
        "playing",
        () => window.audioEvents.push({ type: "play", at: performance.now() }),
        { once: true },
      );
      this.addEventListener(
        "pause",
        () => window.audioEvents.push({ type: "pause", at: performance.now() }),
        { once: true },
      );
      return original.call(this);
    };
  });
  await page.goto("/");
  await loadMusic(page);
  await page.getByRole("button", { name: "Play audio clue" }).click();
  await expect
    .poll(() => page.evaluate(() => window.audioEvents.length))
    .toBeGreaterThanOrEqual(2);
  const events = await page.evaluate(() => window.audioEvents);
  expect(events[1].at - events[0].at).toBeGreaterThan(70);
  expect(events[1].at - events[0].at).toBeLessThan(400);
  await page.locator("#skip").click();
  await expect(page.locator(".points")).toContainText("800");
  await page
    .getByRole("button", { name: "Replay 0.1 second clue", exact: true })
    .click();
  await page.locator("#guess").fill("No Cap");
  await page.locator("#guess-form button").click();
  await expect(page.locator(".score-block strong")).toContainText("800");
  await expect(page.locator(".clip-heading h2")).toHaveText("No Cap");
  await expect(page.locator(".clip-heading p")).toHaveText("KR$NA");
  await expect(
    page.getByRole("link", { name: "Open in Apple Music" }),
  ).toHaveAttribute("href", "https://music.apple.com/in/song/1");
  await page.getByRole("button", { name: "Play song reveal" }).click();
  await expect(page.locator(".record")).toHaveClass(/spinning/);
  await page.locator("#next").click();
  await expect(page.getByRole("dialog")).toContainText("800");
});
test("wrong guesses, increasing clues, reveal, results and restart", async ({
  page,
}) => {
  await mockCatalog(page);
  await page.goto("/");
  await loadMusic(page);
  await page.locator("#guess").fill("Wrong");
  await page.locator("#guess-form button").click();
  await expect(page.getByRole("status")).toContainText("Not quite");
  for (let i = 0; i < 5; i++) await page.locator("#skip").click();
  await expect(page.locator(".points")).toContainText("100 PTS");
  await page.locator("#skip").click();
  await expect(page.locator(".clip-heading h2")).toHaveText("No Cap");
  await expect(page.locator(".score-block strong")).toContainText("0");
  await page.locator("#next").click();
  await page.getByRole("button", { name: "One more spin" }).click();
  await expect(page.locator(".points")).toContainText("1000");
});
test("pass-and-play completes a six-track session", async ({ page }) => {
  await mockCatalog(
    page,
    Array.from({ length: 6 }, (_, i) => track(i + 1, `Test song ${i + 1}`)),
  );
  await page.goto("/");
  await loadMusic(page);
  await page.getByRole("button", { name: "With friends" }).click();
  await page.locator("#names").fill("Ada, Bo");
  await page.getByRole("button", { name: "Let’s play" }).click();
  await page.getByRole("button", { name: "I’m ready" }).click();
  for (let i = 0; i < 6; i++) {
    await page.locator("#giveup").click();
    await page.locator("#next").click();
    if (i < 5) {
      await expect(page.getByRole("dialog")).toContainText(
        i % 2 === 0 ? "Bo," : "Ada,",
      );
      await page.getByRole("button", { name: "I’m ready" }).click();
    }
  }
  await expect(page.getByRole("dialog")).toContainText("6 tracks");
  await expect(page.locator(".results")).toContainText("Ada");
  await expect(page.locator(".results")).toContainText("Bo");
});
test("Spotify import shows partial visibility and unmatched songs before starting", async ({
  page,
}) => {
  await mockCatalog(page);
  const tracks = [
    { title: "No Cap", artist: "KR$NA" },
    { title: "Unavailable Song", artist: "Another Artist" },
  ];
  await page.route("**/api/playlist?*", (r) =>
    r.fulfill({
      json: {
        name: "My playlist",
        tracks,
        total: 40,
        warning: "The public page may list only part of your playlist.",
        completeness: "public-preview",
      },
    }),
  );
  await page.route("**/api/resolve", (r) =>
    r.fulfill({
      json: {
        results: [
          { input: tracks[0], track: track() },
          { input: tracks[1], track: null },
        ],
      },
    }),
  );
  await page.goto("/");
  await page.locator("#paste-playlist").click();
  await page
    .locator("#playlist-url")
    .fill("https://open.spotify.com/playlist/1234567890123456789012");
  await page.getByRole("button", { name: "Find my songs" }).click();
  await expect(page.locator("#library-status")).toHaveText(
    "1 song ready · 1 unavailable",
  );
  await expect(page.locator(".import-warning")).toHaveCount(0);
  await page.locator("summary").click();
  await expect(page.locator("#import-report li")).toContainText(
    "Unavailable Song",
  );
  await page.getByRole("button", { name: "Play 1 song", exact: true }).click();
  await expect(page.locator("#guess")).toBeVisible();
  await expect(page.locator(".side-panel h2")).toContainText("My playlist");
});
test("blocked catalog is an actionable error, never a demo fallback", async ({
  page,
}) => {
  await page.route("**/api/search?*", (r) =>
    r.fulfill({
      status: 502,
      json: {
        error: "Music service could not be reached. Check network access.",
      },
    }),
  );
  await page.goto("/");
  await page.locator("#quick-query").fill("Raftaar");
  await page.getByRole("button", { name: "Find songs", exact: true }).click();
  await expect(page.locator(".library-error")).toContainText(
    "Check network access",
  );
  await expect(page.locator("#play-selection")).toBeDisabled();
  await expect(page.locator("#search-results")).toBeEmpty();
});
test("unavailable audio reports an error without losing the round", async ({
  page,
}) => {
  await mockCatalog(page);
  await page.route("https://audio-ssl.itunes.apple.com/**", (r) =>
    r.fulfill({ status: 404, body: "gone" }),
  );
  await page.goto("/");
  await loadMusic(page);
  await page.locator("#play").click();
  await expect(page.locator("#feedback")).toContainText(
    "preview is unavailable",
  );
  await expect(page.locator(".record")).not.toHaveClass(/spinning/);
  await page.locator("#giveup").click();
  await expect(page.locator(".clip-heading h2")).toHaveText("No Cap");
});
for (const width of [320, 360, 390, 430, 1440])
  test(`catalog, empty and active layouts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockCatalog(page);
    await page.goto("/");
    const noOverflow = async () =>
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    await noOverflow();
    await page.screenshot({
      path: `/tmp/needle-catalog-${width}.png`,
      fullPage: true,
    });
    await loadMusic(page);
    await expect(page.locator("#play")).toBeVisible();
    await expect(page.locator("#guess")).toBeVisible();
    await noOverflow();
    await page.screenshot({
      path: `/tmp/needle-active-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Your music" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await noOverflow();
    await page.getByRole("tab", { name: "Spotify link" }).click();
    await noOverflow();
  });
test("switching clues while audio loads cannot restart a revealed round", async ({
  page,
}) => {
  await mockCatalog(page);
  await page.route("https://audio-ssl.itunes.apple.com/**", async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await r.fulfill({ contentType: "audio/wav", body: audio });
  });
  await page.goto("/");
  await loadMusic(page);
  await page.locator("#play").click();
  await page.locator("#skip").click();
  await page.locator("#giveup").click();
  await page.waitForTimeout(500);
  await expect(page.locator(".record")).not.toHaveClass(/spinning/);
  await expect(page.locator(".reveal-bottom p")).toContainText(
    "One for next time",
  );
});

test("pasted names resolve across batches and report unavailable songs", async ({
  page,
}) => {
  await mockCatalog(page);
  let batches = 0;
  await page.route("**/api/resolve", (route) => {
    batches++;
    const input = route.request().postDataJSON().tracks;
    return route.fulfill({
      json: {
        results: input.map((t, i) => ({
          input: t,
          track: i === 0 ? track() : null,
        })),
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Your music" }).click();
  await page.getByRole("tab", { name: "Track list" }).click();
  await page
    .locator("#tracklist")
    .fill(Array.from({ length: 9 }, (_, i) => `Artist - Song ${i}`).join("\n"));
  await page.getByRole("button", { name: "Find these songs" }).click();
  await expect(page.locator("#library-status")).toHaveText(
    "1 song ready · 6 unavailable",
  );
  expect(batches).toBe(3);
});

test("canceling an import cannot replace the current game", async ({
  page,
}) => {
  await mockCatalog(page);
  await page.goto("/");
  await loadMusic(page);
  await page.route("**/api/resolve", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      json: {
        results: [
          {
            input: { title: "New Song", artist: "Someone" },
            track: track(2, "New Song", "Someone"),
          },
        ],
      },
    });
  });
  await page.getByRole("button", { name: "Your music" }).click();
  await page.getByRole("tab", { name: "Track list" }).click();
  await page.locator("#tracklist").fill("Someone - New Song");
  await page.getByRole("button", { name: "Find these songs" }).click();
  await expect(page.locator("#library-status")).toContainText("Finding songs");
  await page.getByRole("button", { name: "Cancel import" }).click();
  await expect(page.locator("#library-status")).toContainText(
    "Import canceled",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.waitForTimeout(600);
  await page.locator("#giveup").click();
  await expect(page.locator(".clip-heading h2")).toHaveText("No Cap");
});

test("entry and playlist picker contain no example artists or developer notes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("[data-artist]")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("KR$NA");
  await expect(page.locator("body")).not.toContainText("Raftaar");
  await expect(page.locator("body")).not.toContainText("Seedhe Maut");
  await page.locator("#paste-playlist").click();
  await expect(page.locator("#dialog")).not.toContainText("Deezer");
  await expect(page.locator("#dialog")).not.toContainText("public page");
  await expect(page.locator("#dialog")).not.toContainText("No Spotify login");
  await expect(page.locator("#dialog")).not.toContainText("Node server");
});

test("HTML returned for an API request shows a short error and logs deployment diagnostics", async ({
  page,
}) => {
  let diagnostic = false;
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("[Needle API]"))
      diagnostic = true;
  });
  await page.route("**/api/search?*", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Static fallback</title>",
    }),
  );
  await page.goto("/");
  await page.locator("#quick-query").fill("Some artist");
  await page.getByRole("button", { name: "Find songs", exact: true }).click();
  await expect(page.locator(".library-error")).toHaveText(
    "Music is temporarily unavailable. Please try again.",
  );
  expect(diagnostic).toBe(true);
  await expect(page.locator("#dialog")).not.toContainText("Node");
});

test("playlist uses exact Spotify preview clips without calling a matching service", async ({
  page,
}) => {
  const spotify = {
    ...track(),
    id: "spotify:1234567890123456789012",
    url: "https://p.scdn.co/mp3-preview/" + "a".repeat(40),
    source: "spotify",
    sourceUrl: "https://open.spotify.com/track/1234567890123456789012",
  };
  let matchingCalls = 0;
  await page.route("**/api/playlist?*", (r) =>
    r.fulfill({
      json: {
        name: "Exact playlist",
        tracks: [
          { title: spotify.title, artist: spotify.artist, preview: spotify },
        ],
      },
    }),
  );
  await page.route("**/api/resolve", (r) => {
    matchingCalls++;
    return r.fulfill({
      status: 500,
      json: { error: "Matching should not be called" },
    });
  });
  await page.route("https://p.scdn.co/**", (r) =>
    r.fulfill({ contentType: "audio/wav", body: audio }),
  );
  await page.goto("/");
  await page.locator("#paste-playlist").click();
  await page
    .locator("#playlist-url")
    .fill("https://open.spotify.com/playlist/1234567890123456789012");
  await page.getByRole("button", { name: "Find my songs" }).click();
  await expect(page.locator("#library-status")).toHaveText("1 song ready");
  expect(matchingCalls).toBe(0);
  await page.getByRole("button", { name: "Play 1 song", exact: true }).click();
  await page.locator("#giveup").click();
  await expect(
    page.getByRole("link", { name: "Open in Spotify" }),
  ).toBeVisible();
  await page.locator("#play").click();
  await expect(page.locator(".record")).toHaveClass(/spinning/);
});

import { test, expect } from "@playwright/test";
const loadLocal = async (page) => {
  await page.getByRole("button", { name: "Your music" }).click();
  await page.locator("#files").setInputFiles({
    name: "Test Artist - Test Song.wav",
    mimeType: "audio/wav",
    buffer: (await import("node:fs")).readFileSync("public/audio/twinkle.wav"),
  });
};
test("real audio clue stops at 0.1 seconds and an old clue cannot restore points", async ({
  page,
}) => {
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
  await loadLocal(page);
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
  await page.locator("#guess").fill("Test Song");
  await page.locator("#guess-form button").click();
  await expect(page.locator(".score-block strong")).toContainText("800");
  await expect(page.locator(".clip-heading h2")).toHaveText("Test Song");
  await expect(page.locator(".clip-heading p")).toHaveText("Test Artist");
  await page.getByRole("button", { name: "Play song reveal" }).click();
  await expect(page.locator(".record")).toHaveClass(/spinning/);
  await page.locator("#next").click();
  await expect(page.getByRole("dialog")).toContainText("800");
});
test("wrong guesses, increasing clues, reveal, results and restart", async ({
  page,
}) => {
  await page.goto("/");
  await loadLocal(page);
  await page.locator("#guess").fill("Wrong");
  await page.locator("#guess-form button").click();
  await expect(page.getByRole("status")).toContainText("Not quite");
  for (let i = 0; i < 5; i++) await page.locator("#skip").click();
  await expect(page.locator(".points")).toContainText("100 PTS");
  await page.locator("#skip").click();
  await expect(page.locator(".clip-heading h2")).toHaveText("Test Song");
  await expect(page.locator(".score-block strong")).toContainText("0");
  await page.locator("#next").click();
  await page.getByRole("button", { name: "One more spin" }).click();
  await expect(page.locator(".points")).toContainText("1000");
  await expect(page.locator("#guess")).toBeVisible();
});
test("pass-and-play alternates players and completes a six-track session", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "With friends" }).click();
  await page.locator("#names").fill("Ada, Bo");
  await page.getByRole("button", { name: "Let’s play" }).click();
  await expect(page.getByRole("dialog")).toContainText("Ada,");
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
for (const width of [320, 360, 390, 430, 1440])
  test(`no horizontal overflow and playable controls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("#play")).toBeVisible();
    await expect(page.locator("#guess")).toBeVisible();
    await page.getByRole("button", { name: "Your music" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.screenshot({ path: `/tmp/needle-${width}.png`, fullPage: true });
  });

test("changing clues while audio loads cannot restart a revealed round", async ({
  page,
}) => {
  await page.route("**/audio/*.wav", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.continue();
  });
  await page.goto("/");
  await page.locator("#play").click();
  await page.locator("#skip").click();
  await page.locator("#giveup").click();
  await expect(page.locator(".reveal-badge")).toHaveText("REVEALED");
  await page.waitForTimeout(500);
  await expect(page.locator(".record")).not.toHaveClass(/spinning/);
  await expect(page.locator(".reveal-bottom p")).toContainText(
    "One for next time",
  );
});

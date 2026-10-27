# Needle

A mobile-first, game-first song guessing website. Play solo or pass the phone between 2–6 people. No backend or account is required.

## Run

Node 22.12+ or Node 24 and npm are required.

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

The Vite development server listens on port 5173. `npm run build` creates a static site in `dist/`; `npm run preview` serves that build on port 4173. Deploy `dist/` to a static hosting service when desired. No deployment service is configured.

## Play

- Listen to 0.1, 0.5, 1, 2, 5, or 10 seconds. Longer clues reduce the reward from 1,000 to 100 points.
- Enter the title, optionally using suggestions. Wrong guesses are free; replaying earlier clues does not restore points.
- After guessing or giving up, listen to up to 30 seconds, then move on.
- With friends is **pass-and-play on one device**, not online multiplayer. Players alternate across a shared shuffled collection. For a fair comparison, load a multiple of the player count. Scores and songs are tab-local and reset on reload.
- **Your music** accepts local audio files supported by the browser. Name them `Artist - Title.mp3` (or `.wav`, `.m4a`, `.ogg`, etc.). Files stay on-device; there is no upload or permanent storage. Some formats depend on the browser's codecs. The game plays from the start of each file.

The provisional name, copy, design and starter catalog are editable. Starter tracks live near the beginning of `src/main.js`; scoring and file-name parsing are in `src/game.js`.

## Music rights & Spotify

The bundled WAV files are original synthesized performances of traditional public-domain compositions, plus Beethoven's Ode to Joy. Their synthesis source is `public/audio/generate.py` (Python standard library). They are demonstration melodies, not commercial artist recordings. See `public/audio/LICENSE.md`.

There is no blanket “30 seconds is allowed” rule. Distributing commercial music, streaming it, and using someone else's recordings require appropriate rights and compliance with the source's terms. Local file access is a development option, not a grant of rights for sharing or public performance.

Spotify login, playlist importing, previews and playback are intentionally **not implemented**. Spotify has restricted games/trivia uses in its developer policy; a playlist URL alone gives no audio license, and preview availability cannot be assumed. Verify current policy and obtain any required approval before designing a Spotify-powered version. The app's Spotify information dialog explains this instead of offering a nonfunctional login.

The reference game pages and Spotify policy pages returned proxy HTTP 403 during development, so no current policy review or direct inspection of those sites is claimed. Relevant sources for follow-up:

- https://developer.spotify.com/policy
- https://developer.spotify.com/documentation/web-api
- https://playdaily.org/songless
- https://play.google.com/store/apps/details?id=com.ricocorp.spotiguess

A commercial catalog and online rooms are future scope. No authentication, third-party API keys, analytics, or remote fonts are used by this draft.

## Validate

```sh
npm test
npm run build
npm run test:e2e
```

The browser suite uses the environment's `/usr/bin/chromium`. Set `CHROMIUM_PATH` to use another installed Chromium. On machines without one, install a supported Chromium browser first; the Playwright CDN was blocked in the cloud environment. The Vite server starts automatically for tests if absent.

Tests cover real clip playback and stopping, scoring after replaying an earlier clue, local-file import, guesses, reveal playback, results/restart, a complete pass-and-play session, and overflow at 320/360/390/430/1440 pixels. These are desktop Chromium emulations, not real Android-device or Safari tests.

## First-draft screenshots

[Mobile](docs/screenshots/mobile.png) · [Desktop](docs/screenshots/desktop.png)

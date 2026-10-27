# Needle

Mobile-first song guessing. Pick songs, paste a public Spotify playlist, play solo, or pass the phone between friends.

## Run

Node 22.19+ (Node 24 recommended):

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

Vite serves the frontend **and the music API** on port 5173. The API plugin also runs with `npm run preview` and direct `vite` / `vite preview` commands. After a production build, `npm start` runs the standalone Node server on port 4173.

```sh
npm test
npm run build
npm run test:e2e
```

## Vercel

The existing site is https://guess-the-song-xi.vercel.app/ . The repository now includes `api/[...path].js`, a Node serverless entry, and `vercel.json`. A static `dist/` deployment alone cannot serve music requests. Deploy this repository with its root directory set to the repository root so Vercel includes the API function. Use the normal `npm run build` command and `dist` output. The serverless handler accepts Vercel's pre-parsed request body as well as standalone Node streams.

`GET /api/health` must return JSON with `status: "ok"`, `apiVersion: 1`, and the Vercel commit revision when supplied by Vercel. Before this fix, the user's deployed API returned HTTP 404. A push is not proof of a successful Vercel deployment: inspect this endpoint and the relevant music routes after deployment.

## Music sources

- Spotify playlist import reads the public embed page's listed tracks and **uses each recording's public Spotify preview directly** when present. It does not rematch those tracks against Deezer or another catalog.
- General artist/song search uses Apple’s India catalog. Missing Spotify previews can also use conservative title-and-primary-artist matching there. Deezer is no longer a runtime dependency.
- No Spotify SDK, login, token extraction, full-song downloads, or private-playlist access is implemented. Commercial recordings are not bundled or stored by the app.
- Public playlist pages may omit tracks, and some tracks lack previews. Imported results show available counts and missing songs without exposing developer diagnostics in the game interface.
- Previews are **provider-selected excerpts**. They do not guarantee the opening of the original song. Full original-song opening playback remains unresolved.

The player offers 0.1, 0.5, 1, 2, 5, and 10 seconds, decreasing points, title suggestions, and reveal playback up to 30 seconds. Friends mode alternates turns on the same device. Scores and collections are tab-local.

## Live verification

With a server running:

```sh
npm run check:catalog -- 'https://open.spotify.com/playlist/YOUR_PLAYLIST_ID' --all
npm run check:live -- 'https://open.spotify.com/playlist/YOUR_PLAYLIST_ID'
```

The catalog check reads real metadata and requests actual preview audio bytes. The browser check verifies real import, decoding, 0.1-second stopping, correct answer/scoring, and reveal playback. In cloud Chromium, its route adapter sends real upstream media through the platform's configured proxy; it never substitutes fixture audio. Use `NEEDLE_TEST_URL` to target a different server and `CHROMIUM_PATH` to select another Chromium.

On 2026-10-27, the supplied public playlist returned **21 tracks with 21 exact Spotify previews**. All 21 audio endpoints returned HTTP 206 `audio/mpeg`. An actual Chromium game played a 101 ms clue and a 29.71-second reveal. Apple India search and preview delivery were also verified for the example artists, which are **not** shipped as suggestions or default content. These are current-instance results, not guarantees of all-region availability, future URLs, or every playlist.

Regular browser tests use controlled metadata and the test-only waveform under `tests/fixtures`. They verify error handling, import cancellation, Vercel/static routing regressions, scoring, friend sessions, and layouts from 320 to 1440 pixels. They do not substitute for the live checks above or real Android/Safari testing.

## Developer notes and terms

Keep source decisions, integration limitations, debugging details, and example artists in developer communication/documentation, not public game copy. Errors shown in the interface should be short and actionable; API diagnostics belong in developer logs. Do not add the user's example artists as product presets.

The current Spotify policy page was successfully read during this fix and explicitly prohibits games including trivia quizzes, and restricts preview use. Public availability of a preview URL is **not** permission or Spotify approval. The implementation does not establish compliance with Spotify or Apple terms, and no approved full Spotify integration is claimed. See [integration decisions](docs/MUSIC_INTEGRATION.md) for evidence and remaining scope.

[Mobile](docs/screenshots/mobile.png) · [Desktop](docs/screenshots/desktop.png) · [Playlist picker](docs/screenshots/playlist-picker.png)

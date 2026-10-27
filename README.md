# Needle

A mobile-first song guessing website with artist search, public Spotify playlist metadata import, and Deezer audio previews. Play solo or pass the phone between 2–6 people. No song downloads or Spotify login are required by the implemented flow.

**Live integration status:** the catalog adapter and UI are implemented and tested with controlled provider responses. Cloud egress currently blocks the reference sites, Spotify pages, and Deezer. Actual catalog coverage, playlist extraction against today's Spotify pages, and real-provider audio playback have **not** been verified. Do not describe this as a completed live Spotify integration. Run the live check below after network access is enabled.

## Run

Node **22.19+** (Node 24 recommended) and npm are required.

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

This starts the Node music backend and Vite frontend together on port 5173. The proxy-aware upstream client uses the machine's existing proxy configuration and TLS verification. No credentials are needed for the currently implemented public metadata/preview approach. Restart the server after changing backend code.

Production:

```sh
npm run build
npm start
```

`npm start` and `npm run preview` serve both `dist/` and `/api/` on port 4173. `PORT` or `--port` changes the port. Deploy to a Node-capable host; a static-only host would need a separately deployed backend. No web deployment is configured.

## Music flow

- **Find music:** search an artist or song, choose recordings with provider previews, and start a session. KR$NA, Seedhe Maut, and Raftaar are editable search shortcuts, not claims of verified catalog coverage.
- **Spotify link:** validate a public `https://open.spotify.com/playlist/…` URL, fetch its public embed page, extract visible titles/artists, and find conservative title-and-artist matches on Deezer. There is no Spotify audio extraction, Spotify SDK, account login, private-playlist access, or API-token harvesting.
- **Track list:** paste `Artist - Song` lines, up to 500. This imports names only; it does not require audio downloads.
- **Import review:** show listed names, unique playable matches, unmatched songs, and the warning about public-page truncation **before** starting a game. A provider outage or canceled import leaves the current collection unchanged. Exact title/artist matching avoids silently substituting a remix or unrelated recording, but can miss legitimate versions or spelling variants.
- **Gameplay:** hear 0.1, 0.5, 1, 2, 5, or 10 seconds, with rewards decreasing from 1,000 to 100 points. Replaying an earlier clue cannot restore points. After guessing or revealing, play up to 30 seconds and follow the Deezer attribution link if desired.
- **Friends:** alternate turns on the same device. This is not online multiplayer. For equal turn counts, use a multiple of the player count. Scores and collection state are tab-local and reset on reload.

**Provider previews are excerpts of real recordings; they can start mid-song.** Playing from the beginning of the preview does not mean playing the beginning of the original song. Full-song opening-tune gameplay and guaranteed coverage of an entire playlist remain unresolved requirements. A preview-only source cannot guarantee either.

The old demo collection and local-file upload flow have been removed. `tests/fixtures/clip.wav` is a synthetic audio fixture for browser decoding/timing tests only and is not included in the production bundle or exposed as a game collection.

## Network and live verification

Required application destinations: `api.deezer.com`, `open.spotify.com`, and provider audio hosts under `*.dzcdn.net`. The environment draft also includes the supplied reference-game domains and official provider-documentation domains for investigation. Saving the draft alone does not apply runtime network changes or publish the environment.

After the environment settings are saved and the prepared environment is published, run:

```sh
npm run check:catalog
npm run check:catalog -- 'https://open.spotify.com/playlist/YOUR_PUBLIC_PLAYLIST_ID'
```

The check searches the three requested artists, requires preview results, and requests audio bytes through the configured proxy with TLS verification. Passing verifies basic endpoint access and audio delivery; it does not establish source terms, every catalog match, original-song opening alignment, or browser playback. Then verify search, playlist import, and preview playback in a real browser against the live providers.

## Evidence and source limitations

Direct requests to Songless, the linked Play Store listing, Spotify policy, Apple Search, and Deezer endpoints received cloud-proxy HTTP 403. Their current pages and the exact reference apps' audio implementations were not inspected successfully. A proxy-aware Node client successfully reached `registry.npmjs.org`, confirming that the client uses the supported proxy route; the Deezer destination remained blocked.

The published [`spotify-url-info` 3.3.3](https://www.npmjs.com/package/spotify-url-info) documentation and source were inspected through the npm registry. They document public embed metadata extraction without an API key, explicitly limit `getTracks` to the first 100 tracks, and warn that the schema can change. Our focused parser handles the documented public embed data formats but is not an official Spotify API and still needs a live compatibility check. No dependency on that package is installed.

Provider previews and public metadata are not an unrestricted music license. Current provider terms and suitability for this use have not been verified; preview access alone is not approval. No claim is made that Spotify Premium licenses a third-party trivia game. Useful original sources to review when network access works:

- https://developer.spotify.com/policy
- https://developers.deezer.com/api/search
- https://playdaily.org/songless
- https://play.google.com/store/apps/details?id=com.ricocorp.spotiguess

## Validation

```sh
npm test
npm run build
npm run test:e2e
```

The browser suite uses `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installed Chromium. It starts the full development server if needed. Server/logic tests verify URL validation, public data formats, safe preview sources, conservative matching, provider failures, HTTP routes, and scoring. Browser tests use mocked provider metadata plus a test-only waveform to verify the import UI, real browser audio decoding/timing, missing matches, batching, cancellation, playback failures, scores, friend sessions, and 320/360/390/430/1440-pixel layouts. These tests do **not** prove live provider compatibility or music coverage, and are not real Android or Safari tests.

## Screenshots

[Mobile entry](docs/screenshots/mobile.png) · [Desktop entry](docs/screenshots/desktop.png) · [Game layout](docs/screenshots/game-mobile.png)

The game-layout screenshot uses controlled test metadata. It demonstrates the interface, not successful live playback of the named commercial recording.

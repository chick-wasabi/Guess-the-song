# Music integration decisions

## The requirement

The user needs actual popular recordings and a playlist-driven game, without downloading audio files. The initial demo melodies and local uploads missed that requirement. They were removed from the product.

## Current implementation

The Node backend fetches public Spotify embed metadata only, then searches Deezer for corresponding recordings with provider preview URLs. Artist search also works independently of Spotify. Title-and-artist matching is conservative; no artist-only or approximate-title substitution. The browser streams preview URLs directly without proxying, storing, or bundling commercial audio. Provider attribution and an outbound link remain available after reveal.

No Spotify account connection is implemented. Public-page import is a best-effort metadata reader, not a complete official playlist API. Missing/private/changed pages fail explicitly. Long public playlists may be truncated; the UI warns about that and supports pasted track names as a metadata alternative.

## Still unverified / unresolved

- Live Deezer search availability and coverage for KR$NA, Seedhe Maut, and Raftaar.
- Actual Deezer preview URL accessibility and browser playback in the relevant region.
- Compatibility of the public Spotify embed parser with today's pages.
- Current provider terms for this use. Reachable previews alone do not establish permission.
- The user's **original-song opening** requirement. Provider-selected preview excerpts may begin mid-song.
- Guaranteed full-playlist coverage. The UI reports partial visibility and unmatched recordings; it does not claim to solve this.
- The reference apps' actual implementations. Their pages remain blocked by cloud egress.

## Verification evidence

- Public metadata extraction approach corroborated by `spotify-url-info` 3.3.3 documentation and source from the npm registry. It explicitly says only the first 100 tracks are returned and schemas may change.
- Node's default transport did not use this cloud machine's proxy and failed DNS resolution. The app now uses Undici's matching fetch/EnvHttpProxyAgent pair; using Undici 8's dispatcher with Node's older built-in fetch is incompatible (`invalid onRequestStart method`). Keep fetch and dispatcher from the same Undici package.
- The proxy-aware transport successfully fetched an allowed npm-registry endpoint with TLS verification. Curl requests to the music/reference domains returned CONNECT HTTP 403. The real catalog API correctly reports a network error instead of falling back to demo content.
- Controlled-response unit/browser tests validate app behavior but are not live-provider tests. The waveform in `tests/fixtures` is explicitly test-only.

## Next live check

Apply the prepared network settings, publish the cloud environment, run `npm run check:catalog`, then test a real public playlist and browser playback. Read the current provider/reference pages once accessible. Keep clip-position and coverage limitations explicit; do not call this completed opening-tune Spotify gameplay until those requirements are actually met.

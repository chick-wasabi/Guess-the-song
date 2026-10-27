# Music integration decisions

## Current implementation

Public Spotify playlist embeds contain track names, artists and, where available, public preview URLs. The app uses those exact preview recordings before considering any other source. The backend validates HTTPS, the `p.scdn.co` hostname, the preview path, track identity and playability. No credentials, private data, paywall bypass, access-token extraction or full-song extraction are used.

General search uses Apple’s India catalog. Missing Spotify preview clips can use title-and-primary-artist matching there. The final reveal links to the actual source. Provider-selected preview excerpts do not guarantee original-song openings or availability for every track or territory. Public embed metadata does not guarantee a complete playlist.

## Confirmed bug and correction

The user tested an existing Vercel deployment. Its `/api/health` returned HTTP 404; the previous repository contained no Vercel API function. The browser attempted to parse a non-JSON hosting error as music data, producing the visible “unreadable response / Node server” message.

The fix adds a Vercel catch-all API function and a health endpoint with a deployment revision. The handler supports Vercel's pre-parsed JSON body (not only Node request streams). A Vite plugin also serves the API when tools start Vite or Vite preview directly. The client checks response content type, shows a concise availability message and logs the API routing diagnostic separately. Deployment requires verifying the live function, not only the generated static HTML.

## Live evidence, 2026-10-27

- The user-supplied playlist returned 21 publicly listed tracks, all with their own Spotify preview URLs.
- All 21 real preview endpoints delivered audio with HTTP 206 and `audio/mpeg`.
- Chromium imported all 21 without a cross-catalog matching call. A real preview clue stopped after 101 ms; the correct title earned points; reveal playback ended at 29.71 seconds.
- The cloud browser used the configured HTTP proxy for actual upstream media; no fixture recording was substituted.
- Apple India search returned actual recordings for all three example artists, and a real Apple preview delivered audio. Those artist names were removed from product presets and placeholders.
- The actual Vercel deployment of app fix `b0178a5` was verified: `/api/health` returned the expected revision with HTTP 200; actual POST parsing and search returned HTTP 200; the production browser completed the real 21-track import, 101 ms clue, scoring and 29.71-second reveal. Pre-patch health was HTTP 404.

## Reference investigation and terms

Songless's publicly shipped JavaScript was inspected. Its preview helper uses an embedded preview URL when present, or `/api/music/preview?z=<deezerId>` as a Deezer lookup fallback. That establishes observed client behavior only, not the rights, catalog completeness or entire backend implementation of that service. No competitor corpus or private endpoint is used by Needle.

The current Spotify developer policy was fetched successfully: https://developer.spotify.com/policy . It says “Do not create a game, including trivia quizzes” and restricts previews to promoting the underlying content. Public preview URLs do not constitute permission for a trivia service. Neither user Premium access nor this code establishes Spotify approval. Provider terms and any permissions remain distinct from technical access. No compliance claim is made.

## Preserve these lessons

- Examples in a user brief are development context, not product content. Keep named artists out of fixed suggestions unless requested.
- Do not put implementation warnings, server instructions, or developer bug reports into the public game. Retain short user-facing failures and meaningful missing-track counts.
- A Vite/static build cannot supply server API routes on Vercel. Ship a real API function, handle its request format, and verify `/api/health` and live playback.
- Test the actual supplied playlist. A mocked response or a source chosen without checking catalog coverage is insufficient.
- Undici's fetch and its proxy dispatcher must come from the same package version; Undici 8's dispatcher is incompatible with the older fetch bundled in some Node versions.

The remaining full-song opening requirement must not be described as solved by preview playback.

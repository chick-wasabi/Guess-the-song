# Build preferences

- Repository: chick-wasabi/Guess-the-song.
- The user authorized building, committing and pushing this first website concept. Target branch: main (the remote was empty).
- Future commits and pushes require authorization in the applicable request; no standing automatic-release preference has been established.
- The existing website is https://guess-the-song-xi.vercel.app/ on Vercel. Main-branch pushes may trigger its Git-linked deployment; verify the live API revision rather than claiming deployment from a successful push.
- The current deliverable is a website. No native Android build or APK workflow is configured.
- Visual direction: minimal text, immediate gameplay, mobile-first; ivory, charcoal and acid yellow with a record-player centerpiece. Draft identity: Needle.
- Current scope uses publicly exposed Spotify preview clips without account authentication or a Spotify SDK. Current policy restrictions are documented in docs/MUSIC_INTEGRATION.md; do not claim official approval or a completed full-song Spotify integration.
- Core correction: actual popular recordings are required; do not substitute demo melodies or ask the user to download songs. Spotify may be a source of playlist names rather than audio. The current preview approach is a draft with live-network verification, full-playlist coverage, and original-song openings still unresolved.
- This repository uses the GitHub noreply author email locally after GitHub rejected publishing the environment's private email. Preserve that privacy setting on subsequent commits.

- User correction: example artists are context only. Do not ship them as product suggestions or placeholders. Keep implementation explanations, source decisions, debug details and limitations in developer communication/docs; keep public game text minimal and user-focused.

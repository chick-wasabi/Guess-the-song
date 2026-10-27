import { EnvHttpProxyAgent, fetch as fetchHttp } from "undici";
import { normalize } from "../src/game.js";

export class CatalogError extends Error {
  constructor(message, status = 502, code = "UPSTREAM_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function playlistId(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new CatalogError(
      "Paste a Spotify playlist URL, not a song or album link.",
      400,
      "INVALID_PLAYLIST",
    );
  }
  const match = url.pathname.match(
    /^\/(?:intl-[a-z]{2}\/)?playlist\/([a-zA-Z0-9]{22})\/?$/,
  );
  if (
    url.protocol !== "https:" ||
    url.hostname !== "open.spotify.com" ||
    url.port ||
    url.username ||
    url.password ||
    !match
  ) {
    throw new CatalogError(
      "Use an https://open.spotify.com/playlist/… link.",
      400,
      "INVALID_PLAYLIST",
    );
  }
  return match[1];
}
export function parseSpotifyPlaylist(html) {
  let entity;
  for (const [id, decode] of [
    [
      "__NEXT_DATA__",
      (raw) => JSON.parse(raw)?.props?.pageProps?.state?.data?.entity,
    ],
    [
      "initial-state",
      (raw) => JSON.parse(Buffer.from(raw, "base64").toString())?.data?.entity,
    ],
    ["resource", (raw) => JSON.parse(Buffer.from(raw, "base64").toString())],
  ]) {
    const script = html.match(
      new RegExp(
        `<script\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`,
        "i",
      ),
    );
    if (!script) continue;
    try {
      entity = decode(script[1]);
    } catch {
      continue;
    }
    if (Array.isArray(entity?.trackList)) break;
  }
  if (!entity)
    throw new CatalogError(
      "Couldn’t open this playlist. Check its link and visibility.",
      422,
      "PLAYLIST_UNAVAILABLE",
    );
  const list = entity?.trackList;
  if (!Array.isArray(list) || !list.length)
    throw new CatalogError(
      "Couldn’t open this playlist. Check its link and visibility.",
      422,
      "PLAYLIST_UNAVAILABLE",
    );
  const tracks = list
    .filter((t) => t && typeof t === "object")
    .map((t) => ({
      ...t,
      subtitle:
        Array.isArray(t.artists) &&
        t.artists.some((a) => typeof a?.name === "string")
          ? t.artists
              .map((a) => a?.name)
              .filter((a) => typeof a === "string" && a.trim())
              .join(", ")
          : t.subtitle,
    }))
    .filter(
      (t) =>
        typeof t.title === "string" &&
        typeof t.subtitle === "string" &&
        t.title.trim() &&
        t.subtitle.trim(),
    )
    .map((t) => {
      const spotifyId =
        typeof t.uri === "string" &&
        /^spotify:track:[a-zA-Z0-9]{22}$/.test(t.uri)
          ? t.uri.split(":").at(-1)
          : null;
      const track = {
        title: t.title.slice(0, 300),
        artist: t.subtitle.slice(0, 300),
        spotifyId,
      };
      let preview;
      try {
        preview = new URL(t.audioPreview?.url);
      } catch {
        return { ...track, preview: null };
      }
      const valid =
        spotifyId &&
        t.isPlayable !== false &&
        preview.protocol === "https:" &&
        preview.hostname === "p.scdn.co" &&
        !preview.port &&
        !preview.username &&
        !preview.password &&
        /^\/mp3-preview\/[a-f0-9]{40}$/.test(preview.pathname);
      return {
        ...track,
        preview: valid
          ? {
              id: `spotify:${spotifyId}`,
              title: track.title,
              artist: track.artist,
              url: preview.href,
              source: "spotify",
              sourceUrl: `https://open.spotify.com/track/${spotifyId}`,
              clipKind: "preview",
            }
          : null,
      };
    });
  if (!tracks.length)
    throw new CatalogError(
      "No songs found in this playlist.",
      422,
      "PLAYLIST_UNAVAILABLE",
    );
  // The public embed is not a complete-playlist API. Never claim completeness.
  return {
    name:
      typeof (entity.name || entity.title) === "string"
        ? (entity.name || entity.title).slice(0, 200)
        : "Spotify playlist",
    tracks,
    total: Number.isInteger(entity.trackCount) ? entity.trackCount : null,
    completeness: "public-preview",
    warning:
      "Spotify’s public page may expose only part of the playlist. Compare the track count; paste a track list for anything missing.",
  };
}
export function previewTrack(item) {
  let audio, link;
  try {
    audio = new URL(item.previewUrl);
    link = new URL(item.trackViewUrl);
  } catch {
    return null;
  }
  if (
    audio.protocol !== "https:" ||
    audio.hostname !== "audio-ssl.itunes.apple.com" ||
    audio.username ||
    audio.password ||
    audio.port
  )
    return null;
  if (
    link.protocol !== "https:" ||
    !["music.apple.com", "itunes.apple.com"].includes(link.hostname) ||
    link.username ||
    link.password ||
    link.port
  )
    return null;
  if (
    !Number.isSafeInteger(item.trackId) ||
    typeof item.trackName !== "string" ||
    typeof item.artistName !== "string" ||
    !item.trackName.trim() ||
    !item.artistName.trim() ||
    item.kind !== "song"
  )
    return null;
  return {
    id: `apple:${item.trackId}`,
    title: item.trackName,
    artist: item.artistName,
    url: audio.href,
    source: "apple",
    sourceUrl: link.href,
    clipKind: "preview",
    explicit: item.trackExplicitness === "explicit",
  };
}
function titleKey(value) {
  return normalize(
    value
      .replace(/\s*\((?:feat\.?|ft\.?).*\)\s*$/i, "")
      .replace(/\s*\[(?:feat\.?|ft\.?).*\]\s*$/i, ""),
  );
}
export function findMatch(input, candidates) {
  const title = titleKey(input.title);
  const artists = input.artist
    .split(/,| & | feat\.? | ft\.? /i)
    .map(normalize)
    .filter(Boolean);
  // An artist-only match or a similar title is not enough; remixes/live versions stay distinct.
  return (
    candidates.find(
      (t) =>
        titleKey(t.title) === title &&
        t.artist
          .split(/,| & | feat\.? | ft\.? /i)
          .map(normalize)
          .includes(artists[0]),
    ) || null
  );
}
export function parseTrackList(text) {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lines.length || lines.length > 500)
    throw new CatalogError(
      "Paste between 1 and 500 lines, in Artist - Song format.",
      400,
      "INVALID_TRACKS",
    );
  return lines.map((line, i) => {
    const split = line.indexOf(" - ");
    if (split < 1 || !line.slice(split + 3).trim())
      throw new CatalogError(
        `Line ${i + 1}: use Artist - Song.`,
        400,
        "INVALID_TRACKS",
      );
    return {
      artist: line.slice(0, split).trim().slice(0, 300),
      title: line
        .slice(split + 3)
        .trim()
        .slice(0, 300),
    };
  });
}
const proxyAgent = new EnvHttpProxyAgent();
export const fetchUpstream = (url, options = {}) =>
  fetchHttp(url, { ...options, dispatcher: proxyAgent });
export function createCatalogService({ fetchImpl = fetchUpstream } = {}) {
  const cache = new Map();
  let nextProviderRequest = 0;
  async function request(url, kind) {
    const key = url.toString(),
      cached = cache.get(key);
    if (cached && cached.until > Date.now()) return cached.value;
    if (new URL(url).hostname === "itunes.apple.com") {
      const now = Date.now();
      const scheduled = Math.max(now, nextProviderRequest);
      nextProviderRequest = scheduled + 3100;
      if (scheduled > now)
        await new Promise((resolve) => setTimeout(resolve, scheduled - now));
    }
    let response;
    try {
      response = await fetchImpl(url, {
        signal: AbortSignal.timeout(15000),
        redirect: "error",
        headers: { Accept: kind === "html" ? "text/html" : "application/json" },
      });
    } catch {
      throw new CatalogError(
        "Music is temporarily unavailable. Try again shortly.",
        502,
        "NETWORK_BLOCKED",
      );
    }
    if (!response.ok)
      throw new CatalogError(
        response.status === 429
          ? "The music service is busy. Wait a moment before retrying."
          : `The music service returned HTTP ${response.status}. Try again later.`,
        response.status === 429 ? 429 : 502,
        "UPSTREAM_ERROR",
      );
    const raw = await response.text();
    if (raw.length > 4_000_000)
      throw new CatalogError("The music service response was too large.", 502);
    let result;
    try {
      result = kind === "html" ? raw : JSON.parse(raw);
    } catch {
      throw new CatalogError(
        "Music is temporarily unavailable. Try again shortly.",
        502,
      );
    }
    if (result?.error)
      throw new CatalogError(
        "The music service rejected this search. Try again later.",
        502,
        "PROVIDER_ERROR",
      );
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(key, { value: result, until: Date.now() + 300000 });
    return result;
  }
  return {
    async search(query) {
      if (
        typeof query !== "string" ||
        query.trim().length < 2 ||
        query.length > 200
      )
        throw new CatalogError(
          "Search for an artist or song (2–200 characters).",
          400,
          "INVALID_QUERY",
        );
      const url = new URL("https://itunes.apple.com/search");
      url.searchParams.set("term", query.trim());
      url.searchParams.set("entity", "song");
      url.searchParams.set("country", "IN");
      url.searchParams.set("limit", "50");
      const data = await request(url, "json");
      if (!Array.isArray(data?.results))
        throw new CatalogError(
          "Couldn’t find songs right now. Please try again.",
          502,
        );
      return { tracks: data.results.map(previewTrack).filter(Boolean) };
    },
    async playlist(input) {
      const id = playlistId(input);
      return parseSpotifyPlaylist(
        await request(`https://open.spotify.com/embed/playlist/${id}`, "html"),
      );
    },
    async resolve(tracks) {
      if (
        !Array.isArray(tracks) ||
        !tracks.length ||
        tracks.length > 8 ||
        tracks.some(
          (t) =>
            !t ||
            typeof t.title !== "string" ||
            typeof t.artist !== "string" ||
            !t.title.trim() ||
            !t.artist.trim() ||
            t.title.length > 300 ||
            t.artist.length > 300,
        )
      )
        throw new CatalogError(
          "Resolve between 1 and 8 valid song names at a time.",
          400,
          "INVALID_TRACKS",
        );
      const result = [];
      // Keep upstream concurrency at one for playlist matching.
      for (const input of tracks) {
        const clean = (s) => s.replace(/["\\]/g, " ").trim();
        const query = `${clean(input.title).slice(0, 100)} ${clean(input.artist.split(",")[0]).slice(0, 80)}`;
        const { tracks: candidates } = await this.search(query);
        result.push({ input, track: findMatch(input, candidates) });
      }
      return { results: result };
    },
  };
}

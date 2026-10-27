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
      "Spotify did not expose a public track list. Try a public playlist or paste a track list instead.",
      422,
      "PLAYLIST_UNAVAILABLE",
    );
  const list = entity?.trackList;
  if (!Array.isArray(list) || !list.length)
    throw new CatalogError(
      "This playlist is private, empty, or unavailable to public visitors. Paste a track list instead.",
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
    .map((t) => ({
      title: t.title.slice(0, 300),
      artist: t.subtitle.slice(0, 300),
      spotifyId:
        typeof t.uri === "string" &&
        /^spotify:track:[a-zA-Z0-9]{22}$/.test(t.uri)
          ? t.uri.split(":").at(-1)
          : null,
    }));
  if (!tracks.length)
    throw new CatalogError(
      "Spotify returned no readable track names.",
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
    audio = new URL(item.preview);
    link = new URL(item.link);
  } catch {
    return null;
  }
  if (
    audio.protocol !== "https:" ||
    !audio.hostname.endsWith(".dzcdn.net") ||
    audio.username ||
    audio.password ||
    audio.port
  )
    return null;
  if (
    link.protocol !== "https:" ||
    !["www.deezer.com", "deezer.com"].includes(link.hostname) ||
    link.username ||
    link.password ||
    link.port
  )
    return null;
  if (
    !Number.isSafeInteger(item.id) ||
    typeof item.title !== "string" ||
    typeof item.artist?.name !== "string" ||
    !item.title.trim() ||
    !item.artist.name.trim() ||
    item.readable === false
  )
    return null;
  return {
    id: `deezer:${item.id}`,
    title: item.title,
    artist: item.artist.name,
    url: audio.href,
    source: "deezer",
    sourceUrl: link.href,
    clipKind: "preview",
    explicit: Boolean(item.explicit_lyrics),
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
        titleKey(t.title) === title && artists.includes(normalize(t.artist)),
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
    if (new URL(url).hostname === "api.deezer.com") {
      const now = Date.now();
      const scheduled = Math.max(now, nextProviderRequest);
      nextProviderRequest = scheduled + 175;
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
        "The music service could not be reached. Check the server’s network access and try again.",
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
        "The music service returned an unreadable response.",
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
      const url = new URL("https://api.deezer.com/search");
      url.searchParams.set("q", query.trim());
      url.searchParams.set("limit", "50");
      const data = await request(url, "json");
      if (!Array.isArray(data?.data))
        throw new CatalogError(
          "The music service returned no readable results.",
          502,
        );
      return { tracks: data.data.map(previewTrack).filter(Boolean) };
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
        const query = `artist:"${clean(input.artist.split(",")[0]).slice(0, 80)}" track:"${clean(input.title).slice(0, 80)}"`;
        const { tracks: candidates } = await this.search(query);
        result.push({ input, track: findMatch(input, candidates) });
      }
      return { results: result };
    },
  };
}

import { musicRequest, resolvePlaylist } from "./catalog-client.js";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function mountLibrary(dialog, { startCollection, initialQuery = "" }) {
  let tab = "search",
    selected = new Map(),
    results = [],
    report = null,
    controller = null;
  const abort = () => {
    controller?.abort();
    controller = null;
  };
  dialog.addEventListener("close", abort, { once: true });
  function shell() {
    abort();
    dialog.innerHTML = `<button class="dialog-close" aria-label="Close dialog">×</button><span class="eyebrow">REAL SONGS. YOUR ROTATION.</span><h2>Who’s on<br>your playlist?</h2><div class="library-tabs" role="tablist" aria-label="Music source">${[
      ["search", "Find music"],
      ["spotify", "Spotify link"],
      ["text", "Track list"],
    ]
      .map(
        ([id, label]) =>
          `<button role="tab" id="tab-${id}" aria-selected="${tab === id}" aria-controls="library-panel" data-tab="${id}" tabindex="${tab === id ? "0" : "-1"}">${label}</button>`,
      )
      .join(
        "",
      )}</div><section id="library-panel" role="tabpanel" aria-labelledby="tab-${tab}"></section>`;
    dialog.querySelector(".dialog-close").onclick = () => dialog.close();
    dialog.querySelectorAll("[data-tab]").forEach((b) => {
      b.onclick = () => {
        tab = b.dataset.tab;
        shell();
        dialog.querySelector(`[data-tab="${tab}"]`).focus();
      };
      b.onkeydown = (e) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const tabs = ["search", "spotify", "text"];
        let i = tabs.indexOf(tab);
        i =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? 2
              : (i + (e.key === "ArrowRight" ? 1 : 2)) % 3;
        tab = tabs[i];
        shell();
        dialog.querySelector(`[data-tab="${tab}"]`).focus();
      };
    });
    const panel = dialog.querySelector("#library-panel");
    if (tab === "search")
      panel.innerHTML = `<form id="music-search"><label class="sr-only" for="music-query">Artist or song</label><div class="search-box"><input id="music-query" maxlength="200" minlength="2" placeholder="Artist or song…" value="${esc(initialQuery)}" required><button class="primary" type="submit">Search</button></div></form><div class="artist-chips">${["KR$NA", "Seedhe Maut", "Raftaar"].map((a) => `<button data-artist="${esc(a)}">${esc(a)}</button>`).join("")}</div><p class="preview-note">Real recordings via Deezer previews. Excerpts may start mid-song.</p><p id="library-status" role="status"></p><div id="search-results"></div><div id="selection-bar"></div>`;
    else if (tab === "spotify")
      panel.innerHTML = `<form id="playlist-form"><label for="playlist-url">Public Spotify playlist</label><input type="url" id="playlist-url" placeholder="https://open.spotify.com/playlist/…" required><button class="primary" type="submit">Find my songs</button></form><p class="preview-note">No Spotify login. Read publicly listed titles, then match them to Deezer audio previews. Spotify’s public page may list only part of a playlist; private playlists aren’t supported.</p><p id="library-status" role="status"></p><div id="import-report"></div>`;
    else
      panel.innerHTML = `<form id="tracklist-form"><label for="tracklist">Paste song names, one per line</label><textarea id="tracklist" rows="6" maxlength="60000" placeholder="KR$NA - No Cap\nSeedhe Maut - Nanchaku\nRaftaar - Saza-E-Maut" required></textarea><p class="preview-note">Artist - Song. Names only; no audio downloads. Up to 500 tracks.</p><button class="primary" type="submit">Find these songs</button></form><p id="library-status" role="status"></p><div id="import-report"></div>`;
    panel.querySelector("#music-search")?.addEventListener("submit", (e) => {
      e.preventDefault();
      search(panel.querySelector("#music-query").value);
    });
    panel.querySelectorAll("[data-artist]").forEach(
      (b) =>
        (b.onclick = () => {
          panel.querySelector("#music-query").value = b.dataset.artist;
          search(b.dataset.artist);
        }),
    );
    panel
      .querySelector("#playlist-form")
      ?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await importTracks(() =>
          musicRequest(
            `/api/playlist?url=${encodeURIComponent(panel.querySelector("#playlist-url").value)}`,
            { signal: controller.signal },
          ),
        );
      });
    panel
      .querySelector("#tracklist-form")
      ?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await importTracks(() =>
          musicRequest("/api/track-list", {
            signal: controller.signal,
            body: { text: panel.querySelector("#tracklist").value },
          }),
        );
      });
    if (tab === "search") {
      drawResults();
      selectionBar();
    }
  }
  function status(text, error = false) {
    const el = dialog.querySelector("#library-status");
    if (el) {
      el.textContent = text;
      el.className = error ? "library-error" : "library-status";
    }
  }
  async function search(query) {
    abort();
    controller = new AbortController();
    const ticket = controller;
    status("Finding playable songs…");
    try {
      const data = await musicRequest(
        `/api/search?q=${encodeURIComponent(query)}`,
        { signal: ticket.signal },
      );
      if (ticket !== controller || !dialog.open) return;
      results = data.tracks;
      status(
        results.length
          ? `${results.length} playable previews. Pick your tracks.`
          : "No playable previews found. Try another artist or a specific title.",
      );
      drawResults();
      selectionBar();
    } catch (e) {
      if (e.name !== "AbortError" && ticket === controller)
        status(e.message, true);
    }
  }
  function drawResults() {
    const list = dialog.querySelector("#search-results");
    if (!list) return;
    list.innerHTML = results
      .map(
        (t) =>
          `<label class="track-row"><input type="checkbox" data-track="${esc(t.id)}" ${selected.has(t.id) ? "checked" : ""}><span><strong>${esc(t.title)}</strong><small>${esc(t.artist)}${t.explicit ? " · Explicit" : ""}</small></span><span class="track-source">DEEZER</span></label>`,
      )
      .join("");
    list.querySelectorAll("[data-track]").forEach(
      (input) =>
        (input.onchange = () => {
          const t = results.find((t) => t.id === input.dataset.track);
          if (input.checked) {
            if (selected.size >= 500) {
              input.checked = false;
              status("Use up to 500 tracks per session.", true);
              return;
            }
            selected.set(t.id, t);
          } else selected.delete(t.id);
          selectionBar();
        }),
    );
  }
  function selectionBar() {
    const bar = dialog.querySelector("#selection-bar");
    if (!bar) return;
    bar.innerHTML = `<button class="select-all" ${results.length ? "" : "disabled"} id="select-results">Select these results</button><button class="primary" id="play-selection" ${selected.size ? "" : "disabled"}>Play ${selected.size} track${selected.size === 1 ? "" : "s"}</button>`;
    bar.querySelector("#select-results").onclick = () => {
      for (const t of results) {
        if (selected.size >= 500) break;
        selected.set(t.id, t);
      }
      drawResults();
      selectionBar();
    };
    bar.querySelector("#play-selection").onclick = () =>
      startCollection([...selected.values()], "Your rotation");
  }
  async function importTracks(load) {
    abort();
    controller = new AbortController();
    const ticket = controller;
    const out = dialog.querySelector("#import-report");
    out.innerHTML = "";
    const form = dialog.querySelector("form");
    form.querySelector("button").disabled = true;
    status("Reading song names…");
    const cancel = document.createElement("button");
    cancel.className = "cancel-match";
    cancel.textContent = "Cancel import";
    cancel.onclick = () => {
      abort();
      status("Import canceled. Your current game is unchanged.");
      form.querySelector("button").disabled = false;
      cancel.remove();
    };
    out.append(cancel);
    try {
      report = await load();
      if (ticket !== controller) return;
      if (!report.tracks.length)
        throw new Error("No songs were listed. Try pasting a track list.");
      const matches = await resolvePlaylist(report.tracks, {
        signal: ticket.signal,
        progress: (done, total) =>
          status(`Matching previews: ${done} / ${total}…`),
      });
      if (ticket !== controller || !dialog.open) return;
      const playable = [
        ...new Map(
          matches.filter((m) => m.track).map((m) => [m.track.id, m.track]),
        ).values(),
      ];
      const unavailable = matches.filter((m) => !m.track);
      status(
        `${matches.length} listed · ${playable.length} unique playable · ${unavailable.length} unmatched`,
      );
      out.innerHTML = `${report.warning ? `<p class="import-warning">${esc(report.warning)}</p>` : ""}<p class="preview-note">${esc(report.name)}${report.total ? ` · Spotify reports ${report.total} tracks` : ""}. Previews may start mid-song. Only matched recordings enter the game.</p>${unavailable.length ? `<details><summary>${unavailable.length} songs without an exact playable match</summary><ul>${unavailable.map((m) => `<li>${esc(m.input.artist)} — ${esc(m.input.title)}</li>`).join("")}</ul></details>` : ""}<button class="primary" id="play-import" ${playable.length ? "" : "disabled"}>Play ${playable.length} matched track${playable.length === 1 ? "" : "s"}</button>`;
      out.querySelector("#play-import").onclick = () =>
        startCollection(playable, report.name);
    } catch (e) {
      if (e.name !== "AbortError" && ticket === controller) {
        status(e.message, true);
        out.innerHTML =
          '<p class="preview-note">No new game started. Try again or use a track list.</p>';
      }
    } finally {
      if (ticket === controller) {
        form.querySelector("button").disabled = false;
        cancel.remove();
      }
    }
  }
  shell();
  if (initialQuery) search(initialQuery);
}

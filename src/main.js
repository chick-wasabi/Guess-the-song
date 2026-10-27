import "./style.css";
import { CLIPS, POINTS, matches, shuffled } from "./game.js";
import { mountLibrary } from "./library.js";
const icons = {
  play: '<path d="m9 5 11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  music:
    '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let library = [],
  queue = [],
  collectionName = "Your rotation",
  round = 0,
  level = 0,
  score = 0,
  players = ["You"],
  turn = 0,
  scores = [0],
  mode = "solo",
  revealed = false,
  playing = false,
  loading = false,
  playbackSequence = 0;
const audio = new Audio();
let timer,
  animation,
  started = 0,
  duration = 0,
  feedback = "",
  tone = "";
const song = () => queue[round];
function stop() {
  playbackSequence++;
  clearTimeout(timer);
  cancelAnimationFrame(animation);
  audio.pause();
  playing = false;
  loading = false;
  document.querySelector(".record")?.classList.remove("spinning");
  const b = document.querySelector("#play");
  if (b) {
    b.innerHTML = icon("play");
    b.removeAttribute("aria-busy");
  }
  const p = document.querySelector("#progress");
  if (p) p.style.width = "0%";
}
function message(text, kind = "") {
  feedback = text;
  tone = kind;
  const el = document.querySelector("#feedback");
  if (el) {
    el.textContent = text;
    el.className = `feedback ${kind}`;
  } else {
    const p = document.querySelector(".reveal-bottom p");
    if (p) p.textContent = text;
  }
}
function record() {
  return `<div class="record-area"><span class="orbit-label left">TRUST YOUR EARS</span><div class="record ${revealed ? "is-revealed" : ""}"><div class="record-label"><span>needle</span><strong>${revealed ? "✓" : "?"}</strong><small>${revealed ? "SIDE B · THE REVEAL" : "SIDE A · THE MYSTERY"}</small></div></div><span class="orbit-label right">NOT YOUR SHAZAM</span><span class="tonearm"></span></div>`;
}
function emptyGame() {
  return `<div class="card-top"><span class="round">YOUR MUSIC. YOUR GAME.</span><span class="points">REAL SONGS</span></div>${record()}<div class="empty-intro"><h2>Who’s in your rotation?</h2><p>Pick an artist. Find your songs. Press play.</p></div><form id="quick-search" class="search-box"><label class="sr-only" for="quick-query">Artist or song</label><input id="quick-query" placeholder="Artist or song…" minlength="2" maxlength="200" required><button class="primary" aria-label="Find songs">${icon("arrow")}</button></form><div class="artist-chips">${["KR$NA", "Seedhe Maut", "Raftaar"].map((a) => `<button data-artist="${escape(a)}">${escape(a)}</button>`).join("")}</div><button class="playlist-entry" id="paste-playlist">Have a Spotify playlist? Paste the link ${icon("arrow")}</button><p class="empty-source">Deezer audio previews · no downloads<br>Excerpts may start mid-song.</p>`;
}
function activeGame() {
  return `<div class="card-top"><span class="round">ROUND ${String(round + 1).padStart(2, "0")} <span>/ ${String(queue.length).padStart(2, "0")}</span></span><span class="points">✳ ${revealed ? "ROUND COMPLETE" : `${POINTS[level]} PTS UP FOR GRABS`}</span></div>${record()}<div class="clip-heading"><button id="play" class="play" aria-label="${revealed ? "Play song reveal" : "Play audio clue"}">${icon("play")}</button><div><h2>${revealed ? escape(song().title) : `<span id="clip-time">${CLIPS[level]}</span> seconds. Any ideas?`}</h2><p>${revealed ? escape(song().artist) : "Tap play. Let your memory do its thing."}</p></div>${revealed ? '<span class="reveal-badge">REVEALED</span>' : ""}</div><div class="progress-track"><div id="progress"></div></div>${revealed ? `<div class="reveal-bottom"><p role="status">${escape(feedback)}</p><a class="provider-link" href="${escape(song().sourceUrl)}" target="_blank" rel="noopener noreferrer">Listen on Deezer ${icon("arrow")}</a><button class="primary" id="next">${round + 1 >= queue.length ? "See the scores" : "Next track"} ${icon("arrow")}</button></div>` : `<div class="steps" aria-label="Clue length">${CLIPS.map((n, i) => `<button data-level="${i}" class="step ${i === level ? "active" : ""} ${i < level ? "past" : ""}" ${i > level ? "disabled" : ""} aria-label="Replay ${n} second clue" aria-pressed="${i === level}"><span>${n}s</span><i></i></button>`).join("")}</div><form id="guess-form" autocomplete="off"><label class="sr-only" for="guess">Song title</label><div class="input-wrap"><span>${icon("music")}</span><input id="guess" placeholder="Name that song…" list="song-options" required><button aria-label="Submit guess" type="submit">${icon("arrow")}</button></div><datalist id="song-options">${library.map((s) => `<option value="${escape(s.title)}">${escape(s.artist)}</option>`).join("")}</datalist></form><div class="feedback ${tone}" id="feedback" role="status">${escape(feedback)}</div><div class="bottom-actions"><button id="skip" class="skip">${level === CLIPS.length - 1 ? "Reveal song" : `A little more? <span>Unlock ${CLIPS[level + 1]}s ${icon("arrow")}</span>`}</button><button id="giveup" class="text-button">I’m stumped</button></div>`}<p class="game-source">Deezer preview · may start mid-song</p>`;
}
function render() {
  document.querySelector("#app").innerHTML =
    `<header><a class="wordmark" href="/" aria-label="Needle home">needle<span>✳</span></a><button class="library-button" id="library">${icon("music")} Your music <span class="desktop">${icon("arrow")}</span></button></header><main><div class="topline"><span class="eyebrow"><i></i> A LITTLE SOUND. A BIG MEMORY.</span><button class="help-button" id="help" aria-label="How to play">?</button></div><section class="intro"><h1>You know <em>this one.</em></h1><p>How little do you need to hear?</p></section><div class="game-layout"><aside class="side-panel"><span class="eyebrow">ON THE TURNTABLE</span><h2>${escape(queue.length ? collectionName : "Pick your music")}<span>${icon("arrow")}</span></h2><p>${queue.length ? `${library.length} real recordings.\nYour music, your memory.` : "Your artists. Your playlists.\nSongs you actually know."}</p><div class="cover-art"><div class="cover-word">PLAY<br>IT BY<br><em>EAR.</em></div><span class="cover-star">✳</span><span class="cover-small">NEEDLE SELECTS · YOUR ROTATION</span></div><button class="text-button" id="change">${queue.length ? "Switch collection" : "Find your songs"} ${icon("arrow")}</button></aside><section class="game-card" aria-label="Song guessing game">${queue.length ? activeGame() : emptyGame()}</section><aside class="score-panel"><div class="mode-switch"><button id="solo" class="${mode === "solo" ? "selected" : ""}">Solo</button><button id="friends" class="${mode === "friends" ? "selected" : ""}">With friends</button></div><div class="score-block"><span class="eyebrow">${mode === "friends" ? `${escape(players[turn])}'S SCORE` : "YOUR SESSION"}</span><strong>${scores[turn].toLocaleString()}<span>pts</span></strong><div class="session-dots">${queue
      .slice(0, 40)
      .map(
        (_, i) =>
          `<i class="${i < round ? "done" : i === round ? "current" : ""}"></i>`,
      )
      .join(
        "",
      )}</div><p>${mode === "friends" ? `Pass the phone · ${escape(players[turn])}'s turn` : "Just you vs. your music memory."}</p></div><div class="little-note"><span>${icon("arrow")}</span><p>The shorter the clip,<br>the sweeter the score.</p></div><div class="source-note">REAL RECORDINGS<br>DEEZER PREVIEW AUDIO</div></aside></div><footer><span>Made for the <em>“wait, I know this!”</em></span><button id="about">About the audio ${icon("arrow")}</button><span class="footer-index">TURN UP. TUNE IN.</span></footer></main><dialog id="dialog"></dialog>`;
  bind();
}
function bind() {
  document.querySelector("#play")?.addEventListener("click", () => play());
  document.querySelector("#library").onclick = () => open("library");
  document.querySelector("#change").onclick = () => open("library");
  document.querySelector("#help").onclick = () => open("help");
  document.querySelector("#about").onclick = () => open("about");
  document.querySelector("#friends").onclick = () => open("friends");
  document.querySelector("#solo").onclick = () => {
    if (mode !== "solo") open("solo");
  };
  document.querySelector("#guess-form")?.addEventListener("submit", guess);
  document.querySelector("#skip")?.addEventListener("click", more);
  document
    .querySelector("#giveup")
    ?.addEventListener("click", () => reveal(false));
  document.querySelector("#next")?.addEventListener("click", next);
  document.querySelectorAll("[data-level]").forEach(
    (b) =>
      (b.onclick = () => {
        stop();
        play(CLIPS[Number(b.dataset.level)]);
      }),
  );
  document.querySelector("#quick-search")?.addEventListener("submit", (e) => {
    e.preventDefault();
    open("library", document.querySelector("#quick-query").value);
  });
  document
    .querySelectorAll("[data-artist]")
    .forEach((b) => (b.onclick = () => open("library", b.dataset.artist)));
  document.querySelector("#paste-playlist")?.addEventListener("click", () => {
    open("library");
    document.querySelector("#tab-spotify").click();
  });
}
async function play(lengthOverride) {
  if (playing || loading) {
    stop();
    return;
  }
  if (!song()) return;
  stop();
  const ticket = playbackSequence;
  loading = true;
  const b = document.querySelector("#play");
  b.setAttribute("aria-busy", "true");
  b.innerHTML = '<span class="audio-loading">…</span>';
  audio.src = song().url;
  audio.currentTime = 0;
  duration = revealed
    ? 30
    : typeof lengthOverride === "number"
      ? lengthOverride
      : CLIPS[level];
  try {
    await audio.play();
    if (ticket !== playbackSequence) return;
    loading = false;
    playing = true;
    document.querySelector("#play").removeAttribute("aria-busy");
    document.querySelector("#play").innerHTML = icon("pause");
    document.querySelector(".record").classList.add("spinning");
    started = performance.now();
    timer = setTimeout(stop, duration * 1000);
    const frame = () => {
      const p = document.querySelector("#progress");
      if (p)
        p.style.width = `${Math.min(100, (performance.now() - started) / (duration * 10))}%`;
      if (playing) animation = requestAnimationFrame(frame);
    };
    animation = requestAnimationFrame(frame);
  } catch {
    if (ticket !== playbackSequence) return;
    stop();
    message("This preview is unavailable. Retry, or skip this round.", "error");
  }
}
audio.onended = stop;
audio.onerror = () => {
  if (playing || loading) {
    stop();
    message("This preview is unavailable. Retry, or skip this round.", "error");
  }
};
function more() {
  if (level === CLIPS.length - 1) {
    reveal(false);
    return;
  }
  stop();
  level++;
  feedback = "";
  tone = "";
  render();
  play();
}
function guess(e) {
  e.preventDefault();
  const input = document.querySelector("#guess");
  if (!input.value.trim()) return;
  if (matches(input.value, song())) reveal(true);
  else {
    message(
      level === CLIPS.length - 1
        ? "Not quite. Try again or reveal the song."
        : "Not quite. Try again, or unlock a longer clip.",
      "error",
    );
    input.select();
  }
}
function reveal(correct) {
  stop();
  revealed = true;
  const points = correct ? POINTS[level] : 0;
  scores[turn] += points;
  score += points;
  feedback = correct
    ? `You got it. +${points} points. Take a victory listen.`
    : "One for next time. Take a listen.";
  render();
}
function next() {
  stop();
  if (round + 1 >= queue.length) {
    open("results");
    return;
  }
  round++;
  level = 0;
  revealed = false;
  feedback = "";
  tone = "";
  if (mode === "friends") turn = (turn + 1) % players.length;
  render();
  if (mode === "friends") open("pass");
}
function reset() {
  stop();
  queue = shuffled(library);
  round = 0;
  level = 0;
  score = 0;
  scores = players.map(() => 0);
  turn = 0;
  revealed = false;
  feedback = "";
  tone = "";
  render();
}
function startCollection(tracks, name) {
  if (!tracks.length) return;
  library = tracks;
  collectionName = name;
  document.querySelector("#dialog").close();
  reset();
  if (mode === "friends") open("pass");
}
function open(type, query = "") {
  stop();
  const d = document.querySelector("#dialog");
  d.innerHTML = "";
  d.showModal();
  d.onclick = (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        d.close();
    }
  };
  if (type === "library") {
    mountLibrary(d, { startCollection, initialQuery: query });
    return;
  }
  let html = "";
  if (type === "help")
    html = `<span class="eyebrow">THE NEEDLE DROP</span><h2>Little clip.<br>Big points.</h2><ol><li>Find songs by artist or import a public playlist’s track names.</li><li>Listen to a tiny slice of the recording.</li><li>Type the title. Unlock longer clues for fewer points.</li></ol><div class="reward-list">${CLIPS.map((n, i) => `<span>${n}s <b>${POINTS[i]} pts</b></span>`).join("")}</div><p class="dialog-note">Replay clues freely. After the reveal, listen to up to 30 seconds. These are provider-selected previews; they may start mid-song. With friends, pass the phone between turns.</p>`;
  if (type === "about")
    html = `<span class="eyebrow">REAL SONGS, SHORT CLIPS</span><h2>The recordings<br>you know.</h2><p>Search Deezer’s catalog for preview recordings, or read the publicly visible titles in a Spotify playlist and find matching previews. No Spotify playback, login or song downloads.</p><p>Previews may begin in the middle of a song. Some tracks or regions have no preview. Matching requires the same title and artist; missing tracks are reported before you play.</p><p>Spotify’s public page can be incomplete and may change. You can also paste Artist - Song lines for the complete list you want to use.</p><p class="dialog-note">Provider availability and terms apply. Preview access alone doesn’t grant unrestricted music rights.</p>`;
  if (type === "friends")
    html = `<span class="eyebrow">PASS THE PHONE</span><h2>Good ears.<br>Better company.</h2><p>Take turns on one device. No rooms or accounts.</p><form id="players-form"><label for="names">Player names, separated by commas</label><input id="names" maxlength="150" value="${mode === "friends" ? escape(players.join(", ")) : "You, Friend"}" required><p class="dialog-note">2–6 players. Starting resets the session.</p><button class="primary">Let’s play ${icon("arrow")}</button></form>`;
  if (type === "solo")
    html =
      '<h2>A moment for you.</h2><p>Switch to solo and start a fresh session?</p><button class="primary" id="confirm-solo">Start solo</button>';
  if (type === "pass")
    html = `<span class="eyebrow">NEXT UP</span><h2>${escape(players[turn])},<br>you’re on.</h2><p>Pass the phone before playing the next clue.</p><button class="primary" id="ready">I’m ready ${icon("arrow")}</button>`;
  if (type === "results")
    html = `<span class="eyebrow">THAT’S A WRAP</span><h2>${score >= queue.length * 600 ? "Golden ears." : "Nice listening."}</h2><div class="results">${players
      .map((p, i) => ({ p, s: scores[i] }))
      .sort((a, b) => b.s - a.s)
      .map(
        (p, i) =>
          `<div><span>${i + 1}. ${escape(p.p)}</span><strong>${p.s.toLocaleString()} <small>pts</small></strong></div>`,
      )
      .join(
        "",
      )}</div><p class="dialog-note">${queue.length} tracks. A few new memories.</p><button class="primary" id="again">One more spin ${icon("arrow")}</button>`;
  d.innerHTML = `<button class="dialog-close" aria-label="Close dialog">${icon("close")}</button>${html}`;
  d.querySelector(".dialog-close").onclick = () => d.close();
  d.querySelector("#players-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const names = d
      .querySelector("#names")
      .value.split(",")
      .map((n) => n.trim().slice(0, 24))
      .filter(Boolean);
    if (names.length < 2 || names.length > 6) {
      d.querySelector("#names").setCustomValidity(
        "Enter 2–6 names separated by commas.",
      );
      d.querySelector("#names").reportValidity();
      return;
    }
    players = names;
    mode = "friends";
    reset();
    open(queue.length ? "pass" : "library");
  });
  d.querySelector("#names")?.addEventListener("input", (e) =>
    e.target.setCustomValidity(""),
  );
  d.querySelector("#confirm-solo")?.addEventListener("click", () => {
    players = ["You"];
    mode = "solo";
    reset();
  });
  d.querySelector("#ready")?.addEventListener("click", () => d.close());
  d.querySelector("#again")?.addEventListener("click", reset);
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
render();

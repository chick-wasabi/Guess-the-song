import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { catalogHandler } from "./http.js";
import { CatalogError } from "./catalog.js";
test("real HTTP routing validates JSON, preserves errors, and passes through assets", async () => {
  const handler = catalogHandler({
    search: async (q) => {
      if (q === "blocked")
        throw new CatalogError("Network blocked", 502, "NETWORK_BLOCKED");
      return { tracks: [{ title: q }] };
    },
    playlist: async () => ({ tracks: [] }),
    resolve: async (tracks) => ({ results: tracks }),
  });
  const server = createServer((req, res) =>
    handler(req, res, () => {
      res.writeHead(200);
      res.end("frontend");
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let r = await fetch(`${base}/api/search?q=Raftaar`);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).tracks[0].title, "Raftaar");
    r = await fetch(`${base}/api/search?q=blocked`);
    assert.equal(r.status, 502);
    assert.equal((await r.json()).code, "NETWORK_BLOCKED");
    r = await fetch(`${base}/api/resolve`, { method: "POST", body: "invalid" });
    assert.equal(r.status, 400);
    r = await fetch(`${base}/api/track-list`, {
      method: "POST",
      body: JSON.stringify({ text: "Raftaar - Song" }),
    });
    assert.equal((await r.json()).tracks[0].artist, "Raftaar");
    r = await fetch(`${base}/api/missing`);
    assert.equal(r.status, 404);
    r = await fetch(`${base}/`);
    assert.equal(await r.text(), "frontend");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Vercel entry accepts pre-parsed JSON request bodies and serves health", async () => {
  const { default: entry } = await import("../api/[...path].js");
  const invoke = async (req) => {
    let status, body;
    const res = {
      writeHead: (s) => {
        status = s;
      },
      end: (value) => {
        body = JSON.parse(value);
      },
    };
    await entry(req, res);
    return { status, body };
  };
  let result = await invoke({ method: "GET", url: "/api/health" });
  assert.equal(result.status, 200);
  assert.equal(result.body.apiVersion, 1);
  result = await invoke({
    method: "POST",
    url: "/api/track-list",
    body: { text: "Artist - Song" },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.tracks[0].title, "Song");
  result = await invoke({
    method: "POST",
    url: "/api/track-list",
    body: "not json",
  });
  assert.equal(result.status, 400);
});

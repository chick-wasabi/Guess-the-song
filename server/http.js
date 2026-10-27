import { CatalogError, parseTrackList } from "./catalog.js";
async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536)
      throw new CatalogError("Request too large.", 413, "INVALID_REQUEST");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new CatalogError("Send a JSON request.", 400, "INVALID_REQUEST");
  }
}
export function catalogHandler(service) {
  return async (req, res, next) => {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/")) return next();
    const send = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(data));
    };
    try {
      if (req.method === "GET" && url.pathname === "/api/search")
        return send(200, await service.search(url.searchParams.get("q")));
      if (req.method === "GET" && url.pathname === "/api/playlist")
        return send(200, await service.playlist(url.searchParams.get("url")));
      if (req.method === "POST" && url.pathname === "/api/resolve") {
        const body = await readJson(req);
        return send(200, await service.resolve(body?.tracks));
      }
      if (req.method === "POST" && url.pathname === "/api/track-list") {
        const body = await readJson(req);
        if (typeof body?.text !== "string")
          throw new CatalogError("Paste a track list.", 400);
        return send(200, {
          name: "Your track list",
          tracks: parseTrackList(body.text),
          completeness: "provided",
        });
      }
      return send(404, { error: "Unknown music endpoint.", code: "NOT_FOUND" });
    } catch (error) {
      send(error instanceof CatalogError ? error.status : 500, {
        error:
          error instanceof CatalogError
            ? error.message
            : "The music request failed. Try again.",
        code: error instanceof CatalogError ? error.code : "INTERNAL_ERROR",
      });
    }
  };
}

import { catalogHandler } from "../server/http.js";
import { createCatalogService } from "../server/catalog.js";
const handler = catalogHandler(createCatalogService());
export default function musicApi(req, res) {
  return handler(req, res, () => {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found.", code: "NOT_FOUND" }));
  });
}

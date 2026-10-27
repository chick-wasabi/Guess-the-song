import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createCatalogService } from "./catalog.js";
import { catalogHandler } from "./http.js";
const production = process.argv.includes("--production");
const portIndex = process.argv.indexOf("--port");
const port = Number(
  portIndex >= 0
    ? process.argv[portIndex + 1]
    : process.env.PORT || (production ? 4173 : 5173),
);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Use a valid port.");
const root = fileURLToPath(new URL("../", import.meta.url));
const api = catalogHandler(createCatalogService());
let serve;
if (production) {
  const { default: sirv } = await import("sirv");
  serve = sirv(`${root}/dist`, { single: true, etag: true });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  serve = vite.middlewares;
}
const server = createServer((req, res) =>
  api(req, res, () =>
    serve(req, res, () => {
      res.writeHead(404);
      res.end("Not found");
    }),
  ),
);
server.requestTimeout = 180000;
server.listen(port, "0.0.0.0", () =>
  console.log(
    `Needle ${production ? "production" : "development"} server listening on port ${port}`,
  ),
);
server.on("error", (error) => {
  console.error(`Server could not start: ${error.message}`);
  process.exit(1);
});

import { defineConfig } from "vite";
import { catalogHandler } from "./server/http.js";
import { createCatalogService } from "./server/catalog.js";
function attach(server) {
  server.middlewares.use(catalogHandler(createCatalogService()));
}
export default defineConfig({
  plugins: [
    {
      name: "needle-music-api",
      configureServer: attach,
      configurePreviewServer: attach,
    },
  ],
});

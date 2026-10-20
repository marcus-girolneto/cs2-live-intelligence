import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/** A static file of the API documentation page. */
export type DocsAsset = { body: Buffer | string; type: string };

const INIT_JS = `"use strict";
window.addEventListener("load", function () {
  window.ui = SwaggerUIBundle({
    url: "/api/v1/openapi.json",
    dom_id: "#swagger-ui",
    deepLinking: true,
    persistAuthorization: false,
    tryItOutEnabled: false,
    displayRequestDuration: true,
    filter: true,
    defaultModelsExpandDepth: 0,
    presets: [SwaggerUIBundle.presets.apis],
    layout: "BaseLayout",
  });
});
`;

const THEME_CSS = `html { background: #0b0f14; color-scheme: dark; }
body { margin: 0; background: #0b0f14; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.fm-bar { display: flex; align-items: center; gap: 12px; padding: 14px 24px; background: #121821; border-bottom: 1px solid #1f2a36; }
.fm-word { color: #f2a93b; font-weight: 800; letter-spacing: 0.18em; font-size: 18px; }
.fm-sub { color: #e9eef4; opacity: 0.8; font-size: 14px; }
.fm-bar a { margin-left: auto; color: #ffc561; font-size: 14px; text-decoration: none; }
#swagger-ui { filter: invert(0.9) hue-rotate(180deg); background: #fff; min-height: 100vh; }
#swagger-ui .microlight, #swagger-ui .highlight-code, #swagger-ui img { filter: invert(1) hue-rotate(180deg); }
`;

/** The page itself: no inline script or style, so the CSP can allow only 'self'. */
export const DOCS_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FRAGMIND API docs</title>
<link rel="icon" type="image/png" href="/api/docs/favicon-32x32.png">
<link rel="stylesheet" href="/api/docs/swagger-ui.css">
<link rel="stylesheet" href="/api/docs/theme.css">
</head>
<body>
<header class="fm-bar"><span class="fm-word">FRAGMIND</span><span class="fm-sub">Public API v1</span><a href="/api/v1/openapi.json">openapi.json</a></header>
<div id="swagger-ui"></div>
<script src="/api/docs/swagger-ui-bundle.js"></script>
<script src="/api/docs/init.js"></script>
</body>
</html>
`;

/** Content-Security-Policy of the docs page: everything from this origin only. */
export const DOCS_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'";

/**
 * Swagger UI assets, self-hosted from the pinned swagger-ui-dist package (no CDN), read once
 * on first use and kept in memory.
 */
export class SwaggerAssets {
  private cache: Map<string, DocsAsset> | undefined;

  private load(): Map<string, DocsAsset> {
    const dist = dirname(
      createRequire(import.meta.url).resolve("swagger-ui-dist/package.json"),
    );
    const file = (name: string): Buffer => readFileSync(join(dist, name));
    return new Map<string, DocsAsset>([
      [
        "swagger-ui.css",
        { body: file("swagger-ui.css"), type: "text/css; charset=utf-8" },
      ],
      [
        "swagger-ui-bundle.js",
        {
          body: file("swagger-ui-bundle.js"),
          type: "text/javascript; charset=utf-8",
        },
      ],
      [
        "favicon-32x32.png",
        { body: file("favicon-32x32.png"), type: "image/png" },
      ],
      ["init.js", { body: INIT_JS, type: "text/javascript; charset=utf-8" }],
      ["theme.css", { body: THEME_CSS, type: "text/css; charset=utf-8" }],
    ]);
  }

  get(name: string): DocsAsset | undefined {
    this.cache ??= this.load();
    return this.cache.get(name);
  }
}

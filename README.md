# dochigarden

The website for **dochigarden.com** — a small garden of calm, native Mac software.

Static site, no build step. Deployed to Cloudflare Pages (output directory: repo root).

```
/index.html        homepage (the "garden")
/robots.txt        points crawlers at the blog sitemap (dochigarden.com/blog is a separate
                   Cloudflare Worker deployed from khy07181/khy07181.github.io)
/404.html          not-found page (Pages serves it for any unmatched path)
/favicon.svg       studio favicon (hedgehog only; follows the tab's light/dark theme)
/favicon.ico       the same on a paper tile, for crawlers and older clients
/apple-touch-icon.png
/og.png            link-preview card for the studio pages (rendered from brand/og.html)
/brand/            dochigarden logo — a hedgehog (dochi) watching a sprout (garden).
                   index.html is the public brand page (dochigarden.com/brand/);
                   mark (light / dark / one-colour), square avatar, circle-safe icon
                   (Discord, Slack), and build.py, which regenerates every SVG above
  export/          the same as PNG / JPG / WebP, plus the blog's link-preview card
                   (`python3 brand/build.py --export` also rebuilds /favicon.ico,
                   /apple-touch-icon.png and /og.png)
  fonts/           Newsreader Semibold (SIL OFL) — the wordmark in rendered images
/cloister/         Cloister landing page (index.html, og.png, images/)
/functions/        Cloudflare Pages Functions (file-based routing)
  cloister/download.js   /cloister/download → 302 to the latest public DMG
                         on GitHub Releases (the landing's DMG button)
  cloister/crash-report.js  POST /cloister/crash-report → validates an opt-in Cloister
                            crash report and relays it as an email to the support inbox
                            (Email Sending REST; secrets CF_ACCOUNT_ID, CF_EMAIL_API_TOKEN,
                            var CRASH_REPORT_TO). Stores nothing. Tests: npm test
```

Each product lives under its own path (e.g. `dochigarden.com/cloister`). Add new
apps as sibling folders.

## Deploy

The Pages project is direct-upload (not Git-connected): pushing `main` deploys
nothing. Deploy from the **repo root** so wrangler bundles `functions/`:

    npx wrangler pages deploy . --project-name dochigarden --branch main --commit-hash "$(git rev-parse HEAD)"

Running it from any other directory uploads the assets without the Functions and
breaks `/cloister/download` and `/cloister/crash-report`. Check after deploying:
`curl -sI https://dochigarden.com/cloister/download | head -1` → `HTTP/2 302`.

Functions tests: `npm test` (Node ≥ 22, no dependencies).

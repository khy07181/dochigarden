# dochigarden

The website for **dochigarden.com** — a small garden of calm, native Mac software.

Static site, no build step. Deployed to Cloudflare Pages (output directory: repo root).

```
/index.html        homepage (the "garden")
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

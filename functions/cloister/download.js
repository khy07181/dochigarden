// GET /cloister/download → 302 straight to the latest public Cloister DMG.
//
// The landing's "Download the .dmg" button points here so a click starts the
// download immediately instead of parking the visitor on the GitHub release
// page. Resolution avoids the GitHub API (unauthenticated calls share a 60/hr
// per-IP budget with every other Worker in the colo):
//   1. HEAD github.com/.../releases/latest → its Location header carries the
//      latest tag. GitHub excludes drafts + pre-releases here, so dogfood
//      builds (release.sh without --public) never leak to the public button.
//   2. Build the asset URL the way scripts/release.sh names it
//      (releases/download/<tag>/cloister-<version>.dmg) and HEAD-probe it.
//      302 = exists; anything else = naming drifted → fall back to the
//      release page rather than 404 the visitor.
// The resolved redirect is cached at the edge for CACHE_SECONDS.

const REPO = 'https://github.com/khy07181/homebrew-cloister';
const RELEASES_PAGE = `${REPO}/releases/latest`;
const CACHE_SECONDS = 300;
const HEADERS = { 'User-Agent': 'dochigarden-download (+https://dochigarden.com/cloister)' };

export const onRequestGet = handle;
export const onRequestHead = handle;

async function handle({ request, waitUntil }) {
  const cache = caches.default;
  // Fixed key: strip method + query so ?utm_* doesn't fragment the cache.
  const cacheKey = new Request(`${new URL(request.url).origin}/cloister/download`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const target = (await resolveLatestDmg()) ?? RELEASES_PAGE;
  const response = new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Cache-Control': `public, s-maxage=${CACHE_SECONDS}`,
    },
  });
  waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function resolveLatestDmg() {
  try {
    const latest = await fetch(RELEASES_PAGE, { method: 'HEAD', redirect: 'manual', headers: HEADERS });
    const tag = /\/releases\/tag\/([^/?#]+)\/?$/.exec(latest.headers.get('Location') ?? '')?.[1];
    if (!tag) return null;

    const version = tag.replace(/^v/, '');
    const dmg = `${REPO}/releases/download/${tag}/cloister-${version}.dmg`;
    const probe = await fetch(dmg, { method: 'HEAD', redirect: 'manual', headers: HEADERS });
    const exists = probe.ok || (probe.status >= 300 && probe.status < 400);
    return exists ? dmg : null;
  } catch {
    return null;
  }
}

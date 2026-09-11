// POST /cloister/crash-report → relay an opt-in Cloister crash report as an
// email to the support inbox. Stateless: nothing is stored or logged beyond
// the status code. Contract: docs/specs/2026-09-11-crash-reporting-design.md
// §4.5 in the cloister repo. Sends through the Email Sending REST API because
// Pages Functions have no send_email binding.

const MAX_BODY_BYTES = 512 * 1024;
const MAX_REPORT_BYTES = 400 * 1024;
const MAX_COMMENT_CHARS = 2000;
const MAX_EMAIL_CHARS = 254;
const FROM = { address: 'crash-reports@dochigarden.com', name: 'Cloister Crash Reports' };
const DEFAULT_TO = 'support@dochigarden.com';
const ALLOWED_KEYS = new Set(['schema', 'reportID', 'app', 'os', 'model', 'sentAutomatically', 'comment', 'email', 'report']);
const SEMVER = /^\d+\.\d+\.\d+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const utf8Length = (s) => new TextEncoder().encode(s).byteLength;
const isNonEmptyString = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;

/** Schema-1 envelope check. Returns { ok: true, value } or { ok: false, error }. */
export function validate(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return fail('body must be an object');
  for (const key of Object.keys(body)) if (!ALLOWED_KEYS.has(key)) return fail(`unknown field ${key}`);
  if (body.schema !== 1) return fail('schema must be 1');
  if (typeof body.reportID !== 'string' || !UUID.test(body.reportID)) return fail('reportID must be a UUID');
  if (!body.app || !SEMVER.test(body.app.version ?? '') || !isNonEmptyString(body.app.build, 32)) return fail('app.version/build invalid');
  if (!body.os || !isNonEmptyString(body.os.version, 32) || !isNonEmptyString(body.os.build, 32)) return fail('os.version/build invalid');
  if (!isNonEmptyString(body.model, 64)) return fail('model invalid');
  if (typeof body.sentAutomatically !== 'boolean') return fail('sentAutomatically must be boolean');
  if (body.comment != null && !(typeof body.comment === 'string' && body.comment.length <= MAX_COMMENT_CHARS)) return fail('comment too long');
  if (body.email != null && !(typeof body.email === 'string' && body.email.length <= MAX_EMAIL_CHARS)) return fail('email too long');
  if (typeof body.report !== 'string' || body.report.length === 0 || utf8Length(body.report) > MAX_REPORT_BYTES) return fail('report empty or too large');
  return { ok: true, value: body };
}

function fail(error) {
  return { ok: false, error };
}

/** The Email Sending REST payload for one envelope. */
export function buildEmail(envelope, to) {
  const signal = /^Exception Type:\s+(\S+)/m.exec(envelope.report)?.[1] ?? 'unknown';
  const subject = `[Cloister crash] ${envelope.app.version} (${envelope.app.build}) · macOS ${envelope.os.version} · ${signal}`;
  const lines = [
    `Cloister ${envelope.app.version} (${envelope.app.build})`,
    `macOS ${envelope.os.version} (${envelope.os.build}) · ${envelope.model}`,
    `Sent ${envelope.sentAutomatically ? 'automatically' : 'by the user'} · report ${envelope.reportID}`,
    '',
    `Comment: ${envelope.comment ?? '(none)'}`,
    `Email: ${envelope.email ?? '(none)'}`,
    '',
    'The crash report is attached. Symbolicate with scripts/symbolicate.sh in the cloister repo.',
  ];
  const email = {
    to,
    from: FROM,
    subject,
    text: lines.join('\n'),
    attachments: [{
      content: toBase64(envelope.report),
      filename: `cloister-${envelope.app.version}-${envelope.reportID}.crash`,
      type: 'text/plain',
      disposition: 'attachment',
    }],
  };
  if (envelope.email && EMAIL.test(envelope.email)) email.reply_to = envelope.email;
  return email;
}

/** UTF-8 → base64 without spreading a 400 KB array into one call. */
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

const json = (status, payload) =>
  new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

/** POST handler; `fetchImpl` is injected so tests never reach the network. */
export async function handleRequest(request, env, fetchImpl = fetch) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) return new Response(null, { status: 415 });

  const raw = await request.text();
  if (utf8Length(raw) > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: 'invalid JSON' });
  }
  const checked = validate(parsed);
  if (!checked.ok) return json(400, { ok: false, error: checked.error });

  const to = env.CRASH_REPORT_TO || DEFAULT_TO;
  const upstream = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildEmail(checked.value, to)),
    },
  );
  if (!upstream.ok) return json(502, { ok: false });
  return json(202, { ok: true });
}

export const onRequest = (context) =>
  context.request.method === 'POST'
    ? handleRequest(context.request, context.env, fetch)
    : new Response(null, { status: 405, headers: { Allow: 'POST' } });

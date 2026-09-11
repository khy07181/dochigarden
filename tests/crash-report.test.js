import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, buildEmail, handleRequest } from '../functions/cloister/crash-report.js';

const sample = () => ({
  schema: 1,
  reportID: 'D45DDBD4-C9A3-413F-B30A-86071AAC0FBB',
  app: { version: '1.1.3', build: '202609111200' },
  os: { version: '15.1', build: '24B2083' },
  model: 'Mac16,8',
  sentAutomatically: false,
  comment: 'Clicked Start while the popover was open',
  email: 'someone@example.com',
  report: 'Incident Identifier: X\nException Type:  SIGABRT\nException Codes: #0 at 0x0\n',
});

const env = { CF_ACCOUNT_ID: 'acct', CF_EMAIL_API_TOKEN: 'tok', CRASH_REPORT_TO: 'inbox@example.com' };

const post = (body, headers = { 'content-type': 'application/json' }) =>
  new Request('https://dochigarden.com/cloister/crash-report', { method: 'POST', headers, body });

test('validate accepts the sample envelope', () => {
  const result = validate(sample());
  assert.equal(result.ok, true);
  assert.equal(result.value.reportID, sample().reportID);
});

test('validate accepts null comment and email', () => {
  assert.equal(validate({ ...sample(), comment: null, email: null }).ok, true);
});

test('validate rejects unknown fields, bad schema, bad semver, bad uuid', () => {
  assert.equal(validate({ ...sample(), deviceId: 'x' }).ok, false);
  assert.equal(validate({ ...sample(), schema: 2 }).ok, false);
  assert.equal(validate({ ...sample(), app: { version: '1.1', build: '1' } }).ok, false);
  assert.equal(validate({ ...sample(), reportID: 'not-a-uuid' }).ok, false);
  assert.equal(validate({ ...sample(), sentAutomatically: 'yes' }).ok, false);
});

test('validate rejects an empty or oversized report and an oversized comment', () => {
  assert.equal(validate({ ...sample(), report: '' }).ok, false);
  assert.equal(validate({ ...sample(), report: 'x'.repeat(400 * 1024 + 1) }).ok, false);
  assert.equal(validate({ ...sample(), comment: 'x'.repeat(2001) }).ok, false);
});

test('buildEmail sets subject, reply_to, and a base64 .crash attachment', () => {
  const email = buildEmail(sample(), 'inbox@example.com');
  assert.equal(email.to, 'inbox@example.com');
  assert.deepEqual(email.from, { address: 'crash-reports@dochigarden.com', name: 'Cloister Crash Reports' });
  assert.equal(email.subject, '[Cloister crash] 1.1.3 (202609111200) · macOS 15.1 · SIGABRT');
  assert.equal(email.reply_to, 'someone@example.com');
  assert.match(email.text, /Clicked Start while the popover was open/);
  assert.equal(email.attachments.length, 1);
  assert.equal(email.attachments[0].filename, 'cloister-1.1.3-D45DDBD4-C9A3-413F-B30A-86071AAC0FBB.crash');
  assert.equal(email.attachments[0].type, 'text/plain');
  assert.equal(email.attachments[0].disposition, 'attachment');
  assert.equal(Buffer.from(email.attachments[0].content, 'base64').toString('utf8'), sample().report);
});

test('buildEmail omits reply_to without an email and says "unknown" without an Exception Type line', () => {
  const email = buildEmail({ ...sample(), email: null, report: 'no exception line' }, 'inbox@example.com');
  assert.equal('reply_to' in email, false);
  assert.match(email.subject, /· unknown$/);
});

test('buildEmail round-trips multi-byte report text through base64', () => {
  const email = buildEmail({ ...sample(), report: 'Exception Type:  SIGTRAP\n정원 ✓ ' + 'é'.repeat(5000) }, 'inbox@example.com');
  assert.equal(Buffer.from(email.attachments[0].content, 'base64').toString('utf8'), 'Exception Type:  SIGTRAP\n정원 ✓ ' + 'é'.repeat(5000));
});

test('handleRequest: 415 for a non-JSON content type', async () => {
  const res = await handleRequest(post('x', { 'content-type': 'text/plain' }), env, async () => { throw new Error('must not fetch'); });
  assert.equal(res.status, 415);
});

test('handleRequest: 413 for a body over 512 KB', async () => {
  const big = JSON.stringify({ ...sample(), report: 'x'.repeat(520 * 1024) });
  const res = await handleRequest(post(big), env, async () => { throw new Error('must not fetch'); });
  assert.equal(res.status, 413);
});

test('handleRequest: 400 for invalid JSON or an invalid envelope', async () => {
  assert.equal((await handleRequest(post('{'), env, async () => { throw new Error('must not fetch'); })).status, 400);
  assert.equal((await handleRequest(post(JSON.stringify({})), env, async () => { throw new Error('must not fetch'); })).status, 400);
});

test('handleRequest: 202 when the email API accepts, forwarding to CRASH_REPORT_TO', async () => {
  let seen;
  const fakeFetch = async (url, init) => {
    seen = { url, init };
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const res = await handleRequest(post(JSON.stringify(sample())), env, fakeFetch);
  assert.equal(res.status, 202);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(seen.url, 'https://api.cloudflare.com/client/v4/accounts/acct/email/sending/send');
  assert.equal(seen.init.headers.Authorization, 'Bearer tok');
  assert.equal(JSON.parse(seen.init.body).to, 'inbox@example.com');
});

test('handleRequest: 502 when the email API fails', async () => {
  const res = await handleRequest(post(JSON.stringify(sample())), env, async () => new Response('nope', { status: 500 }));
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { ok: false });
});

test('handleRequest: 502 when the email API call itself rejects', async () => {
  const res = await handleRequest(post(JSON.stringify(sample())), env, async () => { throw new TypeError('fetch failed'); });
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { ok: false });
});

test('handleRequest: default recipient is support@dochigarden.com', async () => {
  let body;
  await handleRequest(post(JSON.stringify(sample())), { CF_ACCOUNT_ID: 'a', CF_EMAIL_API_TOKEN: 't' },
    async (_url, init) => { body = JSON.parse(init.body); return new Response('{}', { status: 200 }); });
  assert.equal(body.to, 'support@dochigarden.com');
});

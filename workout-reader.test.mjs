import test from 'node:test';
import assert from 'node:assert/strict';
import { config, protect, refreshConnection, latestWorkout, createAuthServer } from './tools/workout-reader.mjs';

test('reader uses the app project configuration', async () => {
  assert.equal((await config()).projectId, 'lift-tracker-8674a');
});

test('latest reads exactly one workout from the authenticated account and retains sets and notes', async () => {
  const workout = await latestWorkout({ projectId: 'test-project' }, 'account-1', 'private-token', async (url, options) => {
    assert.equal(url, 'https://firestore.googleapis.com/v1/projects/test-project/databases/(default)/documents/users/account-1:runQuery');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer private-token');
    assert.deepEqual(JSON.parse(options.body), { structuredQuery: {
      from: [{ collectionId: 'workouts' }],
      orderBy: [{ field: { fieldPath: 't' }, direction: 'DESCENDING' }], limit: 1
    } });
    return { ok: true, json: async () => [{ document: { name: 'path/workout-2', fields: {
      t: { stringValue: '2026-11-22T10:00:00Z' }, gym: { stringValue: 'Gym' },
      e: { arrayValue: { values: [{ mapValue: { fields: {
        n: { stringValue: 'Bench' }, note: { stringValue: 'Slow tempo' },
        s: { arrayValue: { values: [{ mapValue: { fields: {
          weight: { doubleValue: 112.5 }, reps: { integerValue: '8' }, done: { booleanValue: false }
        } } }] } }
      } } }] } }
    } } }] };
  });
  assert.deepEqual(workout, { id: 'workout-2', t: '2026-11-22T10:00:00Z', gym: 'Gym',
    e: [{ n: 'Bench', note: 'Slow tempo', s: [{ weight: 112.5, reps: 8, done: false }] }] });
});

test('empty accounts return null; access failures never become empty history', async () => {
  assert.equal(await latestWorkout({ projectId: 'p' }, 'u', 'token', async () => ({ ok: true, json: async () => [{ readTime: 'now' }] })), null);
  await assert.rejects(latestWorkout({ projectId: 'p' }, 'u', 'token', async () => ({ ok: false, status: 403 })), /Access denied/);
  await assert.rejects(latestWorkout({ projectId: 'p' }, 'other/account', 'token'), /Invalid account/);
});

test('token refresh is project-bound, account-bound, and preserves rotated refresh tokens', async () => {
  const stored = { uid: 'u', projectId: 'p', refreshToken: 'old-secret' };
  const fetcher = async (url, options) => {
    assert.equal(new URLSearchParams(options.body).get('refresh_token'), 'old-secret');
    return { ok: true, json: async () => ({ user_id: 'u', id_token: 'id-secret', refresh_token: 'rotated-secret' }) };
  };
  const result = await refreshConnection({ projectId: 'p', apiKey: 'key' }, stored, fetcher);
  assert.equal(result.connection.refreshToken, 'rotated-secret');
  assert.equal(stored.refreshToken, 'old-secret');
  await assert.rejects(refreshConnection({ projectId: 'other' }, stored, fetcher), /different project/);
  await assert.rejects(refreshConnection({ projectId: 'p' }, stored, async () => ({ ok: true, json: async () => ({ user_id: 'other', id_token: 'id', refresh_token: 'refresh' }) })), /did not match/);
});

test('Windows account protection round-trips without storing plaintext', { skip: process.platform !== 'win32' }, async () => {
  const plaintext = JSON.stringify({ refreshToken: 'synthetic-test-secret' });
  const encrypted = await protect(plaintext);
  assert.ok(!encrypted.includes('synthetic-test-secret'));
  assert.equal(await protect(encrypted, true), plaintext);
});

test('connection server rejects other origins, missing session proof, and invalid credentials; permits retry', async t => {
  const received = [];
  const flow = createAuthServer({ projectId: 'test', apiKey: 'test', authDomain: 'test.firebaseapp.com' }, async token => {
    if (token === 'bad') throw new Error('private error details');
    received.push(token);
  });
  const link = await flow.listen();
  t.after(() => flow.server.close());
  const url = new URL(link);
  const page = await fetch(link);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal((await fetch(url.origin)).status, 404);
  const post = (origin, session, token) => fetch(`${url.origin}/connection`, { method: 'POST',
    headers: { Origin: origin, 'X-Connection-Session': session, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: token }) });
  const nonce = url.searchParams.get('session');
  assert.equal((await post('https://other.example', nonce, 'secret')).status, 403);
  assert.equal((await post(url.origin, 'wrong', 'secret')).status, 403);
  assert.equal((await post(url.origin, nonce, null)).status, 400);
  const rejected = await post(url.origin, nonce, 'bad');
  assert.equal(rejected.status, 400);
  assert.ok(!(await rejected.text()).includes('private error details'));
  assert.equal((await post(url.origin, nonce, 'good')).status, 200);
  assert.deepEqual(received, ['good']);
});

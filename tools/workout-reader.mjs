import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const authFile = new URL('.local/workout-reader/connection.dpapi', root);

export async function config() {
  const source = await readFile(new URL('firebase.js', root), 'utf8');
  const get = key => {
    const value = source.match(new RegExp(`${key}:\\s*"([^"]+)"`))?.[1];
    if (!value) throw new Error(`Missing ${key} in firebase.js.`);
    return value;
  };
  return { apiKey: get('apiKey'), authDomain: get('authDomain'), projectId: get('projectId') };
}

// DPAPI binds this secret to the current Windows user. Secrets travel over stdin,
// never command-line arguments, environment variables, or console output.
export function protect(text, decrypt = false) {
  if (process.platform !== 'win32') throw new Error('This account connection requires Windows.');
  const operation = decrypt
    ? "$bytes = [Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($inputText), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Text.Encoding]::UTF8.GetString($bytes))"
    : "$bytes = [Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($inputText), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($bytes))";
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.Security; $inputText = [Console]::In.ReadToEnd(); ${operation}`],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
    child.stderr.resume();
    child.on('error', () => reject(new Error('Could not open Windows account protection.')));
    child.on('close', code => code === 0 ? resolve(output) : reject(new Error('Could not unlock the connection. Run the auth command again on this Windows account.')));
    child.stdin.on('error', () => {});
    child.stdin.end(text);
  });
}

async function saveConnection(connection) {
  const encrypted = await protect(JSON.stringify(connection));
  await mkdir(new URL('.local/workout-reader/', root), { recursive: true });
  const temporary = new URL(`${authFile.href}.tmp`);
  await writeFile(temporary, encrypted, { mode: 0o600 });
  await rename(temporary, authFile);
}

async function loadConnection() {
  let encrypted;
  try { encrypted = await readFile(authFile, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error('Account not connected. Run: node tools/workout-reader.mjs auth');
    throw error;
  }
  return JSON.parse(await protect(encrypted, true));
}

export async function request(url, options, fetcher = fetch) {
  const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    // Do not include response bodies: authentication responses may contain secrets.
    if (response.status === 401 || response.status === 400) throw new Error(`Request rejected (${response.status}). Check your connection; you may need to run the auth command again.`);
    if (response.status === 403) throw new Error('Access denied. Check the signed-in account and project access settings.');
    throw new Error(`Request failed (${response.status}). Try again later.`);
  }
  return response.json();
}

export async function refreshConnection(settings, connection, fetcher = fetch) {
  if (connection.projectId !== settings.projectId) throw new Error('Connection belongs to a different project. Run the auth command again.');
  const token = await request(`https://securetoken.googleapis.com/v1/token?key=${settings.apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: connection.refreshToken }).toString()
  }, fetcher);
  if (!token.id_token || !token.refresh_token || token.user_id !== connection.uid) throw new Error('Account connection did not match. Run the auth command again.');
  return { idToken: token.id_token, connection: { ...connection, refreshToken: token.refresh_token } };
}

export function decodeValue(value) {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) {
    const number = Number(value.integerValue);
    return Number.isSafeInteger(number) ? number : value.integerValue;
  }
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  // Preserve any future field types rather than silently dropping workout data.
  return value;
}

export function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

export async function latestWorkout(settings, uid, idToken, fetcher = fetch) {
  if (typeof uid !== 'string' || !uid || uid.includes('/')) throw new Error('Invalid account identifier.');
  const parent = `projects/${settings.projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
  const rows = await request(`https://firestore.googleapis.com/v1/${parent}:runQuery`, {
    method: 'POST', headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'workouts' }],
      orderBy: [{ field: { fieldPath: 't' }, direction: 'DESCENDING' }], limit: 1
    } })
  }, fetcher);
  const document = rows.find(row => row.document)?.document;
  return document ? { ...decodeFields(document.fields || {}), id: document.name.split('/').at(-1) } : null;
}

export function authPage(settings, nonce) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect Lift Tracker</title><style>body{font:18px system-ui;max-width:480px;margin:10vh auto;padding:24px;background:#111918;color:#edf5f1}button{font:inherit;padding:14px;border:0;border-radius:12px;background:#c8edb3}p{line-height:1.6}</style>
<h1>Connect Lift Tracker</h1><p>Sign in with the Google account you use in Lift Tracker. This lets the assistant read your latest saved workout on this computer when you ask.</p>
<p>Your sign-in is encrypted for your Windows account. You can disconnect it at any time.</p>
<button id="connect" disabled>Continue with Google</button><p id="status" role="status">Preparing sign-in…</p>
<script type="module" src="/connect.js?session=${nonce}"></script></html>`;
}

export function authScript(settings, nonce) {
  return `import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, setPersistence, inMemoryPersistence, signOut } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';
const auth = getAuth(initializeApp(${JSON.stringify(settings)}));
const button = document.getElementById('connect');
const status = document.getElementById('status');
await setPersistence(auth, inMemoryPersistence);
button.disabled = false;
status.textContent = 'Ready to connect.';
button.onclick = async () => {
  button.disabled = true;
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    const result = await signInWithPopup(auth, provider);
    const response = await fetch('/connection', {method:'POST', headers:{'Content-Type':'application/json','X-Connection-Session':${JSON.stringify(nonce)}}, body:JSON.stringify({refreshToken:result.user.refreshToken})});
    if (!response.ok) throw new Error('connection-failed');
    await signOut(auth);
    status.textContent = 'Connected. You can close this tab. Your latest workout is ready to read when you ask.';
    button.remove();
  } catch (error) {
    status.textContent = error.code === 'auth/unauthorized-domain'
      ? 'This computer needs one setup step. See WORKOUT-ACCESS.md under Sign-in troubleshooting.'
      : 'Could not connect. Try again, or check the setup instructions.';
    button.disabled = false;
  }
};`;
}

export function createAuthServer(settings, onConnect) {
  const nonce = randomBytes(32).toString('hex');
  let origin;
  let connecting = false;
  const server = createServer(async (req, res) => {
    const send = (code, body, type = 'text/plain') => {
      res.writeHead(code, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; script-src 'self' https://www.gstatic.com https://apis.google.com; style-src 'unsafe-inline'; connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com; frame-src https://*.firebaseapp.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
      res.end(body);
    };
    if (req.headers.host !== new URL(origin).host) return send(403, 'Invalid host.');
    if (req.method === 'GET' && req.url === `/?session=${nonce}`) return send(200, authPage(settings, nonce), 'text/html');
    if (req.method === 'GET' && req.url === `/connect.js?session=${nonce}`) return send(200, authScript(settings, nonce), 'text/javascript');
    if (req.method !== 'POST' || req.url !== '/connection') return send(404, 'Not found.');
    if (req.headers.origin !== origin || req.headers['x-connection-session'] !== nonce ||
      req.headers['content-type'] !== 'application/json') return send(403, 'Invalid connection request.');
    if (connecting) return send(409, 'Connection already in progress.');
    connecting = true;
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 20000) { send(413, 'Request too large.'); return; }
      }
      const { refreshToken } = JSON.parse(body);
      if (typeof refreshToken !== 'string' || !refreshToken || refreshToken.length > 10000) return send(400, 'Invalid connection.');
      await onConnect(refreshToken);
      send(200, 'Connected.');
      server.close();
    } catch {
      send(400, 'Could not save connection. Check setup and try again.');
    } finally { connecting = false; }
  });
  server.requestTimeout = 30000;
  return { server, async listen() {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    // localhost is the standard development sign-in domain; bind only to loopback.
    origin = `http://localhost:${server.address().port}`;
    return `${origin}/?session=${nonce}`;
  } };
}

async function main(command) {
  if (command === 'disconnect') {
    await rm(authFile, { force: true });
    console.log('Removed this computer’s saved connection.');
    return;
  }
  if (!['auth', 'status', 'latest'].includes(command)) {
    console.log('Usage: node tools/workout-reader.mjs auth|status|latest|disconnect');
    return;
  }
  const settings = await config();
  if (command === 'auth') {
    if (process.platform !== 'win32') throw new Error('Account setup requires Windows.');
    const flow = createAuthServer(settings, async refreshToken => {
      const token = await request(`https://securetoken.googleapis.com/v1/token?key=${settings.apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString()
      });
      if (!token.user_id || !token.refresh_token || !token.id_token) throw new Error('Incomplete sign-in.');
      // Verify the signed-in account can read its own workouts before saving.
      // Request only a document name during connection setup.
      await request(`https://firestore.googleapis.com/v1/projects/${settings.projectId}/databases/(default)/documents/users/${encodeURIComponent(token.user_id)}:runQuery`, {
        method: 'POST', headers: { Authorization: `Bearer ${token.id_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'workouts' }], select: { fields: [{ fieldPath: '__name__' }] }, limit: 1 } })
      });
      await saveConnection({ projectId: settings.projectId, uid: token.user_id, refreshToken: token.refresh_token });
      console.log('Account connected. Run: node tools/workout-reader.mjs latest');
    });
    console.log(`Open this link on this computer and complete Google sign-in:\n${await flow.listen()}`);
    const timer = setTimeout(() => { console.log('Setup link expired. Run the auth command again.'); flow.server.close(); }, 15 * 60 * 1000);
    flow.server.on('close', () => clearTimeout(timer));
    return;
  }
  const stored = await loadConnection();
  if (command === 'status') {
    console.log(`Saved connection for account ${stored.uid}. Run latest to verify live access.`);
    return;
  }
  const refreshed = await refreshConnection(settings, stored);
  await saveConnection(refreshed.connection);
  const workout = await latestWorkout(settings, stored.uid, refreshed.idToken);
  console.log(JSON.stringify({ accountId: stored.uid, workout }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}

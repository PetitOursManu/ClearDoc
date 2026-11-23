/**
 * Tests de « Se connecter avec Kosmy Board » (OpenID Connect).
 * Un faux Kosmy Board (découverte, JWKS, jeton) tourne sur un port local ;
 * ClearDoc est monté sur une base SQLite en mémoire.
 *
 * Lancer : npm test
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import {
  createKosmyBoardRouter, migrateKosmyBoard, clearDiscoveryCache,
  safeTarget, codeChallenge, basicAuthHeader, normalizeIssuer, signFlow, verifyFlow,
  FLOW_COOKIE, SETTING_KEYS,
} from '../server/kosmyBoard.js';
import { migrateAccounts, createAdminSessions } from '../server/accounts.js';

const SECRET = 'test-secret-for-cleardoc';
const CLIENT_ID = 'kb-cleardoc-test';
const CLIENT_SECRET = 'very secret:value';
const SUB = '6f1c1d0e-1111-4c4c-9999-0123456789ab';

/* ---------------- Faux Kosmy Board ---------------- */

function startFakeBoard() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig', alg: 'RS256' };
  const codes = new Map();
  const board = { issuer: '', codes, tokenRequests: [], privateKey, otherKey: other.privateKey };

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.get('/oidc/.well-known/openid-configuration', (_req, res) => res.json({
    issuer: board.issuer,
    authorization_endpoint: `${board.issuer}/auth`,
    token_endpoint: `${board.issuer}/token`,
    jwks_uri: `${board.issuer}/jwks`,
  }));
  app.get('/oidc/jwks', (_req, res) => res.json({ keys: [jwk] }));
  app.post('/oidc/token', (req, res) => {
    board.tokenRequests.push({ auth: req.get('authorization'), body: req.body });
    const c = codes.get(req.body.code);
    codes.delete(req.body.code);
    if (!c) return res.status(400).json({ error: 'invalid_grant' });
    if (req.get('authorization') !== basicAuthHeader(CLIENT_ID, CLIENT_SECRET)) {
      return res.status(401).json({ error: 'invalid_client' });
    }
    if (codeChallenge(req.body.code_verifier || '') !== c.challenge) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE' });
    }
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      iss: board.issuer, aud: CLIENT_ID, sub: c.sub, nonce: c.nonce, iat: now, exp: now + 300,
      name: 'Admin Board', email: 'admin@example.test', preferred_username: 'admin@example.test',
      email_verified: false, locale: 'fr',
      ...(c.claims || {}),
    };
    const idToken = jwt.sign(claims, c.key || privateKey, { algorithm: 'RS256', keyid: 'k1' });
    res.json({ access_token: 'at', token_type: 'Bearer', id_token: idToken });
  });

  return new Promise((resolve) => {
    const server = http.createServer(app).listen(0, '127.0.0.1', () => {
      board.issuer = `http://127.0.0.1:${server.address().port}/oidc`;
      board.close = () => new Promise((r) => server.close(r));
      resolve(board);
    });
  });
}

/* ---------------- ClearDoc minimal (même câblage que server.js) ---------------- */

function startClearDoc() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE admin_users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME);
    CREATE TABLE login_logs (username TEXT, success INTEGER);
  `);
  migrateKosmyBoard(db);
  migrateKosmyBoard(db); // idempotente
  migrateAccounts(db);
  migrateAccounts(db); // idempotente
  db.prepare("INSERT INTO admin_users (id, username, password_hash) VALUES ('a1', 'admin', 'x')").run();

  const getSetting = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value || null;
  const setSetting = (k, v) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(k, v);
  const delSetting = (k) => db.prepare('DELETE FROM settings WHERE key = ?').run(k);
  // Les vraies sessions de ClearDoc (server/accounts.js), comme server.js.
  const sessions = createAdminSessions({ db, jwtSecret: SECRET, secure: false });
  const openAdminSession = sessions.open;
  const readAdminSession = sessions.read;
  const requireAuth = sessions.requireAuth;

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(createKosmyBoardRouter({
    db, getSetting, setSetting, delSetting, jwtSecret: SECRET, openAdminSession, readAdminSession, requireAuth,
    onLogin: (_req, username, success) => db.prepare('INSERT INTO login_logs VALUES (?, ?)').run(username, success ? 1 : 0),
  }));

  return new Promise((resolve) => {
    const server = http.createServer(app).listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      resolve({ db, base, setSetting, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

/* ---------------- Outils HTTP ---------------- */

function cookiesFrom(res) {
  const out = {};
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(';');
    const i = pair.indexOf('=');
    out[pair.slice(0, i)] = { value: decodeURIComponent(pair.slice(i + 1)), raw: line };
  }
  return out;
}

const cookieHeader = (obj) => Object.entries(obj).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
const sessionCookie = (username = 'admin') => jwt.sign({ username }, SECRET, { expiresIn: '1h' });

let board;
let app;

async function get(path, cookies = {}) {
  return fetch(app.base + path, { redirect: 'manual', headers: { Cookie: cookieHeader(cookies) } });
}

/** Lance le parcours, et renvoie le cookie de parcours et les paramètres de la demande d'autorisation. */
async function startLogin(query = '') {
  const res = await get(`/auth/kosmy-board/login${query}`);
  assert.equal(res.status, 303);
  const location = new URL(res.headers.get('location'));
  const flowCookie = cookiesFrom(res)[FLOW_COOKIE];
  return { res, location, params: location.searchParams, flowCookie };
}

/** Simule le Board : émet un code pour la demande, puis appelle le retour de ClearDoc. */
async function callback(start, { sub = SUB, claims, key, query, cookies } = {}) {
  const code = randomCode();
  board.codes.set(code, {
    sub, nonce: start.params.get('nonce'), challenge: start.params.get('code_challenge'), claims, key,
  });
  const q = new URLSearchParams({ code, state: start.params.get('state'), iss: board.issuer, ...(query || {}) });
  return get(`/auth/kosmy-board/callback?${q}`, { [FLOW_COOKIE]: start.flowCookie.value, ...(cookies || {}) });
}

const randomCode = () => crypto.randomBytes(16).toString('hex');
const errorOf = (res) => new URL(res.headers.get('location')).searchParams.get('kosmy_error');
const linkAdmin = (sub = SUB) => app.db.prepare("UPDATE admin_users SET kosmy_board_sub = ?, kosmy_board_issuer = ? WHERE id = 'a1'").run(sub, board.issuer);

before(async () => {
  board = await startFakeBoard();
  app = await startClearDoc();
});

after(async () => {
  await app.close();
  await board.close();
});

beforeEach(() => {
  clearDiscoveryCache();
  app.setSetting(SETTING_KEYS.issuer, board.issuer);
  app.setSetting(SETTING_KEYS.clientId, CLIENT_ID);
  app.setSetting(SETTING_KEYS.clientSecret, CLIENT_SECRET);
  app.db.prepare("UPDATE admin_users SET kosmy_board_sub = NULL, kosmy_board_issuer = NULL").run();
});

/* ================================================================ */

describe('fonctions', () => {
  test('safeTarget : même origine seulement, la page de connexion renvoie à l’accueil', () => {
    const base = 'https://doc.example.fr';
    assert.equal(safeTarget('https://doc.example.fr/admin/pdf-manager?x=1', base), '/admin/pdf-manager?x=1');
    assert.equal(safeTarget('/admin/video-generator', base), '/admin/video-generator');
    assert.equal(safeTarget('https://evil.example/admin', base), '/');
    assert.equal(safeTarget('//evil.example/admin', base), '/');
    assert.equal(safeTarget('javascript:alert(1)', base), '/');
    assert.equal(safeTarget('https://doc.example.fr/admin/login', base), '/');
    assert.equal(safeTarget(null, base), '/');
  });

  test('PKCE S256 : vecteur de la RFC 7636', () => {
    assert.equal(codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  test('client_secret_basic encode en URL avant base64', () => {
    const h = basicAuthHeader('a b', 'c:d');
    assert.equal(Buffer.from(h.slice(6), 'base64').toString(), 'a+b:c%3Ad');
  });

  test('normalizeIssuer', () => {
    assert.equal(normalizeIssuer(' https://board.example/oidc/ '), 'https://board.example/oidc');
    assert.equal(normalizeIssuer('ftp://x'), null);
    assert.equal(normalizeIssuer('https://board.example/oidc?x=1'), null);
    assert.equal(normalizeIssuer(''), null);
  });

  test('un jeton de session ne passe pas pour un cookie de parcours', () => {
    assert.equal(verifyFlow(sessionCookie(), SECRET), null);
    const flow = { state: 's', nonce: 'n', verifier: 'v', iss: 'i', target: '/', mode: 'login' };
    assert.deepEqual(verifyFlow(signFlow(flow, SECRET), SECRET), flow);
    assert.equal(verifyFlow(signFlow(flow, 'autre'), SECRET), null);
  });
});

describe('lancement', () => {
  test('redirige vers le Board avec state, nonce et PKCE S256', async () => {
    const { location, params, flowCookie } = await startLogin();
    assert.equal(location.origin + location.pathname, `${board.issuer}/auth`);
    assert.equal(params.get('response_type'), 'code');
    assert.equal(params.get('client_id'), CLIENT_ID);
    assert.equal(params.get('redirect_uri'), `${app.base}/auth/kosmy-board/callback`);
    assert.equal(params.get('scope'), 'openid profile email');
    assert.equal(params.get('code_challenge_method'), 'S256');
    assert.ok(params.get('state').length >= 22);
    assert.ok(params.get('nonce').length >= 22);
    assert.match(flowCookie.raw, /HttpOnly/i);
    assert.match(flowCookie.raw, /SameSite=Lax/i);
    assert.match(flowCookie.raw, /Path=\/auth\/kosmy-board/);
    const flow = verifyFlow(flowCookie.value, SECRET);
    assert.equal(codeChallenge(flow.verifier), params.get('code_challenge'));
    assert.equal(flow.state, params.get('state'));
  });

  test('connexion initiée par le Board : iss vérifié, target_link_uri de la même origine seulement', async () => {
    const ok = await startLogin(`?iss=${encodeURIComponent(board.issuer)}&target_link_uri=${encodeURIComponent(`${app.base}/admin/pdf-manager`)}`);
    assert.equal(verifyFlow(ok.flowCookie.value, SECRET).target, '/admin/pdf-manager');

    const evil = await startLogin(`?target_link_uri=${encodeURIComponent('https://evil.example/')}`);
    assert.equal(verifyFlow(evil.flowCookie.value, SECRET).target, '/');

    const bad = await get(`/auth/kosmy-board/login?iss=${encodeURIComponent('https://autre-board.example/oidc')}`);
    assert.equal(bad.status, 303);
    assert.equal(errorOf(bad), 'issuer');
    assert.equal(cookiesFrom(bad)[FLOW_COOKIE], undefined);
  });

  test('sans réglages : bouton masqué et lancement refusé', async () => {
    app.db.prepare('DELETE FROM settings').run();
    const status = await (await get('/api/auth/kosmy-board')).json();
    assert.equal(status.enabled, false);
    const res = await get('/auth/kosmy-board/login');
    assert.equal(errorOf(res), 'not_configured');
  });
});

describe('retour', () => {
  test('compte relié par sub : session admin ouverte, retour à la page cible', async () => {
    linkAdmin();
    const start = await startLogin(`?target_link_uri=${encodeURIComponent(`${app.base}/admin/video-generator`)}`);
    const res = await callback(start);
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), `${app.base}/admin/video-generator`);
    const c = cookiesFrom(res);
    assert.equal(jwt.verify(c.authToken.value, SECRET).username, 'admin');
    assert.match(c[FLOW_COOKIE].raw, /Expires=Thu, 01 Jan 1970/); // parcours consommé
    // client_secret_basic, code_verifier envoyé
    const req = board.tokenRequests.at(-1);
    assert.equal(req.auth, basicAuthHeader(CLIENT_ID, CLIENT_SECRET));
    assert.equal(req.body.redirect_uri, `${app.base}/auth/kosmy-board/callback`);
    assert.ok(req.body.code_verifier);
  });

  test('sub inconnu : aucun droit admin, même avec le bon e-mail', async () => {
    linkAdmin('un-autre-sub');
    const res = await callback(await startLogin(), { claims: { email: 'admin@example.test' } });
    assert.equal(errorOf(res), 'unknown_account');
    assert.equal(cookiesFrom(res).authToken, undefined);
  });

  test('un sub relié pour un autre émetteur ne suffit pas', async () => {
    app.db.prepare("UPDATE admin_users SET kosmy_board_sub = ?, kosmy_board_issuer = 'https://autre.example/oidc'").run(SUB);
    const res = await callback(await startLogin());
    assert.equal(errorOf(res), 'unknown_account');
  });

  test('state faux, absent ou rejoué : refusé', async () => {
    linkAdmin();
    const start = await startLogin();
    const wrong = await callback(start, { query: { state: 'faux' } });
    assert.equal(errorOf(wrong), 'expired');

    const noCookie = await get(`/auth/kosmy-board/callback?code=x&state=${start.params.get('state')}`);
    assert.equal(errorOf(noCookie), 'expired');

    // Un state faux ne consomme pas le parcours : le bon retour passe encore.
    const ok = await callback(start);
    assert.ok(cookiesFrom(ok).authToken);
    // Rejouer le même cookie de parcours (même avec un nouveau code valide) : refusé.
    const replay = await callback(start);
    assert.equal(errorOf(replay), 'expired');
    assert.equal(cookiesFrom(replay).authToken, undefined);
  });

  test('iss du retour différent de l’émetteur : refusé', async () => {
    linkAdmin();
    const res = await callback(await startLogin(), { query: { iss: 'https://evil.example/oidc' } });
    assert.equal(errorOf(res), 'issuer');
    assert.equal(cookiesFrom(res).authToken, undefined);
  });

  test('error=access_denied du Board', async () => {
    const start = await startLogin();
    const q = new URLSearchParams({ error: 'access_denied', state: start.params.get('state'), iss: board.issuer });
    const res = await get(`/auth/kosmy-board/callback?${q}`, { [FLOW_COOKIE]: start.flowCookie.value });
    assert.equal(errorOf(res), 'denied');
  });

  for (const [name, opts] of [
    ['nonce', { claims: { nonce: 'autre' } }],
    ['aud', { claims: { aud: 'autre-client' } }],
    ['iss', { claims: { iss: 'https://evil.example/oidc' } }],
    ['exp', { claims: { exp: Math.floor(Date.now() / 1000) - 120, iat: Math.floor(Date.now() / 1000) - 600 } }],
    ['signature', { key: 'other' }],
  ]) {
    test(`ID token invalide (${name}) : refusé`, async () => {
      linkAdmin();
      const start = await startLogin();
      const res = await callback(start, { ...opts, key: opts.key === 'other' ? board.otherKey : undefined });
      assert.equal(errorOf(res), 'token');
      assert.equal(cookiesFrom(res).authToken, undefined);
    });
  }

  test('mauvais secret client : échange refusé', async () => {
    linkAdmin();
    app.setSetting(SETTING_KEYS.clientSecret, 'mauvais');
    const res = await callback(await startLogin());
    assert.equal(errorOf(res), 'exchange');
  });
});

describe('liaison du compte admin', () => {
  test('« Relier mon compte » enregistre le sub, puis la connexion par le Board marche', async () => {
    const res = await fetch(`${app.base}/auth/kosmy-board/link`, {
      method: 'POST', redirect: 'manual', headers: { Cookie: cookieHeader({ authToken: sessionCookie() }), Origin: app.base },
    });
    assert.equal(res.status, 303);
    const location = new URL(res.headers.get('location'));
    const start = { params: location.searchParams, flowCookie: cookiesFrom(res)[FLOW_COOKIE] };
    assert.equal(verifyFlow(start.flowCookie.value, SECRET).mode, 'link');

    // Retour sans le cookie de session (SameSite=Strict depuis un autre site) : la liaison passe quand même.
    const back = await callback(start);
    assert.equal(back.headers.get('location'), `${app.base}/admin/kosmy-board?kosmy=linked`);
    assert.equal(cookiesFrom(back).authToken, undefined); // la liaison n'ouvre pas de session
    const row = app.db.prepare("SELECT * FROM admin_users WHERE id = 'a1'").get();
    assert.equal(row.kosmy_board_sub, SUB);
    assert.equal(row.kosmy_board_issuer, board.issuer);

    const login = await callback(await startLogin());
    assert.ok(cookiesFrom(login).authToken);
  });

  test('liaison refusée sans session, ou depuis une autre origine', async () => {
    const anon = await fetch(`${app.base}/auth/kosmy-board/link`, { method: 'POST', redirect: 'manual' });
    assert.equal(anon.status, 303);
    assert.equal(new URL(anon.headers.get('location')).pathname, '/admin/login');

    const cross = await fetch(`${app.base}/auth/kosmy-board/link`, {
      method: 'POST', redirect: 'manual', headers: { Cookie: cookieHeader({ authToken: sessionCookie() }), Origin: 'https://evil.example' },
    });
    assert.equal(cross.status, 403);
  });

  test('le retour d’une liaison refuse une session d’un autre compte', async () => {
    app.db.prepare("INSERT OR IGNORE INTO admin_users (id, username, password_hash) VALUES ('a2', 'autre', 'x')").run();
    const res = await fetch(`${app.base}/auth/kosmy-board/link`, {
      method: 'POST', redirect: 'manual', headers: { Cookie: cookieHeader({ authToken: sessionCookie() }) },
    });
    const start = { params: new URL(res.headers.get('location')).searchParams, flowCookie: cookiesFrom(res)[FLOW_COOKIE] };
    const back = await callback(start, { cookies: { authToken: sessionCookie('autre') } });
    assert.equal(errorOf(back), 'session');
    app.db.prepare("DELETE FROM admin_users WHERE id = 'a2'").run();
  });

  test('un compte sans mot de passe (créé par le Board) ne peut pas être délié', async () => {
    app.db.prepare("INSERT INTO admin_users (id, username, password_hash) VALUES ('a3', 'board-only', '')").run();
    app.db.prepare("UPDATE admin_users SET kosmy_board_sub = 'sub-a3', kosmy_board_issuer = ? WHERE id = 'a3'").run(board.issuer);
    const headers = { Cookie: cookieHeader({ authToken: sessionCookie('board-only') }) };
    const config = await (await fetch(`${app.base}/api/admin/kosmy-board`, { headers })).json();
    assert.equal(config.hasPassword, false);
    const res = await fetch(`${app.base}/api/admin/kosmy-board/unlink`, { method: 'POST', headers });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'no_password');
    assert.equal(app.db.prepare("SELECT kosmy_board_sub FROM admin_users WHERE id = 'a3'").get().kosmy_board_sub, 'sub-a3');
    app.db.prepare("DELETE FROM admin_users WHERE id = 'a3'").run();
  });

  test('délier', async () => {
    linkAdmin();
    const res = await fetch(`${app.base}/api/admin/kosmy-board/unlink`, {
      method: 'POST', headers: { Cookie: cookieHeader({ authToken: sessionCookie() }) },
    });
    assert.equal(res.status, 200);
    assert.equal(app.db.prepare("SELECT kosmy_board_sub FROM admin_users WHERE id = 'a1'").get().kosmy_board_sub, null);
  });
});

describe('réglages admin', () => {
  const auth = () => ({ Cookie: cookieHeader({ authToken: sessionCookie() }), 'Content-Type': 'application/json' });

  test('protégés par la session admin', async () => {
    assert.equal((await fetch(`${app.base}/api/admin/kosmy-board`)).status, 401);
    const put = await fetch(`${app.base}/api/admin/kosmy-board`, { method: 'PUT', body: '{}', headers: { 'Content-Type': 'application/json' } });
    assert.equal(put.status, 401);
  });

  test('le secret n’est jamais renvoyé, et un secret vide garde l’actuel', async () => {
    const data = await (await fetch(`${app.base}/api/admin/kosmy-board`, { headers: auth() })).json();
    assert.equal(data.hasSecret, true);
    assert.ok(!JSON.stringify(data).includes(CLIENT_SECRET));
    assert.equal(data.redirectUri, `${app.base}/auth/kosmy-board/callback`);
    assert.equal(data.initiateLoginUri, `${app.base}/auth/kosmy-board/login`);

    const put = await fetch(`${app.base}/api/admin/kosmy-board`, {
      method: 'PUT', headers: auth(), body: JSON.stringify({ issuer: `${board.issuer}/`, clientId: 'nouveau', clientSecret: '' }),
    });
    assert.equal(put.status, 200);
    const get2 = (k) => app.db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value;
    assert.equal(get2(SETTING_KEYS.issuer), board.issuer);
    assert.equal(get2(SETTING_KEYS.clientId), 'nouveau');
    assert.equal(get2(SETTING_KEYS.clientSecret), CLIENT_SECRET);
  });

  test('émetteur invalide refusé', async () => {
    const put = await fetch(`${app.base}/api/admin/kosmy-board`, {
      method: 'PUT', headers: auth(), body: JSON.stringify({ issuer: 'pas une adresse', clientId: 'x' }),
    });
    assert.equal(put.status, 400);
  });

  test('désactiver efface les réglages', async () => {
    const del = await fetch(`${app.base}/api/admin/kosmy-board`, { method: 'DELETE', headers: auth() });
    assert.equal(del.status, 200);
    assert.equal((await (await get('/api/auth/kosmy-board')).json()).enabled, false);
  });
});

/**
 * Tests des utilisateurs gérés par Kosmy Board (protocole kosmy.board-users.v1).
 * Un faux Kosmy Board (découverte, JWKS, jeton) tourne sur un port local ;
 * ClearDoc est monté sur une base SQLite en mémoire, avec le même câblage que
 * server.js (admin et utilisateurs du Board d'abord, puis CORS, JSON, sessions,
 * SSO, et la page de l'interface pour toute autre adresse).
 *
 * Lancer : npm test
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  createKosmyBoardRouter, migrateKosmyBoard, clearDiscoveryCache, codeChallenge, basicAuthHeader,
  FLOW_COOKIE, SETTING_KEYS,
} from '../server/kosmyBoard.js';
import { createKosmyBoardAdminRouter, createJtiStore } from '../server/kosmyBoardAdmin.js';
import { createKosmyBoardUsersRouter, USERS_PROTOCOL } from '../server/kosmyBoardUsers.js';
import {
  migrateAccounts, createAdminSessions, checkPassword, canGenerateVideos, disableBoardAccount, AccountError,
} from '../server/accounts.js';
import { createAdminActions } from '../server/adminActions.js';

const SECRET = 'test-secret-for-cleardoc';
const CLIENT_ID = 'kb-cleardoc-test';
const CLIENT_SECRET = 'very secret:value';
const PASSWORD = 'mot-de-passe-admin';
const ME = '6f1c1d0e-1111-4c4c-9999-0123456789ab'; // l'administrateur du Board qui agit (compte « admin »)
const ALICE = '5b6e0000-aaaa-4c4c-9999-0123456789ab';
const BOB = '7c7c0000-bbbb-4c4c-9999-0123456789ab';
const USERS_PATH = '/api/kosmy-board/users';

/* ---------------- Faux Kosmy Board ---------------- */

function startFakeBoard() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig', alg: 'RS256' };
  const codes = new Map();
  const board = { issuer: '', codes, privateKey };

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
    const c = codes.get(req.body.code);
    codes.delete(req.body.code);
    if (!c || req.get('authorization') !== basicAuthHeader(CLIENT_ID, CLIENT_SECRET)
      || codeChallenge(req.body.code_verifier || '') !== c.challenge) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    const now = Math.floor(Date.now() / 1000);
    const idToken = jwt.sign({
      iss: board.issuer, aud: CLIENT_ID, sub: c.sub, nonce: c.nonce, iat: now, exp: now + 300,
      name: 'Alice Martin', email: 'alice@exemple.fr', locale: 'fr', ...(c.claims || {}),
    }, privateKey, { algorithm: 'RS256', keyid: 'k1' });
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardoc-kb-users-'));
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE documents (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
      image_path TEXT DEFAULT NULL, category TEXT NOT NULL DEFAULT 'autres', keywords TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, video_url TEXT DEFAULT NULL);
    CREATE TABLE categories (id TEXT PRIMARY KEY, title TEXT NOT NULL);
    CREATE TABLE admin_users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE login_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, success INTEGER NOT NULL DEFAULT 0,
      ip TEXT, logged_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME);
  `);
  migrateKosmyBoard(db);
  migrateAccounts(db);
  migrateAccounts(db); // idempotente

  const getSetting = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value || null;
  const setSetting = (k, v) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(k, String(v));
  const delSetting = (k) => db.prepare('DELETE FROM settings WHERE key = ?').run(k);
  const sessions = createAdminSessions({ db, jwtSecret: SECRET, secure: false });
  const actions = createAdminActions({
    db, getSetting, setSetting, delSetting, uploadsDir: dir, videosDir: dir,
    watermarkPath: path.join(dir, 'watermark.png'), remotionDir: path.join(dir, 'no-remotion'),
  });

  const app = express();
  const jtis = createJtiStore();
  app.use(createKosmyBoardAdminRouter({ db, getSetting, actions, jtis }));
  app.use(createKosmyBoardUsersRouter({ db, getSetting, jtis }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  // Connexion par mot de passe et compte courant : mêmes règles que server.js.
  app.post('/api/auth/login', async (req, res) => {
    const { account, error } = await checkPassword(db, req.body.username, req.body.password);
    if (error === 'disabled') return res.status(403).json({ error: 'Ce compte est désactivé.' });
    if (!account) return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    sessions.open(res, account);
    res.json({ ok: true, username: account.username });
  });
  app.get('/api/auth/me', sessions.requireAuth, (req, res) => {
    res.json({ ok: true, username: req.account.username, canGenerateVideos: canGenerateVideos(req.account) });
  });
  app.use(createKosmyBoardRouter({
    db, getSetting, setSetting, delSetting, jwtSecret: SECRET,
    openAdminSession: sessions.open, readAdminSession: sessions.read, requireAuth: sessions.requireAuth,
  }));
  app.get('*', (_req, res) => res.type('html').send('<!doctype html><title>ClearDoc</title>'));

  return new Promise((resolve) => {
    const server = http.createServer(app).listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      resolve({
        db, base, setSetting,
        close: () => new Promise((r) => server.close(r)).then(() => fs.rmSync(dir, { recursive: true, force: true })),
      });
    });
  });
}

/* ---------------- Jetons et requêtes ---------------- */

let board;
let app;
const HASH = bcrypt.hashSync(PASSWORD, 4);

/** Un jeton du Board pour une requête : `target` est le sub géré (absent pour la liste). */
function boardToken({ method = 'GET', target, actor = ME, over = {}, header = {}, path: p } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({
    iss: board.issuer, aud: CLIENT_ID, sub: actor, iat: now, exp: now + 60,
    jti: crypto.randomBytes(16).toString('base64url'),
    htm: method, htu: `${app.base}${p ?? `${USERS_PATH}${target !== undefined ? `/${target}` : ''}`}`,
    name: 'Admin Board', email: 'admin@example.test',
    ...over,
  }, board.privateKey, { algorithm: 'RS256', keyid: 'k1', header: { typ: 'kb-admin+jwt', ...header } });
}

async function call({ method = 'GET', target, token, body, lang = 'fr', ...tok } = {}) {
  const t = token ?? boardToken({ method, target, ...tok });
  const res = await fetch(`${app.base}${USERS_PATH}${target !== undefined ? `/${target}` : ''}`, {
    method,
    redirect: 'manual',
    headers: {
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      'Accept-Language': lang,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* pas du JSON */ }
  return { res, status: res.status, json, text };
}

const put = (target, body, opts = {}) => call({ method: 'PUT', target, body, ...opts });
const del = (target, opts = {}) => call({ method: 'DELETE', target, ...opts });

function assertJsonError(r, status, error) {
  assert.equal(r.status, status, r.text);
  assert.match(r.res.headers.get('content-type'), /^application\/json; charset=utf-8/);
  assert.equal(r.res.headers.get('cache-control'), 'no-store');
  assert.equal(r.json?.error, error);
}

const row = (where, ...params) => app.db.prepare(`SELECT * FROM admin_users WHERE ${where}`).get(...params);
const bySub = (sub) => row('kosmy_board_sub = ?', sub);
const ALICE_PUT = { name: 'Alice Martin', email: 'alice@exemple.fr', locale: 'fr', role: 'admin', values: { canGenerateVideos: true } };

/* ---------- Connexion (mot de passe, Kosmy Board) et session ---------- */

function cookiesFrom(res) {
  const out = {};
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(';');
    const i = pair.indexOf('=');
    out[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1));
  }
  return out;
}

async function passwordLogin(username, password = PASSWORD) {
  const res = await fetch(`${app.base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
  });
  return { status: res.status, json: await res.json(), session: cookiesFrom(res).authToken };
}

const me = (session) => fetch(`${app.base}/api/auth/me`, { headers: { Cookie: `authToken=${encodeURIComponent(session)}` } });

/** Connexion par le Board pour `sub`, avec les revendications `claims` de l'ID token. */
async function boardLogin(sub, claims) {
  const start = await fetch(`${app.base}/auth/kosmy-board/login`, { redirect: 'manual' });
  const params = new URL(start.headers.get('location')).searchParams;
  const code = crypto.randomBytes(16).toString('hex');
  board.codes.set(code, { sub, nonce: params.get('nonce'), challenge: params.get('code_challenge'), claims });
  const q = new URLSearchParams({ code, state: params.get('state'), iss: board.issuer });
  const res = await fetch(`${app.base}/auth/kosmy-board/callback?${q}`, {
    redirect: 'manual', headers: { Cookie: `${FLOW_COOKIE}=${encodeURIComponent(cookiesFrom(start)[FLOW_COOKIE])}` },
  });
  return {
    error: new URL(res.headers.get('location')).searchParams.get('kosmy_error'),
    session: cookiesFrom(res).authToken,
  };
}

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
  const { db } = app;
  for (const table of ['admin_users', 'login_logs', 'settings']) db.prepare(`DELETE FROM ${table}`).run();
  app.setSetting(SETTING_KEYS.issuer, board.issuer);
  app.setSetting(SETTING_KEYS.clientId, CLIENT_ID);
  app.setSetting(SETTING_KEYS.clientSecret, CLIENT_SECRET);
  // Le compte de l'administrateur qui agit : créé avec setup-admin (mot de passe), relié au Board.
  db.prepare("INSERT INTO admin_users (id, username, password_hash, kosmy_board_sub, kosmy_board_issuer) VALUES ('a1', 'admin', ?, ?, ?)")
    .run(HASH, ME, board.issuer);
});

/* ================================================================ */

describe('jeton du Board', () => {
  test('sans jeton, mauvais typ, jti rejoué : 401 en JSON, sans CORS', async () => {
    assertJsonError(await call({ token: '' }), 401, 'invalid_token');
    assertJsonError(await call({ header: { typ: 'JWT' } }), 401, 'invalid_token');
    const token = boardToken();
    assert.equal((await call({ token })).status, 200);
    const replay = await call({ token });
    assertJsonError(replay, 401, 'invalid_token');
    assert.equal(replay.res.headers.get('access-control-allow-origin'), null);
  });

  test('htm ou htu d’une autre requête : refusé', async () => {
    // Jeton fait pour un GET, utilisé pour un PUT ; fait pour un PUT, utilisé pour un DELETE.
    assertJsonError(await put(ALICE, ALICE_PUT, { token: boardToken({ method: 'GET', target: ALICE }) }), 401, 'invalid_token');
    assertJsonError(await del(ALICE, { token: boardToken({ method: 'PUT', target: ALICE }) }), 401, 'invalid_token');
    // Jeton fait pour la liste, ou pour une autre personne, ou pour l'admin dans le Board.
    assertJsonError(await put(ALICE, ALICE_PUT, { token: boardToken({ method: 'PUT' }) }), 401, 'invalid_token');
    assertJsonError(await put(ALICE, ALICE_PUT, { token: boardToken({ method: 'PUT', target: BOB }) }), 401, 'invalid_token');
    assertJsonError(await call({ token: boardToken({ path: '/api/kosmy-board/admin' }) }), 401, 'invalid_token');
    // Un préfixe de chemin (proxy) est accepté.
    assert.equal((await call({ over: { htu: `https://doc.example.fr/cleardoc${USERS_PATH}` } })).status, 200);
    assert.equal(bySub(ALICE), undefined);
  });

  test('la personne qui agit doit être reliée à un compte actif de ClearDoc', async () => {
    const unknown = await call({ actor: 'inconnu' });
    assertJsonError(unknown, 403, 'not_linked');
    app.db.prepare("UPDATE admin_users SET disabled = 1 WHERE id = 'a1'").run();
    const disabled = await call({ lang: 'en' });
    assertJsonError(disabled, 403, 'forbidden');
    assert.equal(disabled.json.message, 'Your ClearDoc account is disabled.');
  });

  test('adresses : sub invalide 404, méthodes refusées 405, jamais la page de l’interface', async () => {
    assertJsonError(await put('pas_un_sub', ALICE_PUT), 404, 'not_found');
    assertJsonError(await put('x'.repeat(65), ALICE_PUT), 404, 'not_found');
    assertJsonError(await call({ method: 'POST', target: ALICE, body: {} }), 405, 'method_not_allowed');
    assertJsonError(await call({ method: 'PUT', body: ALICE_PUT }), 405, 'method_not_allowed');
    const deep = await fetch(`${app.base}${USERS_PATH}/a/b`);
    assert.equal(deep.status, 401);
    assert.match(deep.headers.get('content-type'), /json/);
  });
});

describe('GET /api/kosmy-board/users', () => {
  test('rôles, restrictions et comptes reliés, sans secret', async () => {
    app.db.prepare("INSERT INTO admin_users (id, username, password_hash) VALUES ('a2', 'local', ?)").run(HASH);
    app.db.prepare("INSERT INTO admin_users (id, username, password_hash, kosmy_board_sub, kosmy_board_issuer) VALUES ('a3', 'ancien', '', 'vieux-sub', 'https://autre.example/oidc')").run();
    const r = await call();
    assert.equal(r.status, 200, r.text);
    assert.match(r.res.headers.get('content-type'), /^application\/json; charset=utf-8/);
    assert.equal(r.res.headers.get('cache-control'), 'no-store');
    assert.equal(r.json.protocol, USERS_PROTOCOL);
    assert.deepEqual(r.json.roles.map((x) => [x.value, x.label, x.admin]), [['admin', 'Administrateur', true]]);
    for (const role of r.json.roles) {
      assert.match(role.value, /^[a-z0-9_-]{1,40}$/);
      assert.ok(role.label.length <= 60 && role.description.length <= 200);
    }
    assert.equal(r.json.defaultRole, 'admin');
    assert.deepEqual(r.json.fields.map((f) => [f.name, f.type, f.value]), [['canGenerateVideos', 'checkbox', true]]);
    assert.equal(r.json.fields[0].label, 'Peut générer des vidéos');
    // Seuls les comptes reliés à ce Board.
    assert.deepEqual(r.json.users, [
      { sub: ME, role: 'admin', values: { canGenerateVideos: true }, active: true, account: 'admin' },
    ]);
    assert.ok(!r.text.includes(HASH) && !r.text.includes(CLIENT_SECRET) && !r.text.includes('password'));
  });

  test('en anglais avec Accept-Language', async () => {
    const r = await call({ lang: 'en-GB,en;q=0.9' });
    assert.equal(r.json.roles[0].label, 'Administrator');
    assert.equal(r.json.fields[0].label, 'Can generate videos');
  });
});

describe('PUT /api/kosmy-board/users/{sub}', () => {
  test('crée un compte sans mot de passe, relié au sub, avec ses restrictions', async () => {
    const r = await put(ALICE, { ...ALICE_PUT, values: { canGenerateVideos: false } });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(
      { ok: r.json.ok, status: r.json.status, account: r.json.account },
      { ok: true, status: 'created', account: 'alice@exemple.fr' },
    );
    assert.match(r.json.message, /Compte ClearDoc créé/);
    const a = bySub(ALICE);
    assert.equal(a.kosmy_board_issuer, board.issuer);
    assert.equal(a.password_hash, '');
    assert.equal(a.display_name, 'Alice Martin');
    assert.equal(a.email, 'alice@exemple.fr');
    assert.equal(a.locale, 'fr');
    assert.equal(a.disabled, 0);
    assert.equal(a.can_generate_videos, 0);
    // Aucun mot de passe ne permet d'entrer dans ce compte.
    assert.equal((await passwordLogin('alice@exemple.fr', '')).status, 401);
    assert.deepEqual(await checkPassword(app.db, 'alice@exemple.fr', 'nimportequoi'), { error: 'invalid' });

    const list = (await call()).json.users;
    assert.deepEqual(list.find((u) => u.sub === ALICE),
      { sub: ALICE, role: 'admin', values: { canGenerateVideos: false }, active: true, account: 'alice@exemple.fr' });
  });

  test('idempotent : le même PUT deux fois laisse le même état', async () => {
    assert.equal((await put(ALICE, ALICE_PUT)).json.status, 'created');
    const first = bySub(ALICE);
    const again = await put(ALICE, ALICE_PUT);
    assert.equal(again.json.status, 'updated');
    assert.equal(again.json.message, 'Compte ClearDoc mis à jour (alice@exemple.fr).');
    assert.deepEqual(bySub(ALICE), first);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM admin_users').get().n, 2);
  });

  test('mise à jour : restrictions, nom et e-mail ; un champ absent garde sa valeur', async () => {
    await put(ALICE, { ...ALICE_PUT, values: { canGenerateVideos: false } });
    const r = await put(ALICE, { name: 'Alice M.', email: 'alice.m@exemple.fr', role: 'admin', values: {} });
    assert.equal(r.json.status, 'updated');
    let a = bySub(ALICE);
    assert.equal(a.display_name, 'Alice M.');
    assert.equal(a.email, 'alice.m@exemple.fr');
    assert.equal(a.username, 'alice@exemple.fr'); // l'identifiant du compte ne change pas
    assert.equal(a.can_generate_videos, 0);
    await put(ALICE, { ...ALICE_PUT, values: { canGenerateVideos: true } });
    a = bySub(ALICE);
    assert.equal(a.can_generate_videos, 1);
  });

  test('relie un compte existant non relié qui porte cet e-mail (par son e-mail ou son identifiant)', async () => {
    app.db.prepare("INSERT INTO admin_users (id, username, password_hash, email) VALUES ('a2', 'alice', ?, 'Alice@Exemple.fr')").run(HASH);
    const r = await put(ALICE, ALICE_PUT);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.status, 'linked');
    assert.equal(r.json.account, 'alice');
    const a = row("id = 'a2'");
    assert.equal(a.kosmy_board_sub, ALICE);
    assert.equal(a.password_hash, HASH); // son mot de passe reste
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM admin_users').get().n, 2);

    // Un compte sans e-mail dont l'identifiant est l'adresse.
    app.db.prepare("INSERT INTO admin_users (id, username, password_hash) VALUES ('a4', 'bob@exemple.fr', ?)").run(HASH);
    const bob = await put(BOB, { name: 'Bob', email: 'BOB@exemple.fr', role: 'admin' });
    assert.equal(bob.json.status, 'linked');
    assert.equal(row("id = 'a4'").kosmy_board_sub, BOB);
    assert.equal(row("id = 'a4'").email, 'bob@exemple.fr');
  });

  test('e-mail d’un compte relié à une autre personne du Board : 409', async () => {
    await put(ALICE, ALICE_PUT);
    const r = await put(BOB, { name: 'Bob', email: 'alice@exemple.fr', role: 'admin' });
    assertJsonError(r, 409, 'conflict');
    assert.match(r.json.message, /appartient déjà à un compte ClearDoc relié à une autre personne/);
    assert.equal(bySub(BOB), undefined);
    const en = await put(BOB, { name: 'Bob', email: 'alice@exemple.fr', role: 'admin' }, { lang: 'en' });
    assert.match(en.json.message, /already belongs to a ClearDoc account/);
  });

  test('valeurs refusées : 422 avec un message, rien n’est créé', async () => {
    const role = await put(ALICE, { ...ALICE_PUT, role: 'member' });
    assertJsonError(role, 422, 'invalid');
    assert.equal(role.json.message, 'Rôle inconnu pour ClearDoc.');
    const bool = await put(ALICE, { ...ALICE_PUT, values: { canGenerateVideos: 'oui' } });
    assertJsonError(bool, 422, 'invalid');
    assert.equal(bool.json.message, '« Peut générer des vidéos » : oui ou non attendu.');
    assertJsonError(await put(ALICE, { ...ALICE_PUT, values: [true] }), 422, 'invalid');
    assertJsonError(await put(ALICE, { ...ALICE_PUT, role: undefined }), 422, 'invalid');
    assertJsonError(await put(ALICE, '{pas du json'), 400, 'invalid_request');
    assertJsonError(await put(ALICE, '[1]'), 400, 'invalid_request');
    assert.equal(bySub(ALICE), undefined);
    // Un compte existant reste intact.
    app.db.prepare("INSERT INTO admin_users (id, username, password_hash, email) VALUES ('a2', 'alice', ?, 'alice@exemple.fr')").run(HASH);
    assertJsonError(await put(ALICE, { ...ALICE_PUT, values: { canGenerateVideos: 1 } }), 422, 'invalid');
    assert.equal(row("id = 'a2'").kosmy_board_sub, null);
  });

  test('identifiants uniques pour les comptes créés', async () => {
    app.db.prepare("INSERT INTO admin_users (id, username, password_hash, email, kosmy_board_sub, kosmy_board_issuer) VALUES ('a2', 'alice@exemple.fr', '', 'autre@exemple.fr', 'x', ?)").run(board.issuer);
    const r = await put(ALICE, ALICE_PUT);
    assert.equal(r.json.status, 'created');
    assert.equal(r.json.account, 'alice@exemple.fr-2');
    const noEmail = await put(BOB, { name: 'Bérénice Dupont', role: 'admin' });
    assert.equal(noEmail.json.account, 'berenice-dupont');
  });
});

describe('DELETE /api/kosmy-board/users/{sub}', () => {
  test('désactive le compte : sessions fermées, plus aucune connexion, données gardées', async () => {
    // Bob a un mot de passe et une session ouverte.
    app.db.prepare("INSERT INTO admin_users (id, username, password_hash, kosmy_board_sub, kosmy_board_issuer) VALUES ('a2', 'bob', ?, ?, ?)")
      .run(HASH, BOB, board.issuer);
    const { session } = await passwordLogin('bob');
    assert.equal((await me(session)).status, 200);
    const boardSession = (await boardLogin(BOB)).session;
    assert.ok(boardSession);

    const r = await del(BOB);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.ok, true);
    assert.match(r.json.message, /désactivé/);
    const a = row("id = 'a2'");
    assert.equal(a.disabled, 1);
    assert.equal(a.username, 'bob'); // le compte et ses données restent
    assert.equal((await call()).json.users.find((u) => u.sub === BOB).active, false);

    // Sessions ouvertes refusées.
    assert.equal((await me(session)).status, 401);
    assert.equal((await me(boardSession)).status, 401);
    // Mot de passe : refusé.
    const pw = await passwordLogin('bob');
    assert.equal(pw.status, 403);
    assert.equal(pw.session, undefined);
    // Connexion par le Board (sans kosmy_board_access) : refusée.
    assert.deepEqual(await boardLogin(BOB), { error: 'disabled', session: undefined });
    // Admin dans le Board et utilisateurs gérés : refusés.
    const adminRes = await fetch(`${app.base}/api/kosmy-board/admin`, {
      headers: { Authorization: `Bearer ${boardToken({ actor: BOB, path: '/api/kosmy-board/admin' })}` },
    });
    assert.equal(adminRes.status, 403);
    assertJsonError(await call({ actor: BOB }), 403, 'forbidden');

    // Un DELETE de plus ne change rien.
    const again = await del(BOB);
    assert.equal(again.status, 200);
    assert.equal(row("id = 'a2'").session_version, a.session_version);
  });

  test('un PUT réactive ; les anciennes sessions restent fermées', async () => {
    await put(ALICE, ALICE_PUT);
    app.db.prepare("UPDATE admin_users SET password_hash = ? WHERE kosmy_board_sub = ?").run(HASH, ALICE);
    const { session } = await passwordLogin('alice@exemple.fr');
    await del(ALICE);
    const r = await put(ALICE, ALICE_PUT);
    assert.equal(r.json.status, 'updated');
    assert.equal(r.json.message, 'Compte ClearDoc réactivé et mis à jour (alice@exemple.fr).');
    assert.equal(bySub(ALICE).disabled, 0);
    assert.equal((await me(session)).status, 401);
    const fresh = await passwordLogin('alice@exemple.fr');
    assert.equal(fresh.status, 200);
    assert.equal((await me(fresh.session)).status, 200);
  });

  test('aucun compte relié : 200, rien à retirer', async () => {
    const r = await del(ALICE);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.ok, true);
  });
});

describe('ne pas se couper l’accès', () => {
  test('se retirer son propre accès : 409', async () => {
    const r = await del(ME);
    assertJsonError(r, 409, 'conflict');
    assert.equal(r.json.message, 'Vous ne pouvez pas retirer votre propre accès à ClearDoc.');
    assert.equal(row("id = 'a1'").disabled, 0);
    const en = await del(ME, { lang: 'en' });
    assert.equal(en.json.message, 'You cannot remove your own access to ClearDoc.');
  });

  test('se modifier soi-même garde ses droits d’administration', async () => {
    const r = await put(ME, { name: 'Admin', email: 'admin@example.test', role: 'admin', values: { canGenerateVideos: false } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.status, 'updated');
    assert.equal(row("id = 'a1'").disabled, 0);
    assert.equal((await call()).status, 200); // toujours administrateur
  });

  test('jamais zéro administrateur actif', () => {
    // Le dernier administrateur actif ne peut pas être désactivé, quel que soit l'auteur.
    assert.throws(
      () => disableBoardAccount(app.db, { issuer: board.issuer, sub: ME, me: 'quelqu-un-d-autre' }),
      (e) => e instanceof AccountError && e.status === 409 && e.key === 'lastAdmin',
    );
    assert.equal(row("id = 'a1'").disabled, 0);
  });
});

describe('restriction « peut générer des vidéos »', () => {
  test('appliquée au compte courant (/api/auth/me)', async () => {
    await put(ME, { role: 'admin', values: { canGenerateVideos: false } });
    const { session } = await passwordLogin('admin');
    assert.deepEqual(await (await me(session)).json(), { ok: true, username: 'admin', canGenerateVideos: false });
    await put(ME, { role: 'admin', values: { canGenerateVideos: true } });
    assert.equal((await (await me(session)).json()).canGenerateVideos, true);
  });
});

describe('connexion par le Board avec kosmy_board_access', () => {
  test('crée le compte s’il n’existe pas, et applique le rôle et les restrictions', async () => {
    const r = await boardLogin(ALICE, { kosmy_board_access: { role: 'admin', values: { canGenerateVideos: false } } });
    assert.equal(r.error, null);
    assert.ok(r.session);
    const a = bySub(ALICE);
    assert.equal(a.password_hash, '');
    assert.equal(a.email, 'alice@exemple.fr');
    assert.equal(a.display_name, 'Alice Martin');
    assert.equal(a.can_generate_videos, 0);
    assert.equal((await (await me(r.session)).json()).canGenerateVideos, false);
  });

  test('jamais de liaison par l’e-mail à la connexion', async () => {
    app.db.prepare("INSERT INTO admin_users (id, username, password_hash, email) VALUES ('a2', 'alice', ?, 'alice@exemple.fr')").run(HASH);
    const r = await boardLogin(ALICE, { kosmy_board_access: { role: 'admin', values: {} } });
    assert.ok(r.session);
    assert.equal(row("id = 'a2'").kosmy_board_sub, null);
    assert.notEqual(bySub(ALICE).id, 'a2');
  });

  test('met à jour un compte relié, et réactive un compte désactivé (comme un PUT)', async () => {
    await put(ALICE, ALICE_PUT);
    await del(ALICE);
    const r = await boardLogin(ALICE, { kosmy_board_access: { role: 'admin', values: { canGenerateVideos: false } } });
    assert.ok(r.session);
    assert.equal(bySub(ALICE).disabled, 0);
    assert.equal(bySub(ALICE).can_generate_videos, 0);
  });

  test('accès illisible : connexion refusée, rien n’est créé', async () => {
    const r = await boardLogin(ALICE, { kosmy_board_access: { role: 'member', values: {} } });
    assert.deepEqual(r, { error: 'access', session: undefined });
    assert.equal(bySub(ALICE), undefined);
  });

  test('sans la revendication, rien ne change : sub inconnu refusé', async () => {
    assert.deepEqual(await boardLogin(ALICE), { error: 'unknown_account', session: undefined });
    assert.equal(bySub(ALICE), undefined);
    const ok = await boardLogin(ME);
    assert.ok(ok.session);
  });
});

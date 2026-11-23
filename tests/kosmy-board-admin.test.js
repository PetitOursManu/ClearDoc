/**
 * Tests de l'admin dans Kosmy Board (protocole kosmy.board-admin.v1).
 * Un faux Kosmy Board (découverte, JWKS, clé RSA de test) tourne sur un port
 * local ; ClearDoc est monté sur une base SQLite en mémoire, avec le même
 * câblage que server.js (admin du Board d'abord, puis CORS, JSON, SSO et la
 * page de l'interface pour toute autre adresse).
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
import jwt from 'jsonwebtoken';
import { createKosmyBoardRouter, migrateKosmyBoard, clearDiscoveryCache, SETTING_KEYS } from '../server/kosmyBoard.js';
import { createKosmyBoardAdminRouter, pickLang, PROTOCOL } from '../server/kosmyBoardAdmin.js';
import { migrateAccounts, createAdminSessions } from '../server/accounts.js';
import { createAdminActions } from '../server/adminActions.js';

const SECRET = 'test-secret-for-cleardoc';
const CLIENT_ID = 'kb-cleardoc-test';
const CLIENT_SECRET = 'very secret:value';
const AI_KEY = 'sk-test-ne-jamais-renvoyer-1234';
const SUB = '6f1c1d0e-1111-4c4c-9999-0123456789ab';
const READER_SUB = '0a0a0a0a-2222-4c4c-9999-0123456789ab';
const ADMIN_PATH = '/api/kosmy-board/admin';

/* ---------------- Faux Kosmy Board ---------------- */

function startFakeBoard() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig', alg: 'RS256' };
  const board = { issuer: '', privateKey, otherKey: other.privateKey };

  const app = express();
  app.get('/oidc/.well-known/openid-configuration', (_req, res) => res.json({
    issuer: board.issuer,
    authorization_endpoint: `${board.issuer}/auth`,
    token_endpoint: `${board.issuer}/token`,
    jwks_uri: `${board.issuer}/jwks`,
  }));
  app.get('/oidc/jwks', (_req, res) => res.json({ keys: [jwk] }));

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardoc-kb-admin-'));
  const uploadsDir = path.join(dir, 'uploads');
  const videosDir = path.join(dir, 'videos');
  fs.mkdirSync(uploadsDir);
  fs.mkdirSync(videosDir);

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
    CREATE TABLE payslip_zones (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL,
      width REAL NOT NULL, height REAL NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE payslip_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE companies (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE pdf_files (id TEXT PRIMARY KEY, name TEXT NOT NULL, filename TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE company_pdfs (company_id TEXT NOT NULL, pdf_id TEXT NOT NULL, PRIMARY KEY (company_id, pdf_id));
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME);
  `);
  migrateKosmyBoard(db);
  migrateAccounts(db);

  const getSetting = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value || null;
  const setSetting = (k, v) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(k, String(v));
  const delSetting = (k) => db.prepare('DELETE FROM settings WHERE key = ?').run(k);
  const sessions = createAdminSessions({ db, jwtSecret: SECRET, secure: false });
  const { requireAuth, read: readAdminSession } = sessions;
  const actions = createAdminActions({
    db, getSetting, setSetting, delSetting, uploadsDir, videosDir,
    watermarkPath: path.join(dir, 'watermark.png'), remotionDir: path.join(dir, 'no-remotion'),
  });

  const app = express();
  app.use(createKosmyBoardAdminRouter({
    db, getSetting, actions,
    // Dans ClearDoc, tout compte est administrateur. Pour couvrir le refus
    // « forbidden », ce montage de test retire les droits au compte « lecteur ».
    isAdmin: (account) => account.username !== 'lecteur',
  }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(createKosmyBoardRouter({
    db, getSetting, setSetting, delSetting, jwtSecret: SECRET, requireAuth, readAdminSession,
    openAdminSession: sessions.open,
  }));
  // Les routes de l'admin de ClearDoc passent par les mêmes fonctions.
  app.post('/api/categories', requireAuth, (req, res) => res.status(201).json(actions.createCategory(req.body.title)));
  // Fallback de l'interface (SPA), comme server.js quand dist/ existe.
  app.get('*', (_req, res) => res.type('html').send('<!doctype html><title>ClearDoc</title>'));

  return new Promise((resolve) => {
    const server = http.createServer(app).listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      resolve({
        db, base, dir, uploadsDir, setSetting,
        close: () => new Promise((r) => server.close(r)).then(() => fs.rmSync(dir, { recursive: true, force: true })),
      });
    });
  });
}

/* ---------------- Jetons et requêtes ---------------- */

let board;
let app;

/** Un jeton du Board pour une requête ; `over` remplace des revendications, `header` l'en-tête. */
function adminToken({ method = 'GET', section = '', sub = SUB, over = {}, header = {}, key } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: board.issuer, aud: CLIENT_ID, sub, iat: now, exp: now + 60,
    jti: crypto.randomBytes(16).toString('base64url'),
    htm: method, htu: `${app.base}${ADMIN_PATH}${section ? `/${section}` : ''}`,
    name: 'Admin Board', email: 'admin@example.test',
    ...over,
  };
  return jwt.sign(claims, key || board.privateKey, {
    algorithm: 'RS256', keyid: 'k1', header: { typ: 'kb-admin+jwt', ...header },
  });
}

async function call({ method = 'GET', section = '', token, body, lang = 'fr', headers = {}, ...tok } = {}) {
  const t = token ?? adminToken({ method, section, ...tok });
  const res = await fetch(`${app.base}${ADMIN_PATH}${section ? `/${section}` : ''}`, {
    method,
    redirect: 'manual',
    headers: {
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      'Accept-Language': lang,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* pas du JSON */ }
  return { res, status: res.status, json, text };
}

function assertJsonError(r, status, error) {
  assert.equal(r.status, status, r.text);
  assert.match(r.res.headers.get('content-type'), /^application\/json; charset=utf-8/);
  assert.equal(r.res.headers.get('cache-control'), 'no-store');
  assert.equal(r.json?.error, error);
}

const linkAdmin = (id = 'a1', sub = SUB) => app.db.prepare('UPDATE admin_users SET kosmy_board_sub = ?, kosmy_board_issuer = ? WHERE id = ?').run(sub, board.issuer, id);
const blockOf = (section, id) => section.blocks.find((b) => b.id === id);

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
  for (const table of ['documents', 'categories', 'admin_users', 'login_logs', 'payslip_zones', 'companies', 'pdf_files', 'company_pdfs', 'settings']) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
  app.setSetting(SETTING_KEYS.issuer, board.issuer);
  app.setSetting(SETTING_KEYS.clientId, CLIENT_ID);
  app.setSetting(SETTING_KEYS.clientSecret, CLIENT_SECRET);
  app.setSetting('AI_API_KEY', AI_KEY);
  app.setSetting('AI_MODEL', 'deepseek-chat');
  db.prepare("INSERT INTO admin_users (id, username, password_hash) VALUES ('a1', 'admin', 'x'), ('a2', 'lecteur', 'x')").run();
  linkAdmin();
  db.prepare("INSERT INTO categories (id, title) VALUES ('salaire', 'Salaire'), ('autres', 'Autres')").run();
  db.prepare("INSERT INTO documents (id, title, category) VALUES ('d1', 'Salaire de base', 'salaire')").run();
});

/* ================================================================ */

describe('jeton du Board', () => {
  test('jeton valide : le sommaire', async () => {
    const r = await call({ headers: { Origin: 'https://evil.example' } });
    assert.equal(r.status, 200, r.text);
    assert.match(r.res.headers.get('content-type'), /^application\/json; charset=utf-8/);
    assert.equal(r.res.headers.get('cache-control'), 'no-store');
    assert.equal(r.res.headers.get('access-control-allow-origin'), null); // pas de CORS
    assert.equal(r.res.headers.get('access-control-allow-credentials'), null);
    assert.equal(r.json.protocol, PROTOCOL);
    assert.equal(r.json.app.name, 'ClearDoc');
    assert.deepEqual(r.json.user, { name: 'admin', role: 'Administrateur' });
    const ids = r.json.sections.map((s) => s.id);
    assert.deepEqual(ids, ['overview', 'documents', 'categories', 'structures', 'payslip-map', 'videos', 'settings', 'access']);
    assert.ok(ids.length <= 20);
    for (const s of r.json.sections) assert.match(s.id, /^[a-z0-9-]{1,40}$/);
  });

  test('un jeton de type ID token (typ JWT ou absent) est refusé', async () => {
    assertJsonError(await call({ header: { typ: 'JWT' } }), 401, 'invalid_token');
    // Même charge utile qu'un ID token, sans htm/htu ni typ dédié.
    const now = Math.floor(Date.now() / 1000);
    const idToken = jwt.sign({ iss: board.issuer, aud: CLIENT_ID, sub: SUB, iat: now, exp: now + 300, nonce: 'n' },
      board.privateKey, { algorithm: 'RS256', keyid: 'k1' });
    assertJsonError(await call({ token: idToken }), 401, 'invalid_token');
  });

  test('typ comparé sans casse, avec le préfixe application/ facultatif', async () => {
    assert.equal((await call({ header: { typ: 'application/KB-ADMIN+JWT' } })).status, 200);
  });

  test('mauvais aud, mauvais iss, expiré, mauvaise signature, HS256 : refusés', async () => {
    const now = Math.floor(Date.now() / 1000);
    assertJsonError(await call({ over: { aud: 'autre-client' } }), 401, 'invalid_token');
    assertJsonError(await call({ over: { iss: 'https://evil.example/oidc' } }), 401, 'invalid_token');
    assertJsonError(await call({ over: { iat: now - 200, exp: now - 100 } }), 401, 'invalid_token');
    assertJsonError(await call({ key: board.otherKey }), 401, 'invalid_token');
    const hs = jwt.sign({ iss: board.issuer, aud: CLIENT_ID, sub: SUB, htm: 'GET', htu: `${app.base}${ADMIN_PATH}`, jti: 'x' },
      'secret', { algorithm: 'HS256', header: { typ: 'kb-admin+jwt' } });
    assertJsonError(await call({ token: hs }), 401, 'invalid_token');
  });

  test('exp dans la tolérance de 30 secondes : accepté', async () => {
    const now = Math.floor(Date.now() / 1000);
    assert.equal((await call({ over: { iat: now - 70, exp: now - 10 } })).status, 200);
  });

  test('jti rejoué : refusé', async () => {
    const token = adminToken();
    assert.equal((await call({ token })).status, 200);
    assertJsonError(await call({ token }), 401, 'invalid_token');
  });

  test('htm ou htu d’une autre requête : refusé', async () => {
    // Jeton fait pour un POST, utilisé en GET.
    assertJsonError(await call({ token: adminToken({ method: 'POST' }) }), 401, 'invalid_token');
    // Jeton fait pour une section, utilisé pour le sommaire (et l'inverse).
    assertJsonError(await call({ token: adminToken({ section: 'categories' }) }), 401, 'invalid_token');
    assertJsonError(await call({ section: 'categories', token: adminToken() }), 401, 'invalid_token');
    assertJsonError(await call({ over: { htu: 'pas une adresse' } }), 401, 'invalid_token');
    // Un préfixe de chemin (proxy) est accepté : le chemin de htu se termine par le chemin demandé.
    assert.equal((await call({ over: { htu: `https://doc.example.fr/cleardoc${ADMIN_PATH}?x=1` } })).status, 200);
  });

  test('sans jeton, ou connexion unique non réglée : 401 en JSON', async () => {
    assertJsonError(await call({ token: '' }), 401, 'invalid_token');
    app.db.prepare('DELETE FROM settings WHERE key = ?').run(SETTING_KEYS.clientSecret);
    const r = await call();
    assertJsonError(r, 401, 'invalid_token');
    assert.match(r.json.message, /pas configurée/);
  });

  test('sub relié à aucun compte : not_linked', async () => {
    const r = await call({ sub: 'inconnu' });
    assertJsonError(r, 403, 'not_linked');
    assert.match(r.json.message, /relié à aucun compte ClearDoc/);
    // Un sub relié pour un autre émetteur ne compte pas.
    app.db.prepare("UPDATE admin_users SET kosmy_board_issuer = 'https://autre.example/oidc' WHERE id = 'a1'").run();
    assertJsonError(await call(), 403, 'not_linked');
  });

  test('compte relié mais désactivé (accès retiré par le Board) : forbidden', async () => {
    app.db.prepare("UPDATE admin_users SET disabled = 1 WHERE id = 'a1'").run();
    const r = await call();
    assertJsonError(r, 403, 'forbidden');
    assert.match(r.json.message, /désactivé/);
  });

  test('compte relié sans droits d’administration : forbidden', async () => {
    linkAdmin('a2', READER_SUB);
    const r = await call({ sub: READER_SUB, lang: 'en' });
    assertJsonError(r, 403, 'forbidden');
    assert.equal(r.json.message, 'Your ClearDoc account does not have administrator rights.');
  });
});

describe('adresses', () => {
  test('section inconnue, chemin inconnu, méthode refusée : JSON, jamais la page de l’interface', async () => {
    const unknown = await call({ section: 'inconnue' });
    assertJsonError(unknown, 404, 'not_found');
    assert.ok(!unknown.text.includes('<!doctype'));
    const deep = await fetch(`${app.base}${ADMIN_PATH}/a/b`);
    assert.equal(deep.status, 401);
    assert.match(deep.headers.get('content-type'), /json/);
    assertJsonError(await call({ method: 'POST', body: { action: 'x' } }), 405, 'method_not_allowed');
    assertJsonError(await call({ method: 'DELETE', section: 'categories' }), 405, 'method_not_allowed');
    // Le reste du site garde sa page.
    assert.match(await (await fetch(`${app.base}/api/kosmy-board/administration`)).text(), /<!doctype/);
  });

  test('corps illisible : 400 en JSON', async () => {
    assertJsonError(await call({ method: 'POST', section: 'categories', body: '{pas du json' }), 400, 'invalid_request');
    assertJsonError(await call({ method: 'POST', section: 'categories', body: { values: {} } }), 400, 'invalid_request');
  });

  test('langue : Accept-Language', async () => {
    assert.equal(pickLang('en-US,en;q=0.9,fr;q=0.8'), 'en');
    assert.equal(pickLang('de-DE,fr;q=0.5,en;q=0.4'), 'fr');
    assert.equal(pickLang('fr;q=0.2, en;q=0.9'), 'en');
    assert.equal(pickLang(''), 'fr');
    const r = await call({ lang: 'en' });
    assert.equal(r.json.sections[0].title, 'Overview');
    assert.equal(r.json.user.role, 'Administrator');
  });
});

describe('sections', () => {
  test('chaque section se décrit dans les limites du protocole', async () => {
    const { json: manifest } = await call();
    for (const { id } of manifest.sections) {
      const r = await call({ section: id });
      assert.equal(r.status, 200, `${id}: ${r.text}`);
      assert.equal(r.json.id, id);
      assert.ok(r.json.title);
      assert.ok(r.json.blocks.length >= 1 && r.json.blocks.length <= 30, id);
      for (const b of r.json.blocks) {
        assert.ok(['notice', 'stats', 'fields', 'form', 'table', 'actions'].includes(b.type), `${id}: ${b.type}`);
        if (b.type === 'table') {
          assert.ok(b.columns.length <= 12);
          const known = new Set((b.rowActions || []).map((a) => a.id));
          for (const row of b.rows) for (const a of row.actions || []) assert.ok(known.has(a), `${id}: ${a}`);
        }
      }
    }
  });

  test('catégories : un tableau, la suppression proposée seulement si la catégorie est libre', async () => {
    const r = await call({ section: 'categories' });
    const table = blockOf(r.json, 'categories');
    const rows = Object.fromEntries(table.rows.map((row) => [row.id, row]));
    assert.equal(rows.salaire.cells.usage, 1);
    assert.deepEqual(rows.salaire.actions, ['rename']);
    assert.deepEqual(rows.autres.actions, ['rename', 'delete']);
    assert.ok(table.actions.some((a) => a.id === 'add'));
  });

  test('aucun secret existant dans les sections (clés d’API, secret client)', async () => {
    for (const section of ['settings', 'access', 'overview']) {
      const r = await call({ section });
      assert.ok(!r.text.includes(AI_KEY), section);
      assert.ok(!r.text.includes(AI_KEY.slice(-4)), section);
      assert.ok(!r.text.includes(CLIENT_SECRET), section);
    }
    const form = blockOf((await call({ section: 'settings' })).json, 'ai');
    const key = form.fields.find((f) => f.name === 'AI_API_KEY');
    assert.equal(key.type, 'password');
    assert.equal(key.value, undefined);
    assert.equal(form.fields.find((f) => f.name === 'AI_MODEL').value, 'deepseek-chat');
  });
});

describe('actions', () => {
  test('ajouter une catégorie : effet en base et section à jour', async () => {
    const r = await call({ method: 'POST', section: 'categories', body: { action: 'add', values: { title: '  Primes ' } } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.message, 'Catégorie ajoutée.');
    assert.equal(app.db.prepare("SELECT COUNT(*) AS n FROM categories WHERE title = 'Primes'").get().n, 1);
    assert.ok(blockOf(r.json.section, 'categories').rows.some((row) => row.cells.title === 'Primes'));
  });

  test('mêmes règles que l’admin de ClearDoc : catégorie utilisée, titre vide, ligne inconnue', async () => {
    const inUse = await call({ method: 'POST', section: 'categories', lang: 'en', body: { action: 'delete', row: 'salaire' } });
    assertJsonError(inUse, 409, 'conflict');
    assert.equal(inUse.json.message, 'This category cannot be deleted: 1 payslip line(s) use it.');
    assert.equal(app.db.prepare("SELECT COUNT(*) AS n FROM categories WHERE id = 'salaire'").get().n, 1);

    assertJsonError(await call({ method: 'POST', section: 'categories', body: { action: 'add', values: { title: '  ' } } }), 422, 'invalid');
    assertJsonError(await call({ method: 'POST', section: 'categories', body: { action: 'rename', row: 'nope', values: { title: 'X' } } }), 404, 'not_found');
    assertJsonError(await call({ method: 'POST', section: 'categories', body: { action: 'inconnue' } }), 404, 'not_found');
  });

  test('renommer une ligne de paie et changer sa catégorie', async () => {
    let r = await call({ method: 'POST', section: 'documents', body: { action: 'rename', row: 'd1', values: { title: 'Salaire brut' } } });
    assert.equal(r.status, 200, r.text);
    r = await call({ method: 'POST', section: 'documents', body: { action: 'set-category', row: 'd1', values: { category: 'autres' } } });
    assert.equal(r.status, 200, r.text);
    const row = app.db.prepare("SELECT * FROM documents WHERE id = 'd1'").get();
    assert.equal(row.title, 'Salaire brut');
    assert.equal(row.category, 'autres');
    assertJsonError(await call({ method: 'POST', section: 'documents', body: { action: 'set-category', row: 'd1', values: { category: 'inventée' } } }), 422, 'invalid');
  });

  test('supprimer un PDF : fichier, assignations et fiche supprimés', async () => {
    fs.writeFileSync(path.join(app.uploadsDir, 'f1.pdf'), '%PDF-1.4');
    app.db.prepare("INSERT INTO pdf_files (id, name, filename) VALUES ('p1', 'Guide', '/uploads/f1.pdf')").run();
    app.db.prepare("INSERT INTO companies (id, name) VALUES ('c1', 'Structure A')").run();
    app.db.prepare("INSERT INTO company_pdfs (company_id, pdf_id) VALUES ('c1', 'p1')").run();

    const section = (await call({ section: 'structures' })).json;
    assert.deepEqual(blockOf(section, 'pdfs').rows[0].cells.name, { text: 'Guide', href: '/uploads/f1.pdf' });
    assert.equal(blockOf(section, 'assignments').rows[0].id, 'c1|p1');

    const r = await call({ method: 'POST', section: 'structures', body: { action: 'delete-pdf', row: 'p1' } });
    assert.equal(r.status, 200, r.text);
    assert.equal(fs.existsSync(path.join(app.uploadsDir, 'f1.pdf')), false);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM company_pdfs').get().n, 0);
    assert.equal(blockOf(r.json.section, 'pdfs').rows.length, 0);
  });

  test('réglages : une clé vide garde l’actuelle, les valeurs sont vérifiées', async () => {
    const r = await call({ method: 'POST', section: 'settings', body: { action: 'save-ai', values: {
      AI_API_KEY: '', AI_API_BASE_URL: 'https://api.example.test/v1', AI_MODEL: 'autre-modele', ELEVENLABS_API_KEY: 'xi-nouvelle', ELEVENLABS_VOICE_ID: '',
    } } });
    assert.equal(r.status, 200, r.text);
    const get = (k) => app.db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value;
    assert.equal(get('AI_API_KEY'), AI_KEY);
    assert.equal(get('AI_MODEL'), 'autre-modele');
    assert.equal(get('ELEVENLABS_API_KEY'), 'xi-nouvelle');
    assert.ok(!r.text.includes('xi-nouvelle'));

    const bad = await call({ method: 'POST', section: 'settings', body: { action: 'save-video', values: {
      VIDEO_THEME: 'cleardoc', VIDEO_ACCENT_COLOR: 'rouge', VIDEO_QUALITY: 'high', VIDEO_BG_MODE: 'theme',
      VIDEO_BG_COLOR1: '#000000', VIDEO_BG_COLOR2: '#ffffff', VIDEO_BG_ANGLE: 90,
      VIDEO_WATERMARK_POSITION: 'bottom-right', VIDEO_WATERMARK_SIZE: 'medium',
    } } });
    assertJsonError(bad, 422, 'invalid');
    assert.equal(get('VIDEO_ACCENT_COLOR'), undefined);
  });

  test('les routes de l’admin de ClearDoc passent par les mêmes fonctions', async () => {
    const session = jwt.sign({ username: 'admin' }, SECRET, { expiresIn: '1h' });
    const res = await fetch(`${app.base}/api/categories`, {
      method: 'POST', headers: { Cookie: `authToken=${session}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Congés' }),
    });
    assert.equal(res.status, 201);
    const table = blockOf((await call({ section: 'categories' })).json, 'categories');
    assert.ok(table.rows.some((row) => row.cells.title === 'Congés'));
  });
});

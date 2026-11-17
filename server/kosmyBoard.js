/**
 * « Se connecter avec Kosmy Board » — client OpenID Connect de ClearDoc.
 *
 * Kosmy Board est un fournisseur d'identité OpenID Connect standard. Ce module
 * contient les briques du protocole (découverte, PKCE, demande d'autorisation,
 * échange du code, vérification de l'ID token, cookie du parcours) et le routeur
 * Express qui les assemble.
 *
 * ClearDoc n'a qu'un compte administrateur. Il se relie à un compte du Board
 * depuis Admin > Kosmy Board (« Relier mon compte ») : le `sub` reçu est
 * enregistré sur ce compte, avec l'émetteur. Ensuite, une connexion par le Board
 * avec ce `sub` ouvre la session admin. Jamais de liaison par l'e-mail, jamais
 * de droits admin pour un `sub` inconnu.
 *
 * Cahier des charges : Kosmy Board, docs/integration.md.
 */
import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';

export const LOGIN_PATH = '/auth/kosmy-board/login';
export const CALLBACK_PATH = '/auth/kosmy-board/callback';
export const LINK_PATH = '/auth/kosmy-board/link';
/** Cookie qui garde state / nonce / vérificateur PKCE entre le lancement et le retour. */
export const FLOW_COOKIE = 'cleardoc_kosmy_flow';
export const FLOW_TTL_SECONDS = 10 * 60;
/** Page d'accueil de l'admin : l'accueil de ClearDoc, en mode administrateur. */
export const DEFAULT_TARGET = '/';
export const LOGIN_PAGE = '/admin/login';
export const SETTINGS_PAGE = '/admin/kosmy-board';

export const SETTING_KEYS = {
  issuer: 'KOSMY_BOARD_ISSUER',
  clientId: 'KOSMY_BOARD_CLIENT_ID',
  clientSecret: 'KOSMY_BOARD_CLIENT_SECRET',
};

const FLOW_AUDIENCE = 'cleardoc:kosmy-board-flow';
const HTTP_TIMEOUT_MS = 10_000;

/* ============================================================
 * Petites fonctions
 * ============================================================ */

/** Retire espaces et « / » finaux. null si ce n'est pas une adresse http(s) simple. */
export function normalizeIssuer(value) {
  const v = String(value ?? '').trim().replace(/\/+$/, '');
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.search || u.hash || u.username || u.password) return null;
    return v;
  } catch {
    return null;
  }
}

/**
 * Adresse publique de cette instance, sans « / » final : APP_URL si elle est
 * définie, sinon l'adresse vue par la requête (en-têtes du proxy compris).
 */
export function appBaseUrl(req) {
  const fromEnv = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  const first = (v) => String(v || '').split(',')[0].trim();
  let proto = first(req.get('x-forwarded-proto')) || req.protocol;
  if (proto !== 'http' && proto !== 'https') proto = req.protocol;
  const host = first(req.get('x-forwarded-host')) || req.get('host');
  return `${proto}://${host}`;
}

export function redirectUri(base) {
  return `${base}${CALLBACK_PATH}`;
}

export function initiateLoginUri(base) {
  return `${base}${LOGIN_PATH}`;
}

/**
 * Où arriver après la connexion. Seule une page de cette instance (même origine)
 * est acceptée, sinon l'accueil de l'admin : pas de redirection ouverte.
 * La page de connexion elle-même renvoie aussi à l'accueil.
 */
export function safeTarget(target, base) {
  if (!target || typeof target !== 'string') return DEFAULT_TARGET;
  try {
    const origin = new URL(base).origin;
    const u = new URL(target, base);
    if (u.origin !== origin) return DEFAULT_TARGET;
    const p = u.pathname + u.search + u.hash;
    if (!p.startsWith('/') || p.startsWith('//')) return DEFAULT_TARGET;
    if (u.pathname.replace(/\/+$/, '') === LOGIN_PAGE) return DEFAULT_TARGET;
    return p;
  } catch {
    return DEFAULT_TARGET;
  }
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** PKCE S256 : BASE64URL(SHA-256(vérificateur)). */
export function codeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export class OidcError extends Error {
  /** @param {string} code code court qui choisit le message montré à l'utilisateur */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function fetchJson(fetchImpl, url, init = {}) {
  const res = await fetchImpl(url, {
    ...init,
    headers: { Accept: 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

/* ============================================================
 * Découverte et clés (en cache par émetteur)
 * ============================================================ */

const DISCOVERY_TTL_MS = 60 * 60 * 1000;
const JWKS_MIN_REFRESH_MS = 10 * 1000;
const cache = new Map();

export function clearDiscoveryCache() {
  cache.clear();
}

export async function discover(issuer, fetchImpl = fetch) {
  const hit = cache.get(issuer);
  if (hit && Date.now() - hit.at < DISCOVERY_TTL_MS) return hit;

  const { res, body: doc } = await fetchJson(fetchImpl, `${issuer}/.well-known/openid-configuration`);
  if (!res.ok) throw new OidcError('unreachable', `discovery failed (HTTP ${res.status})`);
  if (doc.issuer !== issuer) throw new OidcError('issuer', 'discovery: issuer mismatch');
  for (const k of ['authorization_endpoint', 'token_endpoint', 'jwks_uri']) {
    if (typeof doc[k] !== 'string') throw new OidcError('unreachable', `discovery: missing ${k}`);
  }
  const entry = { doc, at: Date.now(), keys: new Map(), keysAt: 0, fetchImpl };
  cache.set(issuer, entry);
  return entry;
}

async function refreshKeys(entry) {
  const { res, body } = await fetchJson(entry.fetchImpl, entry.doc.jwks_uri);
  if (!res.ok || !Array.isArray(body.keys)) throw new OidcError('unreachable', `jwks fetch failed (HTTP ${res.status})`);
  const keys = new Map();
  for (const jwk of body.keys) {
    if (jwk.kty !== 'RSA' || (jwk.use && jwk.use !== 'sig')) continue;
    try {
      keys.set(jwk.kid ?? '', crypto.createPublicKey({ key: jwk, format: 'jwk' }));
    } catch {
      // clé illisible : ignorée
    }
  }
  entry.keys = keys;
  entry.keysAt = Date.now();
}

/** Clé publique de signature pour ce `kid` (les clés sont relues si le `kid` est inconnu). */
export async function signingKey(entry, kid) {
  const pick = () => {
    if (kid !== undefined) return entry.keys.get(kid);
    return entry.keys.size === 1 ? [...entry.keys.values()][0] : undefined;
  };
  let key = pick();
  if (!key && Date.now() - entry.keysAt > JWKS_MIN_REFRESH_MS) {
    await refreshKeys(entry);
    key = pick();
  }
  if (!key) throw new OidcError('token', 'invalid ID token: unknown signing key');
  return key;
}

/* ============================================================
 * Demande d'autorisation
 * ============================================================ */

export function buildAuthorizationUrl(doc, p) {
  const url = new URL(doc.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    scope: 'openid profile email',
    state: p.state,
    nonce: p.nonce,
    code_challenge: codeChallenge(p.verifier),
    code_challenge_method: 'S256',
  }).toString();
  return url.href;
}

/* ============================================================
 * Cookie du parcours (signé, HttpOnly, 10 minutes)
 * ============================================================ */

/**
 * Signe le parcours. Audience dédiée et pas de `username` : il ne peut jamais
 * passer pour un jeton de session admin.
 * flow = { state, nonce, verifier, iss, target, mode: 'login' | 'link', uid? }
 */
export function signFlow(flow, secret) {
  return jwt.sign({ ...flow }, secret, {
    algorithm: 'HS256',
    audience: FLOW_AUDIENCE,
    expiresIn: FLOW_TTL_SECONDS,
  });
}

export function verifyFlow(token, secret) {
  if (!token) return null;
  try {
    const p = jwt.verify(token, secret, { algorithms: ['HS256'], audience: FLOW_AUDIENCE });
    if (p.username !== undefined || p.sub !== undefined) return null;
    if (typeof p.state !== 'string' || typeof p.nonce !== 'string' || typeof p.verifier !== 'string') return null;
    if (typeof p.iss !== 'string' || typeof p.target !== 'string') return null;
    if (p.mode !== 'login' && p.mode !== 'link') return null;
    if (p.mode === 'link' && typeof p.uid !== 'string') return null;
    return {
      state: p.state,
      nonce: p.nonce,
      verifier: p.verifier,
      iss: p.iss,
      target: p.target,
      mode: p.mode,
      ...(p.mode === 'link' ? { uid: p.uid } : {}),
    };
  } catch {
    return null;
  }
}

export function stateMatches(flow, state) {
  return typeof state === 'string' && state.length > 0 && safeEqual(flow.state, state);
}

/* ============================================================
 * Échange du code et ID token
 * ============================================================ */

/** Identifiants HTTP Basic selon RFC 6749 §2.3.1 (encodés en URL, puis en base64). */
export function basicAuthHeader(clientId, clientSecret) {
  const enc = (s) => encodeURIComponent(s).replace(/%20/g, '+');
  return `Basic ${Buffer.from(`${enc(clientId)}:${enc(clientSecret)}`).toString('base64')}`;
}

/** Échange le code (client_secret_basic + vérificateur PKCE). Renvoie l'ID token brut. */
export async function exchangeCode(doc, p, fetchImpl = fetch) {
  const { res, body } = await fetchJson(fetchImpl, doc.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(p.clientId, p.clientSecret),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: p.code,
      redirect_uri: p.redirectUri,
      code_verifier: p.verifier,
    }).toString(),
  });
  if (!res.ok || typeof body.id_token !== 'string') {
    throw new OidcError('exchange', `token endpoint refused the code: ${body.error_description || body.error || res.status}`);
  }
  return body.id_token;
}

/** Vérification complète de l'ID token : signature RS256 (jwks_uri), iss, aud, exp, nonce. */
export async function verifyIdToken(idToken, { entry, clientId, nonce }) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded.payload !== 'object' || decoded.header?.alg !== 'RS256') {
    throw new OidcError('token', 'invalid ID token: not an RS256 JWT');
  }
  const key = await signingKey(entry, decoded.header.kid);
  let payload;
  try {
    payload = jwt.verify(idToken, key, {
      algorithms: ['RS256'],
      issuer: entry.doc.issuer,
      audience: clientId,
      clockTolerance: 30,
    });
  } catch (e) {
    throw new OidcError('token', `invalid ID token: ${e.message}`);
  }
  if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') {
    throw new OidcError('token', 'invalid ID token: missing exp or iat');
  }
  if (typeof payload.nonce !== 'string' || !safeEqual(payload.nonce, nonce)) {
    throw new OidcError('token', 'invalid ID token: nonce mismatch');
  }
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new OidcError('token', 'invalid ID token: missing sub');
  }
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  return {
    sub: payload.sub,
    name: str(payload.name),
    email: str(payload.email),
    preferred_username: str(payload.preferred_username),
    locale: str(payload.locale),
  };
}

/* ============================================================
 * Base de données
 * ============================================================ */

/** Migration idempotente : le compte admin garde le `sub` et l'émetteur du Board. */
export function migrateKosmyBoard(db) {
  const cols = db.prepare('PRAGMA table_info(admin_users)').all().map((c) => c.name);
  if (!cols.includes('kosmy_board_sub')) db.exec('ALTER TABLE admin_users ADD COLUMN kosmy_board_sub TEXT DEFAULT NULL');
  if (!cols.includes('kosmy_board_issuer')) db.exec('ALTER TABLE admin_users ADD COLUMN kosmy_board_issuer TEXT DEFAULT NULL');
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS admin_users_kosmy_board
           ON admin_users (kosmy_board_issuer, kosmy_board_sub)
           WHERE kosmy_board_sub IS NOT NULL`);
}

/* ============================================================
 * Routeur Express
 * ============================================================ */

/**
 * @param {object} o
 * @param {import('better-sqlite3').Database} o.db
 * @param {(key: string) => string | null} o.getSetting  priorité env > base
 * @param {(key: string, value: string) => void} o.setSetting
 * @param {(key: string) => void} o.delSetting
 * @param {string} o.jwtSecret
 * @param {(res: import('express').Response, admin: { username: string }) => void} o.openAdminSession
 * @param {(token: string | undefined) => { username: string } | null} o.readAdminSession
 * @param {(req, res, next) => void} o.requireAuth
 * @param {(req) => void} [o.onLogin]  journal des connexions
 * @param {typeof fetch} [o.fetchImpl]
 */
export function createKosmyBoardRouter(o) {
  const { db, getSetting, setSetting, delSetting, jwtSecret, openAdminSession, readAdminSession, requireAuth } = o;
  const fetchImpl = o.fetchImpl || fetch;
  const logLogin = o.onLogin || (() => {});
  const router = express.Router();

  // `state` déjà consommés (jusqu'à l'expiration de leur parcours) : un cookie de
  // parcours rejoué est refusé même si le navigateur ne l'a pas effacé.
  const consumedStates = new Map();
  function consumeState(state) {
    const now = Date.now();
    for (const [s, until] of consumedStates) if (until <= now) consumedStates.delete(s);
    if (consumedStates.has(state)) return false;
    consumedStates.set(state, now + FLOW_TTL_SECONDS * 1000);
    return true;
  }

  function getSettings() {
    const issuer = normalizeIssuer(getSetting(SETTING_KEYS.issuer));
    const clientId = (getSetting(SETTING_KEYS.clientId) || '').trim();
    const clientSecret = getSetting(SETTING_KEYS.clientSecret) || '';
    if (!issuer || !clientId || !clientSecret) return null;
    return { issuer, clientId, clientSecret };
  }

  function flowCookieOptions(base, maxAgeMs = FLOW_TTL_SECONDS * 1000) {
    return {
      httpOnly: true,
      // Lax : le cookie doit revenir avec la redirection depuis le Board (navigation GET).
      sameSite: 'lax',
      secure: base.startsWith('https:'),
      path: '/auth/kosmy-board',
      maxAge: maxAgeMs,
    };
  }

  function redirectWithError(res, base, page, code) {
    const url = new URL(page, base);
    url.searchParams.set('kosmy_error', code);
    res.set('Cache-Control', 'no-store');
    return res.redirect(303, url.href);
  }

  async function startFlow(req, res, settings, base, p) {
    const entry = await discover(settings.issuer, fetchImpl);
    const flow = {
      state: randomToken(16),
      nonce: randomToken(16),
      verifier: randomToken(32),
      iss: settings.issuer,
      target: p.target,
      mode: p.mode,
      ...(p.uid ? { uid: p.uid } : {}),
    };
    res.cookie(FLOW_COOKIE, signFlow(flow, jwtSecret), flowCookieOptions(base));
    res.set('Cache-Control', 'no-store');
    return res.redirect(303, buildAuthorizationUrl(entry.doc, {
      clientId: settings.clientId,
      redirectUri: redirectUri(base),
      state: flow.state,
      nonce: flow.nonce,
      verifier: flow.verifier,
    }));
  }

  function adminFromSession(req) {
    const session = readAdminSession(req.cookies?.authToken);
    if (!session) return null;
    return db.prepare('SELECT * FROM admin_users WHERE username = ?').get(session.username) || null;
  }

  /* ---------- API publique : le bouton est-il affiché ? ---------- */

  router.get('/api/auth/kosmy-board', (_req, res) => {
    res.json({ enabled: Boolean(getSettings()) });
  });

  /* ---------- API admin : réglages ---------- */

  router.get('/api/admin/kosmy-board', requireAuth, (req, res) => {
    const base = appBaseUrl(req);
    const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(req.admin.username);
    const settings = getSettings();
    res.json({
      issuer: getSetting(SETTING_KEYS.issuer) || '',
      clientId: getSetting(SETTING_KEYS.clientId) || '',
      hasSecret: Boolean(getSetting(SETTING_KEYS.clientSecret)),
      fromEnv: {
        issuer: Boolean(process.env[SETTING_KEYS.issuer]),
        clientId: Boolean(process.env[SETTING_KEYS.clientId]),
        clientSecret: Boolean(process.env[SETTING_KEYS.clientSecret]),
      },
      enabled: Boolean(settings),
      redirectUri: redirectUri(base),
      initiateLoginUri: initiateLoginUri(base),
      linked: Boolean(admin?.kosmy_board_sub),
      linkedToCurrentIssuer: Boolean(
        admin?.kosmy_board_sub && settings && admin.kosmy_board_issuer === settings.issuer,
      ),
    });
  });

  router.put('/api/admin/kosmy-board', requireAuth, (req, res) => {
    const body = req.body || {};
    const issuerIn = String(body.issuer ?? '').trim();
    const clientIdIn = String(body.clientId ?? '').trim();
    const secretIn = String(body.clientSecret ?? '');

    const issuer = issuerIn ? normalizeIssuer(issuerIn) : '';
    if (issuer === null) return res.status(400).json({ error: 'invalid_issuer' });
    if (clientIdIn.length > 200 || secretIn.length > 500) return res.status(400).json({ error: 'too_long' });

    if (!process.env[SETTING_KEYS.issuer]) {
      if (issuer) setSetting(SETTING_KEYS.issuer, issuer);
      else delSetting(SETTING_KEYS.issuer);
    }
    if (!process.env[SETTING_KEYS.clientId]) {
      if (clientIdIn) setSetting(SETTING_KEYS.clientId, clientIdIn);
      else delSetting(SETTING_KEYS.clientId);
    }
    // Le secret est en écriture seule : vide = on garde l'actuel.
    if (!process.env[SETTING_KEYS.clientSecret] && secretIn.trim()) {
      setSetting(SETTING_KEYS.clientSecret, secretIn.trim());
    }
    clearDiscoveryCache();
    res.json({ ok: true });
  });

  /** Désactive la connexion par le Board (efface les trois réglages enregistrés en base). */
  router.delete('/api/admin/kosmy-board', requireAuth, (_req, res) => {
    for (const key of Object.values(SETTING_KEYS)) delSetting(key);
    clearDiscoveryCache();
    res.json({ ok: true });
  });

  router.post('/api/admin/kosmy-board/unlink', requireAuth, (req, res) => {
    db.prepare('UPDATE admin_users SET kosmy_board_sub = NULL, kosmy_board_issuer = NULL WHERE username = ?')
      .run(req.admin.username);
    res.json({ ok: true });
  });

  /* ---------- Lancement : bouton de la page de connexion, ou « Ouvrir » du Board ---------- */

  router.get(LOGIN_PATH, async (req, res) => {
    const base = appBaseUrl(req);
    const settings = getSettings();
    if (!settings) return redirectWithError(res, base, LOGIN_PAGE, 'not_configured');

    // Connexion initiée par un tiers (OpenID Connect Core § 4) : l'émetteur doit être le nôtre.
    if (req.query.iss !== undefined && normalizeIssuer(req.query.iss) !== settings.issuer) {
      return redirectWithError(res, base, LOGIN_PAGE, 'issuer');
    }
    const target = safeTarget(
      typeof req.query.target_link_uri === 'string' ? req.query.target_link_uri : null,
      base,
    );
    try {
      return await startFlow(req, res, settings, base, { target, mode: 'login' });
    } catch (e) {
      console.error('[kosmy-board] login start failed:', e.message);
      return redirectWithError(res, base, LOGIN_PAGE, e instanceof OidcError ? e.code : 'unreachable');
    }
  });

  /* ---------- Liaison : « Relier mon compte » dans Admin > Kosmy Board ---------- */

  router.post(LINK_PATH, async (req, res) => {
    const base = appBaseUrl(req);
    // Formulaire de la même origine seulement.
    const origin = req.get('origin');
    if (origin && origin !== new URL(base).origin) {
      return res.status(403).json({ error: 'Origine refusée' });
    }
    const admin = adminFromSession(req);
    if (!admin) return res.redirect(303, new URL(LOGIN_PAGE, base).href);

    const settings = getSettings();
    if (!settings) return redirectWithError(res, base, SETTINGS_PAGE, 'not_configured');
    try {
      return await startFlow(req, res, settings, base, { target: SETTINGS_PAGE, mode: 'link', uid: admin.id });
    } catch (e) {
      console.error('[kosmy-board] link start failed:', e.message);
      return redirectWithError(res, base, SETTINGS_PAGE, e instanceof OidcError ? e.code : 'unreachable');
    }
  });

  /* ---------- Retour du Board ---------- */

  router.get(CALLBACK_PATH, async (req, res) => {
    const base = appBaseUrl(req);
    const q = (k) => (typeof req.query[k] === 'string' ? req.query[k] : null);

    // Le parcours ne sert qu'une fois : le cookie est consommé quoi qu'il arrive.
    const flow = verifyFlow(req.cookies?.[FLOW_COOKIE], jwtSecret);
    const { maxAge: _ignored, ...clearOptions } = flowCookieOptions(base);
    res.clearCookie(FLOW_COOKIE, clearOptions);

    if (!flow || !stateMatches(flow, q('state')) || !consumeState(flow.state)) {
      return redirectWithError(res, base, LOGIN_PAGE, 'expired');
    }
    const errorPage = flow.mode === 'link' ? SETTINGS_PAGE : LOGIN_PAGE;

    if (req.query.error !== undefined) {
      return redirectWithError(res, base, errorPage, q('error') === 'access_denied' ? 'denied' : 'failed');
    }

    const settings = getSettings();
    if (!settings) return redirectWithError(res, base, errorPage, 'not_configured');
    // Réglages changés pendant le parcours.
    if (flow.iss !== settings.issuer) return redirectWithError(res, base, errorPage, 'issuer');

    try {
      const entry = await discover(settings.issuer, fetchImpl);

      // RFC 9207 : la réponse doit venir de l'émetteur attendu (le Board l'envoie toujours).
      if (req.query.iss !== undefined && q('iss') !== entry.doc.issuer) {
        return redirectWithError(res, base, errorPage, 'issuer');
      }
      const code = q('code');
      if (!code) return redirectWithError(res, base, errorPage, 'failed');

      const idToken = await exchangeCode(entry.doc, {
        code,
        redirectUri: redirectUri(base),
        verifier: flow.verifier,
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
      }, fetchImpl);
      const claims = await verifyIdToken(idToken, { entry, clientId: settings.clientId, nonce: flow.nonce });

      res.set('Cache-Control', 'no-store');

      if (flow.mode === 'link') return finishLink(req, res, base, flow, settings.issuer, claims.sub);

      // Liaison par `sub` (et émetteur) uniquement : jamais par l'e-mail.
      const admin = db.prepare('SELECT * FROM admin_users WHERE kosmy_board_issuer = ? AND kosmy_board_sub = ?')
        .get(settings.issuer, claims.sub);
      if (!admin) {
        logLogin(req, `kosmy-board:${claims.sub}`, false);
        return redirectWithError(res, base, LOGIN_PAGE, 'unknown_account');
      }
      logLogin(req, admin.username, true);
      openAdminSession(res, admin);
      return res.redirect(303, new URL(flow.target, base).href);
    } catch (e) {
      console.error('[kosmy-board] callback failed:', e.message);
      return redirectWithError(res, base, errorPage, e instanceof OidcError ? e.code : 'unreachable');
    }
  });

  function finishLink(req, res, base, flow, issuer, sub) {
    // Le compte à relier est celui qui a lancé le parcours. Le cookie de session
    // (SameSite=Strict) peut manquer au retour du Board ; s'il est là, il doit
    // désigner ce même compte.
    const admin = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(flow.uid);
    const current = readAdminSession(req.cookies?.authToken);
    if (!admin || (current && current.username !== admin.username)) {
      return redirectWithError(res, base, SETTINGS_PAGE, 'session');
    }
    const other = db.prepare('SELECT id FROM admin_users WHERE kosmy_board_issuer = ? AND kosmy_board_sub = ? AND id != ?')
      .get(issuer, sub, admin.id);
    if (other) return redirectWithError(res, base, SETTINGS_PAGE, 'already_linked');

    db.prepare('UPDATE admin_users SET kosmy_board_sub = ?, kosmy_board_issuer = ? WHERE id = ?')
      .run(sub, issuer, admin.id);
    const url = new URL(SETTINGS_PAGE, base);
    url.searchParams.set('kosmy', 'linked');
    return res.redirect(303, url.href);
  }

  return router;
}

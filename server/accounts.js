/**
 * Les comptes de ClearDoc (table admin_users) : leur état, les sessions, la
 * connexion par mot de passe, et la création / mise à jour / désactivation par
 * Kosmy Board (protocole kosmy.board-users.v1, voir server/kosmyBoardUsers.js).
 *
 * Dans ClearDoc, tout compte est administrateur : le site public se lit sans
 * compte, et un compte sert à administrer. Un compte peut être :
 *   - désactivé (`disabled`) : plus aucune connexion (mot de passe, Kosmy Board,
 *     admin dans le Board), et ses sessions ouvertes sont refusées ;
 *   - privé de la génération de vidéos (`can_generate_videos`), qui consomme les
 *     crédits des API d'IA et de voix de l'instance.
 * Un compte créé par Kosmy Board n'a pas de mot de passe : on s'y connecte par le Board.
 *
 * Les sessions portent la version de session du compte (`sv`) : la désactivation
 * l'augmente, ce qui ferme toutes les sessions ouvertes, même après une réactivation.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const SESSION_COOKIE = 'authToken';
const SESSION_TTL = '1h';
const SESSION_MAX_AGE_MS = 60 * 60 * 1000;

/* ============================================================
 * Base de données
 * ============================================================ */

/** Migration idempotente : nom, e-mail, langue, état et restrictions de chaque compte. */
export function migrateAccounts(db) {
  const cols = db.prepare('PRAGMA table_info(admin_users)').all().map((c) => c.name);
  const add = (name, def) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE admin_users ADD COLUMN ${name} ${def}`);
  };
  add('display_name', 'TEXT DEFAULT NULL');
  add('email', 'TEXT DEFAULT NULL');
  add('locale', 'TEXT DEFAULT NULL');
  add('disabled', 'INTEGER NOT NULL DEFAULT 0');
  add('session_version', 'INTEGER NOT NULL DEFAULT 0');
  add('can_generate_videos', 'INTEGER NOT NULL DEFAULT 1');
}

export const isActive = (account) => Boolean(account) && !account.disabled;
/** Un compte créé par Kosmy Board n'a pas de mot de passe (hash vide). */
export const hasPassword = (account) => Boolean(account?.password_hash);
export const canGenerateVideos = (account) => isActive(account) && account.can_generate_videos !== 0;

/* ============================================================
 * Sessions (cookie JWT d'une heure)
 * ============================================================ */

/**
 * @param {object} o
 * @param {import('better-sqlite3').Database} o.db
 * @param {string} o.jwtSecret
 * @param {boolean} [o.secure]  cookie Secure (production)
 */
export function createAdminSessions({ db, jwtSecret, secure = process.env.NODE_ENV === 'production' }) {
  const byUsername = (username) => db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

  /** Ouvre la session (mot de passe ou Kosmy Board). */
  function open(res, account) {
    const token = jwt.sign({ username: account.username, sv: account.session_version || 0 }, jwtSecret, { expiresIn: SESSION_TTL });
    res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: 'strict', maxAge: SESSION_MAX_AGE_MS });
  }

  /**
   * Le compte de la session, relu en base à chaque requête : null si le cookie
   * est absent, invalide ou expiré, si le compte n'existe plus ou est désactivé,
   * ou si la session a été fermée depuis (version de session changée).
   */
  function read(token) {
    if (!token) return null;
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    } catch {
      return null;
    }
    if (typeof decoded?.username !== 'string') return null;
    const account = byUsername(decoded.username);
    if (!isActive(account)) return null;
    if ((decoded.sv ?? 0) !== (account.session_version || 0)) return null;
    return { username: account.username, account };
  }

  function requireAuth(req, res, next) {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return res.status(401).json({ error: 'Non authentifié' });
    const session = read(token);
    if (!session) {
      res.clearCookie(SESSION_COOKIE);
      return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
    req.admin = { username: session.username };
    req.account = session.account;
    next();
  }

  return { open, read, requireAuth };
}

/**
 * Connexion par mot de passe. { account } si elle réussit ; sinon
 * { error: 'invalid' } (inconnu, mauvais mot de passe, ou compte sans mot de
 * passe) ou { error: 'disabled' } (bon mot de passe, compte désactivé).
 */
export async function checkPassword(db, username, password) {
  const account = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!account || !hasPassword(account)) return { error: 'invalid' };
  let ok = false;
  try {
    ok = await bcrypt.compare(String(password), account.password_hash);
  } catch {
    ok = false;
  }
  if (!ok) return { error: 'invalid' };
  if (!isActive(account)) return { error: 'disabled' };
  return { account };
}

/* ============================================================
 * Rôles et restrictions proposés à Kosmy Board
 * ============================================================ */

/** Les rôles de ClearDoc : un seul, tout compte est administrateur. */
export const ROLES = [{ value: 'admin', admin: true }];
export const DEFAULT_ROLE = 'admin';
const ADMIN_ROLES = new Set(ROLES.filter((r) => r.admin).map((r) => r.value));

/** Le rôle d'un compte parmi ROLES (null s'il n'en a aucun). */
export const roleOf = () => 'admin';

/** Les restrictions qu'applique ClearDoc, avec leur colonne et leur valeur par défaut. */
export const FIELDS = [
  { name: 'canGenerateVideos', type: 'checkbox', column: 'can_generate_videos', value: true },
];

/** Les valeurs des restrictions d'un compte, au format du protocole. */
export function accountValues(account) {
  const out = {};
  for (const f of FIELDS) {
    const v = account?.[f.column];
    out[f.name] = f.type === 'checkbox' ? (v === undefined || v === null ? f.value : v !== 0) : v ?? f.value;
  }
  return out;
}

/* ============================================================
 * Création / mise à jour / désactivation par Kosmy Board
 * ============================================================ */

/** Refus prévu : statut HTTP, code du protocole, clé du message (traduit par l'appelant). */
export class AccountError extends Error {
  constructor(status, code, key, params = {}) {
    super(key);
    this.status = status;
    this.code = code;
    this.key = key;
    this.params = params;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCALE = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/;

const cleanName = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : null);
const cleanEmail = (v) => {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return e && e.length <= 254 && EMAIL.test(e) ? e : null;
};
const cleanLocale = (v) => (typeof v === 'string' && v.length <= 35 && LOCALE.test(v.trim()) ? v.trim() : null);

/**
 * Valeurs reçues du Board, revérifiées une à une : un champ absent garde la
 * valeur actuelle (ou la valeur par défaut pour un nouveau compte).
 */
export function cleanValues(raw, current) {
  const out = accountValues(current);
  if (raw === undefined || raw === null) return out;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new AccountError(422, 'invalid', 'values');
  for (const f of FIELDS) {
    if (!Object.hasOwn(raw, f.name)) continue;
    const v = raw[f.name];
    if (f.type === 'checkbox' && typeof v !== 'boolean') {
      throw new AccountError(422, 'invalid', 'checkbox', { field: f.name });
    }
    out[f.name] = v;
  }
  return out;
}

/** Le compte relié à ce compte du Board (par `sub` et émetteur), désactivé ou non. */
export function linkedAccount(db, issuer, sub) {
  if (typeof sub !== 'string' || !sub) return null;
  return db.prepare('SELECT * FROM admin_users WHERE kosmy_board_issuer = ? AND kosmy_board_sub = ?').get(issuer, sub) || null;
}

/** Les comptes reliés au Board d'émetteur `issuer`. */
export function linkedAccounts(db, issuer, limit = 500) {
  return db.prepare(`SELECT * FROM admin_users WHERE kosmy_board_sub IS NOT NULL AND kosmy_board_issuer = ?
                     ORDER BY created_at, username LIMIT ?`).all(issuer, limit);
}

const activeAdminCount = (db) => db.prepare('SELECT * FROM admin_users WHERE disabled = 0').all()
  .filter((a) => ADMIN_ROLES.has(roleOf(a))).length;

/** Identifiant libre, tiré de l'e-mail ou du nom (« alice@exemple.fr », « alice@exemple.fr-2 »…). */
function uniqueUsername(db, ...candidates) {
  const raw = candidates.find((c) => typeof c === 'string' && c.trim()) || 'compte';
  const root = raw.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9._@+-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'compte';
  const taken = db.prepare('SELECT 1 FROM admin_users WHERE username = ?');
  for (let i = 1; ; i += 1) {
    const username = i === 1 ? root : `${root}-${i}`;
    if (!taken.get(username)) return username;
  }
}

/**
 * Crée, relie ou met à jour le compte de la personne `sub`, avec son rôle et ses
 * restrictions, et le réactive s'il était désactivé. Appelée par un PUT du Board
 * (`me` : le `sub` de la personne qui agit) et à la connexion quand l'ID token
 * porte `kosmy_board_access` (`atLogin` : jamais de liaison par l'e-mail).
 *
 * @returns {{ status: 'created' | 'linked' | 'updated', account: string, reactivated: boolean }}
 */
export function provisionBoardAccount(db, { issuer, sub, body, me = null, atLogin = false }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AccountError(400, 'invalid_request', 'body');
  if (typeof body.role !== 'string' || !ROLES.some((r) => r.value === body.role)) {
    throw new AccountError(422, 'invalid', 'role');
  }
  const name = cleanName(body.name);
  const email = cleanEmail(body.email);
  const locale = cleanLocale(body.locale);

  return db.transaction(() => {
    let account = linkedAccount(db, issuer, sub);
    let status = 'updated';

    if (!account && !atLogin && email) {
      // Un compte non relié à ce Board qui porte cette adresse : on le relie (c'est un
      // administrateur de ClearDoc qui agit, il pourrait déjà tout faire de ce compte).
      // Un compte sans e-mail dont l'identifiant est cette adresse compte aussi.
      const sameEmail = db.prepare(`SELECT * FROM admin_users
        WHERE lower(email) = ? OR (email IS NULL AND lower(username) = ?) ORDER BY created_at`).all(email, email);
      const free = sameEmail.find((a) => !a.kosmy_board_sub || a.kosmy_board_issuer !== issuer);
      if (free) {
        db.prepare('UPDATE admin_users SET kosmy_board_sub = ?, kosmy_board_issuer = ? WHERE id = ?').run(sub, issuer, free.id);
        account = { ...free, kosmy_board_sub: sub, kosmy_board_issuer: issuer };
        status = 'linked';
      } else if (sameEmail.length) {
        throw new AccountError(409, 'conflict', 'emailTaken');
      }
    }

    const values = cleanValues(body.values, account);

    if (!account) {
      const id = crypto.randomUUID();
      // Sans mot de passe : on s'y connecte par le Board.
      db.prepare(`INSERT INTO admin_users (id, username, password_hash, kosmy_board_sub, kosmy_board_issuer)
                  VALUES (?, ?, '', ?, ?)`).run(id, uniqueUsername(db, email, name, `kosmy-${sub.slice(0, 8)}`), sub, issuer);
      account = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id);
      status = 'created';
    }

    // Ne pas se couper l'accès (aujourd'hui, tous les rôles de ClearDoc sont administrateurs).
    const losesAdmin = status !== 'created' && isActive(account)
      && ADMIN_ROLES.has(roleOf(account)) && !ADMIN_ROLES.has(body.role);
    if (losesAdmin && sub === me) throw new AccountError(409, 'conflict', 'selfDemote');
    if (losesAdmin && activeAdminCount(db) <= 1) throw new AccountError(409, 'conflict', 'lastAdmin');

    const reactivated = Boolean(account.disabled);
    const sets = ['display_name = ?', 'email = ?', 'locale = ?', 'disabled = 0'];
    const params = [name ?? account.display_name, email ?? account.email, locale ?? account.locale];
    for (const f of FIELDS) {
      sets.push(`${f.column} = ?`);
      params.push(f.type === 'checkbox' ? (values[f.name] ? 1 : 0) : values[f.name]);
    }
    db.prepare(`UPDATE admin_users SET ${sets.join(', ')} WHERE id = ?`).run(...params, account.id);
    return { status, account: account.username, reactivated };
  })();
}

/**
 * Retire l'accès de la personne `sub` : son compte est désactivé (ses données
 * restent) et ses sessions sont fermées. Rien à faire s'il n'y a pas de compte
 * relié, ou s'il est déjà désactivé.
 *
 * @returns {{ status: 'disabled' | 'none', account?: string }}
 */
export function disableBoardAccount(db, { issuer, sub, me = null }) {
  return db.transaction(() => {
    const account = linkedAccount(db, issuer, sub);
    if (!account || !isActive(account)) return { status: 'none' };
    if (sub === me) throw new AccountError(409, 'conflict', 'selfDisable');
    if (ADMIN_ROLES.has(roleOf(account)) && activeAdminCount(db) <= 1) {
      throw new AccountError(409, 'conflict', 'lastAdmin');
    }
    db.prepare('UPDATE admin_users SET disabled = 1, session_version = session_version + 1 WHERE id = ?').run(account.id);
    return { status: 'disabled', account: account.username };
  })();
}

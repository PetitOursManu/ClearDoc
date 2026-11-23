/**
 * Utilisateurs gérés par Kosmy Board — protocole kosmy.board-users.v1.
 *
 * Un administrateur du Board choisit qui a accès à cette instance de ClearDoc,
 * avec quel rôle et quelles restrictions ; le Board appelle alors :
 *
 *   GET    /api/kosmy-board/users        rôles, restrictions, comptes reliés au Board
 *   PUT    /api/kosmy-board/users/{sub}  créer, relier ou mettre à jour le compte de {sub}
 *   DELETE /api/kosmy-board/users/{sub}  désactiver le compte de {sub} (ses données restent)
 *
 * Même jeton que l'admin dans le Board (typ kb-admin+jwt, htm / htu de cette
 * requête, jti à usage unique). Le `sub` du jeton est la personne qui agit : elle
 * doit être reliée à un compte actif de ClearDoc, qui a les droits d'admin.
 * Le `sub` de l'adresse n'est que la personne gérée.
 *
 * Dans ClearDoc, tout compte est administrateur : un seul rôle (« admin »), et
 * une restriction réellement appliquée, « peut générer des vidéos ».
 * Les règles des comptes sont dans server/accounts.js.
 *
 * Cahier des charges : Kosmy Board, docs/users-api.md.
 */
import express from 'express';
import {
  BoardAdminError, authenticateBoardRequest, createJtiStore, pickLang, sendJson, translator,
} from './kosmyBoardAdmin.js';
import {
  AccountError, DEFAULT_ROLE, FIELDS, ROLES, accountValues, disableBoardAccount, isActive, linkedAccounts,
  provisionBoardAccount, roleOf,
} from './accounts.js';

export const USERS_API_PATH = '/api/kosmy-board/users';
export const USERS_PROTOCOL = 'kosmy.board-users.v1';

const ROUTE = /^\/api\/kosmy-board\/users(?:\/.*)?$/;
const SUB = /^[A-Za-z0-9-]{1,64}$/;
const MAX_USERS = 500;

/* ============================================================
 * Textes (fr / en, selon Accept-Language)
 * ============================================================ */

const TEXTS = {
  fr: {
    'role.admin.label': 'Administrateur',
    'role.admin.description': 'Administre ClearDoc : lignes de paie, catégories, documents des structures, fiche interactive, vidéos et réglages.',
    'field.canGenerateVideos.label': 'Peut générer des vidéos',
    'field.canGenerateVideos.help': 'Génération des vidéos explicatives (Génération vidéo) : elle consomme les crédits des API d\'IA et de voix de l\'instance.',

    'users.created': 'Compte ClearDoc créé ({account}). Il se connecte par Kosmy Board.',
    'users.linked': 'Compte ClearDoc existant ({account}) relié par son adresse e-mail.',
    'users.updated': 'Compte ClearDoc mis à jour ({account}).',
    'users.reactivated': 'Compte ClearDoc réactivé et mis à jour ({account}).',
    'users.disabled': 'Compte ClearDoc désactivé ({account}) : ses sessions sont fermées, ses données restent.',
    'users.none': 'Aucun compte ClearDoc actif n\'est relié à cette personne : rien à retirer.',

    'err.notFound': 'Adresse inconnue.',
    'err.users.body': 'Requête illisible.',
    'err.users.role': 'Rôle inconnu pour ClearDoc.',
    'err.users.values': 'Restrictions illisibles.',
    'err.users.checkbox': '« {field} » : oui ou non attendu.',
    'err.users.emailTaken': 'Cette adresse e-mail appartient déjà à un compte ClearDoc relié à une autre personne du Board.',
    'err.users.selfDemote': 'Vous ne pouvez pas vous retirer vos propres droits d\'administration.',
    'err.users.selfDisable': 'Vous ne pouvez pas retirer votre propre accès à ClearDoc.',
    'err.users.lastAdmin': 'ClearDoc doit garder au moins un administrateur actif.',
  },
  en: {
    'role.admin.label': 'Administrator',
    'role.admin.description': 'Manages ClearDoc: payslip lines, categories, structure documents, interactive payslip, videos and settings.',
    'field.canGenerateVideos.label': 'Can generate videos',
    'field.canGenerateVideos.help': 'Generating the explainer videos (Video generator) uses the instance\'s AI and voice API credits.',

    'users.created': 'ClearDoc account created ({account}). It signs in through Kosmy Board.',
    'users.linked': 'Existing ClearDoc account ({account}) linked by its email address.',
    'users.updated': 'ClearDoc account updated ({account}).',
    'users.reactivated': 'ClearDoc account reactivated and updated ({account}).',
    'users.disabled': 'ClearDoc account disabled ({account}): its sessions are closed, its data is kept.',
    'users.none': 'No active ClearDoc account is linked to this person: nothing to remove.',

    'err.notFound': 'Unknown address.',
    'err.users.body': 'Unreadable request.',
    'err.users.role': 'Unknown ClearDoc role.',
    'err.users.values': 'Unreadable restrictions.',
    'err.users.checkbox': '"{field}": expected yes or no.',
    'err.users.emailTaken': 'This email address already belongs to a ClearDoc account linked to another Board person.',
    'err.users.selfDemote': 'You cannot remove your own administrator rights.',
    'err.users.selfDisable': 'You cannot remove your own access to ClearDoc.',
    'err.users.lastAdmin': 'ClearDoc must keep at least one active administrator.',
  },
};

/** Ce que ClearDoc propose au Board : ses rôles et ses restrictions, dans la langue demandée. */
export function describeUsersApi(t) {
  return {
    roles: ROLES.map((r) => ({
      value: r.value,
      label: t(`role.${r.value}.label`),
      description: t(`role.${r.value}.description`),
      ...(r.admin ? { admin: true } : {}),
    })),
    defaultRole: DEFAULT_ROLE,
    fields: FIELDS.map((f) => ({
      name: f.name,
      label: t(`field.${f.name}.label`),
      type: f.type,
      value: f.value,
      help: t(`field.${f.name}.help`),
    })),
  };
}

/** Un refus des règles des comptes, dans la langue de la personne. */
function fromAccountError(e, t) {
  const field = e.params.field ? t(`field.${e.params.field}.label`) : undefined;
  return new BoardAdminError(e.status, e.code, t(`err.users.${e.key}`, { ...e.params, field }));
}

/* ============================================================
 * Routeur
 * ============================================================ */

/**
 * @param {object} o
 * @param {import('better-sqlite3').Database} o.db
 * @param {(key: string) => string | null} o.getSetting  priorité env > base
 * @param {ReturnType<typeof createJtiStore>} [o.jtis]  `jti` déjà reçus (partagés avec l'admin dans le Board)
 * @param {(account: object) => boolean} [o.isAdmin]  droits d'admin du compte qui agit (tout compte actif dans ClearDoc)
 * @param {typeof fetch} [o.fetchImpl]
 */
export function createKosmyBoardUsersRouter(o) {
  const { db, getSetting } = o;
  const fetchImpl = o.fetchImpl || fetch;
  const isAdmin = o.isAdmin || ((account) => Boolean(account));
  const jtis = o.jtis || createJtiStore();
  const parseJson = express.json({ limit: '64kb', type: () => true });
  const router = express.Router();

  function readBody(req, res) {
    return new Promise((resolve, reject) => {
      parseJson(req, res, (err) => (err ? reject(err) : resolve(req.body)));
    });
  }

  // Toutes les méthodes et tous les chemins sous /api/kosmy-board/users : rien
  // d'autre (session, CORS, page de l'interface) ne doit y répondre.
  router.all(ROUTE, async (req, res) => {
    const t = translator(pickLang(req.get('accept-language')), TEXTS);
    try {
      const { account: me, settings, claims } = await authenticateBoardRequest(req, t, {
        db, getSetting, fetchImpl, jtis, isAdmin,
      });
      const m = /^\/api\/kosmy-board\/users(?:\/([^/]*))?$/.exec(req.path);
      if (!m) throw new BoardAdminError(404, 'not_found', t('err.notFound'));
      const target = m[1];

      /* ---------- GET /api/kosmy-board/users ---------- */
      if (target === undefined) {
        if (req.method !== 'GET') {
          res.set('Allow', 'GET');
          throw new BoardAdminError(405, 'method_not_allowed', t('err.method'));
        }
        return sendJson(res, 200, {
          protocol: USERS_PROTOCOL,
          ...describeUsersApi(t),
          users: linkedAccounts(db, settings.issuer, MAX_USERS).map((a) => ({
            sub: a.kosmy_board_sub,
            role: roleOf(a),
            values: accountValues(a),
            active: isActive(a),
            account: a.username,
          })),
        });
      }

      if (!SUB.test(target)) throw new BoardAdminError(404, 'not_found', t('err.notFound'));
      const who = `${me.username} (${claims.email || claims.name || claims.sub})`;

      /* ---------- PUT /api/kosmy-board/users/{sub} ---------- */
      if (req.method === 'PUT') {
        let body;
        try {
          body = await readBody(req, res);
        } catch (e) {
          if (e?.type === 'entity.too.large') throw new BoardAdminError(413, 'too_large', t('err.tooLarge'));
          throw new BoardAdminError(400, 'invalid_request', t('err.users.body'));
        }
        const r = provisionBoardAccount(db, {
          issuer: settings.issuer, sub: target, body, me: me.kosmy_board_sub,
        });
        console.log(`[kosmy-board users] ${who} : PUT ${target} -> ${r.status} ${r.account}`);
        const key = r.status === 'updated' && r.reactivated ? 'users.reactivated' : `users.${r.status}`;
        return sendJson(res, 200, { ok: true, status: r.status, account: r.account, message: t(key, { account: r.account }) });
      }

      /* ---------- DELETE /api/kosmy-board/users/{sub} ---------- */
      if (req.method === 'DELETE') {
        const r = disableBoardAccount(db, { issuer: settings.issuer, sub: target, me: me.kosmy_board_sub });
        if (r.status === 'none') return sendJson(res, 200, { ok: true, message: t('users.none') });
        console.log(`[kosmy-board users] ${who} : DELETE ${target} -> ${r.account} disabled`);
        return sendJson(res, 200, { ok: true, message: t('users.disabled', { account: r.account }) });
      }

      res.set('Allow', 'PUT, DELETE');
      throw new BoardAdminError(405, 'method_not_allowed', t('err.method'));
    } catch (e) {
      if (e instanceof AccountError) {
        const err = fromAccountError(e, t);
        return sendJson(res, err.status, { error: err.code, message: err.userMessage });
      }
      if (e instanceof BoardAdminError) {
        return sendJson(res, e.status, { error: e.code, ...(e.userMessage ? { message: e.userMessage } : {}) });
      }
      console.error('[kosmy-board users]', e);
      return sendJson(res, 500, { error: 'server_error', message: t('err.server') });
    }
  });

  return router;
}

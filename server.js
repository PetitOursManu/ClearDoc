import 'dotenv/config';
import express from 'express';
import Database from 'better-sqlite3';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { spawn, execSync } from 'child_process';
import { generateVideoForDocument } from './services/videoGenerator.js';
import { createKosmyBoardRouter, migrateKosmyBoard } from './server/kosmyBoard.js';
import { createKosmyBoardAdminRouter, createJtiStore } from './server/kosmyBoardAdmin.js';
import { createKosmyBoardUsersRouter } from './server/kosmyBoardUsers.js';
import { migrateAccounts, createAdminSessions, checkPassword, canGenerateVideos } from './server/accounts.js';
import { createAdminActions, AdminActionError } from './server/adminActions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('ERREUR: JWT_SECRET non défini. Ajoutez JWT_SECRET=... dans le fichier .env');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// INITIALISATION DES DOSSIERS ET DE LA BASE
// ============================================

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const VIDEOS_DIR = path.join(DATA_DIR, 'videos');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');
const BRANDING_DIR = path.join(DATA_DIR, 'branding');
const DB_PATH = path.join(DATA_DIR, 'cleardoc.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
if (!fs.existsSync(BRANDING_DIR)) fs.mkdirSync(BRANDING_DIR, { recursive: true });

const WATERMARK_PATH = path.join(BRANDING_DIR, 'watermark.png');
const REMOTION_DIR = path.join(__dirname, 'node_modules', 'remotion');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    image_path TEXT DEFAULT NULL,
    category TEXT NOT NULL DEFAULT 'autres',
    keywords TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS descriptions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    success INTEGER NOT NULL DEFAULT 0,
    ip TEXT,
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    ip TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    blocked_until DATETIME
  );

  CREATE TABLE IF NOT EXISTS payslip_zones (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payslip_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pdf_files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    filename TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS company_pdfs (
    company_id TEXT NOT NULL,
    pdf_id TEXT NOT NULL,
    PRIMARY KEY (company_id, pdf_id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Ajouter la colonne video_url à la table documents si elle n'existe pas (migration idempotente)
try {
  db.exec('ALTER TABLE documents ADD COLUMN video_url TEXT DEFAULT NULL;');
} catch {
  // Colonne déjà existante, ignorer
}

// Connexion par Kosmy Board : sub + émetteur du Board sur le compte admin (migration idempotente)
migrateKosmyBoard(db);
// Comptes : nom, e-mail, état (désactivé), version de session, restrictions (migration idempotente)
migrateAccounts(db);

// Valeurs par défaut de l'apparence des vidéos
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('VIDEO_THEME', 'cleardoc')").run();
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('VIDEO_ACCENT_COLOR', '#dc2626')").run();
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('VIDEO_WATERMARK_POSITION', 'bottom-right')").run();
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('VIDEO_WATERMARK_SIZE', 'medium')").run();
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('VIDEO_QUALITY', 'high')").run();
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('VIDEO_BG_MODE', 'theme')").run();
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('VIDEO_BG_COLOR1', '#0f172a')").run();
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('VIDEO_BG_COLOR2', '#1e293b')").run();
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('VIDEO_BG_ANGLE', '135')").run();

// Catégories par défaut si la table est vide
const categoriesCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
if (categoriesCount.count === 0) {
  const insertCategory = db.prepare('INSERT INTO categories (id, title) VALUES (?, ?)');
  for (const cat of [
    { id: 'salaire', title: 'Salaire' },
    { id: 'cotisations', title: 'Cotisations' },
    { id: 'net', title: 'Net' },
    { id: 'employeur', title: 'Employeur' },
    { id: 'autres', title: 'Autres' }
  ]) {
    insertCategory.run(cat.id, cat.title);
  }
}

console.log('Base de données initialisée:', DB_PATH);

// ============================================
// SETTINGS — lecture avec priorité env > base
// ============================================

function getSetting(key) {
  return process.env[key.toUpperCase()]
    || db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value
    || null;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, String(value));
}

function delSetting(key) {
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

// ============================================
// FONCTIONS DE L'ADMIN — partagées par les routes ci-dessous et l'admin dans Kosmy Board
// ============================================

const adminActions = createAdminActions({
  db,
  getSetting,
  setSetting,
  delSetting,
  uploadsDir: UPLOADS_DIR,
  videosDir: VIDEOS_DIR,
  watermarkPath: WATERMARK_PATH,
  remotionDir: REMOTION_DIR,
});

/** Erreur prévue (introuvable, saisie refusée, conflit) : son statut et son message ; sinon 500. */
function sendActionError(res, err) {
  if (err instanceof AdminActionError) return res.status(err.status).json({ error: err.message });
  res.status(500).json({ error: err.message });
}

// ============================================
// ADMIN DANS KOSMY BOARD (API appelée par le serveur du Board)
// ============================================

// Montés avant tout le reste : pas de CORS, pas de cookie de session, pas de
// page de l'interface ; ces adresses répondent toujours en JSON. Les deux
// protocoles partagent le même jeton du Board, donc les mêmes `jti` déjà reçus.
const boardJtis = createJtiStore();
app.use(createKosmyBoardAdminRouter({ db, getSetting, actions: adminActions, jtis: boardJtis }));
// Utilisateurs gérés par Kosmy Board (kosmy.board-users.v1)
app.use(createKosmyBoardUsersRouter({ db, getSetting, jtis: boardJtis }));

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Servir les images uploadées
app.use('/uploads', express.static(UPLOADS_DIR));

// Servir les vidéos générées (volume persistant Coolify).
// no-cache : force le navigateur à revalider, sinon une vidéo régénérée (même URL)
// reste affichée depuis le cache.
app.use('/data/videos', express.static(VIDEOS_DIR, {
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
}));

// Servir les éléments de marque (watermark) — volume persistant
app.use('/data/branding', express.static(BRANDING_DIR));

// Servir le frontend buildé en production
const DIST_DIR = path.join(__dirname, 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

// Configuration multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(jpeg|jpg|png|gif|webp|pdf)$/i.test(path.extname(file.originalname))) {
      return cb(null, true);
    }
    cb(new Error('Seuls les fichiers images et PDF sont acceptés'));
  }
});

const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)) {
      return cb(null, true);
    }
    cb(new Error('Seuls les fichiers PDF sont acceptés'));
  }
});

// Watermark : toujours le même fichier (data/branding/watermark.png), PNG uniquement
const watermarkUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BRANDING_DIR),
    filename: (_req, _file, cb) => cb(null, 'watermark.png')
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/png' || /\.png$/i.test(file.originalname)) {
      return cb(null, true);
    }
    cb(new Error('Le watermark doit être un fichier PNG'));
  }
});

// ============================================
// AUTH - HELPERS
// ============================================

// Sessions (cookie JWT d'une heure), partagées par le mot de passe et Kosmy Board.
// Le compte est relu à chaque requête : un compte désactivé perd aussitôt ses
// sessions ouvertes (server/accounts.js).
const adminSessions = createAdminSessions({ db, jwtSecret: JWT_SECRET });
const requireAuth = adminSessions.requireAuth;
const openAdminSession = adminSessions.open;
const readAdminSession = adminSessions.read;

function checkRateLimit(ip) {
  const now = new Date().toISOString();
  const attempt = db.prepare('SELECT * FROM login_attempts WHERE ip = ?').get(ip);

  if (attempt?.blocked_until) {
    if (attempt.blocked_until > now) {
      return { blocked: true };
    }
    // Blocage expiré : réinitialiser
    db.prepare('UPDATE login_attempts SET count = 0, blocked_until = NULL WHERE ip = ?').run(ip);
  }
  return { blocked: false };
}

function recordFailedAttempt(ip) {
  const existing = db.prepare('SELECT * FROM login_attempts WHERE ip = ?').get(ip);

  if (!existing) {
    db.prepare('INSERT INTO login_attempts (ip, count) VALUES (?, 1)').run(ip);
  } else {
    const newCount = (existing.count || 0) + 1;
    if (newCount >= 5) {
      const blockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      db.prepare('UPDATE login_attempts SET count = ?, blocked_until = ? WHERE ip = ?')
        .run(newCount, blockedUntil, ip);
    } else {
      db.prepare('UPDATE login_attempts SET count = ? WHERE ip = ?').run(newCount, ip);
    }
  }
}

function resetAttempts(ip) {
  db.prepare('DELETE FROM login_attempts WHERE ip = ?').run(ip);
}

// ============================================
// ROUTES - AUTH
// ============================================

app.post('/api/auth/login', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;

  if (checkRateLimit(ip).blocked) {
    return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }

  try {
    // Un compte créé par Kosmy Board n'a pas de mot de passe : il se connecte par le Board.
    const { account: admin, error } = await checkPassword(db, username, password);

    if (error === 'disabled') {
      db.prepare('INSERT INTO login_logs (username, success, ip) VALUES (?, 0, ?)').run(username, ip);
      return res.status(403).json({ error: 'Ce compte est désactivé.' });
    }
    if (!admin) {
      recordFailedAttempt(ip);
      db.prepare('INSERT INTO login_logs (username, success, ip) VALUES (?, 0, ?)').run(username, ip);
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    resetAttempts(ip);
    db.prepare('INSERT INTO login_logs (username, success, ip) VALUES (?, 1, ?)').run(username, ip);

    openAdminSession(res, admin);

    res.json({ ok: true, username: admin.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('authToken');
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ ok: true, username: req.account.username, canGenerateVideos: canGenerateVideos(req.account) });
});

// ============================================
// ROUTES - CONNEXION PAR KOSMY BOARD (OpenID Connect)
// ============================================

app.use(createKosmyBoardRouter({
  db,
  getSetting,
  setSetting,
  delSetting,
  jwtSecret: JWT_SECRET,
  openAdminSession,
  readAdminSession,
  requireAuth,
  onLogin: (req, username, success) => {
    const ip = req.ip || req.socket.remoteAddress;
    db.prepare('INSERT INTO login_logs (username, success, ip) VALUES (?, ?, ?)').run(username, success ? 1 : 0, ip);
  },
}));

// ============================================
// ROUTES - DOCUMENTS (lecture publique, écriture protégée)
// ============================================

app.get('/api/documents', (_req, res) => {
  try {
    res.json({ _fromServer: true, items: adminActions.listDocuments() });
  } catch (err) {
    sendActionError(res, err);
  }
});

app.get('/api/documents/:id', (req, res) => {
  try {
    res.json({ _fromServer: true, ...adminActions.getDocument(req.params.id) });
  } catch (err) {
    sendActionError(res, err);
  }
});

app.post('/api/documents', requireAuth, (req, res) => {
  try {
    res.status(201).json({ _fromServer: true, ...adminActions.createDocument(req.body) });
  } catch (err) {
    sendActionError(res, err);
  }
});

app.put('/api/documents/:id', requireAuth, (req, res) => {
  try {
    res.json({ _fromServer: true, ...adminActions.updateDocument(req.params.id, req.body) });
  } catch (err) {
    sendActionError(res, err);
  }
});

app.delete('/api/documents/:id', requireAuth, (req, res) => {
  try {
    res.json(adminActions.deleteDocument(req.params.id));
  } catch (err) {
    sendActionError(res, err);
  }
});

// ============================================
// ROUTES - UPLOAD (protégé)
// ============================================

app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ _fromServer: true, imageUrl, filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROUTES - CATEGORIES (lecture publique, écriture protégée)
// ============================================

app.get('/api/categories', (_req, res) => {
  try {
    res.json({ _fromServer: true, categories: adminActions.listCategories() });
  } catch (err) {
    sendActionError(res, err);
  }
});

app.put('/api/categories', requireAuth, (req, res) => {
  try {
    const { categories } = req.body;
    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: 'categories doit être un tableau' });
    }

    db.transaction((cats) => {
      db.prepare('DELETE FROM categories').run();
      const insert = db.prepare('INSERT INTO categories (id, title) VALUES (?, ?)');
      for (const cat of cats) insert.run(cat.id, cat.title);
    })(categories);

    const updated = db.prepare('SELECT * FROM categories ORDER BY id').all();
    res.json({ _fromServer: true, categories: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', requireAuth, (req, res) => {
  try {
    res.status(201).json({ _fromServer: true, ...adminActions.createCategory(req.body.title) });
  } catch (err) {
    sendActionError(res, err);
  }
});

app.delete('/api/categories/:id', requireAuth, (req, res) => {
  try {
    res.json(adminActions.deleteCategory(req.params.id));
  } catch (err) {
    sendActionError(res, err);
  }
});

app.patch('/api/categories/:id', requireAuth, (req, res) => {
  try {
    res.json({ _fromServer: true, ...adminActions.renameCategory(req.params.id, req.body.title) });
  } catch (err) {
    sendActionError(res, err);
  }
});

// ============================================
// ROUTES - DESCRIPTIONS (lecture publique, écriture protégée)
// ============================================

app.get('/api/descriptions', (_req, res) => {
  try {
    const descriptions = db.prepare('SELECT * FROM descriptions ORDER BY id').all();
    res.json({ _fromServer: true, descriptions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/descriptions', requireAuth, (req, res) => {
  try {
    const { id, title, description } = req.body;
    const descId = id || uuidv4();
    db.prepare('INSERT INTO descriptions (id, title, description) VALUES (?, ?, ?)').run(
      descId, title || '', description || ''
    );
    const created = db.prepare('SELECT * FROM descriptions WHERE id = ?').get(descId);
    res.status(201).json({ _fromServer: true, ...created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/descriptions/:id', requireAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM descriptions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Description non trouvée' });

    const { title, description } = req.body;
    db.prepare('UPDATE descriptions SET title = ?, description = ? WHERE id = ?').run(
      title !== undefined ? title : existing.title,
      description !== undefined ? description : existing.description,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM descriptions WHERE id = ?').get(req.params.id);
    res.json({ _fromServer: true, ...updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/descriptions/:id', requireAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM descriptions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Description non trouvée' });
    db.prepare('DELETE FROM descriptions WHERE id = ?').run(req.params.id);
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROUTES - PAYSLIP ZONES (lecture publique, écriture protégée)
// ============================================

app.get('/api/payslip-zones', (_req, res) => {
  try {
    res.json({ _fromServer: true, zones: adminActions.listZones() });
  } catch (err) {
    sendActionError(res, err);
  }
});

app.post('/api/payslip-zones', requireAuth, (req, res) => {
  try {
    res.status(201).json({ _fromServer: true, ...adminActions.createZone(req.body) });
  } catch (err) {
    sendActionError(res, err);
  }
});

app.put('/api/payslip-zones/:id', requireAuth, (req, res) => {
  try {
    res.json({ _fromServer: true, ...adminActions.updateZone(req.params.id, req.body) });
  } catch (err) {
    sendActionError(res, err);
  }
});

app.delete('/api/payslip-zones/:id', requireAuth, (req, res) => {
  try {
    res.json(adminActions.deleteZone(req.params.id));
  } catch (err) {
    sendActionError(res, err);
  }
});

// ============================================
// ROUTES - PAYSLIP SETTINGS
// ============================================

app.get('/api/payslip-settings', (_req, res) => {
  try {
    res.json({ _fromServer: true, model_image_path: adminActions.payslipModelImage() });
  } catch (err) {
    sendActionError(res, err);
  }
});

app.post('/api/payslip-settings/image', requireAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    const imageUrl = `/uploads/${req.file.filename}`;
    db.prepare("INSERT OR REPLACE INTO payslip_settings (key, value) VALUES ('model_image_path', ?)").run(imageUrl);
    res.json({ _fromServer: true, model_image_path: imageUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROUTES - COMPANIES
// ============================================

app.get('/api/companies', (_req, res) => {
  try {
    res.json({ _fromServer: true, companies: adminActions.listCompanies() });
  } catch (err) {
    sendActionError(res, err);
  }
});

app.post('/api/companies', requireAuth, (req, res) => {
  try {
    res.status(201).json({ _fromServer: true, ...adminActions.createCompany(req.body.name) });
  } catch (err) {
    sendActionError(res, err);
  }
});

app.patch('/api/companies/:id', requireAuth, (req, res) => {
  try {
    res.json({ _fromServer: true, ...adminActions.renameCompany(req.params.id, req.body.name) });
  } catch (err) {
    sendActionError(res, err);
  }
});

app.delete('/api/companies/:id', requireAuth, (req, res) => {
  try {
    res.json(adminActions.deleteCompany(req.params.id));
  } catch (err) {
    sendActionError(res, err);
  }
});

// ============================================
// ROUTES - PDF FILES
// ============================================

app.get('/api/pdf-files', (req, res) => {
  try {
    res.json({ _fromServer: true, pdfs: adminActions.listPdfFiles(req.query.company_id) });
  } catch (err) {
    sendActionError(res, err);
  }
});

app.post('/api/pdf-files/upload', requireAuth, pdfUpload.single('pdf'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    const { name } = req.body;
    const docName = name?.trim() || path.basename(req.file.originalname, '.pdf');
    const id = uuidv4();
    const filename = `/uploads/${req.file.filename}`;
    db.prepare('INSERT INTO pdf_files (id, name, filename) VALUES (?, ?, ?)').run(id, docName, filename);
    const created = db.prepare('SELECT * FROM pdf_files WHERE id = ?').get(id);
    res.status(201).json({ _fromServer: true, ...created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/pdf-files/:id', requireAuth, (req, res) => {
  try {
    res.json(adminActions.deletePdfFile(req.params.id));
  } catch (err) {
    sendActionError(res, err);
  }
});

// ============================================
// ROUTES - COMPANY-PDF ASSIGNMENTS
// ============================================

app.get('/api/company-pdfs', requireAuth, (_req, res) => {
  try {
    res.json({ _fromServer: true, assignments: adminActions.listAssignments() });
  } catch (err) {
    sendActionError(res, err);
  }
});

app.post('/api/company-pdfs', requireAuth, (req, res) => {
  try {
    const { company_id, pdf_id } = req.body;
    res.status(201).json(adminActions.assignPdf(company_id, pdf_id));
  } catch (err) {
    sendActionError(res, err);
  }
});

app.delete('/api/company-pdfs/:company_id/:pdf_id', requireAuth, (req, res) => {
  try {
    res.json(adminActions.unassignPdf(req.params.company_id, req.params.pdf_id));
  } catch (err) {
    sendActionError(res, err);
  }
});

// ============================================
// ROUTES - VIDEO GENERATOR (admin, protégé)
// ============================================

// Un seul render Remotion à la fois (contrainte mémoire/CPU du conteneur).
let renderInProgress = false;

const VIDEOS_CODE_DIR = path.join(__dirname, 'src', 'videos');
const ROOT_TSX_PATH = path.join(__dirname, 'src', 'Root.tsx');

// Helpers SSE
function openSse(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

function sseWrite(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// --- Statut Remotion ---
app.get('/api/admin/remotion/status', requireAuth, (_req, res) => {
  res.json(adminActions.remotionStatus());
});

// --- Installation Remotion (SSE) ---
app.post('/api/admin/remotion/install', requireAuth, (_req, res) => {
  openSse(res);
  const send = (msg) => sseWrite(res, { log: msg });

  const runCmd = (cmd) => new Promise((resolve, reject) => {
    send(`$ ${cmd}`);
    const proc = spawn(cmd, { shell: true, cwd: __dirname });
    proc.stdout.on('data', d => send(d.toString()));
    proc.stderr.on('data', d => send(d.toString()));
    proc.on('error', err => reject(err));
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`Commande terminée avec le code ${code}`)));
  });

  (async () => {
    try {
      await runCmd('npm install remotion @remotion/cli');
      send('Installation Remotion terminée.');
      // Remotion 4.x : "remotion install chromium" n'existe plus, c'est "browser ensure".
      await runCmd('npx remotion browser ensure');
      send('Installation Chromium terminée.');

      for (const dir of [VIDEOS_DIR, AUDIO_DIR, VIDEOS_CODE_DIR]) {
        fs.mkdirSync(dir, { recursive: true });
      }
      send('Dossiers créés.');

      sseWrite(res, { done: true });
    } catch (e) {
      sseWrite(res, { error: e.message });
    }
    res.end();
  })();
});

// --- Désinstallation Remotion ---
app.post('/api/admin/remotion/uninstall', requireAuth, (_req, res) => {
  try {
    execSync('npm uninstall remotion @remotion/cli', { cwd: __dirname });
    fs.rmSync(VIDEOS_CODE_DIR, { recursive: true, force: true });
    fs.rmSync(ROOT_TSX_PATH, { force: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Lecture des paramètres (clés masquées) ---
app.get('/api/admin/settings', requireAuth, (_req, res) => {
  res.json(adminActions.readMaskedSettings());
});

// --- Enregistrement des paramètres ---
app.post('/api/admin/settings', requireAuth, (req, res) => {
  try {
    res.json(adminActions.saveSettings(req.body));
  } catch (e) {
    sendActionError(res, e);
  }
});

// --- Watermark : statut ---
app.get('/api/admin/video-watermark', requireAuth, (_req, res) => {
  res.json(adminActions.watermarkStatus());
});

// --- Watermark : upload (PNG) ---
app.post('/api/admin/video-watermark', requireAuth, (req, res) => {
  watermarkUpload.single('watermark')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    res.json({ ok: true, url: `/data/branding/watermark.png?t=${Date.now()}` });
  });
});

// --- Watermark : suppression ---
app.delete('/api/admin/video-watermark', requireAuth, (_req, res) => {
  try {
    res.json(adminActions.deleteWatermark());
  } catch (e) {
    sendActionError(res, e);
  }
});

// --- Liste des documents possédant une vidéo ---
app.get('/api/admin/videos', requireAuth, (_req, res) => {
  try {
    res.json({ videos: adminActions.listVideos() });
  } catch (e) {
    sendActionError(res, e);
  }
});

// --- Dernière vidéo générée mais non encore validée ---
app.get('/api/admin/videos/pending', requireAuth, (_req, res) => {
  try {
    res.json({ pending: adminActions.getPendingVideo() });
  } catch (e) {
    sendActionError(res, e);
  }
});

// --- Génération d'une vidéo (SSE) ---
app.post('/api/admin/videos/generate/:documentId', requireAuth, async (req, res) => {
  openSse(res);
  const send = (step, message, progress) => sseWrite(res, { step, message, progress });

  // Restriction du compte (réglée depuis les utilisateurs de Kosmy Board).
  if (!canGenerateVideos(req.account)) {
    sseWrite(res, { error: "Votre compte n'est pas autorisé à générer des vidéos." });
    return res.end();
  }

  if (renderInProgress) {
    sseWrite(res, { error: 'Un render est déjà en cours. Veuillez patienter.' });
    return res.end();
  }

  // Heartbeat : garde la connexion SSE vivante pendant le render (sinon un reverse
  // proxy ou le navigateur peut couper la connexion -> "Network Error").
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* connexion fermée */ }
  }, 15000);

  renderInProgress = true;
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.documentId);
    if (!doc) throw new Error('Document introuvable');

    const { theme, accentColor, quality, bg } = req.body || {};
    const { videoUrl } = await generateVideoForDocument({
      doc,
      getSetting,
      send,
      projectRoot: __dirname,
      theme,
      accentColor,
      quality,
      bg,
    });

    // La vidéo n'est PAS publiée automatiquement : l'admin la valide depuis l'aperçu.
    // On mémorise la dernière vidéo non validée pour pouvoir la revoir plus tard.
    setSetting('VIDEO_PENDING', JSON.stringify({
      documentId: doc.id, title: doc.title, videoUrl, createdAt: Date.now(),
    }));
    send('done', 'Vidéo générée — à valider', 100);
    sseWrite(res, { done: true, videoUrl });
  } catch (e) {
    sseWrite(res, { error: e.message });
  } finally {
    clearInterval(heartbeat);
    renderInProgress = false;
    res.end();
  }
});

// --- Validation/publication d'une vidéo sur la fiche ---
app.post('/api/admin/videos/publish/:documentId', requireAuth, (req, res) => {
  try {
    res.json(adminActions.publishVideo(req.params.documentId, (req.body || {}).videoUrl));
  } catch (e) {
    sendActionError(res, e);
  }
});

// --- Rejet d'une vidéo générée mais non publiée ---
app.post('/api/admin/videos/discard', requireAuth, (req, res) => {
  try {
    res.json(adminActions.discardVideo((req.body || {}).videoUrl));
  } catch (e) {
    sendActionError(res, e);
  }
});

// --- Suppression d'une vidéo ---
app.delete('/api/admin/videos/:documentId', requireAuth, (req, res) => {
  try {
    res.json(adminActions.deleteVideo(req.params.documentId));
  } catch (e) {
    sendActionError(res, e);
  }
});

// ============================================
// FALLBACK SPA
// ============================================

if (fs.existsSync(DIST_DIR)) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// ============================================
// DÉMARRAGE
// ============================================

app.listen(PORT, () => {
  console.log(`Serveur ClearDoc démarré sur http://localhost:${PORT}`);
  console.log(`Données: ${DATA_DIR}`);
  console.log(`Base SQLite: ${DB_PATH}`);
  console.log(`Images: ${UPLOADS_DIR}`);
});

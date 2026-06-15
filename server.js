import 'dotenv/config';
import express from 'express';
import Database from 'better-sqlite3';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { spawn, execSync } from 'child_process';
import { generateVideoForDocument } from './services/videoGenerator.js';

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

// Valeurs par défaut de l'apparence des vidéos
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('VIDEO_THEME', 'cleardoc')").run();
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('VIDEO_ACCENT_COLOR', '#dc2626')").run();
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('VIDEO_WATERMARK_POSITION', 'bottom-right')").run();
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('VIDEO_WATERMARK_SIZE', 'medium')").run();

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

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Servir les images uploadées
app.use('/uploads', express.static(UPLOADS_DIR));

// Servir les vidéos générées (volume persistant Coolify)
app.use('/data/videos', express.static(VIDEOS_DIR));

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

function requireAuth(req, res, next) {
  const token = req.cookies?.authToken;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie('authToken');
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

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
    const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      recordFailedAttempt(ip);
      db.prepare('INSERT INTO login_logs (username, success, ip) VALUES (?, 0, ?)').run(username, ip);
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    resetAttempts(ip);
    db.prepare('INSERT INTO login_logs (username, success, ip) VALUES (?, 1, ?)').run(username, ip);

    const token = jwt.sign({ username: admin.username }, JWT_SECRET, { expiresIn: '1h' });

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000
    });

    res.json({ ok: true, username: admin.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('authToken');
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies?.authToken;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ ok: true, username: decoded.username });
  } catch {
    res.clearCookie('authToken');
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
});

// ============================================
// HELPERS - DOCUMENTS
// ============================================

function parseDocument(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_path || '',
    videoUrl: row.video_url || '',
    category: row.category,
    keywords: JSON.parse(row.keywords || '[]'),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// ============================================
// ROUTES - DOCUMENTS (lecture publique, écriture protégée)
// ============================================

app.get('/api/documents', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM documents ORDER BY created_at DESC').all();
    res.json({ _fromServer: true, items: rows.map(parseDocument) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Document non trouvé' });
    res.json({ _fromServer: true, ...parseDocument(row) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents', requireAuth, (req, res) => {
  try {
    const { id, title, description, image_path, imageUrl, category, keywords } = req.body;
    const docId = id || uuidv4();
    const imagePath = image_path || imageUrl || null;
    const keywordsStr = JSON.stringify(Array.isArray(keywords) ? keywords : []);

    db.prepare(`
      INSERT INTO documents (id, title, description, image_path, category, keywords)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(docId, title || '', description || '', imagePath, category || 'autres', keywordsStr);

    const created = parseDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(docId));
    res.status(201).json({ _fromServer: true, ...created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/documents/:id', requireAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Document non trouvé' });

    const { title, description, image_path, imageUrl, category, keywords } = req.body;
    const imagePath = image_path !== undefined ? image_path
      : imageUrl !== undefined ? imageUrl
      : existing.image_path;
    const keywordsStr = keywords !== undefined
      ? JSON.stringify(Array.isArray(keywords) ? keywords : [])
      : existing.keywords;

    db.prepare(`
      UPDATE documents SET
        title = ?,
        description = ?,
        image_path = ?,
        category = ?,
        keywords = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title !== undefined ? title : existing.title,
      description !== undefined ? description : existing.description,
      imagePath,
      category !== undefined ? category : existing.category,
      keywordsStr,
      req.params.id
    );

    const updated = parseDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id));
    res.json({ _fromServer: true, ...updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/documents/:id', requireAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Document non trouvé' });

    if (existing.image_path) {
      const filename = path.basename(existing.image_path);
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const categories = db.prepare('SELECT * FROM categories ORDER BY id').all();
    res.json({ _fromServer: true, categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Le titre de la catégorie est requis' });
    }
    const catId = uuidv4();
    db.prepare('INSERT INTO categories (id, title) VALUES (?, ?)').run(catId, title.trim());
    const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);
    res.status(201).json({ _fromServer: true, ...created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', requireAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Catégorie non trouvée' });

    const usageCount = db.prepare('SELECT COUNT(*) as count FROM documents WHERE category = ?').get(req.params.id);
    if (usageCount.count > 0) {
      return res.status(409).json({
        error: `Impossible de supprimer cette catégorie, elle est utilisée par ${usageCount.count} description(s)`
      });
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/categories/:id', requireAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Catégorie non trouvée' });

    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Le titre de la catégorie est requis' });
    }

    db.prepare('UPDATE categories SET title = ? WHERE id = ?').run(title.trim(), req.params.id);
    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    res.json({ _fromServer: true, ...updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

const ZONE_SELECT = `
  SELECT pz.id, pz.document_id, pz.x, pz.y, pz.width, pz.height, pz.created_at,
         d.title as document_title
  FROM payslip_zones pz
  LEFT JOIN documents d ON pz.document_id = d.id
`;

app.get('/api/payslip-zones', (_req, res) => {
  try {
    const zones = db.prepare(`${ZONE_SELECT} ORDER BY pz.created_at ASC`).all();
    res.json({ _fromServer: true, zones });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payslip-zones', requireAuth, (req, res) => {
  try {
    const { document_id, x, y, width, height } = req.body;
    if (!document_id) return res.status(400).json({ error: 'document_id requis' });
    const id = uuidv4();
    db.prepare('INSERT INTO payslip_zones (id, document_id, x, y, width, height) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, document_id, Number(x), Number(y), Number(width), Number(height));
    const created = db.prepare(`${ZONE_SELECT} WHERE pz.id = ?`).get(id);
    res.status(201).json({ _fromServer: true, ...created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/payslip-zones/:id', requireAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM payslip_zones WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Zone non trouvée' });
    const { document_id, x, y, width, height } = req.body;
    db.prepare('UPDATE payslip_zones SET document_id = ?, x = ?, y = ?, width = ?, height = ? WHERE id = ?')
      .run(
        document_id ?? existing.document_id,
        x !== undefined ? Number(x) : existing.x,
        y !== undefined ? Number(y) : existing.y,
        width !== undefined ? Number(width) : existing.width,
        height !== undefined ? Number(height) : existing.height,
        req.params.id
      );
    const updated = db.prepare(`${ZONE_SELECT} WHERE pz.id = ?`).get(req.params.id);
    res.json({ _fromServer: true, ...updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/payslip-zones/:id', requireAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM payslip_zones WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Zone non trouvée' });
    db.prepare('DELETE FROM payslip_zones WHERE id = ?').run(req.params.id);
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROUTES - PAYSLIP SETTINGS
// ============================================

app.get('/api/payslip-settings', (_req, res) => {
  try {
    const setting = db.prepare("SELECT value FROM payslip_settings WHERE key = 'model_image_path'").get();
    res.json({ _fromServer: true, model_image_path: setting?.value || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const companies = db.prepare('SELECT * FROM companies ORDER BY name').all();
    res.json({ _fromServer: true, companies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/companies', requireAuth, (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis' });
    const id = uuidv4();
    db.prepare('INSERT INTO companies (id, name) VALUES (?, ?)').run(id, name.trim());
    const created = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
    res.status(201).json({ _fromServer: true, ...created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/companies/:id', requireAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Entreprise non trouvée' });
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis' });
    db.prepare('UPDATE companies SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
    const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    res.json({ _fromServer: true, ...updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/companies/:id', requireAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Entreprise non trouvée' });
    db.prepare('DELETE FROM company_pdfs WHERE company_id = ?').run(req.params.id);
    db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROUTES - PDF FILES
// ============================================

app.get('/api/pdf-files', (req, res) => {
  try {
    const { company_id } = req.query;
    if (company_id) {
      const pdfs = db.prepare(`
        SELECT pf.* FROM pdf_files pf
        INNER JOIN company_pdfs cp ON cp.pdf_id = pf.id
        WHERE cp.company_id = ?
        ORDER BY pf.name
      `).all(company_id);
      return res.json({ _fromServer: true, pdfs });
    }
    const pdfs = db.prepare('SELECT * FROM pdf_files ORDER BY name').all();
    res.json({ _fromServer: true, pdfs });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const existing = db.prepare('SELECT * FROM pdf_files WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Fichier non trouvé' });
    const filePath = path.join(UPLOADS_DIR, path.basename(existing.filename));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM company_pdfs WHERE pdf_id = ?').run(req.params.id);
    db.prepare('DELETE FROM pdf_files WHERE id = ?').run(req.params.id);
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROUTES - COMPANY-PDF ASSIGNMENTS
// ============================================

app.get('/api/company-pdfs', requireAuth, (req, res) => {
  try {
    const assignments = db.prepare('SELECT company_id, pdf_id FROM company_pdfs').all();
    res.json({ _fromServer: true, assignments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/company-pdfs', requireAuth, (req, res) => {
  try {
    const { company_id, pdf_id } = req.body;
    if (!company_id || !pdf_id) return res.status(400).json({ error: 'company_id et pdf_id requis' });
    db.prepare('INSERT OR IGNORE INTO company_pdfs (company_id, pdf_id) VALUES (?, ?)').run(company_id, pdf_id);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/company-pdfs/:company_id/:pdf_id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM company_pdfs WHERE company_id = ? AND pdf_id = ?')
      .run(req.params.company_id, req.params.pdf_id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROUTES - VIDEO GENERATOR (admin, protégé)
// ============================================

// Un seul render Remotion à la fois (contrainte mémoire/CPU du conteneur).
let renderInProgress = false;

const REMOTION_DIR = path.join(__dirname, 'node_modules', 'remotion');
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
  const installed = fs.existsSync(REMOTION_DIR);
  let version = null;
  if (installed) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(REMOTION_DIR, 'package.json'), 'utf-8'));
      version = pkg.version;
    } catch {
      // package.json illisible, on ignore
    }
  }
  res.json({ installed, version });
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
const SETTINGS_KEYS = [
  'AI_API_KEY', 'AI_API_BASE_URL', 'AI_MODEL', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID',
  'VIDEO_THEME', 'VIDEO_ACCENT_COLOR', 'VIDEO_WATERMARK_POSITION', 'VIDEO_WATERMARK_SIZE',
];

app.get('/api/admin/settings', requireAuth, (_req, res) => {
  const result = {};
  for (const key of SETTINGS_KEYS) {
    const val = getSetting(key);
    // Masquer les clés API sauf les 4 derniers caractères
    result[key] = val
      ? (key.includes('KEY') ? '***' + val.slice(-4) : val)
      : '';
    // Indiquer si la valeur provient des variables d'environnement (non modifiable en base)
    result[`${key}__fromEnv`] = Boolean(process.env[key]);
  }
  res.json(result);
});

// --- Enregistrement des paramètres ---
app.post('/api/admin/settings', requireAuth, (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      // On ignore les valeurs vides ou encore masquées (préfixe ***)
      if (SETTINGS_KEYS.includes(key) && value && !String(value).startsWith('***')) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
          .run(key, String(value));
      }
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Watermark : statut ---
app.get('/api/admin/video-watermark', requireAuth, (_req, res) => {
  const exists = fs.existsSync(WATERMARK_PATH);
  res.json({
    exists,
    url: exists ? `/data/branding/watermark.png?t=${fs.statSync(WATERMARK_PATH).mtimeMs}` : null,
    position: getSetting('VIDEO_WATERMARK_POSITION') || 'bottom-right',
    size: getSetting('VIDEO_WATERMARK_SIZE') || 'medium',
  });
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
    if (fs.existsSync(WATERMARK_PATH)) fs.unlinkSync(WATERMARK_PATH);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Liste des documents possédant une vidéo ---
app.get('/api/admin/videos', requireAuth, (_req, res) => {
  try {
    const rows = db.prepare(
      "SELECT id, title, video_url FROM documents WHERE video_url IS NOT NULL AND video_url != '' ORDER BY title ASC"
    ).all();
    res.json({ videos: rows.map(r => ({ documentId: r.id, title: r.title, videoUrl: r.video_url })) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Génération d'une vidéo (SSE) ---
app.post('/api/admin/videos/generate/:documentId', requireAuth, async (req, res) => {
  openSse(res);
  const send = (step, message, progress) => sseWrite(res, { step, message, progress });

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

    const { theme, accentColor } = req.body || {};
    const { videoUrl } = await generateVideoForDocument({
      doc,
      getSetting,
      send,
      projectRoot: __dirname,
      theme,
      accentColor,
    });

    // La vidéo n'est PAS publiée automatiquement : l'admin la valide depuis l'aperçu.
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
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.documentId);
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });

    const { videoUrl } = req.body || {};
    if (!videoUrl || typeof videoUrl !== 'string') {
      return res.status(400).json({ error: 'videoUrl requis' });
    }

    // Sécurité : n'accepter qu'un fichier réellement présent dans data/videos (anti path-traversal)
    const base = path.basename(videoUrl);
    const filePath = path.join(VIDEOS_DIR, base);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier vidéo introuvable' });
    }

    const safeUrl = `/data/videos/${base}`;
    db.prepare('UPDATE documents SET video_url = ? WHERE id = ?').run(safeUrl, doc.id);
    res.json({ ok: true, videoUrl: safeUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Rejet d'une vidéo générée mais non publiée ---
app.post('/api/admin/videos/discard', requireAuth, (req, res) => {
  try {
    const { videoUrl } = req.body || {};
    if (!videoUrl || typeof videoUrl !== 'string') {
      return res.status(400).json({ error: 'videoUrl requis' });
    }
    const base = path.basename(videoUrl);
    // Ne pas supprimer un fichier encore référencé par un document publié
    const used = db.prepare('SELECT id FROM documents WHERE video_url = ?').get(`/data/videos/${base}`);
    if (used) {
      return res.status(409).json({ error: 'Vidéo publiée : utilisez la suppression depuis la liste.' });
    }
    const filePath = path.join(VIDEOS_DIR, base);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Suppression d'une vidéo ---
app.delete('/api/admin/videos/:documentId', requireAuth, (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.documentId);
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });

    if (doc.video_url) {
      const filePath = path.join(VIDEOS_DIR, path.basename(doc.video_url));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.prepare('UPDATE documents SET video_url = NULL WHERE id = ?').run(doc.id);
    res.json({ ok: true, id: doc.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
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

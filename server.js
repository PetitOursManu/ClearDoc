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
const DB_PATH = path.join(DATA_DIR, 'cleardoc.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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
`);

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
// MIDDLEWARE
// ============================================

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Servir les images uploadées
app.use('/uploads', express.static(UPLOADS_DIR));

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
    image_path: row.image_path,
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

/**
 * Fonctions de l'administration de ClearDoc.
 *
 * Les routes de l'admin (server.js) et l'admin dans Kosmy Board
 * (server/kosmyBoardAdmin.js) passent toutes les deux par ces fonctions :
 * mêmes règles, mêmes effets, mêmes messages d'erreur.
 *
 * Une erreur prévue (introuvable, saisie refusée, conflit) est une
 * AdminActionError : `status` HTTP, `code` stable (traduit par l'admin dans le
 * Board) et `message` en français (renvoyé tel quel par les routes de l'admin).
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class AdminActionError extends Error {
  /**
   * @param {number} status statut HTTP
   * @param {string} code code court et stable
   * @param {string} message message en français
   * @param {Record<string, string | number>} [params] valeurs du message
   */
  constructor(status, code, message, params = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.params = params;
  }
}

/** Réglages lisibles et modifiables depuis Admin > Génération vidéo. */
export const SETTINGS_KEYS = [
  'AI_API_KEY', 'AI_API_BASE_URL', 'AI_MODEL', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID',
  'VIDEO_THEME', 'VIDEO_ACCENT_COLOR', 'VIDEO_WATERMARK_POSITION', 'VIDEO_WATERMARK_SIZE',
  'VIDEO_QUALITY', 'VIDEO_BG_MODE', 'VIDEO_BG_COLOR1', 'VIDEO_BG_COLOR2', 'VIDEO_BG_ANGLE',
];

/** Un réglage secret (clé d'API) : jamais renvoyé en clair. */
export const isSecretSetting = (key) => key.includes('KEY');

const ZONE_SELECT = `
  SELECT pz.id, pz.document_id, pz.x, pz.y, pz.width, pz.height, pz.created_at,
         d.title as document_title
  FROM payslip_zones pz
  LEFT JOIN documents d ON pz.document_id = d.id
`;

export function parseDocument(row) {
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

/**
 * @param {object} o
 * @param {import('better-sqlite3').Database} o.db
 * @param {(key: string) => string | null} o.getSetting  priorité env > base
 * @param {(key: string, value: string) => void} o.setSetting
 * @param {(key: string) => void} o.delSetting
 * @param {string} o.uploadsDir
 * @param {string} o.videosDir
 * @param {string} o.watermarkPath
 * @param {string} o.remotionDir  node_modules/remotion
 */
export function createAdminActions(o) {
  const { db, getSetting, setSetting, delSetting, uploadsDir, videosDir, watermarkPath, remotionDir } = o;
  const fail = (status, code, message, params) => { throw new AdminActionError(status, code, message, params); };
  const getDoc = (id) => db.prepare('SELECT * FROM documents WHERE id = ?').get(id);

  /* ---------- Lignes de paie (documents) ---------- */

  function listDocuments() {
    return db.prepare('SELECT * FROM documents ORDER BY created_at DESC').all().map(parseDocument);
  }

  function getDocument(id) {
    const row = getDoc(id);
    if (!row) fail(404, 'document_not_found', 'Document non trouvé');
    return parseDocument(row);
  }

  function createDocument(body = {}) {
    const { id, title, description, image_path, imageUrl, category, keywords } = body;
    const docId = id || uuidv4();
    const imagePath = image_path || imageUrl || null;
    const keywordsStr = JSON.stringify(Array.isArray(keywords) ? keywords : []);

    db.prepare(`
      INSERT INTO documents (id, title, description, image_path, category, keywords)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(docId, title || '', description || '', imagePath, category || 'autres', keywordsStr);

    return parseDocument(getDoc(docId));
  }

  /** Mise à jour partielle : un champ absent garde sa valeur. */
  function updateDocument(id, body = {}) {
    const existing = getDoc(id);
    if (!existing) fail(404, 'document_not_found', 'Document non trouvé');

    const { title, description, image_path, imageUrl, category, keywords } = body;
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
      id
    );

    return parseDocument(getDoc(id));
  }

  /** Supprime la ligne et son image envoyée. */
  function deleteDocument(id) {
    const existing = getDoc(id);
    if (!existing) fail(404, 'document_not_found', 'Document non trouvé');

    if (existing.image_path) {
      const filePath = path.join(uploadsDir, path.basename(existing.image_path));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    return { ok: true, id };
  }

  /* ---------- Catégories ---------- */

  function listCategories() {
    return db.prepare('SELECT * FROM categories ORDER BY id').all();
  }

  /** Nombre de lignes de paie rangées dans chaque catégorie. */
  function categoryUsage() {
    const out = new Map();
    for (const r of db.prepare('SELECT category, COUNT(*) as count FROM documents GROUP BY category').all()) {
      out.set(r.category, r.count);
    }
    return out;
  }

  function createCategory(title) {
    if (!title || typeof title !== 'string' || !title.trim()) {
      fail(400, 'category_title_required', 'Le titre de la catégorie est requis');
    }
    const catId = uuidv4();
    db.prepare('INSERT INTO categories (id, title) VALUES (?, ?)').run(catId, title.trim());
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);
  }

  function renameCategory(id, title) {
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!existing) fail(404, 'category_not_found', 'Catégorie non trouvée');
    if (!title || typeof title !== 'string' || !title.trim()) {
      fail(400, 'category_title_required', 'Le titre de la catégorie est requis');
    }
    db.prepare('UPDATE categories SET title = ? WHERE id = ?').run(title.trim(), id);
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  }

  /** Refusé tant qu'une ligne de paie utilise la catégorie. */
  function deleteCategory(id) {
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!existing) fail(404, 'category_not_found', 'Catégorie non trouvée');

    const usageCount = db.prepare('SELECT COUNT(*) as count FROM documents WHERE category = ?').get(id);
    if (usageCount.count > 0) {
      fail(409, 'category_in_use',
        `Impossible de supprimer cette catégorie, elle est utilisée par ${usageCount.count} description(s)`,
        { count: usageCount.count });
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return { ok: true, id };
  }

  /* ---------- Structures (companies) ---------- */

  function listCompanies() {
    return db.prepare('SELECT * FROM companies ORDER BY name').all();
  }

  function createCompany(name) {
    if (typeof name !== 'string' || !name.trim()) fail(400, 'company_name_required', 'Le nom est requis');
    const id = uuidv4();
    db.prepare('INSERT INTO companies (id, name) VALUES (?, ?)').run(id, name.trim());
    return db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
  }

  function renameCompany(id, name) {
    const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
    if (!existing) fail(404, 'company_not_found', 'Entreprise non trouvée');
    if (typeof name !== 'string' || !name.trim()) fail(400, 'company_name_required', 'Le nom est requis');
    db.prepare('UPDATE companies SET name = ? WHERE id = ?').run(name.trim(), id);
    return db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
  }

  /** Supprime la structure et ses assignations de PDF (pas les PDF). */
  function deleteCompany(id) {
    const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
    if (!existing) fail(404, 'company_not_found', 'Entreprise non trouvée');
    db.prepare('DELETE FROM company_pdfs WHERE company_id = ?').run(id);
    db.prepare('DELETE FROM companies WHERE id = ?').run(id);
    return { ok: true, id };
  }

  /* ---------- Fichiers PDF et assignations ---------- */

  function listPdfFiles(companyId) {
    if (companyId) {
      return db.prepare(`
        SELECT pf.* FROM pdf_files pf
        INNER JOIN company_pdfs cp ON cp.pdf_id = pf.id
        WHERE cp.company_id = ?
        ORDER BY pf.name
      `).all(companyId);
    }
    return db.prepare('SELECT * FROM pdf_files ORDER BY name').all();
  }

  /** Supprime le fichier sur le disque, ses assignations et sa fiche. */
  function deletePdfFile(id) {
    const existing = db.prepare('SELECT * FROM pdf_files WHERE id = ?').get(id);
    if (!existing) fail(404, 'pdf_not_found', 'Fichier non trouvé');
    const filePath = path.join(uploadsDir, path.basename(existing.filename));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM company_pdfs WHERE pdf_id = ?').run(id);
    db.prepare('DELETE FROM pdf_files WHERE id = ?').run(id);
    return { ok: true, id };
  }

  function listAssignments() {
    return db.prepare('SELECT company_id, pdf_id FROM company_pdfs').all();
  }

  function assignPdf(companyId, pdfId) {
    if (!companyId || !pdfId) fail(400, 'assignment_required', 'company_id et pdf_id requis');
    db.prepare('INSERT OR IGNORE INTO company_pdfs (company_id, pdf_id) VALUES (?, ?)').run(companyId, pdfId);
    return { ok: true };
  }

  function unassignPdf(companyId, pdfId) {
    db.prepare('DELETE FROM company_pdfs WHERE company_id = ? AND pdf_id = ?').run(companyId, pdfId);
    return { ok: true };
  }

  /* ---------- Fiche de paie interactive ---------- */

  function listZones() {
    return db.prepare(`${ZONE_SELECT} ORDER BY pz.created_at ASC`).all();
  }

  function createZone(body = {}) {
    const { document_id, x, y, width, height } = body;
    if (!document_id) fail(400, 'zone_document_required', 'document_id requis');
    const id = uuidv4();
    db.prepare('INSERT INTO payslip_zones (id, document_id, x, y, width, height) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, document_id, Number(x), Number(y), Number(width), Number(height));
    return db.prepare(`${ZONE_SELECT} WHERE pz.id = ?`).get(id);
  }

  /** Mise à jour partielle : un champ absent garde sa valeur. */
  function updateZone(id, body = {}) {
    const existing = db.prepare('SELECT * FROM payslip_zones WHERE id = ?').get(id);
    if (!existing) fail(404, 'zone_not_found', 'Zone non trouvée');
    const { document_id, x, y, width, height } = body;
    db.prepare('UPDATE payslip_zones SET document_id = ?, x = ?, y = ?, width = ?, height = ? WHERE id = ?')
      .run(
        document_id ?? existing.document_id,
        x !== undefined ? Number(x) : existing.x,
        y !== undefined ? Number(y) : existing.y,
        width !== undefined ? Number(width) : existing.width,
        height !== undefined ? Number(height) : existing.height,
        id
      );
    return db.prepare(`${ZONE_SELECT} WHERE pz.id = ?`).get(id);
  }

  function deleteZone(id) {
    const existing = db.prepare('SELECT * FROM payslip_zones WHERE id = ?').get(id);
    if (!existing) fail(404, 'zone_not_found', 'Zone non trouvée');
    db.prepare('DELETE FROM payslip_zones WHERE id = ?').run(id);
    return { ok: true, id };
  }

  function payslipModelImage() {
    return db.prepare("SELECT value FROM payslip_settings WHERE key = 'model_image_path'").get()?.value || null;
  }

  /* ---------- Réglages (IA, voix, apparence des vidéos) ---------- */

  /** Valeurs des réglages, clés d'API masquées (4 derniers caractères seulement). */
  function readMaskedSettings() {
    const result = {};
    for (const key of SETTINGS_KEYS) {
      const val = getSetting(key);
      result[key] = val
        ? (isSecretSetting(key) ? '***' + val.slice(-4) : val)
        : '';
      // La valeur vient-elle des variables d'environnement (non modifiable en base) ?
      result[`${key}__fromEnv`] = Boolean(process.env[key]);
    }
    return result;
  }

  /** Enregistre les réglages connus. Valeur vide ou encore masquée (« *** ») : inchangée. */
  function saveSettings(values = {}) {
    for (const [key, value] of Object.entries(values)) {
      if (SETTINGS_KEYS.includes(key) && value && !String(value).startsWith('***')) {
        setSetting(key, String(value));
      }
    }
    return { success: true };
  }

  /* ---------- Vidéos ---------- */

  function remotionStatus() {
    const installed = fs.existsSync(remotionDir);
    let version = null;
    if (installed) {
      try {
        version = JSON.parse(fs.readFileSync(path.join(remotionDir, 'package.json'), 'utf-8')).version;
      } catch {
        // package.json illisible, on ignore
      }
    }
    return { installed, version };
  }

  function watermarkStatus() {
    const exists = fs.existsSync(watermarkPath);
    return {
      exists,
      url: exists ? `/data/branding/watermark.png?t=${fs.statSync(watermarkPath).mtimeMs}` : null,
      position: getSetting('VIDEO_WATERMARK_POSITION') || 'bottom-right',
      size: getSetting('VIDEO_WATERMARK_SIZE') || 'medium',
    };
  }

  function deleteWatermark() {
    if (fs.existsSync(watermarkPath)) fs.unlinkSync(watermarkPath);
    return { ok: true };
  }

  /** Lignes de paie qui ont une vidéo publiée. */
  function listVideos() {
    const rows = db.prepare(
      "SELECT id, title, video_url FROM documents WHERE video_url IS NOT NULL AND video_url != '' ORDER BY title ASC"
    ).all();
    return rows.map(r => ({ documentId: r.id, title: r.title, videoUrl: r.video_url }));
  }

  /**
   * Dernière vidéo générée mais pas encore validée, ou null.
   * Oublie celle dont le fichier a disparu ou qui a été publiée entre-temps.
   */
  function getPendingVideo() {
    const raw = getSetting('VIDEO_PENDING');
    if (!raw) return null;
    let p;
    try { p = JSON.parse(raw); } catch { delSetting('VIDEO_PENDING'); return null; }
    const base = path.basename(p.videoUrl || '');
    if (!base || !fs.existsSync(path.join(videosDir, base))) {
      delSetting('VIDEO_PENDING');
      return null;
    }
    const published = db.prepare('SELECT id FROM documents WHERE video_url = ?').get(`/data/videos/${base}`);
    if (published) { delSetting('VIDEO_PENDING'); return null; }
    return { documentId: p.documentId, title: p.title, videoUrl: `/data/videos/${base}`, createdAt: p.createdAt || null };
  }

  /** Publie une vidéo de data/videos sur la ligne de paie. */
  function publishVideo(documentId, videoUrl) {
    const doc = getDoc(documentId);
    if (!doc) fail(404, 'document_not_found', 'Document introuvable');
    if (!videoUrl || typeof videoUrl !== 'string') fail(400, 'video_url_required', 'videoUrl requis');

    // Sécurité : n'accepter qu'un fichier réellement présent dans data/videos (anti path-traversal)
    const base = path.basename(videoUrl);
    if (!fs.existsSync(path.join(videosDir, base))) fail(404, 'video_file_not_found', 'Fichier vidéo introuvable');

    const safeUrl = `/data/videos/${base}`;
    db.prepare('UPDATE documents SET video_url = ? WHERE id = ?').run(safeUrl, doc.id);
    // La vidéo en attente vient d'être publiée -> on l'oublie
    const pendingRaw = getSetting('VIDEO_PENDING');
    if (pendingRaw) {
      try { if (JSON.parse(pendingRaw).documentId === doc.id) delSetting('VIDEO_PENDING'); } catch { /* ignore */ }
    }
    return { ok: true, videoUrl: safeUrl };
  }

  /** Rejette (supprime) une vidéo générée mais pas publiée. */
  function discardVideo(videoUrl) {
    if (!videoUrl || typeof videoUrl !== 'string') fail(400, 'video_url_required', 'videoUrl requis');
    const base = path.basename(videoUrl);
    // Ne pas supprimer un fichier encore référencé par un document publié
    const used = db.prepare('SELECT id FROM documents WHERE video_url = ?').get(`/data/videos/${base}`);
    if (used) fail(409, 'video_published', 'Vidéo publiée : utilisez la suppression depuis la liste.');
    const filePath = path.join(videosDir, base);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    // Si c'était la vidéo en attente, on l'oublie
    const pendingRaw = getSetting('VIDEO_PENDING');
    if (pendingRaw) {
      try { if (path.basename(JSON.parse(pendingRaw).videoUrl || '') === base) delSetting('VIDEO_PENDING'); } catch { /* ignore */ }
    }
    return { ok: true };
  }

  /** Supprime la vidéo publiée d'une ligne de paie (fichier compris). */
  function deleteVideo(documentId) {
    const doc = getDoc(documentId);
    if (!doc) fail(404, 'document_not_found', 'Document introuvable');
    if (doc.video_url) {
      const filePath = path.join(videosDir, path.basename(doc.video_url));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.prepare('UPDATE documents SET video_url = NULL WHERE id = ?').run(doc.id);
    return { ok: true, id: doc.id };
  }

  return {
    listDocuments, getDocument, createDocument, updateDocument, deleteDocument,
    listCategories, categoryUsage, createCategory, renameCategory, deleteCategory,
    listCompanies, createCompany, renameCompany, deleteCompany,
    listPdfFiles, deletePdfFile, listAssignments, assignPdf, unassignPdf,
    listZones, createZone, updateZone, deleteZone, payslipModelImage,
    readMaskedSettings, saveSettings,
    remotionStatus, watermarkStatus, deleteWatermark,
    listVideos, getPendingVideo, publishVideo, discardVideo, deleteVideo,
  };
}

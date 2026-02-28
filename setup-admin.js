import 'dotenv/config';
import { createInterface } from 'readline';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'cleardoc.db');

if (!fs.existsSync(DATA_DIR)) {
  console.error('Le dossier data/ n\'existe pas. Lancez d\'abord le serveur une fois: npm run server');
  process.exit(1);
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

async function main() {
  console.log('=== Création du compte administrateur ClearDoc ===\n');

  const existing = db.prepare('SELECT COUNT(*) as count FROM admin_users').get();
  if (existing.count > 0) {
    const answer = await question('Un compte admin existe déjà. Voulez-vous le remplacer ? (oui/non) : ');
    if (answer.toLowerCase() !== 'oui') {
      console.log('Annulé.');
      rl.close();
      return;
    }
  }

  const username = await question('Identifiant admin : ');
  if (!username.trim()) {
    console.error('L\'identifiant ne peut pas être vide.');
    rl.close();
    process.exit(1);
  }

  const password = await question('Mot de passe (min. 8 caractères) : ');
  if (!password.trim() || password.length < 8) {
    console.error('Le mot de passe doit faire au moins 8 caractères.');
    rl.close();
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(password.trim(), 12);
    db.prepare('DELETE FROM admin_users').run();
    db.prepare('INSERT INTO admin_users (id, username, password_hash) VALUES (?, ?, ?)')
      .run(uuidv4(), username.trim(), hash);

    console.log(`\nCompte admin "${username.trim()}" créé avec succès.`);
    console.log('Lancez le serveur avec: npm run server');
  } catch (err) {
    console.error('Erreur:', err.message);
    process.exit(1);
  }

  rl.close();
}

main();

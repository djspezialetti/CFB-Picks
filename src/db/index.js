const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'picks.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema on every boot (idempotent - uses IF NOT EXISTS everywhere)
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// --- Lightweight migrations -------------------------------------------
// CREATE TABLE IF NOT EXISTS in schema.sql won't add new columns to a
// table that already exists (e.g. on an already-deployed database), so
// new columns get added here instead. Safe to run on every boot.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('games', 'home_logo', 'TEXT');
ensureColumn('games', 'away_logo', 'TEXT');
ensureColumn('games', 'conference', 'TEXT');
ensureColumn('games', 'home_record', 'TEXT');
ensureColumn('games', 'away_record', 'TEXT');
ensureColumn('games', 'home_conf_record', 'TEXT');
ensureColumn('games', 'away_conf_record', 'TEXT');
ensureColumn('games', 'spread', 'TEXT');
ensureColumn('games', 'location', 'TEXT');
ensureColumn('games', 'is_neutral_site', "INTEGER NOT NULL DEFAULT 0");
ensureColumn('games', 'home_rank', 'INTEGER');
ensureColumn('games', 'away_rank', 'INTEGER');

module.exports = db;

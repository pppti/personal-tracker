const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    category TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    deadline TEXT,
    priority TEXT DEFAULT 'medium',
    progress INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS progress_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL,
    progress INTEGER DEFAULT 0,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    remind_at TEXT NOT NULL,
    notified INTEGER DEFAULT 0,
    entry_id INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE SET NULL
  );
`);

// Auto-migrate: add columns if they don't exist (safe to run multiple times)
try { db.exec('ALTER TABLE entries ADD COLUMN deadline TEXT'); } catch {}
try { db.exec('ALTER TABLE entries ADD COLUMN priority TEXT DEFAULT \'medium\''); } catch {}
try { db.exec('ALTER TABLE entries ADD COLUMN progress INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE reminders ADD COLUMN entry_id INTEGER'); } catch {}

module.exports = db;

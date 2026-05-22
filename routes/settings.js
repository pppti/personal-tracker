const express = require('express');
const router = express.Router();
const db = require('../db');
const { getNtfyConfig } = require('../notify');

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const map = {};
  for (const r of rows) {
    if (r.key !== 'password_hash') map[r.key] = r.value;
  }
  const ntfy = getNtfyConfig();
  map.ntfy_server = ntfy.server;
  map.ntfy_topic = ntfy.topic;
  res.json(map);
});

router.put('/', (req, res) => {
  const allowed = ['ntfy_server', 'ntfy_topic', 'deepseek_key', 'deepseek_model'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)').run(key, req.body[key]);
    }
  }
  res.json({ ok: true });
});

router.get('/export', (_req, res) => {
  const entries = db.prepare('SELECT * FROM entries ORDER BY created_at DESC').all();
  const reminders = db.prepare('SELECT * FROM reminders ORDER BY remind_at DESC').all();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="backup.json"');
  res.json({ exported_at: new Date().toISOString(), entries, reminders });
});

module.exports = router;

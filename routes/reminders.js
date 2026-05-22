const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendNotification } = require('../notify');

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM reminders ORDER BY remind_at DESC').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { message, remind_at } = req.body;
  if (!message || !remind_at) return res.status(400).json({ error: 'Message and remind_at required' });
  const result = db.prepare(
    'INSERT INTO reminders (message, remind_at) VALUES (?,?)'
  ).run(message, remind_at);
  const row = db.prepare('SELECT * FROM reminders WHERE id = ?').get(result.lastInsertRowid);
  sendNotification('新提醒已创建', `${row.message}（${row.remind_at}）`);
  res.status(201).json(row);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM reminders WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;

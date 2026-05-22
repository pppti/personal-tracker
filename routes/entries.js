const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendNotification } = require('../notify');

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM entries ORDER BY created_at DESC').all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { title, content, status, category, tags } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const result = db.prepare(
    'INSERT INTO entries (title, content, status, category, tags, created_at, updated_at) VALUES (?,?,?,?,?,?,?)'
  ).run(title, content || '', status || 'pending', category || '', JSON.stringify(tags || []), now, now);
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(result.lastInsertRowid);
  sendNotification('新记录已创建', `[${row.status}] ${row.title}（${row.category || '未分类'}）`);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { title, content, status, category, tags } = req.body;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  db.prepare(
    'UPDATE entries SET title=?, content=?, status=?, category=?, tags=?, updated_at=? WHERE id=?'
  ).run(
    title ?? existing.title,
    content ?? existing.content,
    status ?? existing.status,
    category ?? existing.category,
    tags !== undefined ? JSON.stringify(tags) : existing.tags,
    now,
    req.params.id
  );
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;

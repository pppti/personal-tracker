const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM workflows ORDER BY created_at DESC').all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const wf = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Not found' });
  wf.steps = JSON.parse(wf.steps || '[]');
  res.json(wf);
});

router.post('/', (req, res) => {
  const { name, description, category, steps } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const result = db.prepare(
    'INSERT INTO workflows (name, description, category, steps) VALUES (?,?,?,?)'
  ).run(name, description || '', category || '', JSON.stringify(steps || []));
  const wf = db.prepare('SELECT * FROM workflows WHERE id = ?').get(result.lastInsertRowid);
  wf.steps = JSON.parse(wf.steps || '[]');
  res.status(201).json(wf);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, description, category, steps } = req.body;
  db.prepare('UPDATE workflows SET name=?, description=?, category=?, steps=? WHERE id=?')
    .run(name ?? existing.name, description ?? existing.description,
      category ?? existing.category,
      steps !== undefined ? JSON.stringify(steps) : existing.steps, req.params.id);
  const wf = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  wf.steps = JSON.parse(wf.steps || '[]');
  res.json(wf);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM workflows WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Start a workflow - creates main entry + sub-entries for each step
router.post('/:id/start', (req, res) => {
  const wf = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });
  const steps = JSON.parse(wf.steps || '[]');
  const { deadline } = req.body;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const mainResult = db.prepare(
    'INSERT INTO entries (title, content, status, category, deadline, priority, progress, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(wf.name, wf.description || '', 'in_progress', wf.category || '', deadline || null, 'high', 0, now, now);
  const mainEntry = db.prepare('SELECT * FROM entries WHERE id = ?').get(mainResult.lastInsertRowid);

  const subEntries = [];
  for (let i = 0; i < steps.length; i++) {
    const subResult = db.prepare(
      'INSERT INTO entries (title, content, status, category, deadline, priority, parent_id, progress, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(steps[i], '', 'pending', wf.category || '', deadline || null, 'medium', mainEntry.id, 0, now, now);
    subEntries.push(db.prepare('SELECT * FROM entries WHERE id = ?').get(subResult.lastInsertRowid));
  }

  res.status(201).json({ mainEntry, subEntries, totalSteps: steps.length });
});

// Get sub-entries for a parent
router.get('/subs/:parentId', (req, res) => {
  const subs = db.prepare(
    'SELECT * FROM entries WHERE parent_id = ? ORDER BY id ASC'
  ).all(req.params.parentId);
  res.json(subs);
});

module.exports = router;

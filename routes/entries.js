const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendNotification } = require('../notify');

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM entries ORDER BY created_at DESC').all();
  res.json(rows);
});

router.get('/today', (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.prepare(
    `SELECT * FROM entries
     WHERE (deadline <= ? OR status IN ('pending','in_progress'))
       AND status != 'done'
     ORDER BY
       CASE priority
         WHEN 'urgent' THEN 0
         WHEN 'high' THEN 1
         WHEN 'medium' THEN 2
         WHEN 'low' THEN 3
         ELSE 4
       END,
       deadline ASC,
       created_at DESC`
  ).all(today + ' 23:59:59');
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const logs = db.prepare('SELECT * FROM progress_log WHERE entry_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ ...row, progressLogs: logs });
});

router.post('/', (req, res) => {
  const { title, content, status, category, tags, deadline, priority, progress } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const result = db.prepare(
    `INSERT INTO entries (title, content, status, category, tags, deadline, priority, progress, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(title, content || '', status || 'pending', category || '', JSON.stringify(tags || []),
    deadline || null, priority || 'medium', progress || 0, now, now);
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(result.lastInsertRowid);

  if (progress > 0) {
    db.prepare('INSERT INTO progress_log (entry_id, progress, note) VALUES (?,?,?)')
      .run(row.id, progress, '初始进度');
  }

  sendNotification('新记录已创建', `[${row.status}] ${row.title}（${row.category || '未分类'}）${row.deadline ? ' 截止：' + row.deadline : ''}`);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { title, content, status, category, tags, deadline, priority, progress } = req.body;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  db.prepare(
    `UPDATE entries SET title=?, content=?, status=?, category=?, tags=?, deadline=?, priority=?, progress=?, updated_at=?
     WHERE id=?`
  ).run(
    title ?? existing.title,
    content ?? existing.content,
    status ?? existing.status,
    category ?? existing.category,
    tags !== undefined ? JSON.stringify(tags) : existing.tags,
    deadline !== undefined ? (deadline || null) : existing.deadline,
    priority !== undefined ? priority : existing.priority,
    progress !== undefined ? progress : existing.progress,
    now,
    req.params.id
  );

  // Cascade: if parent marked done, complete all sub-entries too
  if (status === 'done' && status !== existing.status) {
    db.prepare('UPDATE entries SET status = ?, progress = 100, updated_at = ? WHERE parent_id = ? AND status != ?')
      .run('done', now, req.params.id, 'done');
  }

  // Cascade: if sub-entry marked done, check if all subs done → complete parent
  if (status === 'done' && existing.parent_id) {
    const remaining = db.prepare(
      'SELECT COUNT(*) as cnt FROM entries WHERE parent_id = ? AND status != ? AND id != ?'
    ).get(existing.parent_id, 'done', req.params.id);
    if (remaining.cnt === 0) {
      db.prepare('UPDATE entries SET status = ?, progress = 100, updated_at = ? WHERE id = ?')
        .run('done', now, existing.parent_id);
    }
  }

  // Log progress change
  if (progress !== undefined && progress !== existing.progress) {
    const oldProgress = existing.progress || 0;
    const note = status === 'done' ? '已完成' : `进度 ${oldProgress}% → ${progress}%`;
    db.prepare('INSERT INTO progress_log (entry_id, progress, note) VALUES (?,?,?)')
      .run(req.params.id, progress, note);
  }

  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Progress log for an entry
router.get('/:id/logs', (req, res) => {
  const logs = db.prepare(
    'SELECT * FROM progress_log WHERE entry_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);
  res.json(logs);
});

router.post('/:id/logs', (req, res) => {
  const { progress, note } = req.body;
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const result = db.prepare(
    'INSERT INTO progress_log (entry_id, progress, note) VALUES (?,?,?)'
  ).run(req.params.id, progress || 0, note || '');
  if (progress !== undefined) {
    db.prepare('UPDATE entries SET progress = ?, updated_at = ? WHERE id = ?')
      .run(progress, new Date().toISOString().replace('T', ' ').slice(0, 19), req.params.id);
  }
  const log = db.prepare('SELECT * FROM progress_log WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(log);
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendNotification } = require('../notify');

router.get('/', (_req, res) => {
  // Only show top-level entries (no sub-steps cluttering the list)
  const rows = db.prepare('SELECT * FROM entries WHERE parent_id IS NULL ORDER BY created_at DESC').all();
  res.json(rows);
});

router.get('/today', (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  // Get entries but exclude sub-steps (parent_id != null) - only show top-level
  const rows = db.prepare(
    `SELECT * FROM entries
     WHERE parent_id IS NULL
       AND (deadline <= ? OR status IN ('pending','in_progress'))
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

// Get project with its steps
router.get('/project/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  const steps = db.prepare('SELECT * FROM entries WHERE parent_id = ? ORDER BY id ASC').all(req.params.id);
  for (const s of steps) {
    const logs = db.prepare('SELECT * FROM progress_log WHERE entry_id = ? ORDER BY created_at DESC LIMIT 20').all(s.id);
    s.logs = logs;
  }
  res.json({ project, steps });
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

// Helper: recalculate parent progress from sub-steps
function recalcParent(parentId) {
  const subs = db.prepare('SELECT status FROM entries WHERE parent_id = ?').all(parentId);
  if (subs.length === 0) return;
  const done = subs.filter(s => s.status === 'done').length;
  const pct = Math.round(done / subs.length * 100);
  const newStatus = pct >= 100 ? 'done' : 'in_progress';
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  db.prepare('UPDATE entries SET progress = ?, status = ?, updated_at = ? WHERE id = ?')
    .run(pct, newStatus, now, parentId);
}

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  let { title, content, status, category, tags, deadline, priority, progress } = req.body;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Auto: mark done → progress 100
  if (status === 'done' && status !== existing.status) {
    progress = 100;
  }
  // Auto: if simple task (no sub-steps) marked done, progress must be 100
  if (status === 'done' && !existing.parent_id) {
    const hasSubs = db.prepare('SELECT COUNT(*) as cnt FROM entries WHERE parent_id = ?').get(req.params.id);
    if (!hasSubs || hasSubs.cnt === 0) {
      progress = 100;
    }
  }

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

  // Cascade: parent marked done → complete all sub-entries
  if (status === 'done' && status !== existing.status) {
    db.prepare('UPDATE entries SET status = ?, progress = 100, updated_at = ? WHERE parent_id = ? AND status != ?')
      .run('done', now, req.params.id, 'done');
  }

  // Auto-calc: if sub-entry changed, recalculate parent progress
  if (existing.parent_id) {
    recalcParent(existing.parent_id);
  }

  // If this entry has sub-entries, recalculate THIS progress from subs
  if (!existing.parent_id && (status !== undefined || progress !== undefined)) {
    const hasSubs = db.prepare('SELECT COUNT(*) as cnt FROM entries WHERE parent_id = ?').get(req.params.id);
    if (hasSubs && hasSubs.cnt > 0) {
      recalcParent(req.params.id);
    }
  }

  // Log progress change
  const finalProgress = progress !== undefined ? progress : existing.progress;
  if (finalProgress !== (existing.progress || 0)) {
    const note = status === 'done' ? '已完成' : `进度更新至 ${finalProgress}%`;
    db.prepare('INSERT INTO progress_log (entry_id, progress, note) VALUES (?,?,?)')
      .run(req.params.id, finalProgress, note);
  }

  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM entries WHERE parent_id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/batch-delete', (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  const stmt = db.prepare('DELETE FROM entries WHERE id = ?');
  const delSubs = db.prepare('DELETE FROM entries WHERE parent_id = ?');
  for (const id of ids) {
    delSubs.run(id);
    stmt.run(id);
  }
  res.json({ ok: true, deleted: ids.length });
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

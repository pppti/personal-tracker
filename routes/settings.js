const express = require('express');
const router = express.Router();
const db = require('../db');
const { getNtfyConfig, sendNotification } = require('../notify');

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

router.post('/test-push', async (req, res) => {
  try {
    const topic = req.body.topic;
    if (!topic) return res.status(400).json({ error: 'Topic required' });
    const server = req.body.server || process.env.NTFY_SERVER || 'https://ntfy.sh';
    const url = `${server.replace(/\/$/, '')}/${topic}`;
    const fetchRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '测试推送 - 如果你看到这条消息，说明推送配置正确！'
    });
    if (fetchRes.ok) {
      res.json({ ok: true, message: '推送已发送' });
    } else {
      const body = await fetchRes.text();
      res.status(500).json({ error: `ntfy 返回错误 ${fetchRes.status}: ${body}` });
    }
  } catch (err) {
    res.status(500).json({ error: `无法连接到推送服务器: ${err.message}` });
  }
});

router.get('/export', (_req, res) => {
  const entries = db.prepare('SELECT * FROM entries ORDER BY created_at DESC').all();
  const reminders = db.prepare('SELECT * FROM reminders ORDER BY remind_at DESC').all();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="backup.json"');
  res.json({ exported_at: new Date().toISOString(), entries, reminders });
});

module.exports = router;

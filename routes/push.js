const express = require('express');
const router = express.Router();
const db = require('../db');
const webpush = require('web-push');

function getVapidKeys() {
  let pub = db.prepare('SELECT value FROM settings WHERE key = ?').get('vapid_public');
  let prv = db.prepare('SELECT value FROM settings WHERE key = ?').get('vapid_private');

  if (!pub || !prv) {
    const keys = webpush.generateVAPIDKeys();
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)').run('vapid_public', keys.publicKey);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)').run('vapid_private', keys.privateKey);
    pub = { value: keys.publicKey };
    prv = { value: keys.privateKey };
  }

  return { publicKey: pub.value, privateKey: prv.value };
}

// Get public VAPID key (for frontend)
router.get('/vapid-public', (_req, res) => {
  const keys = getVapidKeys();
  res.json({ publicKey: keys.publicKey });
});

// Save a push subscription
router.post('/subscribe', (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'subscription required' });

  const subJson = JSON.stringify(subscription);
  const existing = db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?')
    .get(subscription.endpoint);

  if (existing) {
    db.prepare('UPDATE push_subscriptions SET subscription = ?, updated_at = ? WHERE id = ?')
      .run(subJson, new Date().toISOString(), existing.id);
  } else {
    db.prepare(
      'INSERT INTO push_subscriptions (subscription, created_at) VALUES (?, ?)'
    ).run(subJson, new Date().toISOString());
  }

  res.json({ ok: true });
});

// Send push to all subscriptions
async function sendPushToAll(title, body) {
  const keys = getVapidKeys();
  webpush.setVapidDetails(
    'mailto:tracker@personal.app',
    keys.publicKey,
    keys.privateKey
  );

  const subs = db.prepare('SELECT * FROM push_subscriptions').all();
  const payload = JSON.stringify({ title, body, icon: '/icon-192.png' });

  for (const sub of subs) {
    try {
      const parsed = JSON.parse(sub.subscription);
      await webpush.sendNotification(parsed, payload);
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      }
    }
  }
}

// Ensure push_subscriptions table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

module.exports = { router, sendPushToAll };

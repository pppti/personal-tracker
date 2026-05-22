const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_EXPIRY = '30d';

function getPasswordHash() {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get('password_hash');
}

function isSetup() {
  return !!getPasswordHash();
}

function setupRoutes(app) {
  app.post('/api/auth/status', (_req, res) => {
    res.json({ setup: isSetup() });
  });

  app.post('/api/auth/setup', (req, res) => {
    if (isSetup()) {
      return res.status(400).json({ error: 'Already set up' });
    }
    const { password } = req.body;
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('password_hash', hash);
    const token = jwt.sign({}, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.json({ token });
  });

  app.post('/api/auth/login', (req, res) => {
    const row = getPasswordHash();
    if (!row) {
      return res.status(400).json({ error: 'Not set up yet' });
    }
    const { password } = req.body;
    if (!bcrypt.compareSync(password, row.value)) {
      return res.status(401).json({ error: 'Wrong password' });
    }
    const token = jwt.sign({}, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.json({ token });
  });

  app.post('/api/auth/change-password', authMiddleware, (req, res) => {
    const { current, new: newPass } = req.body;
    const row = getPasswordHash();
    if (!bcrypt.compareSync(current, row.value)) {
      return res.status(401).json({ error: 'Current password incorrect' });
    }
    if (!newPass || newPass.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters' });
    }
    const hash = bcrypt.hashSync(newPass, 10);
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(hash, 'password_hash');
    res.json({ ok: true });
  });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
}

module.exports = { setupRoutes, authMiddleware, isSetup };

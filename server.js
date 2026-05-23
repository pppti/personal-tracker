require('dotenv').config();
const express = require('express');
const path = require('path');

// Handle uncaught errors gracefully
process.on('uncaughtException', (err) => { console.error('FATAL:', err.message); process.exit(1); });
process.on('unhandledRejection', (reason) => { console.error('REJECTION:', reason); });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check must work BEFORE auth
app.get('/health', (_req, res) => res.json({ ok: true }));

// Auth routes (no middleware needed for status/setup/login)
const { setupRoutes } = require('./auth');
setupRoutes(app);

// DB-dependent routes (loaded after health endpoint is ready)
const { authMiddleware } = require('./auth');
app.use('/api/entries', authMiddleware, require('./routes/entries'));
app.use('/api/reminders', authMiddleware, require('./routes/reminders'));
app.use('/api/summary', authMiddleware, require('./routes/summary'));
app.use('/api/settings', authMiddleware, require('./routes/settings'));
app.use('/api/deepseek', authMiddleware, require('./routes/deepseek'));
app.use('/api/workflows', authMiddleware, require('./routes/workflows'));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start scheduler
const { startScheduler } = require('./scheduler');
startScheduler();

function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
});

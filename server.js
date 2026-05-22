require('dotenv').config();
const express = require('express');
const path = require('path');
const { setupRoutes } = require('./auth');
const { authMiddleware } = require('./auth');
const { startScheduler } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

setupRoutes(app);

app.use('/api/entries', authMiddleware, require('./routes/entries'));
app.use('/api/reminders', authMiddleware, require('./routes/reminders'));
app.use('/api/summary', authMiddleware, require('./routes/summary'));
app.use('/api/settings', authMiddleware, require('./routes/settings'));
app.use('/api/deepseek', authMiddleware, require('./routes/deepseek'));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (_req, res) => res.json({ ok: true }));

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
  const ip = getLocalIP();
  console.log(`本地访问: http://localhost:${PORT}`);
  console.log(`局域网访问: http://${ip}:${PORT}`);
  console.log(`手机在同一WiFi下打开 http://${ip}:${PORT} 即可使用`);
});

const db = require('./db');

function getNtfyConfig() {
  const server = db.prepare('SELECT value FROM settings WHERE key = ?').get('ntfy_server');
  const topic = db.prepare('SELECT value FROM settings WHERE key = ?').get('ntfy_topic');
  return {
    server: (server && server.value) || process.env.NTFY_SERVER || 'https://ntfy.sh',
    topic: (topic && topic.value) || process.env.NTFY_TOPIC || ''
  };
}

async function sendNotification(title, message) {
  const { server, topic } = getNtfyConfig();
  if (!topic) {
    console.log('[notify] No ntfy topic configured, skipping:', title);
    return false;
  }
  const url = `${server.replace(/\/$/, '')}/${topic}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: `${title}\n${message}`
    });
    if (res.ok) {
      console.log('[notify] Sent:', title);
      return true;
    }
    console.error('[notify] Failed:', res.status, await res.text());
    return false;
  } catch (e) {
    console.error('[notify] Error:', e.message);
    return false;
  }
}

module.exports = { sendNotification, getNtfyConfig };

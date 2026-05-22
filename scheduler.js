const cron = require('node-cron');
const db = require('./db');
const { sendNotification } = require('./notify');

function startScheduler() {
  cron.schedule('* * * * *', () => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const due = db.prepare(
      'SELECT id, message, remind_at FROM reminders WHERE notified = 0 AND remind_at <= ?'
    ).all(now);

    for (const r of due) {
      sendNotification('Reminder', r.message)
        .then(() => {
          db.prepare('UPDATE reminders SET notified = 1 WHERE id = ?').run(r.id);
        })
        .catch(() => {});
    }
  });

  console.log('[scheduler] Reminder checker started (every minute)');
}

module.exports = { startScheduler };

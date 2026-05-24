const cron = require('node-cron');
const db = require('./db');
const { sendNotification } = require('./notify');
const { sendPushToAll } = require('./routes/push');

function getDailyTimes() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('daily_push_times');
  if (row && row.value) {
    try { return JSON.parse(row.value); } catch { return []; }
  }
  return [];
}

function buildDailyDigest() {
  const today = new Date().toISOString().slice(0, 10);
  const entries = db.prepare(
    `SELECT * FROM entries WHERE status != 'done'
     ORDER BY
       CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       deadline ASC`
  ).all();

  if (entries.length === 0) return null;

  const overdue = entries.filter(e => e.deadline && e.deadline < today);
  const dueToday = entries.filter(e => e.deadline === today);
  const inProgress = entries.filter(e => e.status === 'in_progress');
  const pending = entries.filter(e => e.status === 'pending');

  let msg = `今日待办 ${today}\n`;
  msg += `──────────────\n`;
  if (overdue.length) msg += `已过期 ${overdue.length} 项\n`;
  if (dueToday.length) msg += `今天截止 ${dueToday.length} 项\n`;
  msg += `进行中 ${inProgress.length} | 待处理 ${pending.length}\n\n`;

  const top = [...dueToday, ...overdue, ...inProgress.slice(0, 5)];
  for (const e of top) {
    const icon = e.priority === 'urgent' ? '❗' : e.priority === 'high' ? '🔴' : '📌';
    msg += `${icon} ${e.title}`;
    if (e.progress > 0 && e.status !== 'done') msg += ` (${e.progress}%)`;
    msg += '\n';
  }
  if (entries.length > top.length) msg += `...还有 ${entries.length - top.length} 项\n`;

  return msg;
}

function localTime(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return { date: `${y}-${mo}-${da}`, time: `${y}-${mo}-${da} ${h}:${mi}`, hm: `${h}:${mi}` };
}

function startScheduler() {
  let lastDailyPush = {};

  cron.schedule('* * * * *', () => {
    const now = localTime(new Date());

    // Reset daily push tracking at midnight
    if (lastDailyPush._date !== now.date) {
      lastDailyPush = { _date: now.date };
    }

    // 1. Check individual reminders
    const due = db.prepare(
      "SELECT id, message, remind_at FROM reminders WHERE notified = 0 AND REPLACE(REPLACE(remind_at,'T',' '),'Z','') <= ?"
    ).all(now.time);

    for (const r of due) {
      Promise.allSettled([
        sendNotification('提醒', r.message),
        sendPushToAll('提醒', r.message)
      ]).finally(() => {
        db.prepare('UPDATE reminders SET notified = 1 WHERE id = ?').run(r.id);
      });
    }

    // 2. Check daily digest times
    const dailyTimes = getDailyTimes();
    if (dailyTimes.includes(now.hm) && !lastDailyPush[now.hm]) {
      lastDailyPush[now.hm] = true;
      const digest = buildDailyDigest();
      if (digest) {
        Promise.allSettled([
          sendNotification('今日待办', digest),
          sendPushToAll('今日待办', digest)
        ]);
      }
    }

    // 3. Daily skincare backup at 20:00
    const backupKey = '20:00';
    if (now.hm === backupKey && !lastDailyPush[backupKey]) {
      lastDailyPush[backupKey] = true;
      try {
        const backup = {
          version: 1,
          exported_at: new Date().toISOString(),
          products: db.prepare('SELECT * FROM skincare_products').all(),
          talking_points: db.prepare('SELECT * FROM product_talking_points').all(),
          templates: db.prepare('SELECT * FROM script_templates').all(),
          hotspots: db.prepare('SELECT * FROM hot_topics').all(),
          knowledge: db.prepare('SELECT * FROM knowledge_materials').all(),
          scripts: db.prepare('SELECT * FROM skincare_scripts').all(),
          videos: db.prepare('SELECT * FROM video_records').all()
        };
        const json = JSON.stringify(backup);
        const exists = db.prepare('SELECT value FROM settings WHERE key = ?').get('skincare_backup');
        if (exists) {
          db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(json, 'skincare_backup');
        } else {
          db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('skincare_backup', json);
        }
        console.log('[scheduler] Skincare backup completed at 20:00, size:', Math.round(json.length / 1024) + 'KB');
      } catch (e) {
        console.error('[scheduler] Backup failed:', e.message);
      }
    }
  });

  console.log('[scheduler] Started - reminders + daily digest + skincare backup');
}

module.exports = { startScheduler };

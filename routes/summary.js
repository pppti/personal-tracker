const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/generate', (req, res) => {
  const { startDate, endDate } = req.body;
  let sql = 'SELECT * FROM entries WHERE 1=1';
  const params = [];

  if (startDate) {
    sql += ' AND created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND created_at <= ?';
    params.push(endDate + ' 23:59:59');
  }

  const entries = db.prepare(sql + ' ORDER BY created_at DESC').all(...params);

  const total = entries.length;
  const done = entries.filter(e => e.status === 'done').length;
  const inProgress = entries.filter(e => e.status === 'in_progress').length;
  const pending = entries.filter(e => e.status === 'pending').length;

  const byCategory = {};
  let totalProgress = 0;
  let progressCount = 0;

  for (const e of entries) {
    const cat = e.category || '未分类';
    if (!byCategory[cat]) byCategory[cat] = { total: 0, done: 0, in_progress: 0, pending: 0, avgProgress: 0 };
    byCategory[cat].total++;
    byCategory[cat][e.status] = (byCategory[cat][e.status] || 0) + 1;
    if (e.progress > 0) { totalProgress += e.progress; progressCount++; }
  }

  // Overdue items
  const today = new Date().toISOString().slice(0, 10);
  const overdue = entries.filter(e =>
    e.status !== 'done' && e.deadline && e.deadline < today
  );

  // Due today
  const dueToday = entries.filter(e =>
    e.status !== 'done' && e.deadline && e.deadline === today
  );

  res.json({
    period: { startDate, endDate },
    stats: {
      total, done, inProgress, pending,
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
      avgProgress: progressCount > 0 ? Math.round(totalProgress / progressCount) : 0,
      overdue: overdue.length,
      dueToday: dueToday.length
    },
    byCategory,
    overdue,
    dueToday,
    entries
  });
});

function statusLabel(s) {
  return s === 'done' ? '已完成' : s === 'in_progress' ? '进行中' : '待处理';
}

function priorityLabel(p) {
  const map = { urgent: '紧急', high: '高', medium: '中', low: '低' };
  return map[p] || '中';
}

router.post('/export', (req, res) => {
  const { startDate, endDate, format } = req.body;
  let sql = 'SELECT * FROM entries WHERE 1=1';
  const params = [];

  if (startDate) {
    sql += ' AND created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND created_at <= ?';
    params.push(endDate + ' 23:59:59');
  }

  const entries = db.prepare(sql + ' ORDER BY created_at DESC').all(...params);
  const total = entries.length;
  const done = entries.filter(e => e.status === 'done').length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  const text = buildTextSummary(entries, { startDate, endDate, total, done, rate });
  const md = buildMarkdownSummary(entries, { startDate, endDate, total, done, rate });

  if (format === 'md') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(md);
  } else if (format === 'txt') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  } else {
    res.json({ text, markdown: md });
  }
});

function buildTextSummary(entries, period) {
  let out = `工作汇总\n`;
  out += `========\n\n`;
  if (period.startDate || period.endDate) {
    out += `时间范围：${period.startDate || '...'} 至 ${period.endDate || '...'}\n\n`;
  }
  out += `总计：${period.total} | 已完成：${period.done} | 完成率：${period.rate}%\n\n`;
  out += `--- 详细记录 ---\n\n`;
  for (const e of entries) {
    out += `[${statusLabel(e.status)}] ${e.title}`;
    if (e.progress > 0 && e.status !== 'done') out += ` (${e.progress}%)`;
    if (e.deadline) out += ` 截止：${e.deadline}`;
    if (e.priority) out += ` 优先级：${priorityLabel(e.priority)}`;
    out += `\n`;
    if (e.content) out += `  ${e.content.replace(/\n/g, '\n  ')}\n`;
    if (e.category) out += `  分类：${e.category}\n`;
    out += `  日期：${e.created_at}\n\n`;
  }
  return out;
}

function buildMarkdownSummary(entries, period) {
  let out = `# 工作汇总\n\n`;
  if (period.startDate || period.endDate) {
    out += `**时间范围：**${period.startDate || '...'} 至 ${period.endDate || '...'}\n\n`;
  }
  out += `**总计：**${period.total} | **已完成：**${period.done} | **完成率：**${period.rate}%\n\n`;
  out += `## 详细记录\n\n`;
  for (const e of entries) {
    let flags = '';
    if (e.deadline) flags += ` 截止：${e.deadline}`;
    if (e.priority) flags += ` 优先级：${priorityLabel(e.priority)}`;
    if (e.progress > 0 && e.status !== 'done') flags += ` 进度：${e.progress}%`;
    out += `### [${statusLabel(e.status)}] ${e.title}${flags}\n`;
    if (e.content) out += `${e.content}\n\n`;
    if (e.category) out += `*分类：${e.category}* | `;
    out += `*日期：${e.created_at}*\n\n`;
  }
  return out;
}

module.exports = router;

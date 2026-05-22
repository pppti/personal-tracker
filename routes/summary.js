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
  for (const e of entries) {
    const cat = e.category || 'uncategorized';
    if (!byCategory[cat]) byCategory[cat] = { total: 0, done: 0, in_progress: 0, pending: 0 };
    byCategory[cat].total++;
    byCategory[cat][e.status] = (byCategory[cat][e.status] || 0) + 1;
  }

  res.json({
    period: { startDate, endDate },
    stats: { total, done, inProgress, pending, completionRate: total > 0 ? Math.round((done / total) * 100) : 0 },
    byCategory,
    entries
  });
});

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
    res.setHeader('Content-Type', 'text/markdown');
    res.send(md);
  } else if (format === 'txt') {
    res.setHeader('Content-Type', 'text/plain');
    res.send(text);
  } else {
    res.json({ text, markdown: md });
  }
});

function statusLabel(s) {
  return s === 'done' ? '已完成' : s === 'in_progress' ? '进行中' : '待处理';
}

function buildTextSummary(entries, period) {
  let out = `工作汇总\n`;
  out += `========\n\n`;
  if (period.startDate || period.endDate) {
    out += `时间范围：${period.startDate || '...'} 至 ${period.endDate || '...'}\n\n`;
  }
  out += `总计：${period.total} | 已完成：${period.done} | 完成率：${period.rate}%\n\n`;
  out += `--- 详细记录 ---\n\n`;
  for (const e of entries) {
    out += `[${statusLabel(e.status)}] ${e.title}\n`;
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
    out += `### [${statusLabel(e.status)}] ${e.title}\n`;
    if (e.content) out += `${e.content}\n\n`;
    if (e.category) out += `*分类：${e.category}* | `;
    out += `*日期：${e.created_at}*\n\n`;
  }
  return out;
}

module.exports = router;

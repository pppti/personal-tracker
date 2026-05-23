const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendNotification } = require('../notify');

function getDeepSeekConfig() {
  const key = db.prepare('SELECT value FROM settings WHERE key = ?').get('deepseek_key');
  const model = db.prepare('SELECT value FROM settings WHERE key = ?').get('deepseek_model');
  return {
    apiKey: (key && key.value) || process.env.DEEPSEEK_KEY || '',
    model: (model && model.value) || 'deepseek-chat',
    baseUrl: process.env.DEEPSEEK_BASE || 'https://api.deepseek.com/v1'
  };
}

async function chat(messages, tools) {
  const config = getDeepSeekConfig();
  if (!config.apiKey) throw new Error('请先在设置中配置 DeepSeek API Key');

  const body = {
    model: config.model,
    messages,
    temperature: 0.7,
    max_tokens: 2048
  };
  if (tools) body.tools = tools;

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API 错误: ${res.status}`);
  }
  return res.json();
}

function statusCN(s) {
  return s === 'done' ? '已完成' : s === 'in_progress' ? '进行中' : '待处理';
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_entry',
      description: '创建一条新的工作记录。当用户描述了完成的工作、正在做的事情或计划时使用。自动推断截止日期、优先级和进度。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '工作标题，简洁明了' },
          content: { type: 'string', description: '详细内容，可为空' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'done'], description: '状态：pending=待处理, in_progress=进行中, done=已完成' },
          category: { type: 'string', description: '分类，根据内容自动推断，如：工作、个人、学习、健康、会议等' },
          deadline: { type: 'string', description: '截止日期，格式 YYYY-MM-DD。如果用户提到具体时间节点、截止日期、deadline等，必须填写此字段' },
          priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'], description: '优先级。根据deadline自动判断：已过期或今天→urgent，3天内→high，7天内→medium，其他→low' },
          progress: { type: 'integer', description: '进度百分比 0-100。已完成=100，刚开始=5-10，有一定进展=30-60' }
        },
        required: ['title', 'status']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_reminder',
      description: '设置一个提醒闹钟。当用户提到某个时间要做某事时使用。',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: '提醒内容' },
          remind_at: { type: 'string', description: '提醒时间，格式 YYYY-MM-DDTHH:mm，如 2026-05-23T15:00' }
        },
        required: ['message', 'remind_at']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_workflow',
      description: '创建一个工作流程模板。当用户描述了一个工作流程、SOP、或者想让AI梳理一套工作步骤时使用。根据用户的描述梳理出结构化的步骤列表。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '流程名称，简洁概括' },
          description: { type: 'string', description: '流程描述，说明这个流程的用途' },
          category: { type: 'string', description: '分类，如：工作、个人、学习、开发、运维等' },
          steps: { type: 'array', items: { type: 'string' }, description: '步骤列表，每步要具体可执行，5-8步为佳。如["接到需求", "分析可行性", "设计方案", "开发实现", "测试验证", "上线发布", "复盘总结"]' }
        },
        required: ['name', 'steps']
      }
    }
  }
];

function executeToolCall(name, args) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  if (name === 'create_entry') {
    const deadline = args.deadline || null;
    const priority = args.priority || 'medium';
    const progress = typeof args.progress === 'number' ? args.progress : (args.status === 'done' ? 100 : 0);
    const result = db.prepare(
      'INSERT INTO entries (title, content, status, category, tags, deadline, priority, progress, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(args.title, args.content || '', args.status || 'pending', args.category || '', '[]', deadline, priority, progress, now, now);
    const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(result.lastInsertRowid);
    if (progress > 0) {
      db.prepare('INSERT INTO progress_log (entry_id, progress, note) VALUES (?,?,?)').run(row.id, progress, 'AI 自动记录');
    }
    sendNotification('AI 已创建记录', `[${row.status}] ${row.title}（${row.category || '未分类'}）${deadline ? ' 截止：' + deadline : ''} 优先级：${priority}`);
    return { action: 'create_entry', entry: row };
  }
  if (name === 'set_reminder') {
    const result = db.prepare(
      'INSERT INTO reminders (message, remind_at) VALUES (?,?)'
    ).run(args.message, args.remind_at);
    const row = db.prepare('SELECT * FROM reminders WHERE id = ?').get(result.lastInsertRowid);
    sendNotification('AI 已设置提醒', `${row.message}（${row.remind_at}）`);
    return { action: 'set_reminder', reminder: row };
  }
  if (name === 'create_workflow') {
    const result = db.prepare(
      'INSERT INTO workflows (name, description, category, steps) VALUES (?,?,?,?)'
    ).run(args.name, args.description || '', args.category || '', JSON.stringify(args.steps || []));
    const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(result.lastInsertRowid);
    sendNotification('AI 已创建流程模板', `${row.name}（${args.steps.length}个步骤）`);
    return { action: 'create_workflow', workflow: row };
  }
  return { action: 'unknown' };
}

router.post('/ai-summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    let sql = 'SELECT * FROM entries WHERE 1=1';
    const params = [];
    if (startDate) { sql += ' AND created_at >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59'); }

    const entries = db.prepare(sql + ' ORDER BY created_at DESC').all(...params);

    if (entries.length === 0) {
      return res.json({ summary: '该时间段内暂无工作记录。' });
    }

    const entriesText = entries.map(e =>
      `- [${statusCN(e.status)}] ${e.title}${e.content ? '：' + e.content : ''}（分类：${e.category || '未分类'}）`
    ).join('\n');

    const data = await chat([
      { role: 'system', content: '你是一个贴心的工作助手。请用中文简洁有力地总结用户的工作记录，突出关键成果、工作模式，并提出改进建议。' },
      { role: 'user', content: `以下是我这段时间的工作记录：\n\n${entriesText}\n\n请提供：\n1. 总体概括（2-3句话）\n2. 关键成果\n3. 工作模式或趋势\n4. 改进建议或关注方向` }
    ]);

    res.json({ summary: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { question } = req.body;

    const entries = db.prepare('SELECT * FROM entries ORDER BY created_at DESC LIMIT 50').all();
    const entriesText = entries.map(e =>
      `[${e.id}] [${statusCN(e.status)}] ${e.title}：${e.content || ''}（分类：${e.category || '未分类'}，日期：${e.created_at}）`
    ).join('\n');

    const data = await chat([
      { role: 'system', content: '你是一个贴心的工作助手。基于用户的工作记录回答问题，尽量具体引用记录内容，保持回答简洁。用中文回复。' },
      { role: 'user', content: `我的工作记录：\n\n${entriesText}\n\n问题：${question}` }
    ]);

    res.json({ answer: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/chat/action', async (req, res) => {
  try {
    const { message: userMessage } = req.body;

    const entries = db.prepare('SELECT * FROM entries ORDER BY created_at DESC LIMIT 30').all();
    const reminders = db.prepare('SELECT * FROM reminders ORDER BY remind_at DESC LIMIT 20').all();
    const now = new Date();
    const nowStr = now.toISOString().replace('T', ' ').slice(0, 16);
    const todayStr = now.toISOString().slice(0, 10);

    const context = `当前时间：${nowStr}\n今天日期：${todayStr}\n\n现有工作记录：\n${entries.map(e => `- [${statusCN(e.status)}] ${e.title}（分类：${e.category || '未分类'}）`).join('\n') || '无'}\n\n现有提醒：\n${reminders.map(r => `- ${r.message}（${r.remind_at}${r.notified ? '，已通知' : ''}）`).join('\n') || '无'}`;

    const data = await chat([
      {
        role: 'system',
        content: `你是一个智能工作助手。你可以帮用户：
1. 创建/管理工作记录（create_entry）——自动推断分类、截止日期(deadline)、优先级(priority)、进度(progress)
2. 设置提醒闹钟（set_reminder）——自动解析时间
3. 创建流程模板（create_workflow）——用户描述工作流程后，梳理成结构化的步骤模板
4. 查询和总结工作

重要规则：
- 用户说"帮我梳理XX流程""帮我创建XX模板""XX的标准步骤是什么"时，调用create_workflow创建流程模板
- 流程步骤要具体可执行，5-8步为佳，按实际工作顺序排列
- 用户提到截止日期/deadline/DDL时，必须设置deadline字段
- 根据deadline自动判断优先级：已过期或今天→urgent，3天内→high，7天内→medium，其他→low
- 用户说"今天要做/需要跟进/别忘了"这类时，设置deadline为今天
- 每次回复最多进行3个操作
- 操作完成后用简短中文告诉用户做了什么`
      },
      { role: 'user', content: `${context}\n\n用户说：${userMessage}` }
    ], TOOLS);

    const msg = data.choices[0].message;
    const actions = [];

    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        const args = JSON.parse(tc.function.arguments);
        const result = executeToolCall(tc.function.name, args);
        actions.push(result);
      }

      const followup = await chat([
        ...data.choices[0].message.messages || [
          { role: 'system', content: '你是一个智能工作助手。用简短的中文告诉用户你完成了什么操作。' },
          { role: 'user', content: userMessage },
          { role: 'assistant', content: '', tool_calls: msg.tool_calls },
          { role: 'tool', content: actions.map(a => JSON.stringify(a)).join('\n'), tool_call_id: msg.tool_calls[0].id }
        ],
        { role: 'user', content: '请用一句话告诉我你做了什么。' }
      ]);

      res.json({
        reply: followup.choices[0].message.content,
        actions
      });
    } else {
      res.json({
        reply: msg.content,
        actions: []
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Retrospective: analyze a completed entry and generate lessons learned
router.post('/retrospective', async (req, res) => {
  try {
    const { entryId } = req.body;
    const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(entryId);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    const logs = db.prepare('SELECT * FROM progress_log WHERE entry_id = ? ORDER BY created_at ASC').all(entryId);

    const logsText = logs.map(l => `- ${l.note || '进度 ' + l.progress + '%'} (${l.created_at})`).join('\n');
    const data = await chat([
      { role: 'system', content: '你是一个工作复盘专家。请用中文对用户完成的工作进行复盘分析，提炼经验教训和可复用的流程。' },
      { role: 'user', content: `请对以下完成的工作进行复盘：\n\n标题：${entry.title}\n内容：${entry.content || ''}\n分类：${entry.category || ''}\n进度记录：\n${logsText || '无'}\n\n请提供：\n1. 完成情况总结\n2. 做得好的地方\n3. 可以改进的地方\n4. 提炼出的经验/教训\n5. 如果下次做类似的事，建议的步骤流程（可以作为模板）` }
    ]);
    res.json({ retrospective: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Generate Workflow from completed entries
router.post('/generate-workflow', async (req, res) => {
  try {
    const { category } = req.body;
    let sql = 'SELECT * FROM entries WHERE status = ?';
    const params = ['done'];
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    const entries = db.prepare(sql + ' ORDER BY created_at DESC LIMIT 20').all();

    if (entries.length === 0) {
      return res.json({ workflow: null, message: '没有已完成的任务可供分析' });
    }

    const entriesText = entries.map(e =>
      `- ${e.title}：${e.content || ''}（分类：${e.category || ''}，进度：${e.progress || 0}%）`
    ).join('\n');

    const data = await chat([
      { role: 'system', content: '你是一个工作流程专家。分析用户已完成的任务，提取共性，创建一个可复用的工作流程模板。输出JSON格式。' },
      { role: 'user', content: `以下是我已完成的任务：\n\n${entriesText}\n\n请分析这些任务的共性，生成一个工作流程模板。返回JSON：\n{\n  "name": "流程名称",\n  "description": "流程描述",\n  "category": "分类",\n  "steps": ["步骤1", "步骤2", "步骤3", ...]\n}\n\n只输出JSON，不要加其他文字。步骤要具体、可执行，5-8步为佳。` }
    ]);

    // Try to parse JSON from the response
    let workflow;
    try {
      const text = data.choices[0].message.content;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        workflow = JSON.parse(jsonMatch[0]);
      }
    } catch {}

    if (workflow && workflow.name && workflow.steps) {
      const result = db.prepare(
        'INSERT INTO workflows (name, description, category, steps) VALUES (?,?,?,?)'
      ).run(workflow.name, workflow.description || '', workflow.category || category || '', JSON.stringify(workflow.steps));
      workflow.id = result.lastInsertRowid;
      res.json({ workflow, message: '流程模板已自动创建' });
    } else {
      res.json({ workflow: null, message: '未能生成流程模板，请再试一次', raw: data.choices[0].message.content });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

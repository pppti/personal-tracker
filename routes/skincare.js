const express = require('express');
const router = express.Router();
const db = require('../db');

// ── DeepSeek API helper (same pattern as deepseek.js) ──
function getDeepSeekConfig() {
  const key = db.prepare('SELECT value FROM settings WHERE key = ?').get('deepseek_key');
  const model = db.prepare('SELECT value FROM settings WHERE key = ?').get('deepseek_model');
  return {
    apiKey: (key && key.value) || process.env.DEEPSEEK_KEY || '',
    model: (model && model.value) || 'deepseek-chat',
    baseUrl: process.env.DEEPSEEK_BASE || 'https://api.deepseek.com/v1'
  };
}

async function dsChat(messages, maxTokens = 4096) {
  const config = getDeepSeekConfig();
  if (!config.apiKey) throw new Error('请先在设置中配置 DeepSeek API Key');
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, messages, temperature: 0.7, max_tokens: maxTokens })
  });
  if (!res.ok) throw new Error(`DeepSeek API 错误: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ────────────── PRODUCTS ──────────────
router.get('/products', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM skincare_products ORDER BY updated_at DESC').all();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/products/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM skincare_products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: '产品不存在' });
    const points = db.prepare('SELECT * FROM product_talking_points WHERE product_id = ? ORDER BY id ASC').all(req.params.id);
    res.json({ ...product, talking_points: points });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/products', (req, res) => {
  try {
    const { name, brand_positioning, target_audience, core_ingredients, efficacy, price, specs, usage_scenarios } = req.body;
    if (!name) return res.status(400).json({ error: '产品名称为必填' });
    const result = db.prepare(
      'INSERT INTO skincare_products (name,brand_positioning,target_audience,core_ingredients,efficacy,price,specs,usage_scenarios) VALUES (?,?,?,?,?,?,?,?)'
    ).run(name, brand_positioning||'', target_audience||'', core_ingredients||'', efficacy||'', price||'', specs||'', usage_scenarios||'');
    res.json(db.prepare('SELECT * FROM skincare_products WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/products/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM skincare_products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: '产品不存在' });
    const f = { ...existing, ...req.body, updated_at: new Date().toISOString().replace('T',' ').slice(0,19) };
    db.prepare(
      'UPDATE skincare_products SET name=?,brand_positioning=?,target_audience=?,core_ingredients=?,efficacy=?,price=?,specs=?,usage_scenarios=?,updated_at=? WHERE id=?'
    ).run(f.name,f.brand_positioning,f.target_audience,f.core_ingredients,f.efficacy,f.price,f.specs,f.usage_scenarios,f.updated_at,req.params.id);
    res.json(db.prepare('SELECT * FROM skincare_products WHERE id = ?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/products/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM skincare_products WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Talking Points ──
router.post('/products/:id/talking-points', (req, res) => {
  try {
    const { point_type, content } = req.body;
    if (!content) return res.status(400).json({ error: '话术内容为必填' });
    const result = db.prepare('INSERT INTO product_talking_points (product_id,point_type,content) VALUES (?,?,?)').run(req.params.id, point_type||'卖点', content);
    res.json(db.prepare('SELECT * FROM product_talking_points WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/talking-points/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM product_talking_points WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ────────────── KNOWLEDGE BASE ──────────────
router.get('/knowledge', (req, res) => {
  try {
    const { category, search } = req.query;
    let sql = 'SELECT k.*, p.name as product_name FROM knowledge_materials k LEFT JOIN skincare_products p ON k.product_id = p.id WHERE 1=1';
    const params = [];
    if (category) { sql += ' AND k.category = ?'; params.push(category); }
    if (search) { sql += ' AND (k.title LIKE ? OR k.content LIKE ? OR k.tags LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    sql += ' ORDER BY k.created_at DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/knowledge', (req, res) => {
  try {
    const { title, category, content, source_url, tags, product_id } = req.body;
    if (!title) return res.status(400).json({ error: '标题为必填' });
    const r = db.prepare(
      'INSERT INTO knowledge_materials (title,category,content,source_url,tags,product_id) VALUES (?,?,?,?,?,?)'
    ).run(title, category||'参考素材', content||'', source_url||'', tags||'', product_id||null);
    res.json(db.prepare('SELECT * FROM knowledge_materials WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/knowledge/:id', (req, res) => {
  try {
    const e = db.prepare('SELECT * FROM knowledge_materials WHERE id = ?').get(req.params.id);
    if (!e) return res.status(404).json({ error: '素材不存在' });
    const f = { ...e, ...req.body };
    db.prepare('UPDATE knowledge_materials SET title=?,category=?,content=?,source_url=?,tags=?,product_id=? WHERE id=?')
      .run(f.title,f.category,f.content,f.source_url,f.tags,f.product_id,req.params.id);
    res.json(db.prepare('SELECT * FROM knowledge_materials WHERE id = ?').get(req.params.id));
  } catch (er) { res.status(500).json({ error: er.message }); }
});

router.delete('/knowledge/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM knowledge_materials WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// AI import: paste URL + optional text, AI extracts structure, saves to knowledge base
router.post('/knowledge/import', async (req, res) => {
  try {
    const { url, text } = req.body;
    if (!url && !text) return res.status(400).json({ error: '请输入链接或粘贴内容' });

    let sourceContent = text || '';

    // Try to fetch URL content if no text provided
    if (url && !sourceContent) {
      try {
        const fetchRes = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SkincareBot/1.0)' },
          signal: AbortSignal.timeout(8000)
        });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          // Strip HTML tags for text extraction
          sourceContent = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 6000);
        }
      } catch {}
    }

    if (!sourceContent) {
      // Can't fetch - ask user to paste content
      return res.json({
        need_text: true,
        message: '无法自动获取链接内容（可能需要登录或反爬保护），请手动复制文章/视频的文字内容粘贴进来。'
      });
    }

    // Ask AI to analyze the content
    const analysis = await dsChat([
      { role: 'system', content: '你是护肤品内容分析师。分析用户提供的素材，提取结构化信息。只输出JSON。' },
      { role: 'user', content: `分析以下内容，提取关键信息：\n\n${sourceContent.slice(0, 4000)}\n\n返回JSON：\n{\n  "title": "素材标题（15字以内）",\n  "category": "分类（竞品分析/行业知识/用户反馈/爆款参考/话术灵感/其他）",\n  "summary": "核心内容概述（2-3句）",\n  "tags": "逗号分隔的标签，如：抗衰,成分,爆款结构",\n  "hooks": "值得借鉴的开头钩子或金句（如有）",\n  "structure": "内容结构拆解，如：3秒痛点→15秒展示→10秒讲解→5秒CTA",\n  "takeaways": "可以学习借鉴的点（2-3条）" \n}\n只输出JSON。` }
    ], 2048);

    const jsonMatch = analysis.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: url || '未命名素材', category: '参考素材', summary: sourceContent.slice(0, 200), tags: '', takeaways: '' };

    // Build enriched content
    const enrichedContent = [
      parsed.summary ? `## 概述\n${parsed.summary}` : '',
      parsed.hooks ? `## 值得借鉴的钩子/金句\n${parsed.hooks}` : '',
      parsed.structure ? `## 内容结构\n${parsed.structure}` : '',
      parsed.takeaways ? `## 可以学习的点\n${parsed.takeaways}` : '',
      url ? `\n\n> 来源：${url}` : '',
      `\n\n---\n原始内容：\n${sourceContent.slice(0, 2000)}`
    ].filter(Boolean).join('\n\n');

    // Save to knowledge base
    const r = db.prepare(
      'INSERT INTO knowledge_materials (title,category,content,source_url,tags) VALUES (?,?,?,?,?)'
    ).run(parsed.title || '未命名素材', parsed.category || '参考素材', enrichedContent, url || '', parsed.tags || '');

    res.json({
      id: r.lastInsertRowid,
      title: parsed.title,
      category: parsed.category,
      summary: parsed.summary,
      tags: parsed.tags,
      hooks: parsed.hooks,
      structure: parsed.structure,
      takeaways: parsed.takeaways,
      source_url: url
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ────────────── TEMPLATES ──────────────
router.get('/templates', (_req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM script_templates ORDER BY id ASC').all());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/templates', (req, res) => {
  try {
    const { name, content_style, hook_template, body_template, cta_template, platform } = req.body;
    if (!name) return res.status(400).json({ error: '模板名称为必填' });
    const r = db.prepare(
      'INSERT INTO script_templates (name,content_style,hook_template,body_template,cta_template,platform) VALUES (?,?,?,?,?,?)'
    ).run(name, content_style||'痛点型', hook_template||'', body_template||'', cta_template||'', platform||'通用');
    res.json(db.prepare('SELECT * FROM script_templates WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/templates/:id', (req, res) => {
  try {
    const e = db.prepare('SELECT * FROM script_templates WHERE id = ?').get(req.params.id);
    if (!e) return res.status(404).json({ error: '模板不存在' });
    const f = { ...e, ...req.body };
    db.prepare('UPDATE script_templates SET name=?,content_style=?,hook_template=?,body_template=?,cta_template=?,platform=? WHERE id=?')
      .run(f.name,f.content_style,f.hook_template,f.body_template,f.cta_template,f.platform,req.params.id);
    res.json(db.prepare('SELECT * FROM script_templates WHERE id = ?').get(req.params.id));
  } catch (er) { res.status(500).json({ error: er.message }); }
});

router.delete('/templates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM script_templates WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ────────────── HOT TOPICS ──────────────
router.get('/hotspots', (_req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM hot_topics ORDER BY heat_index DESC, created_at DESC').all());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/hotspots', (req, res) => {
  try {
    const { title, source, heat_index, category, summary } = req.body;
    if (!title) return res.status(400).json({ error: '热点标题为必填' });
    const r = db.prepare(
      'INSERT INTO hot_topics (title,source,heat_index,category,summary) VALUES (?,?,?,?,?)'
    ).run(title, source||'', heat_index||0, category||'', summary||'');
    res.json(db.prepare('SELECT * FROM hot_topics WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/hotspots/analyze', async (req, res) => {
  try {
    const { title, category } = req.body;
    if (!title) return res.status(400).json({ error: '请输入热点内容' });

    // Get product context for relevance scoring
    const products = db.prepare('SELECT * FROM skincare_products').all();
    const productContext = products.length > 0
      ? products.map(p => `- ${p.name}：${p.efficacy || p.core_ingredients || ''}，人群：${p.target_audience || ''}`).join('\n')
      : '暂无产品信息';

    const analysis = await dsChat([
      { role: 'system', content: '你是护肤品短视频热点分析师。对用户提供的热点进行结构化分析，输出JSON格式。' },
      { role: 'user', content: `热点标题/描述：${title}\n品类：${category || '未知'}\n\n我的产品：\n${productContext}\n\n请分析这个热点，返回JSON：\n{\n  "summary": "热点概述（1-2句）",\n  "analysis": "为什么火（2-3句，分析用户心理和传播逻辑）",\n  "relevance_score": 0-100的关联度评分,\n  "relevance_reason": "跟我产品的关联说明（1句）",\n  "script_angle": "建议的切入角度（1-2个）"\n}\n只输出JSON。` }
    ], 1024);

    const jsonMatch = analysis.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: analysis, analysis: '', relevance_score: 0, relevance_reason: '', script_angle: '' };

    // Save to database
    const r = db.prepare(
      'INSERT INTO hot_topics (title,source,category,summary,analysis,relevance_score) VALUES (?,?,?,?,?,?)'
    ).run(title, 'AI分析', category||'', parsed.summary||'', parsed.analysis||'', parsed.relevance_score||0);

    res.json({ ...parsed, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/hotspots/:id', (req, res) => {
  try {
    const e = db.prepare('SELECT * FROM hot_topics WHERE id = ?').get(req.params.id);
    if (!e) return res.status(404).json({ error: '热点不存在' });
    const f = { ...e, ...req.body };
    db.prepare('UPDATE hot_topics SET title=?,source=?,heat_index=?,category=?,summary=?,analysis=?,relevance_score=?,is_saved=? WHERE id=?')
      .run(f.title,f.source,f.heat_index,f.category,f.summary,f.analysis,f.relevance_score,f.is_saved||0,req.params.id);
    res.json(db.prepare('SELECT * FROM hot_topics WHERE id = ?').get(req.params.id));
  } catch (er) { res.status(500).json({ error: er.message }); }
});

router.delete('/hotspots/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM hot_topics WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ────────────── SCRIPTS (CORE) ──────────────
router.get('/scripts', (_req, res) => {
  try {
    const scripts = db.prepare(`
      SELECT s.*, p.name as product_name, h.title as hotspot_title
      FROM skincare_scripts s
      LEFT JOIN skincare_products p ON s.product_id = p.id
      LEFT JOIN hot_topics h ON s.hot_topic_id = h.id
      ORDER BY s.updated_at DESC
    `).all();
    res.json(scripts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/scripts/:id', (req, res) => {
  try {
    const s = db.prepare(`
      SELECT s.*, p.name as product_name, h.title as hotspot_title
      FROM skincare_scripts s
      LEFT JOIN skincare_products p ON s.product_id = p.id
      LEFT JOIN hot_topics h ON s.hot_topic_id = h.id
      WHERE s.id = ?
    `).get(req.params.id);
    if (!s) return res.status(404).json({ error: '脚本不存在' });
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/scripts/generate', async (req, res) => {
  try {
    const { product_id, hot_topic_id, template_id, script_type, content_style, duration_sec, word_count, platform, theme_direction, custom_notes } = req.body;

    // Gather context
    const product = product_id ? db.prepare('SELECT * FROM skincare_products WHERE id = ?').get(product_id) : null;
    const points = product_id ? db.prepare('SELECT * FROM product_talking_points WHERE product_id = ?').all(product_id) : [];
    const hotspot = hot_topic_id ? db.prepare('SELECT * FROM hot_topics WHERE id = ?').get(hot_topic_id) : null;
    const tpl = template_id ? db.prepare('SELECT * FROM script_templates WHERE id = ?').get(template_id) : null;
    const knowledge = db.prepare('SELECT * FROM knowledge_materials ORDER BY created_at DESC LIMIT 20').all();

    // Build context for AI
    let contextParts = [];
    if (product) {
      contextParts.push(`## 产品信息\n- 名称：${product.name}\n- 品牌定位：${product.brand_positioning || ''}\n- 目标人群：${product.target_audience || ''}\n- 核心成分：${product.core_ingredients || ''}\n- 功效：${product.efficacy || ''}\n- 价格：${product.price || ''}\n- 使用场景：${product.usage_scenarios || ''}`);
      if (points.length > 0) {
        contextParts.push(`## 产品话术\n${points.map(p => `- [${p.point_type}] ${p.content}`).join('\n')}`);
      }
    }
    if (hotspot) {
      contextParts.push(`## 热点素材\n- 标题：${hotspot.title}\n- 概述：${hotspot.summary || ''}\n- 分析：${hotspot.analysis || ''}`);
    }
    if (tpl) {
      contextParts.push(`## 参考模板\n- 开头钩子：${tpl.hook_template || ''}\n- 中间内容：${tpl.body_template || ''}\n- 结尾CTA：${tpl.cta_template || ''}`);
    }
    if (knowledge.length > 0) {
      const kText = knowledge.map(k =>
        `- [${k.category}] ${k.title}：${(k.content || '').slice(0, 200)}${(k.content || '').length > 200 ? '...' : ''}`
      ).join('\n');
      contextParts.push(`## 知识库参考素材\n以下是你积累的行业知识和参考素材，请尽量融入脚本中：\n${kText}`);
    }

    const style = content_style || '痛点型';
    const type = script_type || '口播脚本';
    const dur = duration_sec || 30;
    const wc = word_count || 200;
    const plat = platform || '视频号';
    const theme = theme_direction || '';
    const notes = custom_notes || '';

    const platNote = plat === '视频号' ? '慢节奏、深信任、专业感强，适合35岁以上人群' : '快节奏、强视觉冲击、前3秒必须有钩子';

    let extraReqs = [];
    if (theme) extraReqs.push(`- 主题方向：${theme}`);
    if (notes) extraReqs.push(`- 特别要求：${notes}`);
    const extraReqsText = extraReqs.length > 0 ? '\n' + extraReqs.join('\n') : '';

    const prompt = contextParts.length > 0
      ? `根据以下信息，为我生成一份${plat}平台的护肤品${type}。\n\n${contextParts.join('\n\n')}\n\n要求：\n- 内容风格：${style}\n- 时长约${dur}秒，约${wc}字左右\n- 平台风格：${platNote}\n- 脚本结构：钩子(${dur < 30 ? '1-2' : '2-3'}秒) → 痛点/问题 → 产品解决方案 → 效果 → CTA\n- 语言口语化、自然、不要推销腔\n- 如果有关键成分，用通俗语言解释功效${extraReqsText}\n\n直接输出脚本内容，不需要标签和格式说明。`
      : `请生成一份通用的护肤品${type}，内容风格为${style}，时长约${dur}秒，约${wc}字左右，适配${plat}平台。语言口语化自然。${extraReqsText}`;

    const content = await dsChat([
      { role: 'system', content: `你是护肤品短视频脚本专家。你擅长为中国短视频平台（抖音、视频号、小红书）撰写高转化率的护肤品脚本。你熟悉：痛点型、成分科普型、对比评测型、场景种草型等多种风格。脚本要求：口语化、有节奏感、埋钩子、自然融入产品卖点。每次输出直接给出脚本全文，不需要标记"开头/中间/结尾"。` },
      { role: 'user', content: prompt }
    ], 4096);

    // Save to database
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const result = db.prepare(
      'INSERT INTO skincare_scripts (title,hot_topic_id,product_id,template_id,script_type,content_style,duration_sec,word_count,platform,theme_direction,custom_notes,content,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).run(
      (hotspot ? hotspot.title : '通用选题') + ' - 脚本',
      hot_topic_id || null, product_id || null, template_id || null,
      type, style, dur, wc, plat, theme, notes, content, now, now
    );
    const script = db.prepare('SELECT * FROM skincare_scripts WHERE id = ?').get(result.lastInsertRowid);
    res.json(script);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/scripts/:id', (req, res) => {
  try {
    const e = db.prepare('SELECT * FROM skincare_scripts WHERE id = ?').get(req.params.id);
    if (!e) return res.status(404).json({ error: '脚本不存在' });
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const f = { ...e, ...req.body, updated_at: now };
    db.prepare(
      'UPDATE skincare_scripts SET title=?,content=?,content_style=?,script_type=?,duration_sec=?,platform=?,status=?,storyboard=?,updated_at=? WHERE id=?'
    ).run(f.title,f.content,f.content_style,f.script_type,f.duration_sec,f.platform,f.status||'draft',f.storyboard||'',f.updated_at,req.params.id);
    res.json(db.prepare('SELECT * FROM skincare_scripts WHERE id = ?').get(req.params.id));
  } catch (er) { res.status(500).json({ error: er.message }); }
});

router.post('/scripts/:id/revise', async (req, res) => {
  try {
    const script = db.prepare('SELECT * FROM skincare_scripts WHERE id = ?').get(req.params.id);
    if (!script) return res.status(404).json({ error: '脚本不存在' });
    const { instruction } = req.body;
    const revised = await dsChat([
      { role: 'system', content: '你是护肤品脚本编辑。根据用户指示修改脚本，保持原有风格和结构。只输出修改后的完整脚本。' },
      { role: 'user', content: `原始脚本：\n\n${script.content}\n\n修改要求：${instruction || '请优化表达，使其更口语化自然'}\n\n输出修改后的完整脚本。` }
    ], 2048);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    db.prepare('UPDATE skincare_scripts SET content=?, updated_at=? WHERE id=?').run(revised, now, req.params.id);
    res.json({ ...script, content: revised, updated_at: now });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/scripts/:id/storyboard', async (req, res) => {
  try {
    const script = db.prepare('SELECT * FROM skincare_scripts WHERE id = ?').get(req.params.id);
    if (!script) return res.status(404).json({ error: '脚本不存在' });

    const storyboard = await dsChat([
      { role: 'system', content: '你是视频拍摄指导。根据脚本生成详细的分镜表和拍摄指导。用JSON格式输出。' },
      { role: 'user', content: `脚本内容：\n\n${script.content}\n\n脚本类型：${script.script_type}，时长约${script.duration_sec}秒，平台：${script.platform}\n\n请生成：\n1. 分镜表（JSON数组，每个元素：{镜号,时长秒,画面内容,运镜方式,备注}）\n2. 拍摄checklist（灯光、收音、背景、着装）\n3. 剪辑建议（字幕位置、BGM风格、转场）\n\n返回JSON：\n{\n  "storyboard": [{镜号,时长秒,画面内容,运镜方式,备注}],\n  "checklist": {灯光,收音,背景,着装},\n  "editing": {字幕位置,BGM风格,转场建议}\n}\n只输出JSON。` }
    ], 2048);

    const jsonMatch = storyboard.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { storyboard: [], checklist: {}, editing: {} };

    // Save storyboard to script
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    db.prepare('UPDATE skincare_scripts SET storyboard=?, updated_at=? WHERE id=?').run(JSON.stringify(parsed), now, req.params.id);

    res.json({ ...script, storyboard: JSON.stringify(parsed), updated_at: now });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scripts/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM skincare_scripts WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Title generation ──
router.post('/scripts/:id/titles', async (req, res) => {
  try {
    const script = db.prepare('SELECT * FROM skincare_scripts WHERE id = ?').get(req.params.id);
    if (!script) return res.status(404).json({ error: '脚本不存在' });
    const titles = await dsChat([
      { role: 'system', content: '你是短视频标题专家。生成5个吸引人的中文短视频标题。' },
      { role: 'user', content: `脚本内容：\n\n${script.content}\n\n平台：${script.platform}\n\n为这个视频生成5个标题候选，每个标题15-30字，要有吸引力但不标题党。请输出一个JSON数组：["标题1","标题2",...]\n只输出JSON数组。` }
    ], 1024);
    const jsonMatch = titles.match(/\[[\s\S]*\]/);
    res.json({ titles: jsonMatch ? JSON.parse(jsonMatch[0]) : [titles] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ────────────── VIDEOS ──────────────
router.get('/videos', (_req, res) => {
  try {
    const videos = db.prepare(`
      SELECT v.*, s.title as script_title
      FROM video_records v
      LEFT JOIN skincare_scripts s ON v.script_id = s.id
      ORDER BY v.created_at DESC
    `).all();
    res.json(videos);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/videos', (req, res) => {
  try {
    const { script_id, title, description, tags, publish_date, platform } = req.body;
    if (!title) return res.status(400).json({ error: '视频标题为必填' });
    const r = db.prepare(
      'INSERT INTO video_records (script_id,title,description,tags,publish_date,platform) VALUES (?,?,?,?,?,?)'
    ).run(script_id||null, title, description||'', tags||'', publish_date||null, platform||'视频号');
    res.json(db.prepare('SELECT * FROM video_records WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/videos/:id', (req, res) => {
  try {
    const e = db.prepare('SELECT * FROM video_records WHERE id = ?').get(req.params.id);
    if (!e) return res.status(404).json({ error: '视频记录不存在' });
    const f = { ...e, ...req.body };
    db.prepare(
      'UPDATE video_records SET title=?,description=?,tags=?,publish_date=?,platform=?,views=?,likes=?,comments=?,shares=?,clicks=?,notes=? WHERE id=?'
    ).run(f.title,f.description,f.tags,f.publish_date,f.platform,f.views,f.likes,f.comments,f.shares,f.clicks,f.notes||'',req.params.id);
    res.json(db.prepare('SELECT * FROM video_records WHERE id = ?').get(req.params.id));
  } catch (er) { res.status(500).json({ error: er.message }); }
});

router.delete('/videos/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM video_records WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ────────────── ANALYTICS ──────────────
// AI-powered comprehensive review report
router.post('/analytics/report', async (req, res) => {
  try {
    // Gather all data
    const videos = db.prepare(`
      SELECT v.*, s.content_style, s.script_type, s.platform as script_platform,
             s.title as script_title, p.name as product_name, p.efficacy
      FROM video_records v
      LEFT JOIN skincare_scripts s ON v.script_id = s.id
      LEFT JOIN skincare_products p ON s.product_id = p.id
      ORDER BY v.publish_date DESC
    `).all();

    const scripts = db.prepare(`
      SELECT s.*, p.name as product_name
      FROM skincare_scripts s
      LEFT JOIN skincare_products p ON s.product_id = p.id
      ORDER BY s.created_at DESC
    `).all();

    const products = db.prepare('SELECT * FROM skincare_products').all();
    const hotspots = db.prepare('SELECT * FROM hot_topics ORDER BY created_at DESC LIMIT 20').all();
    const knowledge = db.prepare('SELECT * FROM knowledge_materials ORDER BY created_at DESC LIMIT 10').all();

    // Build data summary for AI
    let parts = [];

    if (videos.length > 0) {
      parts.push('## 已发布视频数据\n' + videos.map(v =>
        `- ${v.title} | 平台:${v.platform||'未知'} | 风格:${v.content_style||'未知'} | 产品:${v.product_name||'未知'} | 播放:${v.views||0} 赞:${v.likes||0} 评:${v.comments||0} 分享:${v.shares||0} 点击:${v.clicks||0}`
      ).join('\n'));
      const totalViews = videos.reduce((s,v) => s + (v.views||0), 0);
      const totalLikes = videos.reduce((s,v) => s + (v.likes||0), 0);
      parts.push(`总计：${videos.length}条视频，${totalViews}播放，${totalLikes}赞`);
    } else {
      parts.push('## 已发布视频数据\n暂无视频数据');
    }

    if (scripts.length > 0) {
      const drafts = scripts.filter(s => s.status === 'draft');
      const finals = scripts.filter(s => s.status === 'final');
      parts.push(`## 脚本库\n总计${scripts.length}条脚本：${finals.length}条定稿，${drafts.length}条草稿`);
    }

    if (products.length > 0) {
      parts.push('## 产品线\n' + products.map(p =>
        `- ${p.name} | ${p.efficacy||''} | ${p.target_audience||''}`
      ).join('\n'));
    }

    if (hotspots.length > 0) {
      parts.push('## 近期热点\n' + hotspots.slice(0, 8).map(h =>
        `- ${h.title} | 品类:${h.category||''} | 关联度:${h.relevance_score||0}`
      ).join('\n'));
    }

    if (knowledge.length > 0) {
      parts.push('## 知识库素材\n' + knowledge.map(k =>
        `- [${k.category}] ${k.title}`
      ).join('\n'));
    }

    const dataSummary = parts.join('\n\n');

    // Ask AI for comprehensive report
    const report = await dsChat([
      { role: 'system', content: '你是护肤品短视频运营分析专家。基于用户的视频数据、脚本库、产品线和热点素材，生成一份全面的复盘报告。报告要具体、可执行，不要泛泛而谈。只输出JSON。' },
      { role: 'user', content: `${dataSummary}\n\n请生成复盘报告，返回JSON：\n{\n  "summary": {\n    "overview": "整体概况（2-3句）",\n    "total_score": "整体评分（1-10）及一句话理由",\n    "key_metrics": "关键数据解读（2-3句）"\n  },\n  "what_worked": [\n    {"point": "做得好的点", "data": "数据支撑", "keep": "是否建议继续"}\n  ],\n  "what_to_improve": [\n    {"point": "待改进点", "reason": "原因分析", "action": "具体改进建议"}\n  ],\n  "topic_suggestions": [\n    {"topic": "选题方向", "angle": "切入角度", "style": "建议风格", "reason": "为什么这个选题会有效（结合你的产品和热点）"}\n  ],\n  "next_week_plan": {\n    "focus": "下周重点方向",\n    "actions": ["具体行动1", "具体行动2", "具体行动3"]\n  }\n}\n\n只输出JSON。` }
    ], 4096);

    const jsonMatch = report.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!parsed) {
      return res.json({ raw: report, error: 'JSON parse failed' });
    }

    res.json(parsed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/analytics', (_req, res) => {
  try {
    const totalVideos = db.prepare('SELECT COUNT(*) as c FROM video_records').get().c;
    const totalScripts = db.prepare('SELECT COUNT(*) as c FROM skincare_scripts').get().c;
    const finalScripts = db.prepare("SELECT COUNT(*) as c FROM skincare_scripts WHERE status = 'final'").get().c;
    const stats = db.prepare(`
      SELECT COALESCE(SUM(views),0) as total_views,
             COALESCE(SUM(likes),0) as total_likes,
             COALESCE(SUM(comments),0) as total_comments,
             COALESCE(SUM(shares),0) as total_shares,
             COALESCE(SUM(clicks),0) as total_clicks
      FROM video_records
    `).get();

    const byContentStyle = db.prepare(`
      SELECT content_style, COUNT(*) as count
      FROM video_records v LEFT JOIN skincare_scripts s ON v.script_id = s.id
      WHERE s.content_style IS NOT NULL
      GROUP BY s.content_style
    `).all();

    const byPlatform = db.prepare(`
      SELECT platform, COUNT(*) as count, SUM(views) as views
      FROM video_records GROUP BY platform
    `).all();

    res.json({
      total_videos: totalVideos,
      total_scripts: totalScripts,
      final_scripts: finalScripts,
      ...stats,
      by_content_style: byContentStyle,
      by_platform: byPlatform
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Dashboard summary for skincare tab ──
router.get('/dashboard', (_req, res) => {
  try {
    const productCount = db.prepare('SELECT COUNT(*) as c FROM skincare_products').get().c;
    const hotspotCount = db.prepare('SELECT COUNT(*) as c FROM hot_topics').get().c;
    const scriptCount = db.prepare('SELECT COUNT(*) as c FROM skincare_scripts').get().c;
    const draftCount = db.prepare("SELECT COUNT(*) as c FROM skincare_scripts WHERE status = 'draft'").get().c;
    const videoCount = db.prepare('SELECT COUNT(*) as c FROM video_records').get().c;
    const recentScripts = db.prepare(`
      SELECT s.*, p.name as product_name FROM skincare_scripts s
      LEFT JOIN skincare_products p ON s.product_id = p.id
      ORDER BY s.updated_at DESC LIMIT 5
    `).all();
    const recentHotspots = db.prepare('SELECT * FROM hot_topics ORDER BY created_at DESC LIMIT 5').all();
    res.json({
      product_count: productCount,
      hotspot_count: hotspotCount,
      script_count: scriptCount,
      draft_count: draftCount,
      video_count: videoCount,
      recent_scripts: recentScripts,
      recent_hotspots: recentHotspots
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

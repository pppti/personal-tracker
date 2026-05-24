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

// AI import product: paste URL/doc → AI extracts structured info → save + suggest talking points
router.post('/products/import', async (req, res) => {
  try {
    const { url, text } = req.body;
    if (!url && !text) return res.status(400).json({ error: '请输入链接或粘贴产品文档内容' });

    let sourceContent = text || '';
    if (url && !sourceContent) {
      try {
        const fetchRes = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SkincareBot/1.0)' },
          signal: AbortSignal.timeout(8000)
        });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          sourceContent = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ').trim().slice(0, 6000);
        }
      } catch {}
    }

    if (!sourceContent) {
      return res.json({ need_text: true, message: '无法自动获取链接内容，请手动粘贴产品详情文字。' });
    }

    // Deeper analysis: formula, natural ingredients, competitor positioning
    const analysis = await dsChat([
      { role: 'system', content: '你是护肤品销售文案专家。你的任务是帮用户把产品卖出去。从产品资料中提取一切可以用来打动消费者、促成下单的信息。所有分析都要站在"怎么卖"的角度，任何看似普通的信息都要转化成卖点。无法确定的字段根据行业经验合理推测。只输出JSON。' },
      { role: 'user', content: `从以下产品资料中提取可用于推广销售的信息：\n\n${sourceContent.slice(0, 5000)}\n\n返回JSON：\n{\n  "name": "产品全称（要有吸引力）",\n  "brand_positioning": "品牌定位（用消费者能get到的语言）",\n  "target_audience": "目标人群（越具体越好，方便精准投放）",\n  "core_ingredients": "核心成分（突出明星成分，附带一句话卖点）",\n  "efficacy": "核心功效（用消费者痛点语言表达）",\n  "price": "价格（如果有性价比优势要强调）",\n  "specs": "规格",\n  "usage_scenarios": "使用场景（场景越具体越能触发购买）",\n  "is_natural": "天然/安全卖点：这个产品在成分安全、温和、天然方面有什么让消费者放心的卖点？怎么打消敏感肌/宝妈/成分党的顾虑？（2-3句，纯销售角度）",\n  "formula_analysis": "配方亮点：这个配方里有什么技术壁垒、专利成分、浓度优势可以被拿来做文章？怎么让消费者觉得这个配方比别人强？（3-5句，纯销售角度，不讲缺点）",\n  "competitor_diff": "碾压竞品的理由：跟市面上同类产品比，这个产品有什么让消费者选它不选别人的理由？价格、成分、技术、体验、背书都可以说（3-5句，一定要有说服力）",\n  "talking_points": ["让消费者心动的卖点1", "直击痛点的卖点2", "制造紧迫感的卖点3", "建立信任的卖点4", "促成下单的卖点5", "制造差异化的卖点6"]\n}\n只输出JSON。` }
    ], 4096);

    const jsonMatch = analysis.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    if (!parsed.name) parsed.name = '未命名产品';

    // Save product with deep analysis fields
    const result = db.prepare(
      'INSERT INTO skincare_products (name,brand_positioning,target_audience,core_ingredients,efficacy,price,specs,usage_scenarios,is_natural,formula_analysis,competitor_diff) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ).run(
      parsed.name, parsed.brand_positioning||'', parsed.target_audience||'',
      parsed.core_ingredients||'', parsed.efficacy||'', parsed.price||'',
      parsed.specs||'', parsed.usage_scenarios||'',
      parsed.is_natural||'', parsed.formula_analysis||'', parsed.competitor_diff||''
    );

    // Save talking points
    const points = parsed.talking_points || [];
    for (const tp of points) {
      if (tp) {
        db.prepare('INSERT INTO product_talking_points (product_id,point_type,content) VALUES (?,?,?)').run(result.lastInsertRowid, '卖点', tp);
      }
    }

    const product = db.prepare('SELECT * FROM skincare_products WHERE id = ?').get(result.lastInsertRowid);
    const savedPoints = db.prepare('SELECT * FROM product_talking_points WHERE product_id = ?').all(result.lastInsertRowid);
    res.json({ ...product, talking_points: savedPoints, extracted_from: url || '文档' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Deep analyze existing product — fill missing analysis fields
router.post('/products/:id/deep-analyze', async (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM skincare_products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: '产品不存在' });

    const analysis = await dsChat([
      { role: 'system', content: '你是护肤品销售文案专家。你的唯一任务是帮用户找到产品的销售亮点，为写推广脚本提供弹药。绝不分析产品缺点，只挖掘可以用来打动消费者的角度。用专业知识把普通成分包装成卖点。只输出JSON。' },
      { role: 'user', content: `产品信息：\n- 名称：${product.name}\n- 定位：${product.brand_positioning||''}\n- 人群：${product.target_audience||''}\n- 成分：${product.core_ingredients||''}\n- 功效：${product.efficacy||''}\n- 价格：${product.price||''}\n- 场景：${product.usage_scenarios||''}\n\n请从"怎么卖"的角度分析这个产品：\n返回JSON：\n{\n  "is_natural": "成分安全/天然方面的销售话术——怎么让消费者放心？怎么打消敏感肌/成分党顾虑？（2-3句，纯卖点视角）",\n  "formula_analysis": "配方亮点——这个配方有什么让消费者觉得值这个钱的技术或成分？有什么看不见的良心之处？浓度、工艺、专利都行（3-5句，往好里说）",\n  "competitor_diff": "碾压竞品的理由——为什么买它不买别人？从价格、成分、体验、技术各个角度找优势。如果信息不足，根据行业经验合理推断同类竞品的普遍情况来做对比（3-5句，要有说服力）"\n}\n只输出JSON。` }
    ], 2048);

    const jsonMatch = analysis.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    db.prepare('UPDATE skincare_products SET is_natural=?, formula_analysis=?, competitor_diff=?, updated_at=? WHERE id=?').run(
      parsed.is_natural||'', parsed.formula_analysis||'', parsed.competitor_diff||'', now, req.params.id
    );

    const updated = db.prepare('SELECT * FROM skincare_products WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Competitor analysis: compare product vs competitor knowledge materials
router.post('/products/:id/competitor-analysis', async (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM skincare_products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: '产品不存在' });
    const points = db.prepare('SELECT * FROM product_talking_points WHERE product_id = ?').all(req.params.id);

    // Get competitor-related knowledge materials
    const competitors = db.prepare("SELECT * FROM knowledge_materials WHERE category = '竞品分析' OR tags LIKE '%竞品%' ORDER BY created_at DESC LIMIT 10").all();

    const productInfo = `## 我的产品\n- 名称：${product.name}\n- 定位：${product.brand_positioning||''}\n- 成分：${product.core_ingredients||''}\n- 功效：${product.efficacy||''}\n- 价格：${product.price||''}\n- 天然分析：${product.is_natural||''}\n- 配方分析：${product.formula_analysis||''}\n- 已有差异：${product.competitor_diff||''}\n- 现有话术：${points.map(p=>p.content).join(' | ')}`;

    const competitorInfo = competitors.length > 0
      ? '## 竞品素材\n' + competitors.map(c => `- ${c.title}：${(c.content||'').slice(0, 300)}`).join('\n')
      : '暂无竞品素材（建议先去知识库添加竞品分析）';

    const result = await dsChat([
      { role: 'system', content: '你是护肤品销售竞争策略专家。你的任务是对比自家产品与竞品，找出一切可以说服消费者选你而不选竞品的理由。逢敌必亮剑，每个维度都要找到自家胜出的角度。对手的弱点就是你的卖点。只输出JSON。' },
      { role: 'user', content: `${productInfo}\n\n${competitorInfo}\n\n请从竞争角度挖掘销售优势，返回JSON：\n{\n  "unique_advantages": ["为什么非买你不可的理由1", "理由2", "理由3"],\n  "differentiation_analysis": "差异化销售话术——从成分、技术、价格、体验、人群各个维度说明你的产品比竞品好在哪，让消费者看了想下单（4-6句，一定要有煽动力）",\n  "new_talking_points": ["碾压竞品的话术1", "话术2", "话术3", "话术4"],\n  "recommended_angles": ["适合拍成视频的销售角度1", "角度2", "角度3"],\n  "competitor_gaps": "竞品留给你的机会——他们在哪里做得不够好，你的产品正好填补了什么空白？（2-3句，这是你的黄金卖点）"\n}\n只输出JSON。` }
    ], 4096);

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Update product competitor_diff if enhanced
    if (parsed.differentiation_analysis) {
      const newDiff = [product.competitor_diff, parsed.differentiation_analysis].filter(Boolean).join('\n\n---\n竞品挖掘分析：\n');
      db.prepare('UPDATE skincare_products SET competitor_diff=?, updated_at=? WHERE id=?').run(
        newDiff, new Date().toISOString().replace('T',' ').slice(0,19), req.params.id
      );
    }

    // Save new talking points
    const newPoints = parsed.new_talking_points || [];
    for (const tp of newPoints) {
      if (tp) {
        db.prepare('INSERT INTO product_talking_points (product_id,point_type,content) VALUES (?,?,?)').run(req.params.id, '竞品挖掘', tp);
      }
    }

    // Auto-save to knowledge base
    const kbContent = [
      parsed.differentiation_analysis ? `## 差异分析\n${parsed.differentiation_analysis}` : '',
      parsed.unique_advantages ? `## 独特优势\n${parsed.unique_advantages.map(a => '- '+a).join('\n')}` : '',
      parsed.competitor_gaps ? `## 竞品弱点\n${parsed.competitor_gaps}` : '',
      parsed.recommended_angles ? `## 建议切入角度\n${parsed.recommended_angles.map(a => '- '+a).join('\n')}` : ''
    ].filter(Boolean).join('\n\n');
    if (kbContent) {
      db.prepare('INSERT INTO knowledge_materials (title,category,content,tags,product_id) VALUES (?,?,?,?,?)').run(
        `竞品分析 - ${product.name}`,
        '竞品分析',
        kbContent,
        'AI生成,竞品挖掘',
        req.params.id
      );
    }

    const updatedPoints = db.prepare('SELECT * FROM product_talking_points WHERE product_id = ?').all(req.params.id);
    res.json({ ...parsed, talking_points: updatedPoints });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/products/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM skincare_products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: '产品不存在' });
    const f = { ...existing, ...req.body, updated_at: new Date().toISOString().replace('T',' ').slice(0,19) };
    db.prepare(
      'UPDATE skincare_products SET name=?,brand_positioning=?,target_audience=?,core_ingredients=?,efficacy=?,price=?,specs=?,usage_scenarios=?,is_natural=?,formula_analysis=?,competitor_diff=?,updated_at=? WHERE id=?'
    ).run(f.name,f.brand_positioning,f.target_audience,f.core_ingredients,f.efficacy,f.price,f.specs,f.usage_scenarios,f.is_natural||'',f.formula_analysis||'',f.competitor_diff||'',f.updated_at,req.params.id);
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

// AI analyze video/script → generate template
router.post('/templates/analyze', async (req, res) => {
  try {
    const { url, text } = req.body;
    if (!url && !text) return res.status(400).json({ error: '请输入视频链接或粘贴脚本内容' });

    let sourceContent = text || '';
    if (url && !sourceContent) {
      try {
        const fetchRes = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SkincareBot/1.0)' },
          signal: AbortSignal.timeout(8000)
        });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          sourceContent = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ').trim().slice(0, 5000);
        }
      } catch {}
    }

    if (!sourceContent) {
      return res.json({ need_text: true, message: '无法自动获取链接内容，请手动粘贴视频文案或脚本。' });
    }

    const analysis = await dsChat([
      { role: 'system', content: '你是短视频脚本结构分析师。分析视频/脚本的内容结构，提取可复用的模板。输出JSON。' },
      { role: 'user', content: `分析以下视频脚本，提取结构模板：\n\n${sourceContent.slice(0, 4000)}\n\n返回JSON：\n{\n  "name": "模板名称（简短，如：XX类型口播结构）",\n  "content_style": "内容风格（如：痛点型/悬念反转型/教程教学型等）",\n  "platform": "建议平台（视频号/抖音/通用）",\n  "hook_template": "开头的钩子模板（用[]标注可变部分，如：[具体痛点场景描述]）",\n  "body_template": "中间内容模板（用[]标注可变部分）",\n  "cta_template": "结尾CTA模板（用[]标注可变部分）",\n  "analysis_summary": "结构分析总结（2-3句，说明这个视频为什么有效）"\n}\n只输出JSON。` }
    ], 2048);

    const jsonMatch = analysis.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Auto-save to templates
    if (parsed.name) {
      db.prepare(
        'INSERT INTO script_templates (name,content_style,hook_template,body_template,cta_template,platform) VALUES (?,?,?,?,?,?)'
      ).run(
        parsed.name, parsed.content_style||'痛点型', parsed.hook_template||'',
        parsed.body_template||'', parsed.cta_template||'', parsed.platform||'通用'
      );
    }

    res.json(parsed);
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
    const { product_id, hot_topic_id, template_id, script_type, content_style, duration_sec, word_count, platform, theme_direction, custom_notes, selected_point_ids } = req.body;

    // Gather context
    const product = product_id ? db.prepare('SELECT * FROM skincare_products WHERE id = ?').get(product_id) : null;
    let points = product_id ? db.prepare('SELECT * FROM product_talking_points WHERE product_id = ?').all(product_id) : [];
    // Filter by selected talking points if specified
    if (selected_point_ids && selected_point_ids.length > 0) {
      points = points.filter(p => selected_point_ids.includes(p.id));
    }
    const hotspot = hot_topic_id ? db.prepare('SELECT * FROM hot_topics WHERE id = ?').get(hot_topic_id) : null;
    const tpl = template_id ? db.prepare('SELECT * FROM script_templates WHERE id = ?').get(template_id) : null;
    const knowledge = db.prepare('SELECT * FROM knowledge_materials ORDER BY created_at DESC LIMIT 20').all();

    // Build context for AI
    let contextParts = [];
    if (product) {
      contextParts.push(`## 产品信息\n- 名称：${product.name}\n- 品牌定位：${product.brand_positioning || ''}\n- 目标人群：${product.target_audience || ''}\n- 核心成分：${product.core_ingredients || ''}\n- 功效：${product.efficacy || ''}\n- 价格：${product.price || ''}\n- 使用场景：${product.usage_scenarios || ''}\n- 天然成分分析：${product.is_natural || ''}\n- 配方分析：${product.formula_analysis || ''}\n- 竞品差异：${product.competitor_diff || ''}`);
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
      { role: 'system', content: `你是护肤品带货短视频脚本专家，也是金牌销售。你的每一句话都是为了帮用户把产品卖出去。你写的是带货脚本，不是测评文章——不做客观分析，只做说服购买。核心原则：把功能翻译成好处、把成分翻译成效果、把价格翻译成省钱、把缺点翻译成独特设计。口语化、有节奏感、3秒内必须抓住人。每次输出直接给出脚本全文，不需要标记分段。` },
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
    const { script_id, title, description, tags, publish_date, platform, video_url } = req.body;
    if (!title) return res.status(400).json({ error: '视频标题为必填' });
    const r = db.prepare(
      'INSERT INTO video_records (script_id,title,description,tags,publish_date,platform,video_url) VALUES (?,?,?,?,?,?,?)'
    ).run(script_id||null, title, description||'', tags||'', publish_date||null, platform||'视频号', video_url||'');
    res.json(db.prepare('SELECT * FROM video_records WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/videos/:id', (req, res) => {
  try {
    const e = db.prepare('SELECT * FROM video_records WHERE id = ?').get(req.params.id);
    if (!e) return res.status(404).json({ error: '视频记录不存在' });
    const f = { ...e, ...req.body };
    db.prepare(
      'UPDATE video_records SET title=?,description=?,tags=?,publish_date=?,platform=?,views=?,likes=?,comments=?,shares=?,clicks=?,video_url=?,notes=? WHERE id=?'
    ).run(f.title,f.description,f.tags,f.publish_date,f.platform,f.views,f.likes,f.comments,f.shares,f.clicks,f.video_url||'',f.notes||'',req.params.id);
  } catch (er) { res.status(500).json({ error: er.message }); }
});

router.delete('/videos/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM video_records WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ────────────── AI HOTSPOT DISCOVERY + TOPIC ENGINE ──────────────
router.post('/hotspots/discover', async (req, res) => {
  try {
    const products = db.prepare('SELECT name, efficacy, core_ingredients, target_audience FROM skincare_products').all();
    const existingHotspots = db.prepare('SELECT title, category FROM hot_topics ORDER BY created_at DESC LIMIT 10').all();
    const productSummary = products.length > 0
      ? products.map(p => `- ${p.name}（${p.efficacy||''}，人群：${p.target_audience||''}）`).join('\n')
      : '暂无产品';

    const result = await dsChat([
      { role: 'system', content: '你是护肤品行业趋势分析师。基于当前中国市场护肤品短视频趋势，为用户发现可用的热门话题。输出JSON。' },
      { role: 'user', content: `我的产品线：\n${productSummary}\n\n已有热点：\n${existingHotspots.map(h=>'- '+h.title).join('\n')||'无'}\n\n请基于2025-2026年中国护肤品市场趋势和社交媒体热点，推荐10个当前可以做视频的热门选题。返回JSON：\n{\n  "hotspots": [\n    {\n      "title": "热点话题（含hashtag形式）",\n      "category": "品类（抗衰/美白/防晒/敏感肌/成分等）",\n      "heat_reason": "为什么这个热度高（1-2句）",\n      "relevance": "跟我的产品的关联",\n      "script_angle": "建议的脚本切入角度",\n      "content_style": "建议的内容风格（痛点型/成分科普型/对比评测型/场景种草型）"\n    }\n  ],\n  "trend_summary": "当前护肤品短视频趋势总结（3-5句）"\n}\n只输出JSON。` }
    ], 4096);

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { hotspots: [] };

    // Auto-save trend summary to knowledge base
    if (parsed.trend_summary && parsed.hotspots && parsed.hotspots.length > 0) {
      const knowledgeContent = [
        `## 趋势总结\n${parsed.trend_summary}`,
        `## 热门选题\n${parsed.hotspots.map((h,i) => `${i+1}. ${h.title}\n- 热度原因：${h.heat_reason}\n- 关联：${h.relevance}\n- 切入角度：${h.script_angle}\n- 建议风格：${h.content_style}`).join('\n\n')}`
      ].join('\n\n');
      db.prepare('INSERT INTO knowledge_materials (title,category,content,tags) VALUES (?,?,?,?)').run(
        'AI热点发现 ' + new Date().toISOString().slice(0,10),
        '爆款参考',
        knowledgeContent,
        'AI生成,热点,选题'
      );
    }

    res.json(parsed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/topics/suggest', async (req, res) => {
  try {
    const { focus } = req.body;
    const products = db.prepare('SELECT * FROM skincare_products').all();
    const hotspots = db.prepare('SELECT * FROM hot_topics ORDER BY created_at DESC LIMIT 10').all();
    const knowledge = db.prepare('SELECT * FROM knowledge_materials ORDER BY created_at DESC LIMIT 10').all();

    const ctx = [
      products.length > 0 ? '## 产品\n'+products.map(p=>`- ${p.name}：${p.efficacy||''}（成分：${p.core_ingredients||''}，人群：${p.target_audience||''}，差异：${p.competitor_diff||''}）`).join('\n') : '',
      hotspots.length > 0 ? '## 热点\n'+hotspots.map(h=>`- ${h.title}（${h.category||''}）`).join('\n') : '',
      knowledge.length > 0 ? '## 知识库\n'+knowledge.map(k=>`- [${k.category}] ${k.title}`).join('\n') : ''
    ].filter(Boolean).join('\n\n');

    const focusNote = focus ? `\n特别关注方向：${focus}` : '';

    const result = await dsChat([
      { role: 'system', content: '你是护肤品带货视频创意策划专家。你的选题只有一个目的：帮用户把产品卖出去。每个选题都要有明确的销售转化路径，不是做科普涨粉，是带货成交。输出JSON。' },
      { role: 'user', content: `${ctx}\n\n请策划选题方案${focusNote}，返回JSON：\n{\n  "creative_topics": [\n    {\n      "topic": "选题标题",\n      "angle": "切入角度",\n      "style": "内容风格",\n      "hook": "建议的开头钩子一句话",\n      "structure": "建议的脚本结构（3-5步）",\n      "why": "为什么这个选题能火"\n    }\n  ],\n  "series_suggestion": "如果要做系列内容，建议的系列主题和结构（2-3句）",\n  "weekly_plan": ["周一选题", "周三选题", "周五选题"]\n}\n只输出JSON。` }
    ], 4096);

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    res.json(parsed);
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
      { role: 'system', content: '你是护肤品带货短视频运营专家。复盘只有一个目标：找出什么内容能卖出更多货。分析数据不是为分析而分析，是为找到更高转化的内容策略。所有建议都要指向"怎么拍才能卖更多"。只输出JSON。' },
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

// ────────────── CLEANUP ──────────────
router.post('/cleanup', (_req, res) => {
  try {
    const tables = ['video_records', 'skincare_scripts', 'knowledge_materials', 'hot_topics', 'product_talking_points', 'skincare_products'];
    const counts = {};
    for (const t of tables) {
      const c = db.prepare('SELECT COUNT(*) as c FROM ' + t).get();
      db.prepare('DELETE FROM ' + t).run();
      counts[t] = c.c;
    }
    res.json({ ok: true, deleted: counts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ────────────── BACKUP / RESTORE ──────────────
router.get('/backup/export', (_req, res) => {
  try {
    const data = {
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
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=skincare-backup-' + new Date().toISOString().slice(0,10) + '.json');
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/backup/import', (req, res) => {
  try {
    const data = req.body;
    if (!data.version) return res.status(400).json({ error: '无效的备份文件' });

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    let counts = { products: 0, scripts: 0, videos: 0 };

    // Restore products
    if (data.products && Array.isArray(data.products)) {
      for (const p of data.products) {
        db.prepare('INSERT OR IGNORE INTO skincare_products (id,name,brand_positioning,target_audience,core_ingredients,efficacy,price,specs,usage_scenarios,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
          p.id, p.name, p.brand_positioning||'', p.target_audience||'', p.core_ingredients||'',
          p.efficacy||'', p.price||'', p.specs||'', p.usage_scenarios||'',
          p.created_at||now, p.updated_at||now
        );
        counts.products++;
      }
    }

    // Restore talking points
    if (data.talking_points && Array.isArray(data.talking_points)) {
      for (const tp of data.talking_points) {
        db.prepare('INSERT OR IGNORE INTO product_talking_points (id,product_id,point_type,content,created_at) VALUES (?,?,?,?,?)').run(
          tp.id, tp.product_id, tp.point_type||'卖点', tp.content||'', tp.created_at||now
        );
      }
    }

    // Restore templates
    if (data.templates && Array.isArray(data.templates)) {
      for (const t of data.templates) {
        db.prepare('INSERT OR IGNORE INTO script_templates (id,name,content_style,hook_template,body_template,cta_template,platform,created_at) VALUES (?,?,?,?,?,?,?,?)').run(
          t.id, t.name, t.content_style||'痛点型', t.hook_template||'', t.body_template||'',
          t.cta_template||'', t.platform||'通用', t.created_at||now
        );
      }
    }

    // Restore hotspots
    if (data.hotspots && Array.isArray(data.hotspots)) {
      for (const h of data.hotspots) {
        db.prepare('INSERT OR IGNORE INTO hot_topics (id,title,source,heat_index,category,summary,analysis,relevance_score,is_saved,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(
          h.id, h.title, h.source||'', h.heat_index||0, h.category||'',
          h.summary||'', h.analysis||'', h.relevance_score||0, h.is_saved||0, h.created_at||now
        );
      }
    }

    // Restore knowledge
    if (data.knowledge && Array.isArray(data.knowledge)) {
      for (const k of data.knowledge) {
        db.prepare('INSERT OR IGNORE INTO knowledge_materials (id,title,category,content,source_url,tags,product_id,created_at) VALUES (?,?,?,?,?,?,?,?)').run(
          k.id, k.title, k.category||'参考素材', k.content||'', k.source_url||'',
          k.tags||'', k.product_id||null, k.created_at||now
        );
      }
    }

    // Restore scripts
    if (data.scripts && Array.isArray(data.scripts)) {
      for (const s of data.scripts) {
        db.prepare('INSERT OR IGNORE INTO skincare_scripts (id,title,hot_topic_id,product_id,template_id,script_type,content_style,duration_sec,word_count,platform,theme_direction,custom_notes,content,storyboard,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
          s.id, s.title, s.hot_topic_id||null, s.product_id||null, s.template_id||null,
          s.script_type||'口播脚本', s.content_style||'痛点型', s.duration_sec||30,
          s.word_count||200, s.platform||'视频号', s.theme_direction||'',
          s.custom_notes||'', s.content||'', s.storyboard||'', s.status||'draft',
          s.created_at||now, s.updated_at||now
        );
        counts.scripts++;
      }
    }

    // Restore videos
    if (data.videos && Array.isArray(data.videos)) {
      for (const v of data.videos) {
        db.prepare('INSERT OR IGNORE INTO video_records (id,script_id,title,description,tags,publish_date,platform,views,likes,comments,shares,clicks,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
          v.id, v.script_id||null, v.title, v.description||'', v.tags||'',
          v.publish_date||null, v.platform||'视频号', v.views||0, v.likes||0,
          v.comments||0, v.shares||0, v.clicks||0, v.notes||'', v.created_at||now
        );
        counts.videos++;
      }
    }

    res.json({ ok: true, counts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    category TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    deadline TEXT,
    priority TEXT DEFAULT 'medium',
    progress INTEGER DEFAULT 0,
    parent_id INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS progress_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL,
    progress INTEGER DEFAULT 0,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT '',
    steps TEXT DEFAULT '[]',
    created_from_entry_id INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    remind_at TEXT NOT NULL,
    notified INTEGER DEFAULT 0,
    recurring TEXT DEFAULT NULL,
    last_notified TEXT,
    entry_id INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE SET NULL
  );
`);

// Skincare creation workbench tables
db.exec(`
  CREATE TABLE IF NOT EXISTS skincare_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand_positioning TEXT DEFAULT '',
    target_audience TEXT DEFAULT '',
    core_ingredients TEXT DEFAULT '',
    efficacy TEXT DEFAULT '',
    price TEXT DEFAULT '',
    specs TEXT DEFAULT '',
    usage_scenarios TEXT DEFAULT '',
    is_natural TEXT DEFAULT '',
    formula_analysis TEXT DEFAULT '',
    competitor_diff TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS product_talking_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    point_type TEXT NOT NULL DEFAULT '卖点',
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (product_id) REFERENCES skincare_products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS knowledge_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT DEFAULT '参考素材',
    content TEXT DEFAULT '',
    source_url TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    product_id INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (product_id) REFERENCES skincare_products(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS script_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content_style TEXT DEFAULT '痛点型',
    hook_template TEXT DEFAULT '',
    body_template TEXT DEFAULT '',
    cta_template TEXT DEFAULT '',
    platform TEXT DEFAULT '通用',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS hot_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    source TEXT DEFAULT '',
    heat_index INTEGER DEFAULT 0,
    category TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    analysis TEXT DEFAULT '',
    relevance_score INTEGER DEFAULT 0,
    is_saved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS skincare_scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    hot_topic_id INTEGER,
    product_id INTEGER,
    template_id INTEGER,
    script_type TEXT DEFAULT '口播脚本',
    content_style TEXT DEFAULT '痛点型',
    duration_sec INTEGER DEFAULT 30,
    word_count INTEGER DEFAULT 200,
    platform TEXT DEFAULT '视频号',
    theme_direction TEXT DEFAULT '',
    custom_notes TEXT DEFAULT '',
    content TEXT DEFAULT '',
    storyboard TEXT DEFAULT '',
    status TEXT DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (hot_topic_id) REFERENCES hot_topics(id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES skincare_products(id) ON DELETE SET NULL,
    FOREIGN KEY (template_id) REFERENCES script_templates(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS video_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    publish_date TEXT,
    platform TEXT DEFAULT '视频号',
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    video_url TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (script_id) REFERENCES skincare_scripts(id) ON DELETE SET NULL
  );
`);

// Seed default script templates (only if empty)
const tplCount = db.prepare('SELECT COUNT(*) as c FROM script_templates').get().c;
if (tplCount === 0) {
  const defaults = [
    ['痛点型口播', '痛点型', '你有没有发现[痛点描述]？很多人以为是[常见误区]，其实真正的原因是[真相]。', '就拿我家[产品名]来说，核心成分是[成分]，它[功效原理]。用了[时间段]之后[效果描述]。', '如果你也有[痛点]的困扰，[产品名]在左下角，可以先试试体验装。', '视频号'],
    ['成分科普型', '成分科普型', '99%的人不知道，[成分名]到底是什么？今天用30秒讲清楚。', '[成分]最早是在[来源/研究]中被发现的，它的原理是[简单解释]。我们把[成分]用到了[产品名]里，浓度达到了[X]%。', '市面上含[成分]的产品很多，但[差异化卖点]。想试试的朋友点个关注，我们下期继续讲。', '视频号'],
    ['对比评测型', '对比评测型', '[产品名] vs [竞品/大牌]，同是[品类]，到底差在哪？直接上原相机实测。', '左边是[产品A]，右边是[产品B]。先看质地/吸收/肤感...再看成分表对比，[A]主打[成分a]，[B]主打[成分b]。', '总结一下，如果你是[人群A]选[A]，[人群B]选[B]。[产品名]更适合[目标人群]。', '通用'],
    ['场景种草型', '场景种草型', '熬夜/换季/妆前...这种时候你第一个想到的护肤品是什么？', '[场景描述]，这个时候皮肤最需要[需求]。我一般会用[产品名]，因为[使用体验和即时效果]。', '包里/床头/办公室放一支，[场景]随时用。链接在下方。', '视频号']
  ];
  const insertTpl = db.prepare('INSERT INTO script_templates (name,content_style,hook_template,body_template,cta_template,platform) VALUES (?,?,?,?,?,?)');
  for (const t of defaults) insertTpl.run(...t);
}

// Auto-migrate existing databases
try { db.exec('ALTER TABLE skincare_scripts ADD COLUMN word_count INTEGER DEFAULT 200'); } catch {}
try { db.exec('ALTER TABLE skincare_scripts ADD COLUMN theme_direction TEXT DEFAULT \'\''); } catch {}
try { db.exec('ALTER TABLE skincare_scripts ADD COLUMN custom_notes TEXT DEFAULT \'\''); } catch {}
try { db.exec('ALTER TABLE skincare_products ADD COLUMN is_natural TEXT DEFAULT \'\''); } catch {}
try { db.exec('ALTER TABLE skincare_products ADD COLUMN formula_analysis TEXT DEFAULT \'\''); } catch {}
try { db.exec('ALTER TABLE skincare_products ADD COLUMN competitor_diff TEXT DEFAULT \'\''); } catch {}
try { db.exec('ALTER TABLE video_records ADD COLUMN video_url TEXT DEFAULT \'\''); } catch {}
try { db.exec('ALTER TABLE entries ADD COLUMN deadline TEXT'); } catch {}
try { db.exec('ALTER TABLE entries ADD COLUMN priority TEXT DEFAULT \'medium\''); } catch {}
try { db.exec('ALTER TABLE entries ADD COLUMN progress INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE entries ADD COLUMN parent_id INTEGER'); } catch {}
try { db.exec('ALTER TABLE reminders ADD COLUMN entry_id INTEGER'); } catch {}
try { db.exec('ALTER TABLE reminders ADD COLUMN recurring TEXT DEFAULT NULL'); } catch {}
try { db.exec('ALTER TABLE reminders ADD COLUMN last_notified TEXT'); } catch {}

module.exports = db;

"""
护肤品库存管理 — SQLite 单文件版 (无需安装任何数据库)
用法: python app_sqlite.py
首次运行自动建库 + 导入示例数据
"""
import sqlite3
import os
import csv
import io
import json
from datetime import date, datetime, timedelta
from wsgiref.simple_server import make_server

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skincare.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.create_function("CURDATE", 0, lambda: date.today().isoformat())
    conn.create_function("DATEDIFF", 2, lambda end, start: (date.fromisoformat(end) - date.fromisoformat(start)).days)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# ============================================================================
# 初始化数据库
# ============================================================================
SCHEMA_SQLITE = r"""
CREATE TABLE IF NOT EXISTS product_categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id   INTEGER DEFAULT 0,
    name        TEXT NOT NULL,
    code        TEXT NOT NULL UNIQUE,
    sort_order  INTEGER DEFAULT 0,
    description TEXT,
    is_active   INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS brands (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    name_en     TEXT,
    country     TEXT,
    website     TEXT,
    logo_url    TEXT,
    description TEXT,
    is_active   INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS suppliers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    contact_person  TEXT,
    contact_phone   TEXT,
    contact_email   TEXT,
    address         TEXT,
    bank_name       TEXT,
    bank_account    TEXT,
    tax_id          TEXT,
    payment_terms   TEXT,
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS warehouses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    code            TEXT NOT NULL UNIQUE,
    address         TEXT,
    manager         TEXT,
    phone           TEXT,
    warehouse_type  TEXT DEFAULT 'NORMAL',
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS storage_locations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id    INTEGER NOT NULL,
    location_code   TEXT NOT NULL,
    location_type   TEXT DEFAULT 'SHELF',
    max_capacity    INTEGER DEFAULT 0,
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(warehouse_id, location_code)
);

CREATE TABLE IF NOT EXISTS products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code    TEXT NOT NULL UNIQUE,
    category_id     INTEGER NOT NULL,
    brand_id        INTEGER NOT NULL,
    name            TEXT NOT NULL,
    sub_title       TEXT,
    skin_type       TEXT,
    efficacy_tags   TEXT,
    ingredient_desc TEXT,
    usage_desc      TEXT,
    shelf_life_days INTEGER DEFAULT 1095,
    image_url       TEXT,
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS product_skus (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id      INTEGER NOT NULL,
    sku_code        TEXT NOT NULL UNIQUE,
    barcode         TEXT UNIQUE,
    spec_name       TEXT NOT NULL,
    capacity_ml     REAL DEFAULT 0,
    capacity_g      REAL DEFAULT 0,
    piece_count     INTEGER DEFAULT 1,
    cost_price      REAL DEFAULT 0,
    wholesale_price REAL DEFAULT 0,
    retail_price    REAL DEFAULT 0,
    min_stock_qty   INTEGER DEFAULT 0,
    max_stock_qty   INTEGER DEFAULT 99999,
    weight_kg       REAL DEFAULT 0,
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS product_batches (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sku_id          INTEGER NOT NULL,
    supplier_id     INTEGER,
    batch_no        TEXT NOT NULL,
    production_date TEXT NOT NULL,
    expiry_date     TEXT NOT NULL,
    storage_cond_id INTEGER,
    status          TEXT DEFAULT 'NORMAL',
    remark          TEXT,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(sku_id, batch_no)
);

CREATE TABLE IF NOT EXISTS bundle_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    bundle_sku_id   INTEGER NOT NULL,
    item_sku_id     INTEGER NOT NULL,
    quantity        INTEGER NOT NULL,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(bundle_sku_id, item_sku_id)
);

CREATE TABLE IF NOT EXISTS storage_conditions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    temp_min_c      REAL,
    temp_max_c      REAL,
    humidity_min_pct REAL,
    humidity_max_pct REAL,
    avoid_light     INTEGER DEFAULT 0,
    avoid_odor      INTEGER DEFAULT 0,
    description     TEXT,
    created_at      TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS inventory (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sku_id          INTEGER NOT NULL,
    batch_id        INTEGER NOT NULL,
    warehouse_id    INTEGER NOT NULL,
    location_id     INTEGER NOT NULL,
    quantity        INTEGER NOT NULL DEFAULT 0,
    locked_quantity INTEGER DEFAULT 0,
    updated_at      TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(sku_id, batch_id, warehouse_id, location_id)
);

CREATE TABLE IF NOT EXISTS inbound_orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no        TEXT NOT NULL UNIQUE,
    warehouse_id    INTEGER NOT NULL,
    supplier_id     INTEGER,
    inbound_type    TEXT NOT NULL,
    status          TEXT DEFAULT 'DRAFT',
    total_amount    REAL DEFAULT 0,
    operator        TEXT,
    remark          TEXT,
    confirmed_at    TEXT,
    completed_at    TEXT,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS inbound_order_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL,
    sku_id          INTEGER NOT NULL,
    batch_id        INTEGER NOT NULL,
    location_id     INTEGER NOT NULL,
    quantity        INTEGER NOT NULL,
    unit_price      REAL DEFAULT 0,
    amount          REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS outbound_orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no        TEXT NOT NULL UNIQUE,
    warehouse_id    INTEGER NOT NULL,
    outbound_type   TEXT NOT NULL,
    status          TEXT DEFAULT 'DRAFT',
    customer_name   TEXT,
    order_ref       TEXT,
    total_amount    REAL DEFAULT 0,
    operator        TEXT,
    remark          TEXT,
    confirmed_at    TEXT,
    completed_at    TEXT,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS outbound_order_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL,
    sku_id          INTEGER NOT NULL,
    batch_id        INTEGER NOT NULL,
    location_id     INTEGER NOT NULL,
    quantity        INTEGER NOT NULL,
    unit_price      REAL DEFAULT 0,
    amount          REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_transfers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_no     TEXT NOT NULL UNIQUE,
    from_warehouse  INTEGER NOT NULL,
    to_warehouse    INTEGER NOT NULL,
    status          TEXT DEFAULT 'DRAFT',
    operator        TEXT,
    remark          TEXT,
    completed_at    TEXT,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_id     INTEGER NOT NULL,
    sku_id          INTEGER NOT NULL,
    batch_id        INTEGER NOT NULL,
    quantity        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_checks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    check_no        TEXT NOT NULL UNIQUE,
    warehouse_id    INTEGER NOT NULL,
    check_type      TEXT DEFAULT 'FULL',
    status          TEXT DEFAULT 'DRAFT',
    operator        TEXT,
    remark          TEXT,
    checked_at      TEXT,
    adjusted_at     TEXT,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS inventory_check_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    check_id        INTEGER NOT NULL,
    sku_id          INTEGER NOT NULL,
    batch_id        INTEGER NOT NULL,
    location_id     INTEGER NOT NULL,
    system_qty      INTEGER DEFAULT 0,
    actual_qty      INTEGER DEFAULT 0,
    diff_reason     TEXT,
    adjusted        INTEGER DEFAULT 0
);
"""

SEED_DATA_SQL = r"""
-- 分类
INSERT OR IGNORE INTO product_categories (id, parent_id, name, code, sort_order) VALUES
(1,0,'护肤品','ROOT',0),(10,1,'清洁','CLEANSER',1),(11,10,'洁面乳','FOAM_CLEAN',1),(12,10,'卸妆','REMOVER',2),
(20,1,'化妆水','TONER',2),(30,1,'精华','SERUM',3),(40,1,'乳液','LOTION',4),(50,1,'面霜','CREAM',5),
(51,50,'日霜','DAY_CREAM',1),(52,50,'晚霜','NIGHT_CREAM',2),(60,1,'眼霜','EYE_CREAM',6),(70,1,'防晒','SUNSCREEN',7),
(80,1,'面膜','MASK',8),(81,80,'片状面膜','SHEET_MASK',1),(82,80,'涂抹面膜','CREAM_MASK',2),
(90,1,'身体护理','BODY_CARE',9),(100,1,'唇部护理','LIP_CARE',10),(110,1,'套装','GIFT_SET',11),(120,1,'小样','SAMPLE',12);

-- 品牌 & 供应商
INSERT OR IGNORE INTO brands (id, name, name_en, country) VALUES
(1,'兰蔻','Lancome','法国'),(2,'资生堂','Shiseido','日本'),(3,'薇诺娜','Winona','中国'),(4,'修丽可','SkinCeuticals','美国'),(5,'理肤泉','La Roche-Posay','法国');
INSERT OR IGNORE INTO suppliers (id, name, contact_person, contact_phone) VALUES
(1,'欧莱雅（中国）有限公司','张经理','13800001001'),(2,'资生堂（中国）投资有限公司','李经理','13800001002'),(3,'云南贝泰妮生物科技集团','王经理','13800001003'),(4,'欧莱雅活性健康化妆品部','赵经理','13800001004');

-- 仓库 & 库位
INSERT OR IGNORE INTO warehouses (id, name, code, address, warehouse_type) VALUES
(1,'上海总仓','SH-MAIN','上海市嘉定区XX路100号','NORMAL'),(2,'广州分仓','GZ-BRANCH','广州市白云区XX路200号','NORMAL'),(3,'冷藏仓','COLD-01','上海市浦东新区XX路50号','COLD');
INSERT OR IGNORE INTO storage_locations (id, warehouse_id, location_code, location_type) VALUES
(1,1,'A-01-01','SHELF'),(2,1,'A-01-02','SHELF'),(3,1,'A-02-01','SHELF'),(4,1,'B-01-01','FLOOR'),(5,1,'B-01-02','FLOOR'),(6,2,'A-01-01','SHELF'),(7,2,'A-01-02','SHELF'),(8,3,'C-01-01','COLD'),(9,3,'C-01-02','COLD');
INSERT OR IGNORE INTO storage_conditions (id, name, temp_min_c, temp_max_c, humidity_min_pct, humidity_max_pct, avoid_light) VALUES
(1,'常温避光',15,25,30,70,1),(2,'冷藏2-8℃',2,8,30,70,1),(3,'阴凉干燥',10,20,30,60,1),(4,'常温即可',5,35,20,80,0);

-- 产品 & SKU
INSERT OR IGNORE INTO products (id, product_code, category_id, brand_id, name, sub_title, skin_type, efficacy_tags) VALUES
(1,'PROD-0001',11,1,'兰蔻净澈焕肤洁面乳','极光洁面','ALL','清洁,控油,提亮'),
(2,'PROD-0002',20,1,'兰蔻极光精华水','极光水','COMBO','保湿,焕肤,提亮'),
(3,'PROD-0003',30,4,'修丽可CE抗氧化精华','CE精华','ALL','抗氧化,抗老,提亮'),
(4,'PROD-0004',52,1,'兰蔻菁纯晚霜','菁纯晚霜','DRY','抗老,修复,滋润'),
(5,'PROD-0005',60,2,'资生堂盼丽风姿眼霜','小雷达眼霜','ALL','抗皱,紧致,保湿'),
(6,'PROD-0006',70,5,'理肤泉大哥大防晒','防晒乳','ALL','防晒,隔离,清爽'),
(7,'PROD-0007',81,3,'薇诺娜舒护修敏保湿面膜','舒敏面膜','SENSITIVE','舒敏,保湿,修复'),
(8,'PROD-0008',110,1,'兰蔻明星护肤三件套','明星套装','COMBO','保湿,抗老,修护'),
(9,'PROD-0009',51,2,'资生堂悦薇珀翡焕活日霜','悦薇日霜','COMBO','保湿,抗老,提亮'),
(10,'PROD-0010',12,5,'理肤泉眼唇卸妆液','卸妆液','SENSITIVE','卸妆,温和,不刺激');
INSERT OR IGNORE INTO product_skus (id, product_id, sku_code, barcode, spec_name, capacity_ml, capacity_g, cost_price, wholesale_price, retail_price, min_stock_qty, max_stock_qty, weight_kg) VALUES
(1,  1,  'LC-CL-125ML',   '3147750177109', '125ml',  125, 0,  85.00,  150.00,  220.00,  20,  500, 0.18),
(2,  2,  'LC-TN-150ML',   '3147750177208', '150ml',  150, 0,  180.00, 320.00,  480.00,  15,  300, 0.22),
(3,  2,  'LC-TN-250ML',   '3147750177307', '250ml',  250, 0,  260.00, 460.00,  690.00,  10,  200, 0.35),
(4,  3,  'SC-CE-30ML',    '3606000523106', '30ml',   30,  0,  350.00, 600.00,  980.00,  10,  200, 0.08),
(5,  3,  'SC-CE-55ML',    '3606000523205', '55ml',   55,  0,  550.00, 950.00,  1580.00, 8,   150, 0.12),
(6,  4,  'LC-CR-50ML',    '3147750177406', '50ml',   0,   50, 420.00, 720.00,  1180.00, 10,  200, 0.25),
(7,  5,  'SH-EC-15ML',    '4987176008105', '15ml',   0,   15, 180.00, 310.00,  480.00,  10,  200, 0.06),
(8,  6,  'LR-SS-50ML',    '3337872410017', '50ml',   50,  0,  45.00,  85.00,   159.00,  30,  800, 0.10),
(9,  7,  'WN-MS-5PCS',    '6971234560010', '5片/盒',  0,  125, 25.00,  45.00,   79.00,   50,  1000,0.15),
(10, 8,  'LC-GS-3PC',     '3147750177505', '洁面125ml+水150ml+霜50ml', 0, 0, 450.00, 780.00, 1280.00, 5, 100, 0.65),
(11, 9,  'SH-DC-50ML',    '4987176008204', '50ml',   0,   50, 220.00, 380.00,  580.00,  10,  200, 0.25),
(12, 10, 'LR-RM-125ML',   '3337872410024', '125ml',  125, 0,  38.00,  68.00,   109.00,  20,  500, 0.18);

-- 套装BOM
INSERT OR IGNORE INTO bundle_items (bundle_sku_id, item_sku_id, quantity) VALUES (10,1,1),(10,2,1),(10,6,1);

-- 批次
INSERT OR IGNORE INTO product_batches (id, sku_id, supplier_id, batch_no, production_date, expiry_date, storage_cond_id, status) VALUES
(1,  1,  1, 'LC241201',    '2024-12-01', '2027-12-01', 1, 'NORMAL'),
(2,  1,  1, 'LC250301',    '2025-03-01', '2028-03-01', 1, 'NORMAL'),
(3,  2,  1, 'LC241015',    '2024-10-15', '2027-10-15', 1, 'NORMAL'),
(4,  2,  1, 'LC250120',    '2025-01-20', '2028-01-20', 1, 'NORMAL'),
(5,  4,  4, 'SC240901',    '2024-09-01', '2026-09-01', 2, 'NEAR_EXPIRY'),
(6,  4,  4, 'SC250201',    '2025-02-01', '2027-02-01', 2, 'NORMAL'),
(7,  8,  4, 'LR250301',    '2025-03-01', '2028-03-01', 4, 'NORMAL'),
(8,  9,  3, 'WN250101',    '2025-01-01', '2027-01-01', 1, 'NORMAL'),
(9,  6,  1, 'LC241101',    '2024-11-01', '2027-11-01', 1, 'NORMAL'),
(10, 7,  2, 'SH250201',    '2025-02-01', '2028-02-01', 1, 'NORMAL'),
(11, 11, 2, 'SH250101',    '2025-01-01', '2028-01-01', 1, 'NORMAL'),
(12, 12, 4, 'LR250201',    '2025-02-01', '2028-02-01', 4, 'NORMAL'),
(13, 10, 1, 'LC241201-SET','2024-12-01', '2027-12-01', 1, 'NORMAL');

-- 库存
INSERT OR IGNORE INTO inventory (sku_id, batch_id, warehouse_id, location_id, quantity, locked_quantity) VALUES
(1,  1,  1, 1, 50,  5),
(1,  2,  1, 1, 120, 0),
(2,  3,  1, 2, 30,  3),
(2,  4,  1, 2, 80,  0),
(4,  5,  1, 3, 8,   0),
(4,  6,  1, 3, 45,  0),
(6,  9,  1, 1, 25,  2),
(7,  10, 1, 2, 18,  0),
(8,  7,  1, 4, 200, 10),
(9,  8,  1, 5, 500, 20),
(10, 13, 1, 5, 30,  5),
(11, 11, 1, 2, 22,  0),
(12, 12, 1, 1, 80,  0),
(1,  2,  2, 6, 60,  0),
(8,  7,  2, 7, 100, 0),
(9,  8,  2, 7, 200, 0);

-- 入库单
INSERT OR IGNORE INTO inbound_orders (id, order_no, warehouse_id, supplier_id, inbound_type, status, total_amount, operator, confirmed_at, completed_at) VALUES
(1,'IN-2025-0501-001',1,1,'PURCHASE','COMPLETED',45600,'张操作','2025-05-01T09:00:00','2025-05-01T14:00:00'),
(2,'IN-2025-0515-001',1,4,'PURCHASE','COMPLETED',18300,'张操作','2025-05-15T10:00:00','2025-05-15T15:00:00');
INSERT OR IGNORE INTO inbound_order_items (order_id, sku_id, batch_id, location_id, quantity, unit_price, amount) VALUES
(1, 1,  2,  1, 120, 85,  10200),
(1, 2,  4,  2, 80,  180, 14400),
(1, 6,  9,  1, 30,  420, 12600),
(1, 10, 13, 5, 30,  280, 8400),
(2, 4,  6,  3, 45,  350, 15750),
(2, 8,  7,  4, 30,  45,  1350),
(2, 12, 12, 1, 40,  30,  1200);

-- 出库单
INSERT OR IGNORE INTO outbound_orders (id, order_no, warehouse_id, outbound_type, status, customer_name, order_ref, total_amount, operator, confirmed_at, completed_at) VALUES
(1,'OUT-2025-0521-001',1,'SALE','COMPLETED','天猫旗舰店','TM-20250521-0042',3540,'王操作','2025-05-21T08:00:00','2025-05-21T10:00:00'),
(2,'OUT-2025-0522-001',1,'SALE','PICKING','京东自营','JD-20250522-0018',9500,'王操作','2025-05-22T09:00:00',NULL);
INSERT OR IGNORE INTO outbound_order_items (order_id, sku_id, batch_id, location_id, quantity, unit_price, amount) VALUES
(1, 1, 1,  1, 5, 220,  1100),
(1, 4, 5,  3, 2, 980,  1960),
(1, 7, 10, 2, 1, 480,  480),
(2, 2, 3,  2, 5, 480,  2400),
(2, 4, 6,  3, 3, 1580, 4740),
(2, 6, 9,  1, 2, 1180, 2360);

-- 盘点
INSERT OR IGNORE INTO inventory_checks (id, check_no, warehouse_id, check_type, status, operator, checked_at) VALUES
(1,'CK-2025-0522-001',1,'PARTIAL','CHECKED','张操作','2025-05-22T14:00:00');
INSERT OR IGNORE INTO inventory_check_items (id, check_id, sku_id, batch_id, location_id, system_qty, actual_qty, diff_reason) VALUES
(1,1,1,1,1,45,45,NULL),
(2,1,4,5,3,6,6,NULL),
(3,1,6,9,1,25,24,'实物破损1瓶，待报废处理');
"""

VIEWS_SQLITE = r"""
DROP VIEW IF EXISTS v_product_lookup;
CREATE VIEW v_product_lookup AS
SELECT p.product_code AS 产品编号, p.name AS 产品名称, p.sub_title AS 别名, b.name AS 品牌, pc.name AS 品类,
    p.skin_type AS 适用肤质, p.efficacy_tags AS 功效,
    GROUP_CONCAT(sku.spec_name, ' | ') AS 可选规格,
    GROUP_CONCAT(sku.sku_code, ' | ') AS SKU编码列表,
    GROUP_CONCAT(sku.retail_price, ' | ') AS 零售价列表,
    CASE WHEN p.is_active THEN '启用' ELSE '停用' END AS 状态
FROM products p JOIN brands b ON p.brand_id=b.id JOIN product_categories pc ON p.category_id=pc.id
    JOIN product_skus sku ON sku.product_id=p.id
GROUP BY p.id, p.product_code, p.name, p.sub_title, b.name, pc.name, p.skin_type, p.efficacy_tags, p.is_active;

DROP VIEW IF EXISTS v_inventory_summary;
CREATE VIEW v_inventory_summary AS
SELECT wh.name AS warehouse_name, p.product_code, p.name AS product_name, b.name AS brand_name,
    sku.sku_code, sku.spec_name, sku.retail_price,
    COALESCE(SUM(inv.quantity),0) AS total_qty, COALESCE(SUM(inv.locked_quantity),0) AS locked_qty,
    COALESCE(SUM(inv.quantity),0)-COALESCE(SUM(inv.locked_quantity),0) AS available_qty,
    sku.min_stock_qty, sku.max_stock_qty,
    CASE WHEN COALESCE(SUM(inv.quantity),0) <= sku.min_stock_qty THEN 'BELOW_MIN'
         WHEN COALESCE(SUM(inv.quantity),0) >= sku.max_stock_qty THEN 'ABOVE_MAX' ELSE 'NORMAL' END AS stock_status
FROM inventory inv JOIN product_skus sku ON inv.sku_id=sku.id JOIN products p ON sku.product_id=p.id
    JOIN brands b ON p.brand_id=b.id JOIN product_categories pc ON p.category_id=pc.id
    JOIN warehouses wh ON inv.warehouse_id=wh.id
WHERE p.is_active=1 AND sku.is_active=1
GROUP BY wh.name, p.product_code, p.name, b.name, sku.sku_code, sku.spec_name, sku.retail_price, sku.min_stock_qty, sku.max_stock_qty;

DROP VIEW IF EXISTS v_export_expiry_stock;
CREATE VIEW v_export_expiry_stock AS
SELECT wh.name AS 仓库, sl.location_code AS 库位, b.name AS 品牌, p.product_code AS 产品编号, p.name AS 产品名称,
    sku.sku_code AS SKU编码, sku.spec_name AS 规格, pb.batch_no AS 批次号,
    pb.production_date AS 生产日期, pb.expiry_date AS 有效期至,
    CAST(julianday(pb.expiry_date)-julianday(date('now')) AS INTEGER) AS 剩余天数,
    inv.quantity AS 库存数量, inv.locked_quantity AS 锁定数量,
    inv.quantity-inv.locked_quantity AS 可用数量,
    (inv.quantity-inv.locked_quantity)*sku.retail_price AS 可用货值,
    sku.cost_price AS 成本价, (inv.quantity-inv.locked_quantity)*sku.cost_price AS 可用成本,
    CASE WHEN julianday(pb.expiry_date)-julianday(date('now')) <= 0   THEN '立即销毁'
         WHEN julianday(pb.expiry_date)-julianday(date('now')) <= 30  THEN '紧急促销/报损'
         WHEN julianday(pb.expiry_date)-julianday(date('now')) <= 90  THEN '折扣促销/渠道清货'
         WHEN julianday(pb.expiry_date)-julianday(date('now')) <= 180 THEN '优先出库/制定促销计划'
         ELSE '-' END AS 处置建议
FROM inventory inv JOIN product_batches pb ON inv.batch_id=pb.id JOIN product_skus sku ON inv.sku_id=sku.id
    JOIN products p ON sku.product_id=p.id JOIN brands b ON p.brand_id=b.id
    JOIN warehouses wh ON inv.warehouse_id=wh.id JOIN storage_locations sl ON inv.location_id=sl.id
WHERE inv.quantity>0 AND julianday(pb.expiry_date)-julianday(date('now')) <= 180;

DROP VIEW IF EXISTS v_inventory_ledger;
CREATE VIEW v_inventory_ledger AS
SELECT 'IN' AS io_type, io.order_no, p.product_code, sku.sku_code, p.name AS product_name, sku.spec_name, pb.batch_no,
    wh.name AS warehouse_name, sl.location_code, ioi.quantity, ioi.unit_price, ioi.amount, io.inbound_type AS biz_type, io.created_at AS trans_time
FROM inbound_order_items ioi JOIN inbound_orders io ON ioi.order_id=io.id JOIN product_skus sku ON ioi.sku_id=sku.id
    JOIN products p ON sku.product_id=p.id JOIN product_batches pb ON ioi.batch_id=pb.id
    JOIN warehouses wh ON io.warehouse_id=wh.id JOIN storage_locations sl ON ioi.location_id=sl.id
WHERE io.status='COMPLETED'
UNION ALL
SELECT 'OUT', oo.order_no, p.product_code, sku.sku_code, p.name, sku.spec_name, pb.batch_no,
    wh.name, sl.location_code, -ooi.quantity, ooi.unit_price, ooi.amount, oo.outbound_type, oo.created_at
FROM outbound_order_items ooi JOIN outbound_orders oo ON ooi.order_id=oo.id JOIN product_skus sku ON ooi.sku_id=sku.id
    JOIN products p ON sku.product_id=p.id JOIN product_batches pb ON ooi.batch_id=pb.id
    JOIN warehouses wh ON oo.warehouse_id=wh.id JOIN storage_locations sl ON ooi.location_id=sl.id
WHERE oo.status='COMPLETED';
"""


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA_SQLITE)
    conn.executescript(SEED_DATA_SQL)
    conn.executescript(VIEWS_SQLITE)
    conn.commit()
    conn.close()
    print(f"[OK] 数据库已初始化: {DB_PATH}")


# ============================================================================
# 简易 Web 服务器
# ============================================================================

HTML_PAGE = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>护肤品库存管理</title>
<style>
  :root{--bg:#f5f5f5;--card:#fff;--pri:#6366f1;--danger:#ef4444;--warn:#f59e0b;--ok:#22c55e;--text:#1f2937;--muted:#9ca3af;--border:#e5e7eb}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text)}
  .nav{background:var(--card);border-bottom:1px solid var(--border);padding:0 24px;display:flex;align-items:center;gap:24px;height:56px;position:sticky;top:0}
  .nav h1{font-size:18px;color:var(--pri)}
  .nav a{text-decoration:none;color:var(--text);font-size:14px;padding:6px 12px;border-radius:6px}
  .nav a.active{background:var(--pri);color:#fff}
  .main{max-width:1400px;margin:0 auto;padding:24px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}
  .card{background:var(--card);border-radius:10px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  .card .val{font-size:32px;font-weight:700}.card .lbl{color:var(--muted);font-size:13px;margin-top:4px}
  .card.pri .val{color:var(--pri)}.card.danger .val{color:var(--danger)}.card.warn .val{color:var(--warn)}.card.ok .val{color:var(--ok)}
  table{width:100%;border-collapse:collapse;background:var(--card);border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:16px}
  th{background:#f9fafb;text-align:left;padding:10px 14px;font-size:12px;font-weight:600;color:var(--muted);border-bottom:1px solid var(--border);white-space:nowrap}
  td{padding:8px 14px;font-size:13px;border-bottom:1px solid var(--border)}tr:hover{background:#f9fafb}
  .search{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
  .search input,.search select{padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:14px}
  .search input{flex:1;min-width:200px}
  .btn{padding:8px 16px;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:500}
  .btn-pri{background:var(--pri);color:#fff}.btn-out{background:#fff;border:1px solid var(--border)}
  .badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600}
  .bg-ok{background:#dcfce7;color:#16a34a}.bg-warn{background:#fef3c7;color:#d97706}.bg-danger{background:#fee2e2;color:#dc2626}.bg-muted{background:#f3f4f6;color:#6b7280}
  .code{font-family:"SF Mono","Cascadia Code",monospace;font-size:13px;color:var(--pri);font-weight:600}
  .empty{text-align:center;padding:48px;color:var(--muted)}.hint{color:var(--muted);font-size:13px;margin-bottom:16px}
</style>
</head>
<body>
<div class="nav">
  <h1>护肤品库存管理</h1>
  <a href="/" class="active" id="nav-dash">仪表盘</a>
  <a href="/products" id="nav-prod">产品总览</a>
  <a href="/inventory" id="nav-inv">库存查询</a>
  <a href="/expiry" id="nav-exp">临期预警</a>
  <a href="/ledger" id="nav-ledger">出入库流水</a>
</div>
<div class="main" id="content"></div>
<script>
const BADGES = {
  'BELOW_MIN':'badge bg-danger','低于最低库存':'badge bg-danger',
  '已过期':'badge bg-danger','EXPIRED':'badge bg-danger','立即销毁':'badge bg-danger','紧急促销/报损':'badge bg-danger',
  '盘亏':'badge bg-danger',
  '180天内到期':'badge bg-warn','90天内到期':'badge bg-warn','折扣促销/渠道清货':'badge bg-warn','WARNING_180':'badge bg-warn',
  '正常':'badge bg-ok','NORMAL':'badge bg-ok','启用':'badge bg-ok',
  'DRAFT':'badge bg-muted','草稿':'badge bg-muted'
};

function badge(v) {
  const c = BADGES[v] || '';
  if (v && (''+v).startsWith('PROD-')) return `<span class="code">${v}</span>`;
  if (v && (''+v).startsWith('-')) return `<span style="color:var(--danger)">${v}</span>`;
  return c ? `<span class="${c}">${v}</span>` : (v === null ? '-' : v);
}

function table(rows) {
  if (!rows || rows.length === 0) return '<div class="empty">暂无数据</div>';
  const cols = Object.keys(rows[0]);
  const th = cols.map(c => `<th>${c}</th>`).join('');
  const trs = rows.map(r => '<tr>' + cols.map(c => `<td>${badge(r[c])}</td>`).join('') + '</tr>').join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

async function dash() {
  setNav('dash');
  const r = await fetch('/api/dashboard').then(x => x.json());
  document.getElementById('content').innerHTML =
    `<div class="cards">
      <div class="card pri"><div class="val">${r.sku_count}</div><div class="lbl">活跃SKU数</div></div>
      <div class="card ok"><div class="val">${r.total_stock.toLocaleString()}</div><div class="lbl">总库存数量</div></div>
      <div class="card pri"><div class="val">${r.available.toLocaleString()}</div><div class="lbl">可用库存</div></div>
      <div class="card danger"><div class="val">${r.near_expiry}</div><div class="lbl">临期批次(90天)</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div><strong>低库存预警</strong><br>${table(r.low_stock)}</div>
      <div><strong>最近入库</strong><br>${table(r.recent_in)}</div>
    </div>`;
}

async function products(q) {
  setNav('prod');
  const url = q ? '/api/products?q=' + encodeURIComponent(q) : '/api/products';
  const rows = await fetch(url).then(x => x.json());
  document.getElementById('content').innerHTML =
    `<div class="search">
      <input id="sq" placeholder="输入产品编号、名称、品牌或品类搜索..." value="${q||''}" onkeydown="if(event.key==='Enter')products(document.getElementById('sq').value)">
      <button class="btn btn-pri" onclick="products(document.getElementById('sq').value)">搜索</button>
      <button class="btn btn-out" onclick="exportCSV('/api/products/export')">导出CSV</button>
    </div>
    <div class="hint">共 ${rows.length} 个产品</div>
    ${table(rows)}`;
}

async function inventory(q, wh) {
  setNav('inv');
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (wh) params.set('warehouse', wh);
  const [rows, whs] = await Promise.all([
    fetch('/api/inventory?'+params).then(x=>x.json()),
    fetch('/api/warehouses').then(x=>x.json())
  ]);
  const whOpts = whs.map(w=>`<option value="${w}" ${w===wh?'selected':''}>${w}</option>`).join('');
  document.getElementById('content').innerHTML =
    `<div class="search">
      <input id="sq" placeholder="搜索产品或SKU编码..." value="${q||''}" onkeydown="if(event.key==='Enter')inventory(document.getElementById('sq').value,document.getElementById('swh').value)">
      <select id="swh" onchange="inventory(document.getElementById('sq').value,this.value)">
        <option value="">全部仓库</option>${whOpts}
      </select>
      <button class="btn btn-pri" onclick="inventory(document.getElementById('sq').value,document.getElementById('swh').value)">查询</button>
      <button class="btn btn-out" onclick="exportCSV('/api/inventory/export')">导出CSV</button>
    </div>
    ${table(rows)}`;
}

async function expiry() {
  setNav('exp');
  const rows = await fetch('/api/expiry').then(x=>x.json());
  document.getElementById('content').innerHTML =
    `<div style="margin-bottom:12px"><button class="btn btn-out" onclick="exportCSV('/api/expiry/export')">导出CSV</button></div>
    ${rows.length ? table(rows) : '<div class="empty">没有临期库存，状态良好</div>'}`;
}

async function ledger(days) {
  setNav('ledger');
  days = days || 30;
  const rows = await fetch('/api/ledger?days='+days).then(x=>x.json());
  const opts = [7,15,30,60,90].map(d=>`<option value="${d}" ${d===days?'selected':''}>最近${d}天</option>`).join('');
  document.getElementById('content').innerHTML =
    `<div class="search">
      <select id="sd" onchange="ledger(+this.value)">${opts}</select>
      <button class="btn btn-out" onclick="exportCSV('/api/ledger/export?days='+document.getElementById('sd').value)">导出CSV</button>
    </div>
    ${table(rows)}`;
}

function setNav(page) {
  document.querySelectorAll('.nav a').forEach(a=>a.classList.remove('active'));
  const el = document.getElementById('nav-'+page);
  if (el) el.classList.add('active');
}

function exportCSV(url) {
  window.open(url, '_blank');
}

// 路由
function route() {
  const p = location.pathname;
  if (p === '/' || p === '') dash();
  else if (p === '/products') products();
  else if (p === '/inventory') inventory();
  else if (p === '/expiry') expiry();
  else if (p === '/ledger') ledger();
  else dash();
}

window.addEventListener('popstate', route);
document.addEventListener('DOMContentLoaded', route);
</script>
</body>
</html>
"""


HTML_PAGE = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>库存管理系统</title>
<style>
  :root{--bg:#f6f7f9;--panel:#fff;--line:#e5e7eb;--text:#1f2937;--sub:#6b7280;--brand:#2563eb;--ok:#16a34a;--warn:#d97706;--bad:#dc2626}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",Arial,sans-serif}
  .nav{height:58px;background:var(--panel);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;padding:0 22px;position:sticky;top:0;z-index:2}
  .nav h1{font-size:18px;margin:0 18px 0 0;color:#111827}.nav a{color:var(--text);text-decoration:none;font-size:14px;padding:8px 12px;border-radius:6px}.nav a.active{background:var(--brand);color:#fff}
  .main{max-width:1500px;margin:0 auto;padding:22px}.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.toolbar input,.toolbar select,.form input,.form select,.form textarea{height:36px;border:1px solid var(--line);border-radius:6px;padding:0 10px;background:#fff;font-size:14px}.toolbar input{min-width:260px}
  .btn{height:36px;border:1px solid var(--line);border-radius:6px;background:#fff;padding:0 13px;font-size:14px;cursor:pointer}.btn.primary{background:var(--brand);border-color:var(--brand);color:#fff}.btn.danger{background:#fee2e2;border-color:#fecaca;color:var(--bad)}.btn.ok{background:#dcfce7;border-color:#bbf7d0;color:var(--ok)}
  .cards{display:grid;grid-template-columns:repeat(6,minmax(150px,1fr));gap:12px;margin-bottom:18px}.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px}.card .v{font-size:28px;font-weight:700}.card .k{font-size:13px;color:var(--sub);margin-top:4px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.panel{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:16px}.panel h2{font-size:16px;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden}th,td{border-bottom:1px solid var(--line);padding:9px 10px;text-align:left;font-size:13px;vertical-align:middle}th{background:#f9fafb;color:var(--sub);font-weight:600;white-space:nowrap}tr:hover td{background:#f9fafb}
  .code{font-family:"Cascadia Mono",Consolas,monospace;color:var(--brand);font-weight:600}.empty{text-align:center;color:var(--sub);padding:40px;background:#fff;border:1px solid var(--line);border-radius:8px}
  .tag{display:inline-block;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600}.tag.ok{background:#dcfce7;color:var(--ok)}.tag.warn{background:#fef3c7;color:var(--warn)}.tag.bad{background:#fee2e2;color:var(--bad)}
  .modal{position:fixed;inset:0;background:rgba(15,23,42,.35);display:none;align-items:center;justify-content:center;padding:20px;z-index:5}.dialog{width:min(860px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:8px;border:1px solid var(--line);box-shadow:0 20px 60px rgba(0,0,0,.2)}.dialog header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--line)}.dialog header h2{font-size:17px;margin:0}.dialog .body{padding:18px}.form{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.form label{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--sub)}.form textarea{height:74px;padding-top:8px;grid-column:span 3}.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
  @media(max-width:900px){.cards,.grid2,.form{grid-template-columns:1fr}.nav{overflow:auto}.main{padding:14px}.form textarea{grid-column:span 1}}
</style>
</head>
<body>
<div class="nav">
  <h1>库存管理系统</h1>
  <a href="/" id="nav-dashboard">仪表盘</a>
  <a href="/products" id="nav-products">产品管理</a>
  <a href="/inventory" id="nav-inventory">库存管理</a>
  <a href="/stats" id="nav-stats">统计分析</a>
  <a href="/expiry" id="nav-expiry">临期预警</a>
  <a href="/ledger" id="nav-ledger">出入库流水</a>
</div>
<main class="main" id="content"></main>
<div class="modal" id="modal"><div class="dialog"><header><h2 id="modalTitle"></h2><button class="btn" onclick="closeModal()">关闭</button></header><div class="body" id="modalBody"></div></div></div>
<script>
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const money = v => Number(v || 0).toLocaleString('zh-CN', {minimumFractionDigits:2, maximumFractionDigits:2});
async function api(url, opts={}) { const res = await fetch(url, opts); const data = await res.json().catch(() => ({})); if (!res.ok || data.error) throw new Error(data.error || '操作失败'); return data; }
function setNav(name){document.querySelectorAll('.nav a').forEach(a=>a.classList.remove('active')); const el=$('#nav-'+name); if(el)el.classList.add('active');}
function badge(v){if(v==='低于最低库存'||v==='BELOW_MIN')return '<span class="tag bad">低库存</span>'; if(v==='高于最高库存'||v==='ABOVE_MAX')return '<span class="tag warn">高库存</span>'; if(v==='正常'||v==='NORMAL')return '<span class="tag ok">正常</span>'; return esc(v);}
function table(rows, actions){ if(!rows || !rows.length) return '<div class="empty">暂无数据</div>'; const cols = Object.keys(rows[0]).filter(c=>!c.startsWith('_')); return `<table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}${actions?'<th>操作</th>':''}</tr></thead><tbody>`+rows.map(r=>`<tr>${cols.map(c=>`<td>${c.includes('金额')||c.includes('货值')?money(r[c]):badge(r[c])}</td>`).join('')}${actions?`<td>${actions(r)}</td>`:''}</tr>`).join('')+'</tbody></table>'; }
function openModal(title, body){$('#modalTitle').textContent=title; $('#modalBody').innerHTML=body; $('#modal').style.display='flex';}
function closeModal(){$('#modal').style.display='none';}

async function dashboard(){ setNav('dashboard'); const r = await api('/api/dashboard'); $('#content').innerHTML = `<div class="cards"><div class="card"><div class="v">${r.product_count}</div><div class="k">产品数量</div></div><div class="card"><div class="v">${r.sku_count}</div><div class="k">SKU 数量</div></div><div class="card"><div class="v">${r.total_stock}</div><div class="k">总库存</div></div><div class="card"><div class="v">${r.available}</div><div class="k">可用库存</div></div><div class="card"><div class="v">${money(r.stock_value)}</div><div class="k">零售货值</div></div><div class="card"><div class="v">${r.low_stock_count}</div><div class="k">低库存 SKU</div></div></div><div class="grid2"><div class="panel"><h2>低库存提醒</h2>${table(r.low_stock)}</div><div class="panel"><h2>最近流水</h2>${table(r.recent_ledger)}</div></div>`; }

async function products(q=''){ setNav('products'); const rows = await api('/api/products' + (q ? '?q='+encodeURIComponent(q) : '')); $('#content').innerHTML = `<div class="toolbar"><input id="q" placeholder="搜索产品编号、名称、品牌、SKU" value="${esc(q)}" onkeydown="if(event.key==='Enter')products(this.value)"><button class="btn primary" onclick="products($('#q').value)">搜索</button><button class="btn primary" onclick="productForm()">新增产品</button><button class="btn" onclick="exportCSV('/api/products/export')">导出 CSV</button></div>${table(rows, r => `<button class="btn" onclick="productForm(${r._id})">编辑</button> <button class="btn danger" onclick="deleteProduct(${r._id})">删除</button>`)}`; }
async function productForm(id){ const meta = await api('/api/meta'); const p = id ? await api('/api/products/detail?id='+id) : {}; const opt = (list, val) => list.map(x=>`<option value="${x.id}" ${Number(val)===x.id?'selected':''}>${esc(x.name)}</option>`).join(''); openModal(id?'编辑产品':'新增产品', `<div class="form"><input type="hidden" id="pid" value="${p.id||''}"><label>产品编号<input id="product_code" value="${esc(p.product_code||'')}" placeholder="例如 PROD-0011"></label><label>产品名称<input id="name" value="${esc(p.name||'')}"></label><label>品牌<select id="brand_id">${opt(meta.brands,p.brand_id)}</select></label><label>分类<select id="category_id">${opt(meta.categories,p.category_id)}</select></label><label>SKU 编码<input id="sku_code" value="${esc(p.sku_code||'')}" placeholder="例如 SKU-001"></label><label>规格<input id="spec_name" value="${esc(p.spec_name||'')}" placeholder="例如 50ml"></label><label>成本价<input id="cost_price" type="number" step="0.01" value="${p.cost_price||0}"></label><label>零售价<input id="retail_price" type="number" step="0.01" value="${p.retail_price||0}"></label><label>最低库存<input id="min_stock_qty" type="number" value="${p.min_stock_qty||0}"></label><label>最高库存<input id="max_stock_qty" type="number" value="${p.max_stock_qty||99999}"></label><label>保质期天数<input id="shelf_life_days" type="number" value="${p.shelf_life_days||1095}"></label><textarea id="remark" placeholder="备注、功效、说明">${esc(p.efficacy_tags||'')}</textarea></div><div class="actions"><button class="btn" onclick="closeModal()">取消</button><button class="btn primary" onclick="saveProduct()">保存</button></div>`); }
async function saveProduct(){ const fields = ['pid','product_code','name','brand_id','category_id','sku_code','spec_name','cost_price','retail_price','min_stock_qty','max_stock_qty','shelf_life_days','remark']; const data = Object.fromEntries(fields.map(f=>[f,$('#'+f).value])); await api('/api/products/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); closeModal(); products($('#q')?.value || ''); }
async function deleteProduct(id){ if(!confirm('确定删除这个产品吗？已有流水的数据会保留，产品会设为停用。')) return; await api('/api/products/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}); products($('#q')?.value || ''); }

async function inventory(q='', warehouse=''){ setNav('inventory'); const params = new URLSearchParams(); if(q)params.set('q',q); if(warehouse)params.set('warehouse',warehouse); const [rows, meta] = await Promise.all([api('/api/inventory?'+params), api('/api/meta')]); const whOpts = meta.warehouses.map(w=>`<option value="${w.name}" ${w.name===warehouse?'selected':''}>${esc(w.name)}</option>`).join(''); $('#content').innerHTML = `<div class="toolbar"><input id="q" placeholder="搜索产品或 SKU" value="${esc(q)}" onkeydown="if(event.key==='Enter')inventory(this.value,$('#wh').value)"><select id="wh" onchange="inventory($('#q').value,this.value)"><option value="">全部仓库</option>${whOpts}</select><button class="btn primary" onclick="inventory($('#q').value,$('#wh').value)">查询</button><button class="btn ok" onclick="stockForm('IN')">入库</button><button class="btn danger" onclick="stockForm('OUT')">出库</button><button class="btn" onclick="stockForm('ADJUST')">盘点调整</button><button class="btn" onclick="exportCSV('/api/inventory/export')">导出 CSV</button></div>${table(rows)}`; }
async function stockForm(type){ const meta = await api('/api/stock/options'); const title = type==='IN'?'新增入库':(type==='OUT'?'新增出库':'盘点调整'); const skuOpt = meta.skus.map(x=>`<option value="${x.id}">${esc(x.name)} / ${esc(x.sku_code)} / ${esc(x.spec_name)}</option>`).join(''); const whOpt = meta.warehouses.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join(''); const locOpt = meta.locations.map(x=>`<option value="${x.id}">${esc(x.warehouse)} - ${esc(x.location_code)}</option>`).join(''); const batchOpt = meta.batches.map(x=>`<option value="${x.id}">${esc(x.sku_code)} / ${esc(x.batch_no)} / 库存 ${x.quantity}</option>`).join(''); openModal(title, `<div class="form"><input type="hidden" id="stock_type" value="${type}"><label>商品 SKU<select id="sku_id">${skuOpt}</select></label><label>仓库<select id="warehouse_id">${whOpt}</select></label><label>库位<select id="location_id">${locOpt}</select></label><label>${type==='IN'?'批次号':'选择批次'}${type==='IN'?'<input id="batch_no" placeholder="留空自动生成">':`<select id="batch_id">${batchOpt}</select>`}</label><label>生产日期<input id="production_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>有效期至<input id="expiry_date" type="date" value="${new Date(Date.now()+1095*86400000).toISOString().slice(0,10)}"></label><label>${type==='ADJUST'?'调整后数量':'数量'}<input id="quantity" type="number" min="0" value="1"></label><label>经办人<input id="operator" value="管理员"></label><textarea id="remark" placeholder="备注"></textarea></div><div class="actions"><button class="btn" onclick="closeModal()">取消</button><button class="btn primary" onclick="saveStock()">保存</button></div>`); }
async function saveStock(){ const data = {}; ['stock_type','sku_id','warehouse_id','location_id','batch_id','batch_no','production_date','expiry_date','quantity','operator','remark'].forEach(id=>{const el=$('#'+id); if(el)data[id]=el.value;}); await api('/api/stock/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); closeModal(); inventory($('#q')?.value || '', $('#wh')?.value || ''); }

async function stats(){ setNav('stats'); const r = await api('/api/stats'); $('#content').innerHTML = `<div class="grid2"><div class="panel"><h2>按仓库统计</h2>${table(r.by_warehouse)}</div><div class="panel"><h2>按品牌统计</h2>${table(r.by_brand)}</div><div class="panel"><h2>高货值 SKU</h2>${table(r.top_value)}</div><div class="panel"><h2>库存状态</h2>${table(r.stock_status)}</div></div>`; }
async function expiry(){ setNav('expiry'); const rows = await api('/api/expiry'); $('#content').innerHTML = `<div class="toolbar"><button class="btn" onclick="exportCSV('/api/expiry/export')">导出 CSV</button></div>${table(rows)}`; }
async function ledger(days=30){ setNav('ledger'); const rows = await api('/api/ledger?days='+days); const opts = [7,15,30,60,90,180].map(d=>`<option value="${d}" ${d===days?'selected':''}>最近 ${d} 天</option>`).join(''); $('#content').innerHTML = `<div class="toolbar"><select id="days" onchange="ledger(+this.value)">${opts}</select><button class="btn" onclick="exportCSV('/api/ledger/export?days='+$('#days').value)">导出 CSV</button></div>${table(rows)}`; }
function exportCSV(url){window.open(url,'_blank');}
function route(){const p=location.pathname; if(p==='/products')products(); else if(p==='/inventory')inventory(); else if(p==='/stats')stats(); else if(p==='/expiry')expiry(); else if(p==='/ledger')ledger(); else dashboard();}
window.addEventListener('popstate', route); document.addEventListener('DOMContentLoaded', route);
</script>
</body>
</html>
"""


def application(environ, start_response):
    path = environ["PATH_INFO"]
    qs = environ.get("QUERY_STRING", "")

    try:
        if path == "/":
            return html(start_response, HTML_PAGE)

        elif path.startswith("/api/"):
            return api_handler(path, qs, start_response, environ)

        else:
            return html(start_response, HTML_PAGE)

    except Exception as e:
        import traceback
        traceback.print_exc()
        start_response("500 Internal Server Error", [("Content-Type", "text/plain")])
        return [str(e).encode()]


def api_handler(path, qs, start_response):
    from urllib.parse import parse_qs
    params = parse_qs(qs)
    db = get_db()

    # 仪表盘数据
    if path == "/api/dashboard":
        sku = db.execute("SELECT COUNT(*) AS cnt FROM product_skus WHERE is_active=1").fetchone()["cnt"]
        total = db.execute("SELECT COALESCE(SUM(quantity),0) AS cnt FROM inventory").fetchone()["cnt"]
        avail = db.execute("SELECT COALESCE(SUM(quantity-locked_quantity),0) AS cnt FROM inventory").fetchone()["cnt"]
        exp = db.execute("""
            SELECT COUNT(DISTINCT inv.batch_id) AS cnt FROM inventory inv
            JOIN product_batches pb ON inv.batch_id=pb.id
            WHERE pb.status='NORMAL' AND julianday(pb.expiry_date)-julianday(date('now')) <= 90
              AND julianday(pb.expiry_date)-julianday(date('now')) > 0
        """).fetchone()["cnt"]
        low = [dict(r) for r in db.execute("SELECT * FROM v_inventory_summary WHERE stock_status='BELOW_MIN' LIMIT 10")]
        recent = [dict(r) for r in db.execute("SELECT * FROM v_inventory_ledger WHERE trans_time >= date('now','-14 days') ORDER BY trans_time DESC LIMIT 10")]
        return json_resp(start_response, {"sku_count": sku, "total_stock": total, "available": avail, "near_expiry": exp, "low_stock": low, "recent_in": recent})

    # 产品
    elif path == "/api/products":
        q = params.get("q", [""])[0]
        if q:
            rows = [dict(r) for r in db.execute("SELECT * FROM v_product_lookup WHERE 产品编号 LIKE ? OR 产品名称 LIKE ? OR 别名 LIKE ? OR 品牌 LIKE ? OR 品类 LIKE ?", [f"%{q}%"]*5)]
        else:
            rows = [dict(r) for r in db.execute("SELECT * FROM v_product_lookup")]
        return json_resp(start_response, rows)

    elif path == "/api/products/export":
        return csv_export(db, "v_product_lookup", start_response)

    # 库存
    elif path == "/api/inventory":
        q = params.get("q", [""])[0]
        wh = params.get("warehouse", [""])[0]
        query = "SELECT * FROM v_inventory_summary WHERE 1=1"
        args = []
        if q:
            query += " AND (product_name LIKE ? OR sku_code LIKE ?)"
            args.extend([f"%{q}%", f"%{q}%"])
        if wh:
            query += " AND warehouse_name = ?"
            args.append(wh)
        rows = [dict(r) for r in db.execute(query, args)]
        return json_resp(start_response, rows)

    elif path == "/api/inventory/export":
        return csv_export(db, "v_inventory_summary", start_response)

    elif path == "/api/warehouses":
        rows = [r["warehouse_name"] for r in db.execute("SELECT DISTINCT warehouse_name FROM v_inventory_summary ORDER BY warehouse_name")]
        return json_resp(start_response, rows)

    # 临期
    elif path == "/api/expiry":
        rows = [dict(r) for r in db.execute("SELECT * FROM v_export_expiry_stock")]
        return json_resp(start_response, rows)

    elif path == "/api/expiry/export":
        return csv_export(db, "v_export_expiry_stock", start_response)

    # 流水
    elif path == "/api/ledger":
        days = int(params.get("days", ["30"])[0])
        rows = [dict(r) for r in db.execute("SELECT * FROM v_inventory_ledger WHERE trans_time >= date('now', ?) ORDER BY trans_time DESC LIMIT 500", [f"-{days} days"])]
        return json_resp(start_response, rows)

    elif path == "/api/ledger/export":
        days = params.get("days", ["30"])[0]
        return csv_export(db, "v_inventory_ledger", start_response, f"trans_time >= date('now', '-{days} days')")

    return json_resp(start_response, {"error": "not found"}, 404)


def api_handler(path, qs, start_response, environ=None):
    from urllib.parse import parse_qs
    params = parse_qs(qs)
    db = get_db()
    method = (environ or {}).get("REQUEST_METHOD", "GET")

    def body_json():
        if method != "POST":
            return {}
        size = int((environ or {}).get("CONTENT_LENGTH") or 0)
        raw = (environ or {}).get("wsgi.input").read(size) if size else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    if path == "/api/dashboard":
        product = db.execute("SELECT COUNT(*) AS cnt FROM products WHERE is_active=1").fetchone()["cnt"]
        sku = db.execute("SELECT COUNT(*) AS cnt FROM product_skus WHERE is_active=1").fetchone()["cnt"]
        total = db.execute("SELECT COALESCE(SUM(quantity),0) AS cnt FROM inventory").fetchone()["cnt"]
        avail = db.execute("SELECT COALESCE(SUM(quantity-locked_quantity),0) AS cnt FROM inventory").fetchone()["cnt"]
        value = db.execute("SELECT COALESCE(SUM((inv.quantity-inv.locked_quantity)*sku.retail_price),0) AS amount FROM inventory inv JOIN product_skus sku ON inv.sku_id=sku.id").fetchone()["amount"]
        low_count = db.execute("""
            SELECT COUNT(*) AS cnt FROM (
                SELECT sku.id, COALESCE(SUM(inv.quantity),0) qty, sku.min_stock_qty
                FROM product_skus sku LEFT JOIN inventory inv ON inv.sku_id=sku.id
                WHERE sku.is_active=1 GROUP BY sku.id HAVING qty <= sku.min_stock_qty
            )
        """).fetchone()["cnt"]
        exp = db.execute("""
            SELECT COUNT(DISTINCT inv.batch_id) AS cnt FROM inventory inv
            JOIN product_batches pb ON inv.batch_id=pb.id
            WHERE julianday(pb.expiry_date)-julianday(date('now')) <= 90
              AND julianday(pb.expiry_date)-julianday(date('now')) > 0
        """).fetchone()["cnt"]
        low = [dict(r) for r in db.execute("""
            SELECT p.name AS 产品名称, sku.sku_code AS SKU编码, sku.spec_name AS 规格,
                   COALESCE(SUM(inv.quantity),0) AS 当前库存, sku.min_stock_qty AS 最低库存
            FROM product_skus sku JOIN products p ON sku.product_id=p.id
            LEFT JOIN inventory inv ON inv.sku_id=sku.id
            WHERE p.is_active=1 AND sku.is_active=1
            GROUP BY sku.id HAVING 当前库存 <= sku.min_stock_qty
            ORDER BY 当前库存 ASC LIMIT 10
        """)]
        recent = [dict(r) for r in db.execute("""
            SELECT CASE io_type WHEN 'IN' THEN '入库' ELSE '出库' END AS 类型,
                   order_no AS 单号, product_name AS 产品, sku_code AS SKU,
                   quantity AS 数量, biz_type AS 业务类型, trans_time AS 时间
            FROM v_inventory_ledger ORDER BY trans_time DESC LIMIT 10
        """)]
        return json_resp(start_response, {"product_count": product, "sku_count": sku, "total_stock": total, "available": avail, "stock_value": value, "near_expiry": exp, "low_stock_count": low_count, "low_stock": low, "recent_ledger": recent})

    if path == "/api/products":
        q = params.get("q", [""])[0]
        query = """
            SELECT p.id AS _id, p.product_code AS 产品编号, p.name AS 产品名称, b.name AS 品牌,
                   pc.name AS 分类, sku.sku_code AS SKU编码, sku.spec_name AS 规格,
                   sku.cost_price AS 成本价, sku.retail_price AS 零售价,
                   sku.min_stock_qty AS 最低库存, sku.max_stock_qty AS 最高库存,
                   CASE WHEN p.is_active=1 THEN '启用' ELSE '停用' END AS 状态
            FROM products p
            JOIN brands b ON p.brand_id=b.id
            JOIN product_categories pc ON p.category_id=pc.id
            LEFT JOIN product_skus sku ON sku.product_id=p.id AND sku.is_active=1
            WHERE p.is_active=1
        """
        args = []
        if q:
            query += " AND (p.product_code LIKE ? OR p.name LIKE ? OR b.name LIKE ? OR sku.sku_code LIKE ?)"
            args = [f"%{q}%"] * 4
        query += " ORDER BY p.id DESC, sku.id LIMIT 500"
        return json_resp(start_response, [dict(r) for r in db.execute(query, args)])

    if path == "/api/products/detail":
        pid = int(params.get("id", ["0"])[0])
        row = db.execute("""
            SELECT p.*, sku.sku_code, sku.spec_name, sku.cost_price, sku.retail_price,
                   sku.min_stock_qty, sku.max_stock_qty
            FROM products p LEFT JOIN product_skus sku ON sku.product_id=p.id AND sku.is_active=1
            WHERE p.id=? ORDER BY sku.id LIMIT 1
        """, [pid]).fetchone()
        return json_resp(start_response, dict(row) if row else {})

    if path == "/api/products/save":
        data = body_json()
        required = ["product_code", "name", "brand_id", "category_id", "sku_code", "spec_name"]
        if any(not str(data.get(k, "")).strip() for k in required):
            return json_resp(start_response, {"error": "产品编号、名称、品牌、分类、SKU、规格不能为空"}, 400)
        now = datetime.now().isoformat(timespec="seconds")
        pid = int(data.get("pid") or 0)
        if pid:
            db.execute("UPDATE products SET product_code=?, name=?, brand_id=?, category_id=?, efficacy_tags=?, shelf_life_days=?, updated_at=? WHERE id=?",
                       [data["product_code"], data["name"], int(data["brand_id"]), int(data["category_id"]), data.get("remark", ""), int(data.get("shelf_life_days") or 1095), now, pid])
            sku = db.execute("SELECT id FROM product_skus WHERE product_id=? ORDER BY id LIMIT 1", [pid]).fetchone()
            if sku:
                db.execute("UPDATE product_skus SET sku_code=?, spec_name=?, cost_price=?, retail_price=?, min_stock_qty=?, max_stock_qty=?, updated_at=? WHERE id=?",
                           [data["sku_code"], data["spec_name"], float(data.get("cost_price") or 0), float(data.get("retail_price") or 0), int(data.get("min_stock_qty") or 0), int(data.get("max_stock_qty") or 99999), now, sku["id"]])
            else:
                db.execute("INSERT INTO product_skus (product_id, sku_code, spec_name, cost_price, retail_price, min_stock_qty, max_stock_qty) VALUES (?,?,?,?,?,?,?)",
                           [pid, data["sku_code"], data["spec_name"], float(data.get("cost_price") or 0), float(data.get("retail_price") or 0), int(data.get("min_stock_qty") or 0), int(data.get("max_stock_qty") or 99999)])
        else:
            cur = db.execute("INSERT INTO products (product_code, category_id, brand_id, name, efficacy_tags, shelf_life_days) VALUES (?,?,?,?,?,?)",
                             [data["product_code"], int(data["category_id"]), int(data["brand_id"]), data["name"], data.get("remark", ""), int(data.get("shelf_life_days") or 1095)])
            pid = cur.lastrowid
            db.execute("INSERT INTO product_skus (product_id, sku_code, spec_name, cost_price, retail_price, min_stock_qty, max_stock_qty) VALUES (?,?,?,?,?,?,?)",
                       [pid, data["sku_code"], data["spec_name"], float(data.get("cost_price") or 0), float(data.get("retail_price") or 0), int(data.get("min_stock_qty") or 0), int(data.get("max_stock_qty") or 99999)])
        db.commit()
        return json_resp(start_response, {"ok": True, "id": pid})

    if path == "/api/products/delete":
        pid = int(body_json().get("id") or 0)
        db.execute("UPDATE products SET is_active=0, updated_at=datetime('now','localtime') WHERE id=?", [pid])
        db.execute("UPDATE product_skus SET is_active=0, updated_at=datetime('now','localtime') WHERE product_id=?", [pid])
        db.commit()
        return json_resp(start_response, {"ok": True})

    if path == "/api/products/export":
        return csv_query(db, "SELECT p.product_code AS 产品编号, p.name AS 产品名称, b.name AS 品牌, pc.name AS 分类, sku.sku_code AS SKU编码, sku.spec_name AS 规格, sku.cost_price AS 成本价, sku.retail_price AS 零售价 FROM products p JOIN brands b ON p.brand_id=b.id JOIN product_categories pc ON p.category_id=pc.id LEFT JOIN product_skus sku ON sku.product_id=p.id AND sku.is_active=1 WHERE p.is_active=1", [], "产品清单.csv", start_response)

    if path == "/api/inventory":
        q = params.get("q", [""])[0]
        wh = params.get("warehouse", [""])[0]
        query = """
            SELECT wh.name AS 仓库, p.name AS 产品名称, sku.sku_code AS SKU编码, sku.spec_name AS 规格,
                   SUM(inv.quantity) AS 总库存, SUM(inv.locked_quantity) AS 锁定库存,
                   SUM(inv.quantity-inv.locked_quantity) AS 可用库存,
                   sku.min_stock_qty AS 最低库存, sku.max_stock_qty AS 最高库存,
                   CASE WHEN SUM(inv.quantity) <= sku.min_stock_qty THEN '低于最低库存'
                        WHEN SUM(inv.quantity) >= sku.max_stock_qty THEN '高于最高库存' ELSE '正常' END AS 库存状态,
                   SUM((inv.quantity-inv.locked_quantity)*sku.retail_price) AS 零售货值
            FROM inventory inv JOIN product_skus sku ON inv.sku_id=sku.id
            JOIN products p ON sku.product_id=p.id JOIN warehouses wh ON inv.warehouse_id=wh.id
            WHERE p.is_active=1 AND sku.is_active=1
        """
        args = []
        if q:
            query += " AND (p.name LIKE ? OR sku.sku_code LIKE ?)"
            args.extend([f"%{q}%", f"%{q}%"])
        if wh:
            query += " AND wh.name = ?"
            args.append(wh)
        query += " GROUP BY wh.id, sku.id ORDER BY wh.id, p.name"
        return json_resp(start_response, [dict(r) for r in db.execute(query, args)])

    if path == "/api/inventory/export":
        return csv_query(db, "SELECT wh.name AS 仓库, p.name AS 产品名称, sku.sku_code AS SKU编码, sku.spec_name AS 规格, SUM(inv.quantity) AS 总库存, SUM(inv.quantity-inv.locked_quantity) AS 可用库存 FROM inventory inv JOIN product_skus sku ON inv.sku_id=sku.id JOIN products p ON sku.product_id=p.id JOIN warehouses wh ON inv.warehouse_id=wh.id GROUP BY wh.id, sku.id", [], "库存汇总.csv", start_response)

    if path == "/api/meta":
        return json_resp(start_response, {
            "brands": [dict(r) for r in db.execute("SELECT id, name FROM brands WHERE is_active=1 ORDER BY id")],
            "categories": [dict(r) for r in db.execute("SELECT id, name FROM product_categories WHERE is_active=1 AND id<>1 ORDER BY sort_order, id")],
            "warehouses": [dict(r) for r in db.execute("SELECT id, name FROM warehouses WHERE is_active=1 ORDER BY id")],
        })

    if path == "/api/stock/options":
        return json_resp(start_response, {
            "skus": [dict(r) for r in db.execute("SELECT sku.id, sku.sku_code, sku.spec_name, p.name FROM product_skus sku JOIN products p ON sku.product_id=p.id WHERE sku.is_active=1 AND p.is_active=1 ORDER BY p.name, sku.sku_code")],
            "warehouses": [dict(r) for r in db.execute("SELECT id, name FROM warehouses WHERE is_active=1 ORDER BY id")],
            "locations": [dict(r) for r in db.execute("SELECT sl.id, sl.warehouse_id, wh.name AS warehouse, sl.location_code FROM storage_locations sl JOIN warehouses wh ON sl.warehouse_id=wh.id WHERE sl.is_active=1 ORDER BY wh.id, sl.location_code")],
            "batches": [dict(r) for r in db.execute("SELECT pb.id, sku.sku_code, pb.batch_no, COALESCE(SUM(inv.quantity),0) AS quantity FROM product_batches pb JOIN product_skus sku ON pb.sku_id=sku.id LEFT JOIN inventory inv ON inv.batch_id=pb.id GROUP BY pb.id ORDER BY pb.id DESC")],
        })

    if path == "/api/stock/save":
        data = body_json()
        stock_type = data.get("stock_type")
        qty = int(data.get("quantity") or 0)
        if qty < 0:
            return json_resp(start_response, {"error": "数量不能小于 0"}, 400)
        sku_id = int(data.get("sku_id") or 0)
        warehouse_id = int(data.get("warehouse_id") or 0)
        location_id = int(data.get("location_id") or 0)
        operator = data.get("operator") or "管理员"
        remark = data.get("remark") or ""
        if stock_type == "IN":
            batch_no = data.get("batch_no") or f"BT{datetime.now().strftime('%Y%m%d%H%M%S')}"
            batch = db.execute("SELECT id FROM product_batches WHERE sku_id=? AND batch_no=?", [sku_id, batch_no]).fetchone()
            if batch:
                batch_id = batch["id"]
            else:
                cur = db.execute("INSERT INTO product_batches (sku_id, batch_no, production_date, expiry_date, status, remark) VALUES (?,?,?,?,?,?)",
                                 [sku_id, batch_no, data.get("production_date") or date.today().isoformat(), data.get("expiry_date") or (date.today() + timedelta(days=1095)).isoformat(), "NORMAL", remark])
                batch_id = cur.lastrowid
            inv = db.execute("SELECT id FROM inventory WHERE sku_id=? AND batch_id=? AND warehouse_id=? AND location_id=?", [sku_id, batch_id, warehouse_id, location_id]).fetchone()
            if inv:
                db.execute("UPDATE inventory SET quantity=quantity+?, updated_at=datetime('now','localtime') WHERE id=?", [qty, inv["id"]])
            else:
                db.execute("INSERT INTO inventory (sku_id, batch_id, warehouse_id, location_id, quantity, locked_quantity) VALUES (?,?,?,?,?,0)", [sku_id, batch_id, warehouse_id, location_id, qty])
            order_no = f"IN-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            cur = db.execute("INSERT INTO inbound_orders (order_no, warehouse_id, inbound_type, status, operator, remark, confirmed_at, completed_at) VALUES (?,?,?,?,?,?,datetime('now','localtime'),datetime('now','localtime'))", [order_no, warehouse_id, "MANUAL", "COMPLETED", operator, remark])
            db.execute("INSERT INTO inbound_order_items (order_id, sku_id, batch_id, location_id, quantity) VALUES (?,?,?,?,?)", [cur.lastrowid, sku_id, batch_id, location_id, qty])
        else:
            batch_id = int(data.get("batch_id") or 0)
            inv = db.execute("SELECT id, quantity, sku_id, warehouse_id, location_id FROM inventory WHERE batch_id=? ORDER BY quantity DESC LIMIT 1", [batch_id]).fetchone()
            if not inv:
                return json_resp(start_response, {"error": "没有找到对应库存批次"}, 400)
            sku_id = inv["sku_id"]
            if stock_type == "OUT":
                if inv["quantity"] < qty:
                    return json_resp(start_response, {"error": "出库数量不能大于当前库存"}, 400)
                db.execute("UPDATE inventory SET quantity=quantity-?, updated_at=datetime('now','localtime') WHERE id=?", [qty, inv["id"]])
                order_no = f"OUT-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
                cur = db.execute("INSERT INTO outbound_orders (order_no, warehouse_id, outbound_type, status, customer_name, operator, remark, confirmed_at, completed_at) VALUES (?,?,?,?,?,?,?,datetime('now','localtime'),datetime('now','localtime'))", [order_no, inv["warehouse_id"], "MANUAL", "COMPLETED", "手工出库", operator, remark])
                db.execute("INSERT INTO outbound_order_items (order_id, sku_id, batch_id, location_id, quantity) VALUES (?,?,?,?,?)", [cur.lastrowid, sku_id, batch_id, inv["location_id"], qty])
            elif stock_type == "ADJUST":
                old_qty = inv["quantity"]
                db.execute("UPDATE inventory SET quantity=?, updated_at=datetime('now','localtime') WHERE id=?", [qty, inv["id"]])
                check_no = f"CK-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
                cur = db.execute("INSERT INTO inventory_checks (check_no, warehouse_id, check_type, status, operator, remark, checked_at, adjusted_at) VALUES (?,?,?,?,?,?,datetime('now','localtime'),datetime('now','localtime'))", [check_no, inv["warehouse_id"], "ADJUST", "ADJUSTED", operator, remark])
                db.execute("INSERT INTO inventory_check_items (check_id, sku_id, batch_id, location_id, system_qty, actual_qty, diff_reason, adjusted) VALUES (?,?,?,?,?,?,?,1)", [cur.lastrowid, sku_id, batch_id, inv["location_id"], old_qty, qty, f"手工调整，差异 {qty-old_qty}"])
        db.commit()
        return json_resp(start_response, {"ok": True})

    if path == "/api/expiry":
        return json_resp(start_response, [dict(r) for r in db.execute("""
            SELECT wh.name AS 仓库, sl.location_code AS 库位, p.name AS 产品名称, sku.sku_code AS SKU编码,
                   pb.batch_no AS 批次号, pb.production_date AS 生产日期, pb.expiry_date AS 有效期至,
                   CAST(julianday(pb.expiry_date)-julianday(date('now')) AS INTEGER) AS 剩余天数,
                   inv.quantity AS 库存数量,
                   CASE WHEN julianday(pb.expiry_date)-julianday(date('now')) <= 0 THEN '立即报损'
                        WHEN julianday(pb.expiry_date)-julianday(date('now')) <= 30 THEN '紧急促销/报损'
                        WHEN julianday(pb.expiry_date)-julianday(date('now')) <= 90 THEN '折扣促销/清货'
                        ELSE '优先出库' END AS 处置建议
            FROM inventory inv JOIN product_batches pb ON inv.batch_id=pb.id
            JOIN product_skus sku ON inv.sku_id=sku.id JOIN products p ON sku.product_id=p.id
            JOIN warehouses wh ON inv.warehouse_id=wh.id JOIN storage_locations sl ON inv.location_id=sl.id
            WHERE inv.quantity>0 AND julianday(pb.expiry_date)-julianday(date('now')) <= 180
            ORDER BY pb.expiry_date
        """)])

    if path == "/api/ledger":
        days = int(params.get("days", ["30"])[0])
        return json_resp(start_response, [dict(r) for r in db.execute("""
            SELECT CASE io_type WHEN 'IN' THEN '入库' ELSE '出库' END AS 类型,
                   order_no AS 单号, product_name AS 产品名称, sku_code AS SKU编码, spec_name AS 规格,
                   batch_no AS 批次号, warehouse_name AS 仓库, location_code AS 库位,
                   quantity AS 数量, biz_type AS 业务类型, trans_time AS 时间
            FROM v_inventory_ledger WHERE trans_time >= date('now', ?) ORDER BY trans_time DESC LIMIT 500
        """, [f"-{days} days"])])

    if path == "/api/stats":
        by_warehouse = [dict(r) for r in db.execute("SELECT wh.name AS 仓库, SUM(inv.quantity) AS 总库存, SUM(inv.quantity-inv.locked_quantity) AS 可用库存, SUM((inv.quantity-inv.locked_quantity)*sku.retail_price) AS 零售货值 FROM inventory inv JOIN warehouses wh ON inv.warehouse_id=wh.id JOIN product_skus sku ON inv.sku_id=sku.id GROUP BY wh.id ORDER BY 零售货值 DESC")]
        by_brand = [dict(r) for r in db.execute("SELECT b.name AS 品牌, COUNT(DISTINCT p.id) AS 产品数, SUM(inv.quantity) AS 总库存, SUM((inv.quantity-inv.locked_quantity)*sku.retail_price) AS 零售货值 FROM inventory inv JOIN product_skus sku ON inv.sku_id=sku.id JOIN products p ON sku.product_id=p.id JOIN brands b ON p.brand_id=b.id GROUP BY b.id ORDER BY 零售货值 DESC")]
        top_value = [dict(r) for r in db.execute("SELECT p.name AS 产品名称, sku.sku_code AS SKU编码, SUM(inv.quantity) AS 总库存, SUM((inv.quantity-inv.locked_quantity)*sku.retail_price) AS 零售货值 FROM inventory inv JOIN product_skus sku ON inv.sku_id=sku.id JOIN products p ON sku.product_id=p.id GROUP BY sku.id ORDER BY 零售货值 DESC LIMIT 10")]
        stock_status = [dict(r) for r in db.execute("SELECT 库存状态, COUNT(*) AS SKU数量 FROM (SELECT sku.id, CASE WHEN COALESCE(SUM(inv.quantity),0) <= sku.min_stock_qty THEN '低于最低库存' WHEN COALESCE(SUM(inv.quantity),0) >= sku.max_stock_qty THEN '高于最高库存' ELSE '正常' END AS 库存状态 FROM product_skus sku LEFT JOIN inventory inv ON inv.sku_id=sku.id WHERE sku.is_active=1 GROUP BY sku.id) GROUP BY 库存状态")]
        return json_resp(start_response, {"by_warehouse": by_warehouse, "by_brand": by_brand, "top_value": top_value, "stock_status": stock_status})

    if path == "/api/expiry/export":
        return csv_export(db, "v_export_expiry_stock", start_response)
    if path == "/api/ledger/export":
        days = params.get("days", ["30"])[0]
        return csv_export(db, "v_inventory_ledger", start_response, f"trans_time >= date('now', '-{days} days')")

    return json_resp(start_response, {"error": "not found"}, 404)


def json_resp(start_response, data, status=200):
    import json
    body = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
    start_response(f"{status} OK", [("Content-Type", "application/json; charset=utf-8")])
    return [body]


def csv_export(db, view, start_response, where=None):
    query = f"SELECT * FROM {view}"
    if where:
        query += f" WHERE {where}"
    rows = [dict(r) for r in db.execute(query)]

    output = io.StringIO()
    if rows:
        import csv as csv_mod
        writer = csv_mod.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    data = output.getvalue().encode("utf-8-sig")
    output.close()

    start_response("200 OK", [
        ("Content-Type", "text/csv; charset=utf-8-sig"),
        ("Content-Disposition", f'attachment; filename="{view}.csv"'),
    ])
    return [data]


def csv_query(db, query, args, filename, start_response):
    rows = [dict(r) for r in db.execute(query, args)]
    output = io.StringIO()
    if rows:
        import csv as csv_mod
        writer = csv_mod.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    data = output.getvalue().encode("utf-8-sig")
    output.close()
    start_response("200 OK", [
        ("Content-Type", "text/csv; charset=utf-8-sig"),
        ("Content-Disposition", f'attachment; filename="{filename}"'),
    ])
    return [data]


def html(start_response, content):
    data = content.encode("utf-8")
    start_response("200 OK", [("Content-Type", "text/html; charset=utf-8")])
    return [data]


if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        init_db()
    host = os.getenv("WEB_HOST", "0.0.0.0")
    port = int(os.getenv("WEB_PORT", "5000"))
    print("=" * 50)
    print("  护肤品库存管理系统 — SQLite 内网版")
    print(f"  访问: http://localhost:{port}")
    print("  数据库:", DB_PATH)
    print("=" * 50)
    server = make_server(host, port, application)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")

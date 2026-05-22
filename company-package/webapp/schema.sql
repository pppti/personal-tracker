-- ============================================================
-- 护肤品公司 - 供应商与包材管理数据库 (SQLite)
-- 无需安装 MySQL，文件数据库，零依赖
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. 供应商主表
CREATE TABLE supplier (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT    NOT NULL UNIQUE,
    name            TEXT    NOT NULL,
    short_name      TEXT,
    company_address TEXT,
    factory_address TEXT,
    region          TEXT,
    country         TEXT    DEFAULT '中国',
    website         TEXT,

    business_license      TEXT,
    legal_representative  TEXT,
    registered_capital    REAL,
    established_date      TEXT,

    cooperation_status TEXT DEFAULT 'POTENTIAL',
    settlement_method  TEXT,
    payment_terms      TEXT,
    tax_rate           REAL,
    is_general_taxpayer INTEGER DEFAULT 1,

    composite_score    REAL,
    remark     TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_supplier_status ON supplier(cooperation_status);
CREATE INDEX idx_supplier_region ON supplier(region);


-- 2. 供应商联系人
CREATE TABLE supplier_contact (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL REFERENCES supplier(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    title       TEXT,
    department  TEXT,
    phone       TEXT,
    mobile      TEXT,
    email       TEXT,
    wechat      TEXT,
    is_primary  INTEGER DEFAULT 0,
    sort_order  INTEGER DEFAULT 0,
    remark      TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_contact_supplier ON supplier_contact(supplier_id);


-- 3. 供应商资质/证书
CREATE TABLE supplier_certification (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id     INTEGER NOT NULL REFERENCES supplier(id) ON DELETE CASCADE,
    cert_type       TEXT    NOT NULL,
    cert_number     TEXT,
    issuing_agency  TEXT,
    issue_date      TEXT,
    expiry_date     TEXT,
    attachment_path TEXT,
    remark          TEXT,
    created_at      TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_cert_supplier ON supplier_certification(supplier_id);
CREATE INDEX idx_cert_expiry ON supplier_certification(expiry_date);


-- 4. 包材分类（树形）
CREATE TABLE material_category (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id  INTEGER REFERENCES material_category(id) ON DELETE SET NULL,
    name       TEXT    NOT NULL,
    full_path  TEXT    UNIQUE,
    level      INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    is_active  INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_cat_parent ON material_category(parent_id);


-- 5. 包材主表
CREATE TABLE material (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT NOT NULL UNIQUE,
    category_id     INTEGER NOT NULL REFERENCES material_category(id),
    name            TEXT NOT NULL,
    material_type   TEXT,
    spec_capacity   TEXT,
    spec_color      TEXT,
    spec_finish     TEXT,
    printing_process TEXT,
    printing_colors  TEXT,
    has_custom_mold  INTEGER DEFAULT 0,
    mold_owner       TEXT,
    mold_lifecycle   TEXT,
    suitable_for     TEXT,
    need_food_grade  INTEGER DEFAULT 0,
    need_medical_cert INTEGER DEFAULT 0,
    unit            TEXT DEFAULT '个',
    min_order_qty   INTEGER,
    typical_lead_time INTEGER,
    image_path      TEXT,
    design_file_path TEXT,
    status          TEXT DEFAULT 'ACTIVE',
    remark          TEXT,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_mat_category ON material(category_id);
CREATE INDEX idx_mat_type ON material(material_type);
CREATE INDEX idx_mat_status ON material(status);


-- 6-13. 各类包材规格扩展（瓶/管/泵头/瓶盖/彩盒/标签/袋/外箱）
CREATE TABLE material_spec_bottle (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL UNIQUE REFERENCES material(id) ON DELETE CASCADE,
    bottle_type     TEXT,
    body_material   TEXT,
    neck_finish     TEXT,
    diameter        REAL,
    height          REAL,
    weight          REAL,
    wall_thickness  REAL,
    has_inner_plug  INTEGER DEFAULT 0,
    inner_plug_material TEXT,
    seal_type       TEXT
);

CREATE TABLE material_spec_tube (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL UNIQUE REFERENCES material(id) ON DELETE CASCADE,
    tube_type       TEXT,
    tube_material   TEXT,
    diameter        REAL,
    tube_length     REAL,
    capacity_ml     REAL,
    seal_method     TEXT,
    cap_type        TEXT,
    cap_material    TEXT,
    has_aluminum_seal INTEGER
);

CREATE TABLE material_spec_dispenser (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL UNIQUE REFERENCES material(id) ON DELETE CASCADE,
    dispenser_type    TEXT NOT NULL,
    output_per_press  REAL,
    neck_finish       TEXT,
    dip_tube_length   REAL,
    dip_tube_diameter REAL,
    spring_material   TEXT,
    pump_material     TEXT,
    closure_type      TEXT,
    has_lock       INTEGER DEFAULT 0,
    has_dust_cover INTEGER DEFAULT 0
);

CREATE TABLE material_spec_cap (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL UNIQUE REFERENCES material(id) ON DELETE CASCADE,
    cap_type        TEXT,
    cap_material    TEXT,
    neck_finish     TEXT,
    diameter        REAL,
    height          REAL,
    gasket_material TEXT,
    surface_treatment TEXT
);

CREATE TABLE material_spec_carton (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL UNIQUE REFERENCES material(id) ON DELETE CASCADE,
    carton_type     TEXT,
    base_paper      TEXT,
    paper_gsm       INTEGER,
    length          REAL,
    width           REAL,
    height          REAL,
    surface_process TEXT,
    printing_colors TEXT,
    inner_tray      TEXT,
    has_window      INTEGER DEFAULT 0,
    has_magnet      INTEGER DEFAULT 0
);

CREATE TABLE material_spec_label (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL UNIQUE REFERENCES material(id) ON DELETE CASCADE,
    label_type      TEXT,
    label_material  TEXT,
    label_shape     TEXT,
    label_width     REAL,
    label_height    REAL,
    printing_method TEXT,
    surface_finish  TEXT,
    adhesive_type   TEXT,
    is_waterproof   INTEGER DEFAULT 0,
    is_anti_counterfeit INTEGER DEFAULT 0
);

CREATE TABLE material_spec_pouch (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL UNIQUE REFERENCES material(id) ON DELETE CASCADE,
    pouch_type        TEXT,
    material_structure TEXT,
    width        REAL,
    length       REAL,
    thickness_mm REAL,
    has_tear_notch INTEGER DEFAULT 0,
    has_zipper     INTEGER DEFAULT 0,
    seal_width     REAL
);

CREATE TABLE material_spec_corrugated (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL UNIQUE REFERENCES material(id) ON DELETE CASCADE,
    box_type        TEXT,
    flute_type      TEXT,
    material_grade  TEXT,
    length          REAL,
    width           REAL,
    height          REAL,
    bursting_strength TEXT,
    units_per_box   INTEGER,
    is_printing     INTEGER DEFAULT 0
);


-- 14. 供应商-包材供应关系
CREATE TABLE supplier_material (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id     INTEGER NOT NULL REFERENCES supplier(id) ON DELETE CASCADE,
    material_id     INTEGER NOT NULL REFERENCES material(id) ON DELETE CASCADE,
    is_preferred    INTEGER DEFAULT 0,
    supplier_material_code TEXT,
    monthly_capacity INTEGER,
    moq              INTEGER,
    typical_lead_time INTEGER,
    latest_unit_price REAL,
    price_update_date TEXT,
    currency         TEXT DEFAULT 'CNY',
    sample_approved   INTEGER DEFAULT 0,
    sample_date       TEXT,
    status          TEXT DEFAULT 'ACTIVE',
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(supplier_id, material_id)
);
CREATE INDEX idx_sm_material ON supplier_material(material_id);


-- 15. 报价单主表
CREATE TABLE quotation (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_no    TEXT NOT NULL UNIQUE,
    supplier_id     INTEGER NOT NULL REFERENCES supplier(id),
    quotation_date  TEXT NOT NULL,
    valid_until     TEXT,
    currency        TEXT DEFAULT 'CNY',
    exchange_rate   REAL DEFAULT 1.0,
    incoterm        TEXT,
    is_tax_included INTEGER DEFAULT 1,
    is_shipping_included INTEGER DEFAULT 0,
    contact_person   TEXT,
    contact_phone    TEXT,
    total_amount     REAL,
    remark           TEXT,
    status          TEXT DEFAULT 'DRAFT',
    approved_by      TEXT,
    approved_at      TEXT,
    created_by       TEXT,
    created_at       TEXT DEFAULT (datetime('now','localtime')),
    updated_at       TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_quo_supplier ON quotation(supplier_id);
CREATE INDEX idx_quo_date ON quotation(quotation_date);


-- 16. 报价单明细
CREATE TABLE quotation_item (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_id    INTEGER NOT NULL REFERENCES quotation(id) ON DELETE CASCADE,
    material_id     INTEGER NOT NULL REFERENCES material(id),
    item_seq        INTEGER NOT NULL,
    quantity        INTEGER,
    unit_price      REAL NOT NULL,
    mold_fee        REAL DEFAULT 0,
    sample_fee      REAL DEFAULT 0,
    shipping_fee    REAL DEFAULT 0,
    price_breakdown TEXT,
    lead_time_days  INTEGER,
    remark          TEXT
);
CREATE INDEX idx_qi_quotation ON quotation_item(quotation_id);
CREATE INDEX idx_qi_material ON quotation_item(material_id);


-- 17. 采购订单
CREATE TABLE purchase_order (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no        TEXT NOT NULL UNIQUE,
    supplier_id     INTEGER NOT NULL REFERENCES supplier(id),
    quotation_id    INTEGER REFERENCES quotation(id) ON DELETE SET NULL,
    order_date      TEXT NOT NULL,
    expected_delivery TEXT,
    actual_delivery  TEXT,
    currency        TEXT DEFAULT 'CNY',
    prod_qty_total   INTEGER,
    received_qty     INTEGER,
    total_amount     REAL,
    paid_amount      REAL DEFAULT 0,
    urgency         TEXT DEFAULT 'NORMAL',
    status          TEXT DEFAULT 'DRAFT',
    shipping_method TEXT,
    tracking_no     TEXT,
    contract_path   TEXT,
    remark          TEXT,
    created_by      TEXT,
    approved_by     TEXT,
    approved_at     TEXT,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_po_supplier ON purchase_order(supplier_id);
CREATE INDEX idx_po_status ON purchase_order(status);
CREATE INDEX idx_po_order_date ON purchase_order(order_date);
CREATE INDEX idx_po_expected ON purchase_order(expected_delivery);


-- 18. 采购订单明细
CREATE TABLE purchase_order_item (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
    material_id     INTEGER NOT NULL REFERENCES material(id),
    item_seq        INTEGER NOT NULL,
    order_qty       INTEGER NOT NULL,
    received_qty    INTEGER DEFAULT 0,
    unit_price      REAL NOT NULL,
    batch_no        TEXT,
    supplier_batch  TEXT,
    expected_date   TEXT,
    actual_date     TEXT,
    status          TEXT DEFAULT 'PENDING',
    remark          TEXT
);
CREATE INDEX idx_poi_order ON purchase_order_item(order_id);
CREATE INDEX idx_poi_material ON purchase_order_item(material_id);
CREATE INDEX idx_poi_status ON purchase_order_item(status);


-- 19. 到货质检记录
CREATE TABLE quality_inspection (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_no   TEXT NOT NULL UNIQUE,
    order_id        INTEGER NOT NULL REFERENCES purchase_order(id),
    order_item_id   INTEGER REFERENCES purchase_order_item(id) ON DELETE SET NULL,
    inspection_date TEXT NOT NULL,
    inspector       TEXT,
    lot_qty         INTEGER,
    sample_qty      INTEGER,
    defect_qty      INTEGER DEFAULT 0,
    aql_level       TEXT,
    aql_critical    REAL,
    aql_major       REAL,
    aql_minor       REAL,
    check_dimensions  INTEGER DEFAULT 1,
    check_appearance  INTEGER DEFAULT 1,
    check_function    INTEGER DEFAULT 1,
    check_printing    INTEGER DEFAULT 1,
    check_color       INTEGER DEFAULT 1,
    check_material    INTEGER DEFAULT 1,
    check_capacity    INTEGER DEFAULT 1,
    check_compatibility INTEGER,
    inspection_detail TEXT,
    result          TEXT NOT NULL,
    handle_method   TEXT,
    attachment_path TEXT,
    remark          TEXT,
    created_at      TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_qi_order ON quality_inspection(order_id);
CREATE INDEX idx_qi_result ON quality_inspection(result);
CREATE INDEX idx_qi_date ON quality_inspection(inspection_date);


-- 20. 供应商评估记录
CREATE TABLE supplier_evaluation (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id     INTEGER NOT NULL REFERENCES supplier(id) ON DELETE CASCADE,
    eval_period     TEXT NOT NULL,
    eval_date       TEXT NOT NULL,
    evaluator       TEXT,
    score_quality   REAL,
    score_delivery  REAL,
    score_price     REAL,
    score_service   REAL,
    score_flexibility REAL,
    evaluation_summary TEXT,
    improvement_plan   TEXT,
    created_at      TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_eval_supplier_period ON supplier_evaluation(supplier_id, eval_period);


-- 21. 交货/物流记录
CREATE TABLE delivery_record (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
    delivery_date   TEXT,
    delivery_qty    INTEGER,
    carrier         TEXT,
    tracking_no     TEXT,
    estimated_arrival TEXT,
    actual_arrival   TEXT,
    packing_list    TEXT,
    remark          TEXT,
    created_at      TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_del_order ON delivery_record(order_id);


-- ============================================================
-- 初始数据：包材分类
-- ============================================================
INSERT INTO material_category (id, parent_id, name, full_path, level, sort_order) VALUES
(1,  NULL, '内包材',   '内包材',   1, 10),
(2,  NULL, '外包材',   '外包材',   1, 20),
(3,  NULL, '辅助包材', '辅助包材', 1, 30),

(11, 1, '瓶类',    '内包材/瓶类',    2, 11),
(12, 1, '软管类',   '内包材/软管类',   2, 12),
(13, 1, '袋类',    '内包材/袋类',    2, 13),
(14, 1, '泵头/喷头/滴管', '内包材/泵头_喷头_滴管', 2, 14),
(15, 1, '瓶盖/内塞', '内包材/瓶盖_内塞', 2, 15),
(16, 1, '安瓶类',   '内包材/安瓶类',   2, 16),

(21, 2, '彩盒/纸盒', '外包材/彩盒_纸盒', 2, 21),
(22, 2, '标签/贴纸', '外包材/标签_贴纸', 2, 22),
(23, 2, '说明书/折页','外包材/说明书_折页', 2, 23),
(24, 2, '收缩膜',    '外包材/收缩膜',   2, 24),
(25, 2, '封口贴/封条','外包材/封口贴_封条', 2, 25),
(26, 2, '内托/内衬', '外包材/内托_内衬', 2, 26),

(31, 3, '外箱',      '辅助包材/外箱',     2, 31),
(32, 3, '封箱胶带',   '辅助包材/封箱胶带',  2, 32),
(33, 3, '缓冲材料',   '辅助包材/缓冲材料',  2, 33),

(111, 11, '精华瓶',   '内包材/瓶类/精华瓶',   3, 111),
(112, 11, '乳液瓶',   '内包材/瓶类/乳液瓶',   3, 112),
(113, 11, '膏霜瓶',   '内包材/瓶类/膏霜瓶',   3, 113),
(114, 11, '爽肤水瓶', '内包材/瓶类/爽肤水瓶', 3, 114),
(115, 11, '精油瓶',   '内包材/瓶类/精油瓶',   3, 115),
(116, 11, '喷雾瓶',   '内包材/瓶类/喷雾瓶',   3, 116),
(117, 11, '旅行装瓶', '内包材/瓶类/旅行装瓶', 3, 117),

(121, 12, '塑料软管', '内包材/软管类/塑料软管',   3, 121),
(122, 12, '铝塑复合管','内包材/软管类/铝塑复合管', 3, 122),
(123, 12, '全塑复合管','内包材/软管类/全塑复合管', 3, 123),

(131, 13, '面膜袋',   '内包材/袋类/面膜袋',   3, 131),
(132, 13, '铝箔袋',   '内包材/袋类/铝箔袋',   3, 132),
(133, 13, '试用装袋', '内包材/袋类/试用装袋',  3, 133),

(211, 21, '天地盖盒', '外包材/彩盒_纸盒/天地盖盒', 3, 211),
(212, 21, '翻盖盒',   '外包材/彩盒_纸盒/翻盖盒',   3, 212),
(213, 21, '抽屉盒',   '外包材/彩盒_纸盒/抽屉盒',   3, 213),
(214, 21, '书型盒',   '外包材/彩盒_纸盒/书型盒',   3, 214),
(215, 21, '普通卡盒', '外包材/彩盒_纸盒/普通卡盒', 3, 215);

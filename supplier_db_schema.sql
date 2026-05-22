-- ============================================================
-- 护肤品公司 - 供应商与包材管理数据库
-- Database: skincare_supplier
-- Engine: InnoDB, Charset: utf8mb4
-- ============================================================

CREATE DATABASE IF NOT EXISTS skincare_supplier
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE skincare_supplier;

-- ============================================================
-- 1. 供应商主表
-- ============================================================
CREATE TABLE supplier (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(32)   NOT NULL COMMENT '供应商编码，如 SUP20240001',
    name            VARCHAR(128)  NOT NULL COMMENT '供应商全称',
    short_name      VARCHAR(64)   COMMENT '简称',
    company_address VARCHAR(256)  COMMENT '公司注册地址',
    factory_address VARCHAR(256)  COMMENT '工厂地址（如与注册地不同）',
    region          VARCHAR(64)   COMMENT '所在地区：华东/华南/华北/华中/西南/境外',
    country         VARCHAR(32)   DEFAULT '中国',
    website         VARCHAR(128)  COMMENT '官网',

    -- 资质信息
    business_license   VARCHAR(64)  COMMENT '营业执照号',
    legal_representative VARCHAR(32) COMMENT '法定代表人',
    registered_capital  DECIMAL(14,2) COMMENT '注册资本（万元）',
    established_date    DATE COMMENT '成立日期',

    -- 合作信息
    cooperation_status ENUM('POTENTIAL','TRIAL','QUALIFIED','STRATEGIC','SUSPENDED','BLACKLIST')
                        DEFAULT 'POTENTIAL' COMMENT '合作状态：潜在/试用/合格/战略/暂停/黑名单',
    settlement_method  ENUM('T/T','L/C','MONTHLY_BILL','CASH_ON_DELIVERY','OTHER')
                        COMMENT '结算方式',
    payment_terms      VARCHAR(64)  COMMENT '付款条件，如"月结60天"、"预付30%"',
    tax_rate           DECIMAL(5,4) COMMENT '税率，如 0.13 = 13%',
    is_general_taxpayer TINYINT(1) DEFAULT 1 COMMENT '是否一般纳税人',

    -- 评分
    composite_score    DECIMAL(3,1) COMMENT '综合评分 0-5',

    -- 备注与附件
    remark     TEXT,
    created_at DATETIME    DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_code (code),
    INDEX idx_status (cooperation_status),
    INDEX idx_region (region)
) ENGINE=InnoDB COMMENT='供应商主表';


-- ============================================================
-- 2. 供应商联系人
-- ============================================================
CREATE TABLE supplier_contact (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    supplier_id BIGINT UNSIGNED NOT NULL,

    name        VARCHAR(32)  NOT NULL COMMENT '姓名',
    title       VARCHAR(32)  COMMENT '职务',
    department  VARCHAR(32)  COMMENT '部门：销售/技术/售后/管理层',
    phone       VARCHAR(32)  COMMENT '电话',
    mobile      VARCHAR(32)  COMMENT '手机号',
    email       VARCHAR(64)  COMMENT '邮箱',
    wechat      VARCHAR(32)  COMMENT '微信号',
    is_primary  TINYINT(1)  DEFAULT 0 COMMENT '是否主要联系人',
    sort_order  INT          DEFAULT 0 COMMENT '排序',
    remark      VARCHAR(256),
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_supplier (supplier_id),
    CONSTRAINT fk_contact_supplier FOREIGN KEY (supplier_id)
        REFERENCES supplier(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='供应商联系人';


-- ============================================================
-- 3. 供应商资质/证书
-- ============================================================
CREATE TABLE supplier_certification (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    supplier_id     BIGINT UNSIGNED NOT NULL,

    cert_type       VARCHAR(32)  NOT NULL COMMENT '证书类型：ISO9001/ISO14001/ISO22716/GMPC/FDA/REACH/HALAL/有机认证等',
    cert_number     VARCHAR(64)  COMMENT '证书编号',
    issuing_agency  VARCHAR(128) COMMENT '颁发机构',
    issue_date      DATE,
    expiry_date     DATE,
    is_valid        TINYINT(1)  GENERATED ALWAYS AS (
                        CASE WHEN expiry_date >= CURDATE() THEN 1 ELSE 0 END
                    ) VIRTUAL COMMENT '是否在有效期内（自动计算）',
    attachment_path VARCHAR(256) COMMENT '证书附件路径',
    remark          VARCHAR(256),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_supplier_cert (supplier_id),
    INDEX idx_cert_expiry (expiry_date),
    CONSTRAINT fk_cert_supplier FOREIGN KEY (supplier_id)
        REFERENCES supplier(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='供应商资质/证书';


-- ============================================================
-- 4. 包材分类（树形结构：内包材/外包材/辅助包材 → 瓶类/管类... → 精华瓶/乳液瓶...）
-- ============================================================
CREATE TABLE material_category (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    parent_id   BIGINT UNSIGNED DEFAULT NULL COMMENT '上级分类ID，NULL为根节点',
    name        VARCHAR(64)  NOT NULL COMMENT '分类名称',
    full_path   VARCHAR(256) COMMENT '完整路径，如"内包材/瓶类/精华瓶"（冗余字段，便于查询）',
    level       TINYINT      NOT NULL DEFAULT 1 COMMENT '层级：1/2/3',
    sort_order  INT          DEFAULT 0,
    is_active   TINYINT(1)   DEFAULT 1,
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_fullpath (full_path),
    INDEX idx_parent (parent_id),
    CONSTRAINT fk_cat_parent FOREIGN KEY (parent_id)
        REFERENCES material_category(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='包材分类（树形）';


-- ============================================================
-- 5. 包材主表
-- ============================================================
CREATE TABLE material (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(32)  NOT NULL COMMENT '包材编码，如 BC-2024-00001',
    category_id     BIGINT UNSIGNED NOT NULL COMMENT '所属分类',

    name            VARCHAR(128) NOT NULL COMMENT '包材名称',
    material_type   VARCHAR(32)  COMMENT '材质类型：玻璃/PET/PP/PE/亚克力/铝塑/白卡纸/铜版纸等',

    -- 通用规格
    spec_capacity   VARCHAR(16)  COMMENT '容量/规格（如 30ml, 50g, 100*80*50mm）',
    spec_color      VARCHAR(32)  COMMENT '颜色/透明度',
    spec_finish     VARCHAR(64)  COMMENT '表面处理：磨砂/光面/喷涂/电镀/烫金/UV/覆膜等',

    -- 印刷
    printing_process VARCHAR(128) COMMENT '印刷工艺：丝印/移印/烫金/热转印/不干胶等',
    printing_colors  VARCHAR(32)  COMMENT '印刷色数：单色/双色/四色/专色',

    -- 模具
    has_custom_mold  TINYINT(1) DEFAULT 0 COMMENT '是否需要开模',
    mold_owner       ENUM('COMPANY','SUPPLIER','SHARED') COMMENT '模具归属：我司/供应商/共用',
    mold_lifecycle   VARCHAR(32)  COMMENT '模具寿命（万次）',

    -- 匹配产品
    suitable_for     VARCHAR(256) COMMENT '适用产品类型：精华/乳液/面霜/爽肤水/洁面等',

    -- 认证要求
    need_food_grade  TINYINT(1) DEFAULT 0 COMMENT '是否需要食品级认证',
    need_medical_cert TINYINT(1) DEFAULT 0 COMMENT '是否需要医疗器械认证',

    -- 基准信息
    unit            VARCHAR(8)   DEFAULT '个' COMMENT '计量单位',
    min_order_qty   INT          COMMENT '最小起订量',
    typical_lead_time INT         COMMENT '常规交货周期（天）',

    -- 备注
    image_path      VARCHAR(256) COMMENT '样品图片路径',
    design_file_path VARCHAR(256) COMMENT '设计文件路径（AI/CDR/PDF）',
    status          ENUM('ACTIVE','DISCONTINUED','DEVELOPING') DEFAULT 'ACTIVE',
    remark          TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_code (code),
    INDEX idx_category (category_id),
    INDEX idx_type (material_type),
    INDEX idx_status (status),
    CONSTRAINT fk_mat_category FOREIGN KEY (category_id)
        REFERENCES material_category(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='包材主表';


-- ============================================================
-- 6. 瓶子规格扩展（当包材为瓶类时使用）
-- ============================================================
CREATE TABLE material_spec_bottle (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    material_id BIGINT UNSIGNED NOT NULL,

    bottle_type     VARCHAR(32) COMMENT '瓶型：精华瓶/乳液瓶/膏霜瓶/爽肤水瓶/安瓶',
    body_material   VARCHAR(32) COMMENT '瓶身材质：高白玻璃/普白玻璃/PET/PP/亚克力',
    neck_finish     VARCHAR(16) COMMENT '瓶口规格：18/410, 20/410, 24/410, 28/410',
    diameter        DECIMAL(8,2) COMMENT '直径（mm）',
    height          DECIMAL(8,2) COMMENT '高度（mm）',
    weight          DECIMAL(8,2) COMMENT '重量（g）',
    wall_thickness  DECIMAL(8,2) COMMENT '壁厚（mm）',
    has_inner_plug  TINYINT(1) DEFAULT 0 COMMENT '是否搭配内塞',
    inner_plug_material VARCHAR(32) COMMENT '内塞材质：PP/PE/硅胶',
    seal_type       VARCHAR(32) COMMENT '密封方式：旋盖/压盖/卡扣',

    UNIQUE KEY uk_mat_id (material_id),
    CONSTRAINT fk_spec_bottle FOREIGN KEY (material_id)
        REFERENCES material(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='瓶子规格扩展';


-- ============================================================
-- 7. 软管规格扩展
-- ============================================================
CREATE TABLE material_spec_tube (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    material_id BIGINT UNSIGNED NOT NULL,

    tube_type       VARCHAR(32) COMMENT '管型：圆管/扁管/椭圆管',
    tube_material   VARCHAR(32) COMMENT '管身材质：PE/铝塑复合/全塑复合',
    diameter        DECIMAL(6,1) COMMENT '管径（mm）',
    tube_length     DECIMAL(8,2) COMMENT '管长（mm）',
    capacity_ml     DECIMAL(6,1) COMMENT '标称容量（ml）',
    seal_method     VARCHAR(32) COMMENT '封尾方式：热封/超声波封/折叠封',
    cap_type        VARCHAR(32) COMMENT '盖型：旋盖/翻盖/无盖',
    cap_material    VARCHAR(32) COMMENT '盖材质：PP/ABS/电镀',
    has_aluminum_seal TINYINT(1) COMMENT '是否铝箔封口',

    UNIQUE KEY uk_mat_id (material_id),
    CONSTRAINT fk_spec_tube FOREIGN KEY (material_id)
        REFERENCES material(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='软管规格扩展';


-- ============================================================
-- 8. 泵头/喷头/滴管规格扩展
-- ============================================================
CREATE TABLE material_spec_dispenser (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    material_id BIGINT UNSIGNED NOT NULL,

    dispenser_type  VARCHAR(32) NOT NULL COMMENT '类型：乳液泵/喷雾泵/真空泵/滴管/按压泵',
    output_per_press DECIMAL(6,2) COMMENT '单次出液量（ml）',
    neck_finish     VARCHAR(16) COMMENT '匹配瓶口规格',
    dip_tube_length DECIMAL(8,2) COMMENT '吸管长度（mm）',
    dip_tube_diameter DECIMAL(6,2) COMMENT '吸管直径（mm）',
    spring_material VARCHAR(32) COMMENT '弹簧材质：不锈钢/塑料/无弹簧',
    pump_material   VARCHAR(32) COMMENT '泵体材质：PP/PE/ABS',
    closure_type    VARCHAR(32) COMMENT '外罩类型：铝罩/电化铝/塑料',
    has_lock        TINYINT(1) DEFAULT 0 COMMENT '是否有锁定功能',
    has_dust_cover  TINYINT(1) DEFAULT 0 COMMENT '是否含防尘盖',

    UNIQUE KEY uk_mat_id (material_id),
    CONSTRAINT fk_spec_dispenser FOREIGN KEY (material_id)
        REFERENCES material(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='泵头/喷头/滴管规格扩展';


-- ============================================================
-- 9. 瓶盖规格扩展
-- ============================================================
CREATE TABLE material_spec_cap (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    material_id BIGINT UNSIGNED NOT NULL,

    cap_type        VARCHAR(32) COMMENT '盖型：旋盖/翻盖/压盖/滴管盖',
    cap_material    VARCHAR(32) COMMENT '材质：PP/ABS/亚克力/铝/电化铝',
    neck_finish     VARCHAR(16) COMMENT '匹配瓶口规格',
    diameter        DECIMAL(8,2) COMMENT '外径（mm）',
    height          DECIMAL(8,2) COMMENT '高度（mm）',
    gasket_material VARCHAR(32) COMMENT '垫片材质：EVA/硅胶/PE泡棉/铝箔',
    surface_treatment VARCHAR(64) COMMENT '表面处理：电镀/喷涂/烫金/UV',

    UNIQUE KEY uk_mat_id (material_id),
    CONSTRAINT fk_spec_cap FOREIGN KEY (material_id)
        REFERENCES material(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='瓶盖规格扩展';


-- ============================================================
-- 10. 彩盒规格扩展
-- ============================================================
CREATE TABLE material_spec_carton (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    material_id BIGINT UNSIGNED NOT NULL,

    carton_type     VARCHAR(32)  COMMENT '盒型：天地盖/翻盖盒/抽屉盒/书型盒/飞机盒/普通卡盒',
    base_paper      VARCHAR(32)  COMMENT '基材：白卡纸/铜版纸/灰板裱白卡/特种纸',
    paper_gsm       INT          COMMENT '纸张克重（g/m²）',
    length          DECIMAL(8,2) COMMENT '长（mm）',
    width           DECIMAL(8,2) COMMENT '宽（mm）',
    height          DECIMAL(8,2) COMMENT '高（mm）',
    surface_process VARCHAR(128) COMMENT '表面处理：覆膜（亮光/哑光）、UV、烫金、压纹、凹凸',
    printing_colors VARCHAR(32)  COMMENT '印刷：四色/专色/四色+专色',
    inner_tray      VARCHAR(32)  COMMENT '内托类型：吸塑/纸托/EVA/海绵',
    has_window      TINYINT(1) DEFAULT 0 COMMENT '是否开窗',
    has_magnet      TINYINT(1) DEFAULT 0 COMMENT '是否含磁铁',

    UNIQUE KEY uk_mat_id (material_id),
    CONSTRAINT fk_spec_carton FOREIGN KEY (material_id)
        REFERENCES material(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='彩盒/纸盒规格扩展';


-- ============================================================
-- 11. 标签/贴纸规格扩展
-- ============================================================
CREATE TABLE material_spec_label (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    material_id     BIGINT UNSIGNED NOT NULL,

    label_type      VARCHAR(32) COMMENT '标签类型：瓶身标签/外盒贴纸/防伪标签/封口贴',
    label_material  VARCHAR(32) COMMENT '材质：不干胶/PET/PVC/合成纸/铜版纸',
    label_shape     VARCHAR(16) COMMENT '形状：矩形/圆形/椭圆/异形',
    label_width     DECIMAL(8,2) COMMENT '宽度（mm）',
    label_height    DECIMAL(8,2) COMMENT '高度/直径（mm）',
    printing_method VARCHAR(32) COMMENT '印刷方式：胶印/凹印/数码',
    surface_finish  VARCHAR(32) COMMENT '表面处理：覆膜/烫金/UV/凹凸',
    adhesive_type   VARCHAR(32) COMMENT '胶水类型：永久/可移除/强粘',
    is_waterproof   TINYINT(1) DEFAULT 0 COMMENT '是否防水',
    is_anti_counterfeit TINYINT(1) DEFAULT 0 COMMENT '是否防伪标签',

    UNIQUE KEY uk_mat_id (material_id),
    CONSTRAINT fk_spec_label FOREIGN KEY (material_id)
        REFERENCES material(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='标签/贴纸规格扩展';


-- ============================================================
-- 12. 面膜袋/试用装袋规格扩展
-- ============================================================
CREATE TABLE material_spec_pouch (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    material_id BIGINT UNSIGNED NOT NULL,

    pouch_type      VARCHAR(32) COMMENT '袋型：面膜袋/铝箔袋/试用装袋/三边封袋/自立袋',
    material_structure VARCHAR(128) COMMENT '材质结构，如"PET/AL/PE"、"NY/PE"',
    width           DECIMAL(8,2) COMMENT '宽度（mm）',
    length          DECIMAL(8,2) COMMENT '长度（mm）',
    thickness_mm    DECIMAL(6,2) COMMENT '厚度（丝）',
    has_tear_notch  TINYINT(1) DEFAULT 0 COMMENT '是否有易撕口',
    has_zipper      TINYINT(1) DEFAULT 0 COMMENT '是否有拉链',
    seal_width      DECIMAL(6,2) COMMENT '封边宽度（mm）',

    UNIQUE KEY uk_mat_id (material_id),
    CONSTRAINT fk_spec_pouch FOREIGN KEY (material_id)
        REFERENCES material(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='面膜袋/试用装袋规格扩展';


-- ============================================================
-- 13. 外箱规格扩展
-- ============================================================
CREATE TABLE material_spec_corrugated (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    material_id BIGINT UNSIGNED NOT NULL,

    box_type        VARCHAR(32) COMMENT '箱型：普通瓦楞箱/天地盖箱/飞机盒',
    flute_type      VARCHAR(8)  COMMENT '楞型：A/B/C/E/AB/BC/BE',
    material_grade  VARCHAR(16) COMMENT '材质等级：K=A/A=A/K3K等',
    length          DECIMAL(8,2) COMMENT '外径长（mm）',
    width           DECIMAL(8,2) COMMENT '外径宽（mm）',
    height          DECIMAL(8,2) COMMENT '外径高（mm）',
    bursting_strength VARCHAR(16) COMMENT '耐破强度',
    units_per_box   INT         COMMENT '每箱容量（个）',
    is_printing     TINYINT(1) DEFAULT 0 COMMENT '箱体是否印刷',

    UNIQUE KEY uk_mat_id (material_id),
    CONSTRAINT fk_spec_corrugated FOREIGN KEY (material_id)
        REFERENCES material(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='外箱规格扩展';


-- ============================================================
-- 14. 供应商-包材供应关系（多对多）
-- ============================================================
CREATE TABLE supplier_material (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    supplier_id     BIGINT UNSIGNED NOT NULL,
    material_id     BIGINT UNSIGNED NOT NULL,

    is_preferred    TINYINT(1) DEFAULT 0 COMMENT '是否首选供应商',
    supplier_material_code VARCHAR(64) COMMENT '供应商自己的物料编码',

    -- 产能信息
    monthly_capacity INT        COMMENT '月产能（个/月）',
    moq              INT        COMMENT '最小起订量',
    typical_lead_time INT       COMMENT '常规交期（天）',

    -- 价格范围（汇总用，实际报价在报价单）
    latest_unit_price DECIMAL(12,6) COMMENT '最新单价',
    price_update_date DATE        COMMENT '价格更新日期',
    currency          VARCHAR(8) DEFAULT 'CNY',

    -- 品质
    sample_approved   TINYINT(1) DEFAULT 0 COMMENT '样品是否已确认',
    sample_date       DATE        COMMENT '样品确认日期',

    status          ENUM('ACTIVE','INACTIVE','DISCONTINUED') DEFAULT 'ACTIVE',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_supplier_mat (supplier_id, material_id),
    INDEX idx_material (material_id),
    CONSTRAINT fk_sm_supplier FOREIGN KEY (supplier_id)
        REFERENCES supplier(id) ON DELETE CASCADE,
    CONSTRAINT fk_sm_material FOREIGN KEY (material_id)
        REFERENCES material(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='供应商可供应包材（多对多）';


-- ============================================================
-- 15. 报价单主表
-- ============================================================
CREATE TABLE quotation (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    quotation_no    VARCHAR(32) NOT NULL COMMENT '报价单号',
    supplier_id     BIGINT UNSIGNED NOT NULL,

    quotation_date  DATE        NOT NULL COMMENT '报价日期',
    valid_until     DATE        COMMENT '有效期至',

    currency        VARCHAR(8)  DEFAULT 'CNY',
    exchange_rate   DECIMAL(10,6) DEFAULT 1.000000 COMMENT '汇率（外币报价时）',

    -- 价格条款
    incoterm        VARCHAR(8)  COMMENT '贸易术语：FOB/CIF/EXW/DDP',
    is_tax_included TINYINT(1) DEFAULT 1 COMMENT '是否含税',
    is_shipping_included TINYINT(1) DEFAULT 0 COMMENT '是否含运费',

    contact_person   VARCHAR(32) COMMENT '报价联系人',
    contact_phone    VARCHAR(32),

    total_amount     DECIMAL(16,4) COMMENT '报价总金额',
    remark           TEXT,

    status          ENUM('DRAFT','CONFIRMED','EXPIRED','CANCELLED') DEFAULT 'DRAFT',
    approved_by      VARCHAR(32) COMMENT '审核人',
    approved_at      DATETIME,
    created_by       VARCHAR(32) COMMENT '创建人',
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_quotation_no (quotation_no),
    INDEX idx_supplier (supplier_id),
    INDEX idx_date (quotation_date),
    CONSTRAINT fk_quo_supplier FOREIGN KEY (supplier_id)
        REFERENCES supplier(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='报价单主表';


-- ============================================================
-- 16. 报价单明细
-- ============================================================
CREATE TABLE quotation_item (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    quotation_id    BIGINT UNSIGNED NOT NULL,
    material_id     BIGINT UNSIGNED NOT NULL,

    item_seq        INT         NOT NULL COMMENT '行号',

    quantity        INT         COMMENT '报价数量',
    unit_price      DECIMAL(12,6) NOT NULL COMMENT '单价',

    -- 费用明细（按需扩展）
    mold_fee        DECIMAL(12,2) DEFAULT 0 COMMENT '模具费（如有）',
    sample_fee      DECIMAL(12,2) DEFAULT 0 COMMENT '打样费',
    shipping_fee    DECIMAL(12,2) DEFAULT 0 COMMENT '运费预估',

    price_breakdown TEXT        COMMENT '价格分解说明（JSON）：材料费/加工费/印刷费等',
    line_total      DECIMAL(16,4) GENERATED ALWAYS AS (
                        CAST(quantity AS DECIMAL(16,4)) * unit_price
                    ) STORED COMMENT '小计（自动计算）',

    lead_time_days  INT         COMMENT '该物料交期（天）',
    remark          VARCHAR(256),

    INDEX idx_quotation (quotation_id),
    INDEX idx_material (material_id),
    CONSTRAINT fk_qi_quotation FOREIGN KEY (quotation_id)
        REFERENCES quotation(id) ON DELETE CASCADE,
    CONSTRAINT fk_qi_material FOREIGN KEY (material_id)
        REFERENCES material(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='报价单明细';


-- ============================================================
-- 17. 采购订单
-- ============================================================
CREATE TABLE purchase_order (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_no        VARCHAR(32) NOT NULL COMMENT '采购单号',
    supplier_id     BIGINT UNSIGNED NOT NULL,
    quotation_id    BIGINT UNSIGNED COMMENT '关联报价单',

    order_date      DATE        NOT NULL,
    expected_delivery DATE      COMMENT '预计交货日期',
    actual_delivery  DATE       COMMENT '实际交货日期',

    currency        VARCHAR(8)  DEFAULT 'CNY',

    -- 履约
    prod_qty_total   INT        COMMENT '生产总数量',
    received_qty     INT        COMMENT '已收货数量',

    total_amount    DECIMAL(16,4) COMMENT '订单总金额',
    paid_amount     DECIMAL(16,4) DEFAULT 0 COMMENT '已付金额',

    urgency         ENUM('NORMAL','URGENT','CRITICAL') DEFAULT 'NORMAL',
    status          ENUM('DRAFT','SENT','CONFIRMED','IN_PRODUCTION','SHIPPING','PARTIAL_RECEIVED','RECEIVED','CANCELLED')
                        DEFAULT 'DRAFT',

    shipping_method VARCHAR(32) COMMENT '运输方式：快递/物流/空运/海运/自提',
    tracking_no     VARCHAR(64) COMMENT '物流单号',

    contract_path   VARCHAR(256) COMMENT '合同文件路径',
    remark          TEXT,
    created_by      VARCHAR(32),
    approved_by     VARCHAR(32),
    approved_at     DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_order_no (order_no),
    INDEX idx_supplier (supplier_id),
    INDEX idx_status (status),
    INDEX idx_order_date (order_date),
    INDEX idx_expected_delivery (expected_delivery),
    CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id)
        REFERENCES supplier(id) ON DELETE RESTRICT,
    CONSTRAINT fk_po_quotation FOREIGN KEY (quotation_id)
        REFERENCES quotation(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='采购订单';


-- ============================================================
-- 18. 采购订单明细
-- ============================================================
CREATE TABLE purchase_order_item (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id        BIGINT UNSIGNED NOT NULL,
    material_id     BIGINT UNSIGNED NOT NULL,

    item_seq        INT         NOT NULL COMMENT '行号',
    order_qty       INT         NOT NULL COMMENT '订购数量',
    received_qty    INT         DEFAULT 0 COMMENT '已收货数量',
    unit_price      DECIMAL(12,6) NOT NULL COMMENT '单价',
    line_total      DECIMAL(16,4) GENERATED ALWAYS AS (
                        CAST(order_qty AS DECIMAL(16,4)) * unit_price
                    ) STORED COMMENT '小计',

    batch_no        VARCHAR(64) COMMENT '我司批号',
    supplier_batch  VARCHAR(64) COMMENT '供应商批号',

    expected_date   DATE        COMMENT '该物料预计到货日',
    actual_date     DATE        COMMENT '该物料实际到货日',
    status          ENUM('PENDING','PARTIAL','COMPLETED','CANCELLED') DEFAULT 'PENDING',
    remark          VARCHAR(256),

    INDEX idx_order (order_id),
    INDEX idx_material (material_id),
    INDEX idx_status (status),
    CONSTRAINT fk_poi_order FOREIGN KEY (order_id)
        REFERENCES purchase_order(id) ON DELETE CASCADE,
    CONSTRAINT fk_poi_material FOREIGN KEY (material_id)
        REFERENCES material(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='采购订单明细';


-- ============================================================
-- 19. 到货质检记录
-- ============================================================
CREATE TABLE quality_inspection (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    inspection_no   VARCHAR(32) NOT NULL COMMENT '质检单号',
    order_id        BIGINT UNSIGNED NOT NULL,
    order_item_id   BIGINT UNSIGNED COMMENT '对应订单明细（可为NULL表示整单检验）',

    inspection_date DATE        NOT NULL,
    inspector       VARCHAR(32) COMMENT '检验人',

    -- 抽样
    lot_qty         INT         COMMENT '批次总数量',
    sample_qty      INT         COMMENT '抽样数量',
    defect_qty      INT         DEFAULT 0 COMMENT '不良数量',
    defect_rate     DECIMAL(6,4) GENERATED ALWAYS AS (
                        CASE WHEN sample_qty > 0
                        THEN CAST(defect_qty AS DECIMAL(10,4)) / CAST(sample_qty AS DECIMAL(10,4))
                        ELSE NULL END
                    ) STORED COMMENT '不良率（自动计算）',

    -- AQL
    aql_level       VARCHAR(8)  COMMENT 'AQL标准：如 1.0/2.5/4.0',
    aql_critical    DECIMAL(6,4) COMMENT 'AQL致命缺陷率',
    aql_major       DECIMAL(6,4) COMMENT 'AQL严重缺陷率',
    aql_minor       DECIMAL(6,4) COMMENT 'AQL轻微缺陷率',

    -- 检验项目（可用JSON存多项）
    check_dimensions  TINYINT(1) DEFAULT 1 COMMENT '尺寸检验：1通过/0不通过',
    check_appearance  TINYINT(1) DEFAULT 1 COMMENT '外观检验',
    check_function    TINYINT(1) DEFAULT 1 COMMENT '功能检验（泵头出液、密封性等）',
    check_printing    TINYINT(1) DEFAULT 1 COMMENT '印刷检验',
    check_color       TINYINT(1) DEFAULT 1 COMMENT '色差检验',
    check_material    TINYINT(1) DEFAULT 1 COMMENT '材质检验',
    check_capacity    TINYINT(1) DEFAULT 1 COMMENT '容量/克重检验',
    check_compatibility TINYINT(1) COMMENT '兼容性测试（包材与料体）',

    inspection_detail TEXT       COMMENT '检验详细记录',

    result          ENUM('PASS','CONDITIONAL_PASS','FAIL') NOT NULL COMMENT '检验结论：合格/让步接收/不合格',
    handle_method   VARCHAR(64) COMMENT '不合格处理：退货/挑选使用/让步接收/报废',

    attachment_path VARCHAR(256) COMMENT '检验报告附件路径',
    remark          TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_inspection_no (inspection_no),
    INDEX idx_order (order_id),
    INDEX idx_result (result),
    INDEX idx_date (inspection_date),
    CONSTRAINT fk_qi_order FOREIGN KEY (order_id)
        REFERENCES purchase_order(id) ON DELETE RESTRICT,
    CONSTRAINT fk_qi_item FOREIGN KEY (order_item_id)
        REFERENCES purchase_order_item(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='到货质检记录';


-- ============================================================
-- 20. 供应商评估记录
-- ============================================================
CREATE TABLE supplier_evaluation (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    supplier_id     BIGINT UNSIGNED NOT NULL,

    eval_period     VARCHAR(16)  NOT NULL COMMENT '评估期，如 2024-Q1 或 2024-03',
    eval_date       DATE         NOT NULL,
    evaluator       VARCHAR(32),

    score_quality   DECIMAL(3,1) COMMENT '质量得分（满分5）',
    score_delivery  DECIMAL(3,1) COMMENT '交期得分（满分5）',
    score_price     DECIMAL(3,1) COMMENT '价格得分（满分5）',
    score_service   DECIMAL(3,1) COMMENT '服务得分（满分5）',
    score_flexibility DECIMAL(3,1) COMMENT '配合度/柔性（满分5）',

    total_score     DECIMAL(4,2) GENERATED ALWAYS AS (
                        (COALESCE(score_quality,0) + COALESCE(score_delivery,0)
                       + COALESCE(score_price,0) + COALESCE(score_service,0)
                       + COALESCE(score_flexibility,0)) / 5
                    ) STORED COMMENT '综合得分（自动计算）',

    evaluation_summary TEXT     COMMENT '评估总结',
    improvement_plan   TEXT     COMMENT '改善建议',

    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_supplier_period (supplier_id, eval_period),
    CONSTRAINT fk_eval_supplier FOREIGN KEY (supplier_id)
        REFERENCES supplier(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='供应商评估记录';


-- ============================================================
-- 21. 交货记录/物流追踪
-- ============================================================
CREATE TABLE delivery_record (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id        BIGINT UNSIGNED NOT NULL,

    delivery_date   DATE        COMMENT '发货日期',
    delivery_qty    INT         COMMENT '本批发货数量',
    carrier         VARCHAR(64) COMMENT '承运商',
    tracking_no     VARCHAR(64) COMMENT '物流单号',
    estimated_arrival DATE      COMMENT '预计到货日',
    actual_arrival   DATE       COMMENT '实际到货日',

    packing_list    VARCHAR(256) COMMENT '装箱单附件',
    remark          VARCHAR(256),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_order (order_id),
    CONSTRAINT fk_del_order FOREIGN KEY (order_id)
        REFERENCES purchase_order(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='交货/物流记录';


-- ============================================================
-- 初始数据：包材分类
-- ============================================================
INSERT INTO material_category (id, parent_id, name, full_path, level, sort_order) VALUES
-- 一级
(1,  NULL, '内包材',   '内包材',   1, 10),
(2,  NULL, '外包材',   '外包材',   1, 20),
(3,  NULL, '辅助包材', '辅助包材', 1, 30),

-- 二级（内包材下）
(11, 1, '瓶类',    '内包材/瓶类',    2, 11),
(12, 1, '软管类',   '内包材/软管类',   2, 12),
(13, 1, '袋类',    '内包材/袋类',    2, 13),
(14, 1, '泵头/喷头/滴管', '内包材/泵头_喷头_滴管', 2, 14),
(15, 1, '瓶盖/内塞', '内包材/瓶盖_内塞', 2, 15),
(16, 1, '安瓶类',   '内包材/安瓶类',   2, 16),

-- 二级（外包材下）
(21, 2, '彩盒/纸盒', '外包材/彩盒_纸盒', 2, 21),
(22, 2, '标签/贴纸', '外包材/标签_贴纸', 2, 22),
(23, 2, '说明书/折页','外包材/说明书_折页', 2, 23),
(24, 2, '收缩膜',    '外包材/收缩膜',   2, 24),
(25, 2, '封口贴/封条','外包材/封口贴_封条', 2, 25),
(26, 2, '内托/内衬', '外包材/内托_内衬', 2, 26),

-- 二级（辅助包材下）
(31, 3, '外箱',      '辅助包材/外箱',     2, 31),
(32, 3, '封箱胶带',   '辅助包材/封箱胶带',  2, 32),
(33, 3, '缓冲材料',   '辅助包材/缓冲材料',  2, 33),

-- 三级（瓶类下）
(111, 11, '精华瓶',   '内包材/瓶类/精华瓶',   3, 111),
(112, 11, '乳液瓶',   '内包材/瓶类/乳液瓶',   3, 112),
(113, 11, '膏霜瓶',   '内包材/瓶类/膏霜瓶',   3, 113),
(114, 11, '爽肤水瓶', '内包材/瓶类/爽肤水瓶', 3, 114),
(115, 11, '精油瓶',   '内包材/瓶类/精油瓶',   3, 115),
(116, 11, '喷雾瓶',   '内包材/瓶类/喷雾瓶',   3, 116),
(117, 11, '旅行装瓶', '内包材/瓶类/旅行装瓶', 3, 117),

-- 三级（软管类下）
(121, 12, '塑料软管', '内包材/软管类/塑料软管',   3, 121),
(122, 12, '铝塑复合管','内包材/软管类/铝塑复合管', 3, 122),
(123, 12, '全塑复合管','内包材/软管类/全塑复合管', 3, 123),

-- 三级（袋类下）
(131, 13, '面膜袋',   '内包材/袋类/面膜袋',   3, 131),
(132, 13, '铝箔袋',   '内包材/袋类/铝箔袋',   3, 132),
(133, 13, '试用装袋', '内包材/袋类/试用装袋',  3, 133),

-- 三级（彩盒下）
(211, 21, '天地盖盒', '外包材/彩盒_纸盒/天地盖盒', 3, 211),
(212, 21, '翻盖盒',   '外包材/彩盒_纸盒/翻盖盒',   3, 212),
(213, 21, '抽屉盒',   '外包材/彩盒_纸盒/抽屉盒',   3, 213),
(214, 21, '书型盒',   '外包材/彩盒_纸盒/书型盒',   3, 214),
(215, 21, '普通卡盒', '外包材/彩盒_纸盒/普通卡盒', 3, 215);

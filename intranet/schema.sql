-- ============================================================================
-- 护肤品库存管理数据库 DDL
-- 目标数据库: MySQL 8.0+ / PostgreSQL 14+
-- 字符集: utf8mb4
-- ============================================================================

-- ============================================================================
-- 1. 基础数据表
-- ============================================================================

-- 1.1 产品分类（树形结构）
CREATE TABLE product_categories (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    parent_id       BIGINT          DEFAULT 0       COMMENT '父级分类ID，0=根节点',
    name            VARCHAR(64)     NOT NULL        COMMENT '分类名称',
    code            VARCHAR(32)     NOT NULL        COMMENT '分类编码，如 CLEANSER / TONER',
    sort_order      INT             DEFAULT 0       COMMENT '排序序号',
    description     VARCHAR(255)                    COMMENT '分类描述',
    is_active       TINYINT         DEFAULT 1       COMMENT '启用状态: 1=启用, 0=停用',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_code (code),
    INDEX idx_parent (parent_id),
    INDEX idx_sort (parent_id, sort_order)
) COMMENT '产品分类表';

-- 1.2 品牌
CREATE TABLE brands (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(128)    NOT NULL        COMMENT '品牌名称',
    name_en         VARCHAR(128)                    COMMENT '品牌英文名',
    country         VARCHAR(64)                     COMMENT '所属国家/地区',
    website         VARCHAR(255)                    COMMENT '官网',
    logo_url        VARCHAR(512)                    COMMENT 'Logo图片地址',
    description     TEXT                            COMMENT '品牌简介',
    is_active       TINYINT         DEFAULT 1       COMMENT '启用状态',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_name (name)
) COMMENT '品牌表';

-- 1.3 供应商
CREATE TABLE suppliers (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(128)    NOT NULL        COMMENT '供应商名称',
    contact_person  VARCHAR(64)                     COMMENT '联系人',
    contact_phone   VARCHAR(32)                     COMMENT '联系电话',
    contact_email   VARCHAR(128)                    COMMENT '联系邮箱',
    address         VARCHAR(512)                    COMMENT '地址',
    bank_name       VARCHAR(128)                    COMMENT '开户行',
    bank_account    VARCHAR(64)                     COMMENT '银行账号',
    tax_id          VARCHAR(32)                     COMMENT '税号',
    payment_terms   VARCHAR(255)                    COMMENT '结算方式说明',
    is_active       TINYINT         DEFAULT 1       COMMENT '启用状态',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_name (name)
) COMMENT '供应商表';

-- 1.4 仓库
CREATE TABLE warehouses (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(128)    NOT NULL        COMMENT '仓库名称',
    code            VARCHAR(32)     NOT NULL        COMMENT '仓库编码',
    address         VARCHAR(512)                    COMMENT '仓库地址',
    manager         VARCHAR(64)                     COMMENT '负责人',
    phone           VARCHAR(32)                     COMMENT '联系电话',
    warehouse_type  VARCHAR(32)     DEFAULT 'NORMAL' COMMENT '仓库类型: NORMAL=普通仓, COLD=冷藏仓, HAZARD=危化品仓',
    is_active       TINYINT         DEFAULT 1       COMMENT '启用状态',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_code (code)
) COMMENT '仓库表';

-- 1.5 库位
CREATE TABLE storage_locations (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    warehouse_id    BIGINT          NOT NULL        COMMENT '所属仓库ID',
    location_code   VARCHAR(64)     NOT NULL        COMMENT '库位编码，如 A-01-03',
    location_type   VARCHAR(32)     DEFAULT 'SHELF' COMMENT '库位类型: SHELF=货架, FLOOR=地堆, COLD=冷藏区',
    max_capacity    INT             DEFAULT 0       COMMENT '最大存放数量（箱/件）',
    is_active       TINYINT         DEFAULT 1       COMMENT '启用状态',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_warehouse_location (warehouse_id, location_code),
    INDEX idx_warehouse (warehouse_id)
) COMMENT '库位表';

-- ============================================================================
-- 2. 产品数据表
-- ============================================================================

-- 2.1 产品主表
CREATE TABLE products (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    product_code    VARCHAR(32)     NOT NULL        COMMENT '产品编号，如 PROD-0001',
    category_id     BIGINT          NOT NULL        COMMENT '所属分类ID',
    brand_id        BIGINT          NOT NULL        COMMENT '品牌ID',
    name            VARCHAR(256)    NOT NULL        COMMENT '产品名称',
    sub_title       VARCHAR(256)                    COMMENT '副标题/产品别名',
    skin_type       VARCHAR(64)                     COMMENT '适用肤质: ALL=所有, DRY=干性, OILY=油性, COMBO=混合, SENSITIVE=敏感',
    efficacy_tags   VARCHAR(512)                    COMMENT '功效标签，逗号分隔: 保湿,美白,抗皱,修复,控油,舒缓',
    ingredient_desc TEXT                            COMMENT '核心成分说明',
    usage_desc      TEXT                            COMMENT '使用方法',
    shelf_life_days INT             DEFAULT 1095    COMMENT '保质期（天），默认3年',
    image_url       VARCHAR(512)                    COMMENT '产品主图',
    is_active       TINYINT         DEFAULT 1       COMMENT '上架状态',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_product_code (product_code),
    INDEX idx_category (category_id),
    INDEX idx_brand (brand_id),
    INDEX idx_skin_type (skin_type),
    INDEX idx_name (name),
    FULLTEXT INDEX ft_name_ingredient (name, ingredient_desc)
) COMMENT '产品主表';

-- 2.2 产品规格/SKU
CREATE TABLE product_skus (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    product_id      BIGINT          NOT NULL        COMMENT '产品ID',
    sku_code        VARCHAR(64)     NOT NULL        COMMENT 'SKU编码（企业自定义）',
    barcode         VARCHAR(64)                     COMMENT '商品条码（EAN/UPC）',
    spec_name       VARCHAR(128)    NOT NULL        COMMENT '规格名称，如 30ml / 50g / 5片装',
    capacity_ml     DECIMAL(10,2)   DEFAULT 0       COMMENT '容量(ml)',
    capacity_g      DECIMAL(10,2)   DEFAULT 0       COMMENT '重量(g)',
    piece_count     INT             DEFAULT 1       COMMENT '片/个数（面膜等）',
    cost_price      DECIMAL(12,2)   DEFAULT 0       COMMENT '成本价',
    wholesale_price DECIMAL(12,2)   DEFAULT 0       COMMENT '批发价',
    retail_price    DECIMAL(12,2)   DEFAULT 0       COMMENT '零售价',
    min_stock_qty   INT             DEFAULT 0       COMMENT '最低库存预警',
    max_stock_qty   INT             DEFAULT 99999   COMMENT '最高库存上限',
    weight_kg       DECIMAL(8,3)    DEFAULT 0       COMMENT '单件重量(kg)，用于物流',
    is_active       TINYINT         DEFAULT 1       COMMENT '启用状态',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_sku_code (sku_code),
    UNIQUE KEY uk_barcode (barcode),
    INDEX idx_product (product_id),
    INDEX idx_price (retail_price)
) COMMENT '产品SKU表';

-- 2.3 批次表
CREATE TABLE product_batches (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    sku_id          BIGINT          NOT NULL        COMMENT 'SKU ID',
    supplier_id     BIGINT                          COMMENT '供应商ID（采购入库时记录）',
    batch_no        VARCHAR(64)     NOT NULL        COMMENT '批次号',
    production_date DATE            NOT NULL        COMMENT '生产日期',
    expiry_date     DATE            NOT NULL        COMMENT '有效期至',
    storage_cond_id BIGINT                          COMMENT '推荐存储条件ID',
    status          VARCHAR(32)     DEFAULT 'NORMAL' COMMENT '状态: NORMAL=正常, NEAR_EXPIRY=临期, EXPIRED=过期, FROZEN=冻结, SCRAPPED=已报废',
    remark          VARCHAR(255)                    COMMENT '备注',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_batch (sku_id, batch_no),
    INDEX idx_sku (sku_id),
    INDEX idx_expiry (expiry_date),
    INDEX idx_status (status),
    INDEX idx_production (production_date)
) COMMENT '批次表';

-- 2.4 套装组合BOM
CREATE TABLE bundle_items (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    bundle_sku_id   BIGINT          NOT NULL        COMMENT '套装SKU ID',
    item_sku_id     BIGINT          NOT NULL        COMMENT '组成单品SKU ID',
    quantity        INT             NOT NULL        COMMENT '单品数量',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_bundle_item (bundle_sku_id, item_sku_id),
    INDEX idx_bundle (bundle_sku_id),
    INDEX idx_item (item_sku_id)
) COMMENT '套装组合BOM表 - 记录套装包含哪些子SKU';

-- ============================================================================
-- 3. 存储与库存
-- ============================================================================

-- 3.1 存储条件表
CREATE TABLE storage_conditions (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(128)    NOT NULL        COMMENT '条件名称，如 常温避光 / 冷藏2-8℃',
    temp_min_c      DECIMAL(5,1)                    COMMENT '最低温度(℃)',
    temp_max_c      DECIMAL(5,1)                    COMMENT '最高温度(℃)',
    humidity_min_pct DECIMAL(5,1)                   COMMENT '最低湿度(%)',
    humidity_max_pct DECIMAL(5,1)                   COMMENT '最高湿度(%)',
    avoid_light     TINYINT         DEFAULT 0       COMMENT '是否避光: 1=是, 0=否',
    avoid_odor      TINYINT         DEFAULT 0       COMMENT '是否隔离异味: 1=是, 0=否',
    description     VARCHAR(255)                    COMMENT '说明',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_name (name)
) COMMENT '存储条件表';

-- 3.2 库存表
CREATE TABLE inventory (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    sku_id          BIGINT          NOT NULL        COMMENT 'SKU ID',
    batch_id        BIGINT          NOT NULL        COMMENT '批次ID',
    warehouse_id    BIGINT          NOT NULL        COMMENT '仓库ID',
    location_id     BIGINT          NOT NULL        COMMENT '库位ID',
    quantity        INT             NOT NULL DEFAULT 0 COMMENT '当前库存数量',
    locked_quantity INT             DEFAULT 0       COMMENT '锁定库存（已下单未出库）',
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_sku_batch_loc (sku_id, batch_id, warehouse_id, location_id),
    INDEX idx_sku (sku_id),
    INDEX idx_batch (batch_id),
    INDEX idx_warehouse (warehouse_id),
    INDEX idx_location (location_id),
    INDEX idx_sku_warehouse (sku_id, warehouse_id)
) COMMENT '库存表 - 按 SKU + 批次 + 仓库 + 库位 维度记录';

-- ============================================================================
-- 4. 业务单据
-- ============================================================================

-- 4.1 入库单
CREATE TABLE inbound_orders (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    order_no        VARCHAR(64)     NOT NULL        COMMENT '入库单号',
    warehouse_id    BIGINT          NOT NULL        COMMENT '入库仓库ID',
    supplier_id     BIGINT                          COMMENT '供应商ID',
    inbound_type    VARCHAR(32)     NOT NULL        COMMENT '入库类型: PURCHASE=采购入库, RETURN=退货入库, TRANSFER=调拨入库, BUNDLE=套装组合, CHECK=盘点盈入',
    status          VARCHAR(32)     DEFAULT 'DRAFT' COMMENT '状态: DRAFT=草稿, CONFIRMED=已确认, COMPLETED=已完成, CANCELLED=已取消',
    total_amount    DECIMAL(14,2)   DEFAULT 0       COMMENT '总金额',
    operator        VARCHAR(64)                     COMMENT '操作人',
    remark          VARCHAR(512)                    COMMENT '备注',
    confirmed_at    DATETIME                        COMMENT '确认时间',
    completed_at    DATETIME                        COMMENT '完成时间',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_order_no (order_no),
    INDEX idx_warehouse (warehouse_id),
    INDEX idx_supplier (supplier_id),
    INDEX idx_status (status),
    INDEX idx_date (created_at)
) COMMENT '入库单主表';

CREATE TABLE inbound_order_items (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    order_id        BIGINT          NOT NULL        COMMENT '入库单ID',
    sku_id          BIGINT          NOT NULL        COMMENT 'SKU ID',
    batch_id        BIGINT          NOT NULL        COMMENT '批次ID',
    location_id     BIGINT          NOT NULL        COMMENT '入库库位ID',
    quantity        INT             NOT NULL        COMMENT '入库数量',
    unit_price      DECIMAL(12,2)   DEFAULT 0       COMMENT '单价',
    amount          DECIMAL(14,2)   DEFAULT 0       COMMENT '金额',

    INDEX idx_order (order_id),
    INDEX idx_sku (sku_id),
    INDEX idx_batch (batch_id)
) COMMENT '入库单明细表';

-- 4.2 出库单
CREATE TABLE outbound_orders (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    order_no        VARCHAR(64)     NOT NULL        COMMENT '出库单号',
    warehouse_id    BIGINT          NOT NULL        COMMENT '出库仓库ID',
    outbound_type   VARCHAR(32)     NOT NULL        COMMENT '出库类型: SALE=销售出库, TRANSFER=调拨出库, SCRAP=报废出库, SAMPLE=赠品/样品, CHECK=盘点亏出',
    status          VARCHAR(32)     DEFAULT 'DRAFT' COMMENT '状态: DRAFT=草稿, CONFIRMED=已确认, PICKING=拣货中, COMPLETED=已完成, CANCELLED=已取消',
    customer_name   VARCHAR(128)                    COMMENT '客户名称(销售出库)',
    order_ref       VARCHAR(128)                    COMMENT '关联订单号',
    total_amount    DECIMAL(14,2)   DEFAULT 0       COMMENT '总金额',
    operator        VARCHAR(64)                     COMMENT '操作人',
    remark          VARCHAR(512)                    COMMENT '备注',
    confirmed_at    DATETIME                        COMMENT '确认时间',
    completed_at    DATETIME                        COMMENT '完成时间',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_order_no (order_no),
    INDEX idx_warehouse (warehouse_id),
    INDEX idx_status (status),
    INDEX idx_date (created_at),
    INDEX idx_type (outbound_type)
) COMMENT '出库单主表';

CREATE TABLE outbound_order_items (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    order_id        BIGINT          NOT NULL        COMMENT '出库单ID',
    sku_id          BIGINT          NOT NULL        COMMENT 'SKU ID',
    batch_id        BIGINT          NOT NULL        COMMENT '批次ID（FEFO原则拣选）',
    location_id     BIGINT          NOT NULL        COMMENT '出库库位ID',
    quantity        INT             NOT NULL        COMMENT '出库数量',
    unit_price      DECIMAL(12,2)   DEFAULT 0       COMMENT '出库单价',
    amount          DECIMAL(14,2)   DEFAULT 0       COMMENT '出库金额',

    INDEX idx_order (order_id),
    INDEX idx_sku (sku_id),
    INDEX idx_batch (batch_id)
) COMMENT '出库单明细表';

-- 4.3 调拨单
CREATE TABLE stock_transfers (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    transfer_no     VARCHAR(64)     NOT NULL        COMMENT '调拨单号',
    from_warehouse  BIGINT          NOT NULL        COMMENT '调出仓库ID',
    to_warehouse    BIGINT          NOT NULL        COMMENT '调入仓库ID',
    status          VARCHAR(32)     DEFAULT 'DRAFT' COMMENT '状态: DRAFT=草稿, IN_TRANSIT=在途, COMPLETED=已完成, CANCELLED=已取消',
    operator        VARCHAR(64)                     COMMENT '操作人',
    remark          VARCHAR(512)                    COMMENT '备注',
    completed_at    DATETIME                        COMMENT '完成时间',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_transfer_no (transfer_no),
    INDEX idx_from (from_warehouse),
    INDEX idx_to (to_warehouse),
    INDEX idx_status (status)
) COMMENT '调拨单主表';

CREATE TABLE stock_transfer_items (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    transfer_id     BIGINT          NOT NULL        COMMENT '调拨单ID',
    sku_id          BIGINT          NOT NULL        COMMENT 'SKU ID',
    batch_id        BIGINT          NOT NULL        COMMENT '批次ID',
    quantity        INT             NOT NULL        COMMENT '调拨数量',

    INDEX idx_transfer (transfer_id),
    INDEX idx_sku (sku_id)
) COMMENT '调拨单明细表';

-- 4.4 盘点单
CREATE TABLE inventory_checks (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    check_no        VARCHAR(64)     NOT NULL        COMMENT '盘点单号',
    warehouse_id    BIGINT          NOT NULL        COMMENT '盘点仓库ID',
    check_type      VARCHAR(32)     DEFAULT 'FULL'  COMMENT '盘点类型: FULL=全盘, PARTIAL=抽盘, DYNAMIC=动态盘点',
    status          VARCHAR(32)     DEFAULT 'DRAFT' COMMENT '状态: DRAFT=草稿, CHECKING=盘点中, CHECKED=已盘点, ADJUSTED=已调整, CANCELLED=已取消',
    operator        VARCHAR(64)                     COMMENT '操作人',
    remark          VARCHAR(512)                    COMMENT '备注',
    checked_at      DATETIME                        COMMENT '盘点时间',
    adjusted_at     DATETIME                        COMMENT '调整时间',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_check_no (check_no),
    INDEX idx_warehouse (warehouse_id),
    INDEX idx_status (status)
) COMMENT '盘点单主表';

CREATE TABLE inventory_check_items (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    check_id        BIGINT          NOT NULL        COMMENT '盘点单ID',
    sku_id          BIGINT          NOT NULL        COMMENT 'SKU ID',
    batch_id        BIGINT          NOT NULL        COMMENT '批次ID',
    location_id     BIGINT          NOT NULL        COMMENT '库位ID',
    system_qty      INT             DEFAULT 0       COMMENT '系统库存',
    actual_qty      INT             DEFAULT 0       COMMENT '实盘库存',
    diff_qty        INT             GENERATED ALWAYS AS (actual_qty - system_qty) VIRTUAL COMMENT '差异数量',
    diff_reason     VARCHAR(255)                    COMMENT '差异原因',
    adjusted        TINYINT         DEFAULT 0       COMMENT '是否已调整: 1=是, 0=否',

    INDEX idx_check (check_id),
    INDEX idx_sku (sku_id)
) COMMENT '盘点单明细表';

-- ============================================================================
-- 5. 外键约束（可选，生产环境可按需添加）
-- ============================================================================
-- 以下外键仅为注释说明，实际执行时按需取消注释：
-- ALTER TABLE products        ADD CONSTRAINT fk_product_cat   FOREIGN KEY (category_id) REFERENCES product_categories(id);
-- ALTER TABLE products        ADD CONSTRAINT fk_product_brand FOREIGN KEY (brand_id)     REFERENCES brands(id);
-- ALTER TABLE product_skus    ADD CONSTRAINT fk_sku_product   FOREIGN KEY (product_id)   REFERENCES products(id);
-- ALTER TABLE product_batches ADD CONSTRAINT fk_batch_sku     FOREIGN KEY (sku_id)       REFERENCES product_skus(id);
-- ALTER TABLE bundle_items    ADD CONSTRAINT fk_bundle_sku    FOREIGN KEY (bundle_sku_id)REFERENCES product_skus(id);
-- ALTER TABLE bundle_items    ADD CONSTRAINT fk_bundle_item   FOREIGN KEY (item_sku_id)  REFERENCES product_skus(id);
-- ALTER TABLE inventory       ADD CONSTRAINT fk_inv_sku       FOREIGN KEY (sku_id)       REFERENCES product_skus(id);
-- ALTER TABLE inventory       ADD CONSTRAINT fk_inv_batch     FOREIGN KEY (batch_id)     REFERENCES product_batches(id);
-- ALTER TABLE inventory       ADD CONSTRAINT fk_inv_wh        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
-- ALTER TABLE inventory       ADD CONSTRAINT fk_inv_loc       FOREIGN KEY (location_id)  REFERENCES storage_locations(id);

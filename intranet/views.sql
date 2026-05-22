-- ============================================================================
-- 护肤品库存管理数据库 — 常用业务视图
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 视图0: 产品编号速查总览
-- 用途: 输入编号查产品，或输入关键词反向查编号，一扫即知
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_product_lookup AS
SELECT
    p.product_code         AS 产品编号,
    p.name                 AS 产品名称,
    p.sub_title            AS 别名,
    b.name                 AS 品牌,
    pc.name                AS 品类,
    p.skin_type            AS 适用肤质,
    p.efficacy_tags        AS 功效,
    GROUP_CONCAT(sku.spec_name ORDER BY sku.spec_name SEPARATOR ' | ') AS 可选规格,
    GROUP_CONCAT(sku.sku_code ORDER BY sku.spec_name SEPARATOR ' | ') AS SKU编码列表,
    GROUP_CONCAT(sku.retail_price ORDER BY sku.spec_name SEPARATOR ' | ') AS 零售价列表,
    CASE WHEN p.is_active = 1 THEN '启用' ELSE '停用' END AS 状态
FROM products p
JOIN brands b               ON p.brand_id    = b.id
JOIN product_categories pc  ON p.category_id = pc.id
JOIN product_skus sku       ON sku.product_id = p.id
GROUP BY p.id, p.product_code, p.name, p.sub_title, b.name, pc.name,
         p.skin_type, p.efficacy_tags, p.is_active
ORDER BY p.product_code;

-- ----------------------------------------------------------------------------
-- 视图1: 库存总览
-- 用途: 按 SKU + 仓库 维度汇总库存，包含可用库存、锁定库存、预警状态
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_inventory_summary AS
SELECT
    wh.id              AS warehouse_id,
    wh.name            AS warehouse_name,
    p.product_code     AS product_code,
    p.id               AS product_id,
    p.name             AS product_name,
    b.name             AS brand_name,
    pc.name            AS category_name,
    sku.id             AS sku_id,
    sku.sku_code,
    sku.spec_name,
    sku.retail_price,
    SUM(inv.quantity)          AS total_qty,
    SUM(inv.locked_quantity)   AS locked_qty,
    SUM(inv.quantity) - SUM(inv.locked_quantity) AS available_qty,
    sku.min_stock_qty,
    sku.max_stock_qty,
    CASE
        WHEN SUM(inv.quantity) <= sku.min_stock_qty THEN 'BELOW_MIN'
        WHEN SUM(inv.quantity) >= sku.max_stock_qty THEN 'ABOVE_MAX'
        ELSE 'NORMAL'
    END AS stock_status
FROM inventory inv
JOIN product_skus     sku ON inv.sku_id       = sku.id
JOIN products         p   ON sku.product_id   = p.id
JOIN brands           b   ON p.brand_id       = b.id
JOIN product_categories pc ON p.category_id   = pc.id
JOIN warehouses       wh  ON inv.warehouse_id = wh.id
WHERE p.is_active = 1 AND sku.is_active = 1
GROUP BY wh.id, wh.name, p.product_code, p.id, p.name, b.name, pc.name,
         sku.id, sku.sku_code, sku.spec_name, sku.retail_price,
         sku.min_stock_qty, sku.max_stock_qty;


-- ----------------------------------------------------------------------------
-- 视图2: 临期预警
-- 用途: 列出 90天内到期 / 180天内到期 的批次，按到期日排序
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_expiry_warning AS
SELECT
    pb.id               AS batch_id,
    pb.batch_no,
    p.product_code      AS product_code,
    p.name              AS product_name,
    sku.sku_code,
    sku.spec_name,
    pb.production_date,
    pb.expiry_date,
    DATEDIFF(pb.expiry_date, CURDATE()) AS days_to_expire,
    sc.name             AS storage_condition,
    SUM(inv.quantity)   AS stock_qty,
    wh.name             AS warehouse_name,
    CASE
        WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 0   THEN 'EXPIRED'
        WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 90  THEN 'URGENT_90'
        WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 180 THEN 'WARNING_180'
        ELSE 'OK'
    END AS warning_level
FROM product_batches pb
JOIN product_skus     sku ON pb.sku_id      = sku.id
JOIN products         p   ON sku.product_id = p.id
JOIN inventory        inv ON inv.batch_id   = pb.id
JOIN warehouses       wh  ON inv.warehouse_id = wh.id
LEFT JOIN storage_conditions sc ON pb.storage_cond_id = sc.id
WHERE pb.status IN ('NORMAL', 'NEAR_EXPIRY')
  AND DATEDIFF(pb.expiry_date, CURDATE()) <= 180
GROUP BY pb.id, pb.batch_no, p.name, sku.sku_code, sku.spec_name,
         pb.production_date, pb.expiry_date, sc.name, wh.name
ORDER BY days_to_expire ASC;


-- ----------------------------------------------------------------------------
-- 视图3: 出入库流水
-- 用途: 合并入库/出库明细为统一流水视图
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_inventory_ledger AS
SELECT
    'IN'                          AS io_type,
    io.order_no                   AS order_no,
    ioi.id                        AS item_id,
    ioi.sku_id,
    p.product_code                AS product_code,
    sku.sku_code,
    p.name                        AS product_name,
    sku.spec_name,
    pb.batch_no,
    w.name                        AS warehouse_name,
    sl.location_code              AS location_code,
    ioi.quantity                  AS quantity,
    ioi.unit_price,
    ioi.amount,
    io.inbound_type               AS biz_type,
    io.created_at                 AS trans_time
FROM inbound_order_items ioi
JOIN inbound_orders    io  ON ioi.order_id = io.id
JOIN product_skus      sku ON ioi.sku_id   = sku.id
JOIN products          p   ON sku.product_id = p.id
JOIN product_batches   pb  ON ioi.batch_id = pb.id
JOIN warehouses        w   ON io.warehouse_id = w.id
JOIN storage_locations sl  ON ioi.location_id = sl.id
WHERE io.status = 'COMPLETED'

UNION ALL

SELECT
    'OUT'                         AS io_type,
    oo.order_no                   AS order_no,
    ooi.id                        AS item_id,
    ooi.sku_id,
    p.product_code                AS product_code,
    sku.sku_code,
    p.name                        AS product_name,
    sku.spec_name,
    pb.batch_no,
    w.name                        AS warehouse_name,
    sl.location_code              AS location_code,
    -ooi.quantity                 AS quantity,     -- 出库为负数
    ooi.unit_price,
    ooi.amount,
    oo.outbound_type              AS biz_type,
    oo.created_at                 AS trans_time
FROM outbound_order_items ooi
JOIN outbound_orders   oo  ON ooi.order_id = oo.id
JOIN product_skus      sku ON ooi.sku_id   = sku.id
JOIN products          p   ON sku.product_id = p.id
JOIN product_batches   pb  ON ooi.batch_id = pb.id
JOIN warehouses        w   ON oo.warehouse_id = w.id
JOIN storage_locations sl  ON ooi.location_id = sl.id
WHERE oo.status = 'COMPLETED'
ORDER BY trans_time DESC;


-- ----------------------------------------------------------------------------
-- 视图4: FEFO出库推荐（先到期先出）
-- 用途: 查询某SKU可出库批次，按到期日升序排列，拣货时按此顺序出库
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_fefo_pick_list AS
SELECT
    inv.sku_id,
    p.product_code      AS product_code,
    sku.sku_code,
    p.name              AS product_name,
    sku.spec_name,
    pb.batch_no,
    pb.expiry_date,
    DATEDIFF(pb.expiry_date, CURDATE()) AS days_to_expire,
    wh.name             AS warehouse_name,
    sl.location_code,
    inv.quantity        AS available_qty,
    inv.locked_quantity AS locked_qty,
    inv.quantity - inv.locked_quantity AS pickable_qty
FROM inventory inv
JOIN product_batches   pb  ON inv.batch_id      = pb.id
JOIN product_skus      sku ON inv.sku_id         = sku.id
JOIN products          p   ON sku.product_id     = p.id
JOIN warehouses        wh  ON inv.warehouse_id   = wh.id
JOIN storage_locations sl  ON inv.location_id    = sl.id
WHERE inv.quantity > inv.locked_quantity
  AND pb.status = 'NORMAL'
ORDER BY inv.sku_id, pb.expiry_date ASC;


-- ----------------------------------------------------------------------------
-- 视图5: 套装库存可配数量
-- 用途: 计算套装可组装数量 = 各子SKU可用库存的最小值
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_bundle_available_qty AS
SELECT
    bundle_sku.id                AS bundle_sku_id,
    bundle_sku.sku_code          AS bundle_sku_code,
    bundle_p.product_code        AS bundle_product_code,
    bundle_p.name                AS bundle_name,
    item_sku.id                  AS item_sku_id,
    item_sku.sku_code            AS item_sku_code,
    item_p.product_code          AS item_product_code,
    item_p.name                  AS item_name,
    bi.quantity                  AS qty_per_bundle,
    COALESCE(SUM(inv.quantity - inv.locked_quantity), 0) AS item_available_qty,
    FLOOR(COALESCE(SUM(inv.quantity - inv.locked_quantity), 0) / bi.quantity) AS max_bundles_from_item
FROM bundle_items bi
JOIN product_skus   bundle_sku ON bi.bundle_sku_id = bundle_sku.id
JOIN products       bundle_p   ON bundle_sku.product_id = bundle_p.id
JOIN product_skus   item_sku   ON bi.item_sku_id = item_sku.id
JOIN products       item_p     ON item_sku.product_id = item_p.id
LEFT JOIN inventory inv ON inv.sku_id = item_sku.id
WHERE bundle_sku.is_active = 1 AND item_sku.is_active = 1
GROUP BY bundle_sku.id, bundle_sku.sku_code, bundle_p.name,
         item_sku.id, item_sku.sku_code, item_p.name, bi.quantity;


-- ----------------------------------------------------------------------------
-- 视图6: 库存周转率（按SKU，最近30天）
-- 用途: 分析各SKU库存周转情况
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_inventory_turnover AS
SELECT
    sku.id              AS sku_id,
    p.product_code      AS product_code,
    sku.sku_code,
    p.name              AS product_name,
    sku.spec_name,
    COALESCE(ooi.total_out, 0)      AS out_qty_30d,
    COALESCE(inv_sum.total_qty, 0)  AS current_stock,
    CASE
        WHEN COALESCE(inv_sum.total_qty, 0) > 0
        THEN ROUND(COALESCE(ooi.total_out, 0) / COALESCE(inv_sum.total_qty, 1), 2)
        ELSE 0
    END AS turnover_rate_30d,
    CASE
        WHEN COALESCE(ooi.total_out, 0) > 0
        THEN ROUND(COALESCE(inv_sum.total_qty, 0) / (COALESCE(ooi.total_out, 0) / 30.0), 0)
        ELSE NULL
    END AS days_of_inventory
FROM product_skus sku
JOIN products p ON sku.product_id = p.id
LEFT JOIN (
    SELECT sku_id, SUM(quantity) AS total_out
    FROM outbound_order_items ooi
    JOIN outbound_orders oo ON ooi.order_id = oo.id
    WHERE oo.status = 'COMPLETED'
      AND oo.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY sku_id
) ooi ON sku.id = ooi.sku_id
LEFT JOIN (
    SELECT sku_id, SUM(quantity - locked_quantity) AS total_qty
    FROM inventory
    GROUP BY sku_id
) inv_sum ON sku.id = inv_sum.sku_id
WHERE sku.is_active = 1;

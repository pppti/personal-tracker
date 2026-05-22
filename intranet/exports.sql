-- ============================================================================
-- 护肤品库存管理数据库 — 全部导出视图 & 存储过程
-- 用途: 提供可直接导出为 CSV/Excel 的扁平化数据视图
-- ============================================================================

-- ============================================================================
-- 导出视图（扁平化，适合 SELECT ... INTO OUTFILE 直接导出）
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 导出1: 产品主数据全量导出
-- 字段: 品类路径、品牌、产品名、适用肤质、功效、成分、SKU、条码、价格、保质期
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_export_product_master AS
SELECT
    p.id                    AS 产品ID,
    p.product_code          AS 产品编号,
    pc1.name                AS 一级品类,
    pc2.name                AS 二级品类,
    pc3.name                AS 三级品类,
    b.name                  AS 品牌,
    b.country               AS 品牌产地,
    p.name                  AS 产品名称,
    p.sub_title             AS 产品别名,
    p.skin_type             AS 适用肤质,
    p.efficacy_tags         AS 功效标签,
    p.ingredient_desc       AS 核心成分,
    p.shelf_life_days       AS 保质期天数,
    sku.sku_code            AS SKU编码,
    sku.barcode             AS 条码,
    sku.spec_name           AS 规格,
    sku.capacity_ml         AS 容量ml,
    sku.capacity_g          AS 重量g,
    sku.piece_count         AS 片数,
    sku.cost_price          AS 成本价,
    sku.wholesale_price     AS 批发价,
    sku.retail_price        AS 零售价,
    sku.weight_kg           AS 单件重量kg,
    sku.min_stock_qty       AS 最低库存预警,
    sku.max_stock_qty       AS 最高库存上限,
    CASE WHEN p.is_active = 1 AND sku.is_active = 1 THEN '启用' ELSE '停用' END AS 状态,
    p.created_at            AS 产品创建时间,
    sku.created_at          AS SKU创建时间
FROM product_skus sku
JOIN products p            ON sku.product_id   = p.id
JOIN brands b              ON p.brand_id       = b.id
JOIN product_categories pc3 ON p.category_id   = pc3.id
LEFT JOIN product_categories pc2 ON pc3.parent_id = pc2.id
LEFT JOIN product_categories pc1 ON pc2.parent_id = pc1.id
ORDER BY 一级品类, 二级品类, 品牌, 产品名称, 规格;


-- ----------------------------------------------------------------------------
-- 导出2: 批次全量追踪导出
-- 字段: 产品信息、批次号、生产日期、到期日、剩余天数、供应商、存储条件、状态
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_export_batch_tracking AS
SELECT
    pb.id                   AS 批次ID,
    pb.batch_no             AS 批次号,
    p.product_code          AS 产品编号,
    p.name                  AS 产品名称,
    b.name                  AS 品牌,
    sku.sku_code            AS SKU编码,
    sku.spec_name           AS 规格,
    pb.production_date      AS 生产日期,
    pb.expiry_date          AS 有效期至,
    DATEDIFF(pb.expiry_date, CURDATE()) AS 剩余天数,
    CASE
        WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 0   THEN '已过期'
        WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 90  THEN '90天内到期'
        WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 180 THEN '180天内到期'
        ELSE '正常'
    END                     AS 效期状态,
    COALESCE(s.name, '-')   AS 供应商,
    COALESCE(sc.name, '-')  AS 存储条件,
    CASE pb.status
        WHEN 'NORMAL'      THEN '正常'
        WHEN 'NEAR_EXPIRY' THEN '临期'
        WHEN 'EXPIRED'     THEN '已过期'
        WHEN 'FROZEN'      THEN '已冻结'
        WHEN 'SCRAPPED'    THEN '已报废'
    END                     AS 批次状态,
    pb.remark               AS 备注,
    pb.created_at           AS 创建时间
FROM product_batches pb
JOIN product_skus     sku ON pb.sku_id = sku.id
JOIN products         p   ON sku.product_id = p.id
JOIN brands           b   ON p.brand_id = b.id
LEFT JOIN suppliers   s   ON pb.supplier_id = s.id
LEFT JOIN storage_conditions sc ON pb.storage_cond_id = sc.id
ORDER BY pb.expiry_date ASC;


-- ----------------------------------------------------------------------------
-- 导出3: 库存快照导出（当前库存全量）
-- 字段: 完整维度 + 可用数量 + 锁定数量 + 库位 + 临期标记
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_export_inventory_snapshot AS
SELECT
    wh.name                 AS 仓库,
    sl.location_code        AS 库位,
    pc.name                 AS 品类,
    b.name                  AS 品牌,
    p.product_code          AS 产品编号,
    p.name                  AS 产品名称,
    sku.sku_code            AS SKU编码,
    sku.barcode             AS 条码,
    sku.spec_name           AS 规格,
    pb.batch_no             AS 批次号,
    pb.production_date      AS 生产日期,
    pb.expiry_date          AS 有效期至,
    DATEDIFF(pb.expiry_date, CURDATE()) AS 剩余天数,
    CASE
        WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 0   THEN '已过期'
        WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 90  THEN '90天内到期'
        WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 180 THEN '180天内到期'
        ELSE '正常'
    END                     AS 效期状态,
    inv.quantity            AS 库存数量,
    inv.locked_quantity     AS 锁定数量,
    inv.quantity - inv.locked_quantity AS 可用数量,
    sku.retail_price        AS 零售价,
    (inv.quantity - inv.locked_quantity) * sku.retail_price AS 可用库存货值,
    sl.location_type        AS 库位类型,
    sc.name                 AS 存储要求,
    inv.updated_at          AS 最后更新时间
FROM inventory inv
JOIN product_skus      sku ON inv.sku_id       = sku.id
JOIN products          p   ON sku.product_id   = p.id
JOIN brands            b   ON p.brand_id       = b.id
JOIN product_categories pc ON p.category_id    = pc.id
JOIN product_batches   pb  ON inv.batch_id     = pb.id
JOIN warehouses        wh  ON inv.warehouse_id = wh.id
JOIN storage_locations sl  ON inv.location_id  = sl.id
LEFT JOIN storage_conditions sc ON pb.storage_cond_id = sc.id
WHERE inv.quantity > 0
ORDER BY wh.name, sl.location_code, p.name, pb.expiry_date;


-- ----------------------------------------------------------------------------
-- 导出4: 库存汇总导出（按产品+仓库，不区分批次）
-- 字段: 适合给管理层/财务看的汇总数据
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_export_inventory_summary AS
SELECT
    wh.name                 AS 仓库,
    pc.name                 AS 品类,
    b.name                  AS 品牌,
    p.product_code          AS 产品编号,
    p.name                  AS 产品名称,
    sku.sku_code            AS SKU编码,
    sku.spec_name           AS 规格,
    sku.retail_price        AS 零售价,
    sku.cost_price          AS 成本价,
    SUM(inv.quantity)       AS 总库存,
    SUM(inv.locked_quantity)AS 总锁定,
    SUM(inv.quantity) - SUM(inv.locked_quantity) AS 可用库存,
    (SUM(inv.quantity) - SUM(inv.locked_quantity)) * sku.retail_price AS 可用货值,
    (SUM(inv.quantity) - SUM(inv.locked_quantity)) * sku.cost_price   AS 可用成本,
    COUNT(DISTINCT inv.batch_id) AS 批次数量,
    MIN(pb.expiry_date)     AS 最早到期日,
    CASE
        WHEN SUM(inv.quantity) <= sku.min_stock_qty THEN '低于最低库存'
        WHEN SUM(inv.quantity) >= sku.max_stock_qty THEN '超过最高库存'
        ELSE '正常'
    END                     AS 库存状态
FROM inventory inv
JOIN product_skus      sku ON inv.sku_id       = sku.id
JOIN products          p   ON sku.product_id   = p.id
JOIN brands            b   ON p.brand_id       = b.id
JOIN product_categories pc ON p.category_id    = pc.id
JOIN warehouses        wh  ON inv.warehouse_id = wh.id
JOIN product_batches   pb  ON inv.batch_id     = pb.id
WHERE inv.quantity > 0
GROUP BY wh.name, pc.name, b.name, p.product_code, p.name, sku.sku_code, sku.spec_name,
         sku.retail_price, sku.cost_price, sku.min_stock_qty, sku.max_stock_qty
ORDER BY wh.name, pc.name, 品牌, 产品名称;


-- ----------------------------------------------------------------------------
-- 导出5: 入库明细导出（支持按日期范围筛选）
-- 字段: 入库单完整信息 + 每行商品明细
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_export_inbound_detail AS
SELECT
    io.order_no             AS 入库单号,
    CASE io.inbound_type
        WHEN 'PURCHASE'  THEN '采购入库'
        WHEN 'RETURN'    THEN '退货入库'
        WHEN 'TRANSFER'  THEN '调拨入库'
        WHEN 'BUNDLE'    THEN '套装组合'
        WHEN 'CHECK'     THEN '盘点盈入'
    END                     AS 入库类型,
    wh.name                 AS 仓库,
    COALESCE(s.name, '-')   AS 供应商,
    io.created_at           AS 入库日期,
    CASE io.status
        WHEN 'DRAFT'     THEN '草稿'
        WHEN 'CONFIRMED' THEN '已确认'
        WHEN 'COMPLETED' THEN '已完成'
        WHEN 'CANCELLED' THEN '已取消'
    END                     AS 状态,
    p.product_code          AS 产品编号,
    p.name                  AS 产品名称,
    sku.sku_code            AS SKU编码,
    sku.spec_name           AS 规格,
    pb.batch_no             AS 批次号,
    sl.location_code        AS 入库库位,
    ioi.quantity            AS 数量,
    ioi.unit_price          AS 单价,
    ioi.amount              AS 金额,
    io.operator             AS 操作人,
    io.remark               AS 备注
FROM inbound_orders io
JOIN inbound_order_items ioi ON io.id = ioi.order_id
JOIN product_skus      sku  ON ioi.sku_id   = sku.id
JOIN products          p    ON sku.product_id = p.id
JOIN product_batches   pb   ON ioi.batch_id = pb.id
JOIN warehouses        wh   ON io.warehouse_id = wh.id
JOIN storage_locations sl   ON ioi.location_id = sl.id
LEFT JOIN suppliers    s    ON io.supplier_id = s.id
ORDER BY io.created_at DESC, io.order_no, p.name;


-- ----------------------------------------------------------------------------
-- 导出6: 出库明细导出（支持按日期范围筛选）
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_export_outbound_detail AS
SELECT
    oo.order_no             AS 出库单号,
    CASE oo.outbound_type
        WHEN 'SALE'      THEN '销售出库'
        WHEN 'TRANSFER'  THEN '调拨出库'
        WHEN 'SCRAP'     THEN '报废出库'
        WHEN 'SAMPLE'    THEN '赠品/样品'
        WHEN 'CHECK'     THEN '盘点亏出'
    END                     AS 出库类型,
    wh.name                 AS 仓库,
    COALESCE(oo.customer_name, '-') AS 客户,
    COALESCE(oo.order_ref, '-')     AS 关联订单号,
    oo.created_at           AS 出库日期,
    CASE oo.status
        WHEN 'DRAFT'     THEN '草稿'
        WHEN 'CONFIRMED' THEN '已确认'
        WHEN 'PICKING'   THEN '拣货中'
        WHEN 'COMPLETED' THEN '已完成'
        WHEN 'CANCELLED' THEN '已取消'
    END                     AS 状态,
    p.product_code          AS 产品编号,
    p.name                  AS 产品名称,
    sku.sku_code            AS SKU编码,
    sku.spec_name           AS 规格,
    pb.batch_no             AS 批次号,
    pb.expiry_date          AS 批次到期日,
    sl.location_code        AS 出库库位,
    ooi.quantity            AS 数量,
    ooi.unit_price          AS 单价,
    ooi.amount              AS 金额,
    oo.operator             AS 操作人,
    oo.remark               AS 备注
FROM outbound_orders oo
JOIN outbound_order_items ooi ON oo.id = ooi.order_id
JOIN product_skus      sku   ON ooi.sku_id   = sku.id
JOIN products          p     ON sku.product_id = p.id
JOIN product_batches   pb    ON ooi.batch_id = pb.id
JOIN warehouses        wh    ON oo.warehouse_id = wh.id
JOIN storage_locations sl    ON ooi.location_id = sl.id
ORDER BY oo.created_at DESC, oo.order_no, p.name;


-- ----------------------------------------------------------------------------
-- 导出7: 盘点差异导出
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_export_check_diff AS
SELECT
    ic.check_no             AS 盘点单号,
    wh.name                 AS 仓库,
    CASE ic.check_type
        WHEN 'FULL'    THEN '全盘'
        WHEN 'PARTIAL' THEN '抽盘'
        WHEN 'DYNAMIC' THEN '动态盘点'
    END                     AS 盘点类型,
    ic.checked_at           AS 盘点时间,
    CASE ic.status
        WHEN 'DRAFT'    THEN '草稿'
        WHEN 'CHECKING' THEN '盘点中'
        WHEN 'CHECKED'  THEN '已盘点'
        WHEN 'ADJUSTED' THEN '已调整'
        WHEN 'CANCELLED' THEN '已取消'
    END                     AS 状态,
    p.product_code          AS 产品编号,
    p.name                  AS 产品名称,
    sku.sku_code            AS SKU编码,
    sku.spec_name           AS 规格,
    pb.batch_no             AS 批次号,
    sl.location_code        AS 库位,
    ici.system_qty          AS 系统数量,
    ici.actual_qty          AS 实盘数量,
    ici.diff_qty            AS 差异数量,
    CASE
        WHEN ici.diff_qty > 0  THEN '盘盈'
        WHEN ici.diff_qty < 0  THEN '盘亏'
        WHEN ici.diff_qty = 0  THEN '相符'
    END                     AS 差异类型,
    COALESCE(ici.diff_reason, '-') AS 差异原因,
    CASE WHEN ici.adjusted = 1 THEN '已调整' ELSE '未调整' END AS 调整状态,
    ic.operator             AS 操作人
FROM inventory_checks ic
JOIN inventory_check_items ici ON ic.id = ici.check_id
JOIN product_skus      sku    ON ici.sku_id   = sku.id
JOIN products          p      ON sku.product_id = p.id
JOIN product_batches   pb     ON ici.batch_id = pb.id
JOIN warehouses        wh     ON ic.warehouse_id = wh.id
JOIN storage_locations sl     ON ici.location_id = sl.id
ORDER BY ic.checked_at DESC, ABS(ici.diff_qty) DESC;


-- ----------------------------------------------------------------------------
-- 导出8: 调拨明细导出
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_export_transfer_detail AS
SELECT
    st.transfer_no          AS 调拨单号,
    fw.name                 AS 调出仓库,
    tw.name                 AS 调入仓库,
    CASE st.status
        WHEN 'DRAFT'     THEN '草稿'
        WHEN 'IN_TRANSIT'THEN '在途'
        WHEN 'COMPLETED' THEN '已完成'
        WHEN 'CANCELLED' THEN '已取消'
    END                     AS 状态,
    st.created_at           AS 创建时间,
    st.completed_at         AS 完成时间,
    p.product_code          AS 产品编号,
    p.name                  AS 产品名称,
    sku.sku_code            AS SKU编码,
    sku.spec_name           AS 规格,
    pb.batch_no             AS 批次号,
    sti.quantity            AS 数量,
    st.operator             AS 操作人,
    st.remark               AS 备注
FROM stock_transfers st
JOIN stock_transfer_items sti ON st.id = sti.transfer_id
JOIN product_skus      sku   ON sti.sku_id   = sku.id
JOIN products          p     ON sku.product_id = p.id
JOIN product_batches   pb    ON sti.batch_id = pb.id
JOIN warehouses        fw    ON st.from_warehouse = fw.id
JOIN warehouses        tw    ON st.to_warehouse   = tw.id
ORDER BY st.created_at DESC, st.transfer_no;


-- ----------------------------------------------------------------------------
-- 导出9: 临期库存导出（含处置建议）
-- 字段: 只包含180天内到期的产品，用于制定促销/退货/报废决策
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_export_expiry_stock AS
SELECT
    wh.name                 AS 仓库,
    sl.location_code        AS 库位,
    b.name                  AS 品牌,
    p.product_code          AS 产品编号,
    p.name                  AS 产品名称,
    sku.sku_code            AS SKU编码,
    sku.spec_name           AS 规格,
    pb.batch_no             AS 批次号,
    pb.production_date      AS 生产日期,
    pb.expiry_date          AS 有效期至,
    DATEDIFF(pb.expiry_date, CURDATE()) AS 剩余天数,
    inv.quantity            AS 库存数量,
    inv.locked_quantity     AS 锁定数量,
    inv.quantity - inv.locked_quantity AS 可用数量,
    (inv.quantity - inv.locked_quantity) * sku.retail_price AS 可用货值,
    sku.cost_price          AS 成本价,
    (inv.quantity - inv.locked_quantity) * sku.cost_price   AS 可用成本,
    s.name                  AS 供应商,
    CASE
        WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 0   THEN '立即销毁'
        WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 30  THEN '紧急促销/报损'
        WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 90  THEN '折扣促销/渠道清货'
        WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 180 THEN '优先出库/制定促销计划'
        ELSE '-'
    END                     AS 处置建议
FROM inventory inv
JOIN product_batches   pb  ON inv.batch_id     = pb.id
JOIN product_skus      sku ON inv.sku_id       = sku.id
JOIN products          p   ON sku.product_id   = p.id
JOIN brands            b   ON p.brand_id       = b.id
JOIN warehouses        wh  ON inv.warehouse_id = wh.id
JOIN storage_locations sl  ON inv.location_id  = sl.id
LEFT JOIN suppliers    s   ON pb.supplier_id   = s.id
WHERE inv.quantity > 0
  AND DATEDIFF(pb.expiry_date, CURDATE()) <= 180
ORDER BY 剩余天数 ASC;


-- ============================================================================
-- 存储过程: 按日期范围导出（支持参数化查询）
-- 注意: MySQL 存储过程无法直接返回结果集给导出工具，
--       以下过程将结果写入临时表，外部工具从临时表读取
-- ============================================================================

-- 导出用临时表（会话级）
CREATE TEMPORARY TABLE IF NOT EXISTS _export_result (
    row_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    data_json   JSON            COMMENT '行数据JSON',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=MEMORY;


-- ----------------------------------------------------------------------------
-- 存储过程: 按日期范围导出出入库流水
-- 用法: CALL sp_export_ledger('2025-05-01', '2025-05-31');
-- ----------------------------------------------------------------------------
DELIMITER //

CREATE OR REPLACE PROCEDURE sp_export_ledger(
    IN p_start_date DATE,
    IN p_end_date   DATE
)
BEGIN
    -- 先清空临时表
    TRUNCATE TABLE _export_result;

    -- 写入出入库流水JSON
    INSERT INTO _export_result (data_json)
    SELECT JSON_OBJECT(
        '类型',       io_type,
        '单号',       order_no,
        'SKU编码',    sku_code,
        '产品名称',   product_name,
        '规格',       spec_name,
        '批次号',     batch_no,
        '仓库',       warehouse_name,
        '库位',       location_code,
        '数量',       quantity,
        '单价',       unit_price,
        '金额',       amount,
        '业务类型',   biz_type,
        '时间',       trans_time
    )
    FROM v_inventory_ledger
    WHERE trans_time >= p_start_date
      AND trans_time <  DATE_ADD(p_end_date, INTERVAL 1 DAY)
    ORDER BY trans_time DESC;

    -- 返回记录数
    SELECT COUNT(*) AS total_rows FROM _export_result;
END //

DELIMITER ;


-- ----------------------------------------------------------------------------
-- 存储过程: 导出指定仓库当前库存到文件
-- 用法(MySQL): CALL sp_export_inventory_to_file(1, '/tmp/inventory_sh.csv');
-- 注意: MySQL secure_file_priv 必须配置允许写入目标路径
-- ----------------------------------------------------------------------------
DELIMITER //

CREATE OR REPLACE PROCEDURE sp_export_inventory_to_file(
    IN p_warehouse_id BIGINT,
    IN p_file_path    VARCHAR(512)
)
BEGIN
    SET @sql = CONCAT(
        "SELECT '仓库','库位','品类','品牌','产品名称','SKU编码','条码','规格','批次号','生产日期','有效期至','剩余天数','库存数量','锁定数量','可用数量','零售价','可用货值' ",
        "UNION ALL ",
        "SELECT 仓库,库位,品类,品牌,产品名称,SKU编码,COALESCE(条码,''),规格,批次号,生产日期,有效期至,剩余天数,库存数量,锁定数量,可用数量,零售价,可用库存货值 ",
        "FROM v_export_inventory_snapshot ",
        IF(p_warehouse_id > 0,
           CONCAT("WHERE 仓库 IN (SELECT name FROM warehouses WHERE id = ", p_warehouse_id, ") "),
           ""),
        "INTO OUTFILE '", p_file_path, "' ",
        "CHARACTER SET utf8mb4 ",
        "FIELDS TERMINATED BY ',' ",
        "OPTIONALLY ENCLOSED BY '\"' ",
        "LINES TERMINATED BY '\\n'"
    );

    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END //

DELIMITER ;


-- ============================================================================
-- 便捷导出查询模板（直接复制到客户端工具中执行，替换日期参数即可）
-- ============================================================================

-- 模板1: 导出当前全部库存 (替换 CURDATE() 可做历史快照)
-- SELECT * FROM v_export_inventory_snapshot
-- INTO OUTFILE '/tmp/inventory_20250522.csv'
-- CHARACTER SET utf8mb4
-- FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
-- LINES TERMINATED BY '\n';

-- 模板2: 导出5月入库明细
-- SELECT * FROM v_export_inbound_detail
-- WHERE 入库日期 BETWEEN '2025-05-01' AND '2025-05-31';

-- 模板3: 导出5月出库明细
-- SELECT * FROM v_export_outbound_detail
-- WHERE 出库日期 BETWEEN '2025-05-01' AND '2025-05-31';

-- 模板4: 导出临期库存（180天内到期）
-- SELECT * FROM v_export_expiry_stock;

-- 模板5: 导出盘点差异
-- SELECT * FROM v_export_check_diff
-- WHERE 盘点时间 BETWEEN '2025-05-01' AND '2025-05-31';

-- 模板6: 导出批次追踪全量
-- SELECT * FROM v_export_batch_tracking;

-- 模板7: 导出产品主数据
-- SELECT * FROM v_export_product_master;

-- 模板8: 导出库存汇总（管理层报表）
-- SELECT * FROM v_export_inventory_summary;

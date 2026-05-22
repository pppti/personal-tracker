-- ============================================================
-- 护肤品公司 - 供应商与包材管理 - 常用查询
-- ============================================================

-- ============================================================
-- 一、供应商维度
-- ============================================================

-- 1.1 供应商完整信息一览（含联系人、证书数、供应包材数、最新评级）
SELECT
    s.code             AS 供应商编码,
    s.name             AS 供应商名称,
    s.region           AS 地区,
    s.cooperation_status AS 合作状态,
    s.composite_score  AS 综合评分,
    COUNT(DISTINCT sc.id)  AS 联系人数量,
    COUNT(DISTINCT cert.id) AS 证书数量,
    COUNT(DISTINCT sm.id)   AS 供应包材数,
    MAX(eval.total_score)   AS 最近评估分
FROM supplier s
LEFT JOIN supplier_contact   sc   ON sc.supplier_id = s.id
LEFT JOIN supplier_certification cert ON cert.supplier_id = s.id
LEFT JOIN supplier_material  sm   ON sm.supplier_id = s.id AND sm.status = 'ACTIVE'
LEFT JOIN supplier_evaluation eval ON eval.supplier_id = s.id
GROUP BY s.id
ORDER BY s.cooperation_status, s.composite_score DESC;


-- 1.2 即将过期的供应商证书（30天内）
SELECT
    s.name          AS 供应商,
    cert.cert_type  AS 证书类型,
    cert.cert_number AS 证书编号,
    cert.expiry_date AS 到期日期,
    DATEDIFF(cert.expiry_date, CURDATE()) AS 剩余天数
FROM supplier_certification cert
JOIN supplier s ON s.id = cert.supplier_id
WHERE cert.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
ORDER BY cert.expiry_date;


-- 1.3 供应商季度考核排名
SELECT
    s.name         AS 供应商,
    eval.eval_period AS 评估期,
    eval.score_quality  AS 质量,
    eval.score_delivery AS 交期,
    eval.score_price    AS 价格,
    eval.score_service  AS 服务,
    eval.score_flexibility AS 配合度,
    eval.total_score    AS 综合得分,
    RANK() OVER (PARTITION BY eval.eval_period ORDER BY eval.total_score DESC) AS 排名
FROM supplier_evaluation eval
JOIN supplier s ON s.id = eval.supplier_id
WHERE eval.eval_period >= CONCAT(YEAR(CURDATE()), '-Q', QUARTER(CURDATE()) - 1)
ORDER BY eval.eval_period DESC, eval.total_score DESC;


-- 1.4 各供应商历史报价趋势（最近12个月，按月汇总）
SELECT
    s.name         AS 供应商,
    DATE_FORMAT(q.quotation_date, '%Y-%m') AS 报价月份,
    COUNT(DISTINCT q.id) AS 报价次数,
    ROUND(AVG(qi.unit_price), 4) AS 平均单价
FROM quotation q
JOIN supplier s ON s.id = q.supplier_id
JOIN quotation_item qi ON qi.quotation_id = q.id
WHERE q.quotation_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
GROUP BY s.id, DATE_FORMAT(q.quotation_date, '%Y-%m')
ORDER BY s.name, DATE_FORMAT(q.quotation_date, '%Y-%m');


-- ============================================================
-- 二、包材维度
-- ============================================================

-- 2.1 按分类查看所有包材及其可用供应商数
SELECT
    mc.full_path      AS 包材分类,
    m.code            AS 包材编码,
    m.name            AS 包材名称,
    m.material_type   AS 材质,
    m.spec_capacity   AS 规格,
    COUNT(DISTINCT sm.supplier_id) AS 可选供应商数,
    MIN(sm.latest_unit_price)      AS 最低参考价,
    m.status          AS 状态
FROM material m
JOIN material_category mc ON mc.id = m.category_id
LEFT JOIN supplier_material sm ON sm.material_id = m.id AND sm.status = 'ACTIVE'
GROUP BY m.id
ORDER BY mc.full_path, m.name;


-- 2.2 查询指定包材的所有可用供应商及最新报价（传 material_id 或包材编码）
SELECT
    m.name             AS 包材名称,
    s.name             AS 供应商,
    s.cooperation_status AS 合作状态,
    sm.is_preferred    AS 是否首选,
    sm.latest_unit_price AS 最新单价,
    sm.price_update_date AS 价格更新日,
    sm.monthly_capacity  AS 月产能,
    sm.typical_lead_time AS 常规交期天,
    sm.sample_approved   AS 样品确认
FROM material m
JOIN supplier_material sm ON sm.material_id = m.id AND sm.status = 'ACTIVE'
JOIN supplier s ON s.id = sm.supplier_id
WHERE m.code = 'BC-2024-00001'  -- 替换为实际编码
ORDER BY sm.is_preferred DESC, sm.latest_unit_price;


-- 2.3 没有合格供应商的包材（风险预警）
SELECT
    mc.full_path  AS 包材分类,
    m.code        AS 包材编码,
    m.name        AS 包材名称
FROM material m
JOIN material_category mc ON mc.id = m.category_id
WHERE m.status = 'ACTIVE'
  AND m.id NOT IN (
      SELECT DISTINCT material_id
      FROM supplier_material
      WHERE status = 'ACTIVE'
  )
ORDER BY mc.full_path;


-- 2.4 包材完整规格一览（以瓶子为例）
SELECT
    m.code           AS 编码,
    m.name           AS 名称,
    b.bottle_type    AS 瓶型,
    b.body_material  AS 瓶身材质,
    b.neck_finish    AS 瓶口规格,
    b.diameter       AS 直径mm,
    b.height         AS 高度mm,
    b.weight         AS 重量g,
    b.wall_thickness AS 壁厚mm,
    b.seal_type      AS 密封方式,
    b.has_inner_plug AS 是否含内塞
FROM material m
JOIN material_spec_bottle b ON b.material_id = m.id
ORDER BY m.name;


-- ============================================================
-- 三、报价维度
-- ============================================================

-- 3.1 各包材最新报价对比（跨供应商比价）
SELECT
    m.name              AS 包材名称,
    m.spec_capacity     AS 规格,
    s.name              AS 供应商,
    q.quotation_no      AS 报价单号,
    q.quotation_date    AS 报价日期,
    qi.quantity         AS 报价数量,
    qi.unit_price       AS 单价,
    qi.mold_fee         AS 模具费,
    qi.lead_time_days   AS 交期天,
    q.valid_until       AS 有效期至
FROM quotation_item qi
JOIN quotation q  ON q.id = qi.quotation_id
JOIN material m   ON m.id = qi.material_id
JOIN supplier s   ON s.id = q.supplier_id
WHERE q.status = 'CONFIRMED'
  AND (q.valid_until IS NULL OR q.valid_until >= CURDATE())
  AND (qi.material_id, q.quotation_date) IN (
      SELECT material_id, MAX(q2.quotation_date)
      FROM quotation_item qi2
      JOIN quotation q2 ON q2.id = qi2.quotation_id
      WHERE q2.status = 'CONFIRMED'
      GROUP BY qi2.material_id
  )
ORDER BY m.name, qi.unit_price;


-- 3.2 同一包材历史报价对比
SELECT
    m.name           AS 包材名称,
    s.name           AS 供应商,
    q.quotation_date AS 报价日期,
    qi.quantity      AS 数量,
    qi.unit_price    AS 单价,
    LAG(qi.unit_price) OVER (PARTITION BY m.id, s.id ORDER BY q.quotation_date) AS 上次单价,
    ROUND(
        (qi.unit_price - LAG(qi.unit_price) OVER (PARTITION BY m.id, s.id ORDER BY q.quotation_date))
        / LAG(qi.unit_price) OVER (PARTITION BY m.id, s.id ORDER BY q.quotation_date) * 100, 2
    ) AS 涨跌幅百分比
FROM quotation_item qi
JOIN quotation q ON q.id = qi.quotation_id
JOIN material m  ON m.id = qi.material_id
JOIN supplier s  ON s.id = q.supplier_id
WHERE q.status = 'CONFIRMED'
ORDER BY m.name, s.name, q.quotation_date;


-- ============================================================
-- 四、采购与交付维度
-- ============================================================

-- 4.1 进行中的采购订单
SELECT
    po.order_no          AS 采购单号,
    po.order_date        AS 下单日期,
    s.name               AS 供应商,
    s.region             AS 地区,
    po.expected_delivery AS 预计到货,
    po.prod_qty_total    AS 总数量,
    po.received_qty      AS 已收数量,
    ROUND(po.received_qty / po.prod_qty_total * 100, 1) AS 收货进度,
    po.urgency           AS 紧急程度,
    po.status            AS 状态,
    DATEDIFF(po.expected_delivery, CURDATE()) AS 距预计交期剩余天
FROM purchase_order po
JOIN supplier s ON s.id = po.supplier_id
WHERE po.status NOT IN ('RECEIVED', 'CANCELLED')
ORDER BY
    CASE po.urgency WHEN 'CRITICAL' THEN 0 WHEN 'URGENT' THEN 1 ELSE 2 END,
    po.expected_delivery;


-- 4.2 逾期未交货明细
SELECT
    po.order_no          AS 采购单号,
    s.name               AS 供应商,
    m.name               AS 包材,
    poi.order_qty        AS 订购量,
    poi.received_qty     AS 已收量,
    poi.order_qty - poi.received_qty AS 欠交量,
    poi.expected_date    AS 应到货日,
    DATEDIFF(CURDATE(), poi.expected_date) AS 逾期天数,
    poi.status           AS 状态
FROM purchase_order_item poi
JOIN purchase_order po ON po.id = poi.order_id
JOIN supplier s ON s.id = po.supplier_id
JOIN material m ON m.id = poi.material_id
WHERE poi.status IN ('PENDING', 'PARTIAL')
  AND poi.expected_date < CURDATE()
ORDER BY DATEDIFF(CURDATE(), poi.expected_date) DESC;


-- 4.3 按供应商统计采购金额（本年累计）
SELECT
    s.name             AS 供应商,
    COUNT(DISTINCT po.id) AS 采购次数,
    SUM(po.total_amount)  AS 累计采购金额,
    SUM(po.paid_amount)   AS 累计已付,
    SUM(po.total_amount) - SUM(po.paid_amount) AS 应付余额
FROM purchase_order po
JOIN supplier s ON s.id = po.supplier_id
WHERE po.status NOT IN ('DRAFT', 'CANCELLED')
  AND YEAR(po.order_date) = YEAR(CURDATE())
GROUP BY s.id
ORDER BY SUM(po.total_amount) DESC;


-- 4.4 按月采购金额趋势（最近12个月）
SELECT
    DATE_FORMAT(po.order_date, '%Y-%m') AS 月份,
    COUNT(DISTINCT po.id) AS 订单数,
    SUM(po.total_amount)  AS 采购总额,
    COUNT(DISTINCT po.supplier_id) AS 涉及供应商数
FROM purchase_order po
WHERE po.status NOT IN ('DRAFT', 'CANCELLED')
  AND po.order_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
GROUP BY DATE_FORMAT(po.order_date, '%Y-%m')
ORDER BY 月份;


-- ============================================================
-- 五、质量维度
-- ============================================================

-- 5.1 各供应商质检合格率（最近12个月）
SELECT
    s.name               AS 供应商,
    COUNT(qi2.id)        AS 检验总次数,
    SUM(CASE WHEN qi2.result = 'PASS' THEN 1 ELSE 0 END) AS 合格次数,
    SUM(CASE WHEN qi2.result = 'CONDITIONAL_PASS' THEN 1 ELSE 0 END) AS 让步接收次数,
    SUM(CASE WHEN qi2.result = 'FAIL' THEN 1 ELSE 0 END) AS 不合格次数,
    ROUND(SUM(CASE WHEN qi2.result = 'PASS' THEN 1 ELSE 0 END) / COUNT(qi2.id) * 100, 1) AS 合格率,
    ROUND(AVG(qi2.defect_rate) * 100, 2) AS 平均不良率
FROM quality_inspection qi2
JOIN purchase_order po ON po.id = qi2.order_id
JOIN supplier s ON s.id = po.supplier_id
WHERE qi2.inspection_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
GROUP BY s.id
ORDER BY 合格率 DESC;


-- 5.2 不合格质检详情
SELECT
    qi2.inspection_no    AS 质检单号,
    qi2.inspection_date  AS 检验日期,
    s.name               AS 供应商,
    m.name               AS 包材,
    qi2.lot_qty          AS 批次总量,
    qi2.sample_qty       AS 抽样量,
    qi2.defect_qty       AS 不良数,
    ROUND(qi2.defect_rate * 100, 2) AS 不良率,
    qi2.result           AS 结论,
    qi2.handle_method    AS 处理方式,
    qi2.inspection_detail AS 详细记录
FROM quality_inspection qi2
LEFT JOIN purchase_order_item poi ON poi.id = qi2.order_item_id
LEFT JOIN material m ON m.id = poi.material_id
JOIN purchase_order po ON po.id = qi2.order_id
JOIN supplier s ON s.id = po.supplier_id
WHERE qi2.result IN ('FAIL', 'CONDITIONAL_PASS')
ORDER BY qi2.inspection_date DESC;


-- 5.3 按包材类型统计常见质量问题
SELECT
    mc.full_path         AS 包材分类,
    COUNT(qi2.id)        AS 检验次数,
    SUM(CASE WHEN qi2.result != 'PASS' THEN 1 ELSE 0 END) AS 异常次数,
    ROUND(AVG(qi2.defect_rate) * 100, 2) AS 平均不良率
FROM quality_inspection qi2
LEFT JOIN purchase_order_item poi ON poi.id = qi2.order_item_id
LEFT JOIN material m ON m.id = poi.material_id
LEFT JOIN material_category mc ON mc.id = m.category_id
WHERE qi2.inspection_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
GROUP BY mc.id, mc.full_path
ORDER BY 异常次数 DESC;


-- ============================================================
-- 六、综合决策视图（视图）
-- ============================================================

-- 6.1 供应商综合看板视图
CREATE OR REPLACE VIEW v_supplier_dashboard AS
SELECT
    s.id,
    s.code            AS 供应商编码,
    s.name            AS 供应商名称,
    s.region          AS 地区,
    s.cooperation_status AS 合作状态,
    s.composite_score AS 综合评分,

    -- 供应包材数
    COUNT(DISTINCT sm.material_id) AS 供应包材数,

    -- 最新报价平均价（用作参考）
    ROUND(AVG(sm.latest_unit_price), 4) AS 均价参考,

    -- 质检合格率（最近12个月）
    ROUND(
        SUM(CASE WHEN qi2.result = 'PASS' THEN 1 ELSE 0 END)
        / NULLIF(COUNT(DISTINCT qi2.id), 0) * 100, 1
    ) AS 质检合格率,

    -- 逾期次数（最近12个月）
    SUM(CASE WHEN poi.expected_date < CURDATE()
              AND poi.status IN ('PENDING', 'PARTIAL')
             THEN 1 ELSE 0 END) AS 当前逾期项数,

    -- 在途订单数
    COUNT(DISTINCT CASE WHEN po.status NOT IN ('RECEIVED', 'CANCELLED', 'DRAFT')
                         THEN po.id END) AS 在途订单数,

    -- 最近评估分
    eval_latest.total_score AS 最近评估分

FROM supplier s
LEFT JOIN supplier_material sm ON sm.supplier_id = s.id AND sm.status = 'ACTIVE'
LEFT JOIN purchase_order po ON po.supplier_id = s.id
LEFT JOIN purchase_order_item poi ON poi.order_id = po.id
LEFT JOIN quality_inspection qi2 ON qi2.order_id = po.id
LEFT JOIN LATERAL (
    SELECT total_score FROM supplier_evaluation
    WHERE supplier_id = s.id
    ORDER BY eval_date DESC LIMIT 1
) eval_latest ON TRUE
GROUP BY s.id;


-- 6.2 包材-供应商最优选择视图（按价格排序）
CREATE OR REPLACE VIEW v_best_supplier_by_material AS
SELECT
    m.id          AS material_id,
    m.code        AS 包材编码,
    m.name        AS 包材名称,
    mc.full_path  AS 分类,
    s.id          AS supplier_id,
    s.name        AS 供应商,
    sm.latest_unit_price AS 参考单价,
    sm.is_preferred      AS 首选,
    sm.monthly_capacity  AS 月产能,
    sm.typical_lead_time AS 交期天,
    sm.sample_approved   AS 样品确认,
    ROW_NUMBER() OVER (
        PARTITION BY m.id
        ORDER BY sm.is_preferred DESC, sm.latest_unit_price
    ) AS 推荐排序
FROM material m
JOIN material_category mc ON mc.id = m.category_id
JOIN supplier_material sm ON sm.material_id = m.id AND sm.status = 'ACTIVE'
JOIN supplier s ON s.id = sm.supplier_id
WHERE s.cooperation_status IN ('TRIAL', 'QUALIFIED', 'STRATEGIC')
  AND m.status = 'ACTIVE';

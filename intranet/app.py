"""
库存管理系统 - Flask + MySQL 多人内网版
启动: python app.py
访问: http://localhost:5000
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
import csv
import io
import os

from flask import Flask, jsonify, request, send_file
import mysql.connector


app = Flask(__name__)

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "skincare2025!"),
    "database": os.getenv("DB_NAME", "skincare_inventory"),
    "charset": "utf8mb4",
    "autocommit": False,
}


def get_db():
    return mysql.connector.connect(**DB_CONFIG)


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
  .empty{text-align:center;color:var(--sub);padding:40px;background:#fff;border:1px solid var(--line);border-radius:8px}.tag{display:inline-block;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600}.tag.ok{background:#dcfce7;color:var(--ok)}.tag.warn{background:#fef3c7;color:var(--warn)}.tag.bad{background:#fee2e2;color:var(--bad)}
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
function badge(v){if(v==='低于最低库存'||v==='BELOW_MIN')return '<span class="tag bad">低库存</span>'; if(v==='高于最高库存'||v==='ABOVE_MAX')return '<span class="tag warn">高库存</span>'; if(v==='正常'||v==='NORMAL'||v==='启用')return '<span class="tag ok">'+esc(v)+'</span>'; return esc(v);}
function table(rows, actions){ if(!rows || !rows.length) return '<div class="empty">暂无数据</div>'; const cols = Object.keys(rows[0]).filter(c=>!c.startsWith('_')); return `<table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}${actions?'<th>操作</th>':''}</tr></thead><tbody>`+rows.map(r=>`<tr>${cols.map(c=>`<td>${c.includes('金额')||c.includes('货值')?money(r[c]):badge(r[c])}</td>`).join('')}${actions?`<td>${actions(r)}</td>`:''}</tr>`).join('')+'</tbody></table>'; }
function openModal(title, body){$('#modalTitle').textContent=title; $('#modalBody').innerHTML=body; $('#modal').style.display='flex';}
function closeModal(){$('#modal').style.display='none';}
async function run(fn){try{await fn()}catch(e){alert(e.message || e)}}

async function dashboard(){ setNav('dashboard'); const r = await api('/api/dashboard'); $('#content').innerHTML = `<div class="cards"><div class="card"><div class="v">${r.product_count}</div><div class="k">产品数量</div></div><div class="card"><div class="v">${r.sku_count}</div><div class="k">SKU 数量</div></div><div class="card"><div class="v">${r.total_stock}</div><div class="k">总库存</div></div><div class="card"><div class="v">${r.available}</div><div class="k">可用库存</div></div><div class="card"><div class="v">${money(r.stock_value)}</div><div class="k">零售货值</div></div><div class="card"><div class="v">${r.low_stock_count}</div><div class="k">低库存 SKU</div></div></div><div class="grid2"><div class="panel"><h2>低库存提醒</h2>${table(r.low_stock)}</div><div class="panel"><h2>最近流水</h2>${table(r.recent_ledger)}</div></div>`; }
async function products(q=''){ setNav('products'); const rows = await api('/api/products' + (q ? '?q='+encodeURIComponent(q) : '')); $('#content').innerHTML = `<div class="toolbar"><input id="q" placeholder="搜索产品编号、名称、品牌、SKU" value="${esc(q)}" onkeydown="if(event.key==='Enter')products(this.value)"><button class="btn primary" onclick="products($('#q').value)">搜索</button><button class="btn primary" onclick="productForm()">新增产品</button><button class="btn" onclick="exportCSV('/products/export')">导出 CSV</button></div>${table(rows, r => `<button class="btn" onclick="productForm(${r._id})">编辑</button> <button class="btn danger" onclick="deleteProduct(${r._id})">删除</button>`)}`; }
async function productForm(id){ const meta = await api('/api/meta'); const p = id ? await api('/api/products/detail?id='+id) : {}; const opt = (list, val) => list.map(x=>`<option value="${x.id}" ${Number(val)===x.id?'selected':''}>${esc(x.name)}</option>`).join(''); openModal(id?'编辑产品':'新增产品', `<div class="form"><input type="hidden" id="pid" value="${p.id||''}"><label>产品编号<input id="product_code" value="${esc(p.product_code||'')}" placeholder="例如 PROD-0011"></label><label>产品名称<input id="name" value="${esc(p.name||'')}"></label><label>品牌<select id="brand_id">${opt(meta.brands,p.brand_id)}</select></label><label>分类<select id="category_id">${opt(meta.categories,p.category_id)}</select></label><label>SKU 编码<input id="sku_code" value="${esc(p.sku_code||'')}" placeholder="例如 SKU-001"></label><label>规格<input id="spec_name" value="${esc(p.spec_name||'')}" placeholder="例如 50ml"></label><label>成本价<input id="cost_price" type="number" step="0.01" value="${p.cost_price||0}"></label><label>零售价<input id="retail_price" type="number" step="0.01" value="${p.retail_price||0}"></label><label>最低库存<input id="min_stock_qty" type="number" value="${p.min_stock_qty||0}"></label><label>最高库存<input id="max_stock_qty" type="number" value="${p.max_stock_qty||99999}"></label><label>保质期天数<input id="shelf_life_days" type="number" value="${p.shelf_life_days||1095}"></label><textarea id="remark" placeholder="备注、功效、说明">${esc(p.efficacy_tags||'')}</textarea></div><div class="actions"><button class="btn" onclick="closeModal()">取消</button><button class="btn primary" onclick="run(saveProduct)">保存</button></div>`); }
async function saveProduct(){ const fields = ['pid','product_code','name','brand_id','category_id','sku_code','spec_name','cost_price','retail_price','min_stock_qty','max_stock_qty','shelf_life_days','remark']; const data = Object.fromEntries(fields.map(f=>[f,$('#'+f).value])); await api('/api/products/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); closeModal(); products($('#q')?.value || ''); }
async function deleteProduct(id){ if(!confirm('确定删除这个产品吗？已有流水的数据会保留，产品会设为停用。')) return; await api('/api/products/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}); products($('#q')?.value || ''); }
async function inventory(q='', warehouse=''){ setNav('inventory'); const params = new URLSearchParams(); if(q)params.set('q',q); if(warehouse)params.set('warehouse',warehouse); const [rows, meta] = await Promise.all([api('/api/inventory?'+params), api('/api/meta')]); const whOpts = meta.warehouses.map(w=>`<option value="${w.name}" ${w.name===warehouse?'selected':''}>${esc(w.name)}</option>`).join(''); $('#content').innerHTML = `<div class="toolbar"><input id="q" placeholder="搜索产品或 SKU" value="${esc(q)}" onkeydown="if(event.key==='Enter')inventory(this.value,$('#wh').value)"><select id="wh" onchange="inventory($('#q').value,this.value)"><option value="">全部仓库</option>${whOpts}</select><button class="btn primary" onclick="inventory($('#q').value,$('#wh').value)">查询</button><button class="btn ok" onclick="stockForm('IN')">入库</button><button class="btn danger" onclick="stockForm('OUT')">出库</button><button class="btn" onclick="stockForm('ADJUST')">盘点调整</button><button class="btn" onclick="exportCSV('/inventory/export')">导出 CSV</button></div>${table(rows)}`; }
async function stockForm(type){ const meta = await api('/api/stock/options'); const title = type==='IN'?'新增入库':(type==='OUT'?'新增出库':'盘点调整'); const skuOpt = meta.skus.map(x=>`<option value="${x.id}">${esc(x.name)} / ${esc(x.sku_code)} / ${esc(x.spec_name)}</option>`).join(''); const whOpt = meta.warehouses.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join(''); const locOpt = meta.locations.map(x=>`<option value="${x.id}">${esc(x.warehouse)} - ${esc(x.location_code)}</option>`).join(''); const batchOpt = meta.batches.map(x=>`<option value="${x.id}">${esc(x.sku_code)} / ${esc(x.batch_no)} / 库存 ${x.quantity}</option>`).join(''); openModal(title, `<div class="form"><input type="hidden" id="stock_type" value="${type}"><label>商品 SKU<select id="sku_id">${skuOpt}</select></label><label>仓库<select id="warehouse_id">${whOpt}</select></label><label>库位<select id="location_id">${locOpt}</select></label><label>${type==='IN'?'批次号':'选择批次'}${type==='IN'?'<input id="batch_no" placeholder="留空自动生成">':`<select id="batch_id">${batchOpt}</select>`}</label><label>生产日期<input id="production_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>有效期至<input id="expiry_date" type="date" value="${new Date(Date.now()+1095*86400000).toISOString().slice(0,10)}"></label><label>${type==='ADJUST'?'调整后数量':'数量'}<input id="quantity" type="number" min="0" value="1"></label><label>经办人<input id="operator" value="管理员"></label><textarea id="remark" placeholder="备注"></textarea></div><div class="actions"><button class="btn" onclick="closeModal()">取消</button><button class="btn primary" onclick="run(saveStock)">保存</button></div>`); }
async function saveStock(){ const data = {}; ['stock_type','sku_id','warehouse_id','location_id','batch_id','batch_no','production_date','expiry_date','quantity','operator','remark'].forEach(id=>{const el=$('#'+id); if(el)data[id]=el.value;}); await api('/api/stock/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); closeModal(); inventory($('#q')?.value || '', $('#wh')?.value || ''); }
async function stats(){ setNav('stats'); const r = await api('/api/stats'); $('#content').innerHTML = `<div class="grid2"><div class="panel"><h2>按仓库统计</h2>${table(r.by_warehouse)}</div><div class="panel"><h2>按品牌统计</h2>${table(r.by_brand)}</div><div class="panel"><h2>高货值 SKU</h2>${table(r.top_value)}</div><div class="panel"><h2>库存状态</h2>${table(r.stock_status)}</div></div>`; }
async function expiry(){ setNav('expiry'); const rows = await api('/api/expiry'); $('#content').innerHTML = `<div class="toolbar"><button class="btn" onclick="exportCSV('/expiry/export')">导出 CSV</button></div>${table(rows)}`; }
async function ledger(days=30){ setNav('ledger'); const rows = await api('/api/ledger?days='+days); const opts = [7,15,30,60,90,180].map(d=>`<option value="${d}" ${d===days?'selected':''}>最近 ${d} 天</option>`).join(''); $('#content').innerHTML = `<div class="toolbar"><select id="days" onchange="ledger(+this.value)">${opts}</select><button class="btn" onclick="exportCSV('/ledger/export?days='+$('#days').value)">导出 CSV</button></div>${table(rows)}`; }
function exportCSV(url){window.open(url,'_blank');}
function route(){const p=location.pathname; if(p==='/products')products(); else if(p==='/inventory')inventory(); else if(p==='/stats')stats(); else if(p==='/expiry')expiry(); else if(p==='/ledger')ledger(); else dashboard();}
window.addEventListener('popstate', route); document.addEventListener('DOMContentLoaded', route);
</script>
</body>
</html>
"""


@app.errorhandler(Exception)
def handle_error(exc):
    if request.path.startswith("/api/"):
        return jsonify({"error": str(exc)}), 500
    return str(exc), 500


@app.route("/")
@app.route("/products")
@app.route("/inventory")
@app.route("/stats")
@app.route("/expiry")
@app.route("/ledger")
def spa():
    return HTML_PAGE


@app.get("/api/dashboard")
def dashboard_api():
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute("SELECT COUNT(*) AS cnt FROM products WHERE is_active=1")
    product_count = cur.fetchone()["cnt"]
    cur.execute("SELECT COUNT(*) AS cnt FROM product_skus WHERE is_active=1")
    sku_count = cur.fetchone()["cnt"]
    cur.execute("SELECT COALESCE(SUM(quantity),0) AS cnt FROM inventory")
    total_stock = cur.fetchone()["cnt"]
    cur.execute("SELECT COALESCE(SUM(quantity-locked_quantity),0) AS cnt FROM inventory")
    available = cur.fetchone()["cnt"]
    cur.execute("SELECT COALESCE(SUM((inv.quantity-inv.locked_quantity)*sku.retail_price),0) AS amount FROM inventory inv JOIN product_skus sku ON inv.sku_id=sku.id")
    stock_value = cur.fetchone()["amount"]
    cur.execute("""
        SELECT COUNT(*) AS cnt FROM (
            SELECT sku.id, COALESCE(SUM(inv.quantity),0) qty, sku.min_stock_qty
            FROM product_skus sku LEFT JOIN inventory inv ON inv.sku_id=sku.id
            WHERE sku.is_active=1 GROUP BY sku.id HAVING qty <= sku.min_stock_qty
        ) x
    """)
    low_stock_count = cur.fetchone()["cnt"]
    cur.execute("""
        SELECT p.name AS 产品名称, sku.sku_code AS SKU编码, sku.spec_name AS 规格,
               COALESCE(SUM(inv.quantity),0) AS 当前库存, sku.min_stock_qty AS 最低库存
        FROM product_skus sku JOIN products p ON sku.product_id=p.id
        LEFT JOIN inventory inv ON inv.sku_id=sku.id
        WHERE p.is_active=1 AND sku.is_active=1
        GROUP BY sku.id, p.name, sku.sku_code, sku.spec_name, sku.min_stock_qty
        HAVING 当前库存 <= sku.min_stock_qty
        ORDER BY 当前库存 ASC LIMIT 10
    """)
    low_stock = normalize_rows(cur.fetchall())
    cur.execute("""
        SELECT CASE io_type WHEN 'IN' THEN '入库' ELSE '出库' END AS 类型,
               order_no AS 单号, product_name AS 产品, sku_code AS SKU,
               quantity AS 数量, biz_type AS 业务类型, trans_time AS 时间
        FROM v_inventory_ledger ORDER BY trans_time DESC LIMIT 10
    """)
    recent_ledger = normalize_rows(cur.fetchall())
    cur.close()
    db.close()
    return jsonify({
        "product_count": product_count, "sku_count": sku_count, "total_stock": total_stock,
        "available": available, "stock_value": float(stock_value or 0),
        "low_stock_count": low_stock_count, "low_stock": low_stock, "recent_ledger": recent_ledger,
    })


@app.get("/api/products")
def products_api():
    q = request.args.get("q", "").strip()
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
    params = []
    if q:
        query += " AND (p.product_code LIKE %s OR p.name LIKE %s OR b.name LIKE %s OR sku.sku_code LIKE %s)"
        params = [f"%{q}%"] * 4
    query += " ORDER BY p.id DESC, sku.id LIMIT 500"
    return jsonify(fetch_all(query, params))


@app.get("/api/products/detail")
def product_detail_api():
    pid = int(request.args.get("id", "0"))
    rows = fetch_all("""
        SELECT p.*, sku.sku_code, sku.spec_name, sku.cost_price, sku.retail_price,
               sku.min_stock_qty, sku.max_stock_qty
        FROM products p LEFT JOIN product_skus sku ON sku.product_id=p.id AND sku.is_active=1
        WHERE p.id=%s ORDER BY sku.id LIMIT 1
    """, [pid])
    return jsonify(rows[0] if rows else {})


@app.post("/api/products/save")
def product_save_api():
    data = request.get_json(silent=True) or {}
    required = ["product_code", "name", "brand_id", "category_id", "sku_code", "spec_name"]
    if any(not str(data.get(k, "")).strip() for k in required):
        return jsonify({"error": "产品编号、名称、品牌、分类、SKU、规格不能为空"}), 400
    db = get_db()
    cur = db.cursor(dictionary=True)
    try:
        pid = int(data.get("pid") or 0)
        if pid:
            cur.execute("""
                UPDATE products SET product_code=%s, name=%s, brand_id=%s, category_id=%s,
                    efficacy_tags=%s, shelf_life_days=%s, updated_at=NOW() WHERE id=%s
            """, [data["product_code"], data["name"], int(data["brand_id"]), int(data["category_id"]),
                  data.get("remark", ""), int(data.get("shelf_life_days") or 1095), pid])
            cur.execute("SELECT id FROM product_skus WHERE product_id=%s ORDER BY id LIMIT 1", [pid])
            sku = cur.fetchone()
            if sku:
                cur.execute("""
                    UPDATE product_skus SET sku_code=%s, spec_name=%s, cost_price=%s, retail_price=%s,
                        min_stock_qty=%s, max_stock_qty=%s, updated_at=NOW() WHERE id=%s
                """, [data["sku_code"], data["spec_name"], float(data.get("cost_price") or 0),
                      float(data.get("retail_price") or 0), int(data.get("min_stock_qty") or 0),
                      int(data.get("max_stock_qty") or 99999), sku["id"]])
            else:
                cur.execute("""
                    INSERT INTO product_skus (product_id, sku_code, spec_name, cost_price, retail_price, min_stock_qty, max_stock_qty)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                """, [pid, data["sku_code"], data["spec_name"], float(data.get("cost_price") or 0),
                      float(data.get("retail_price") or 0), int(data.get("min_stock_qty") or 0),
                      int(data.get("max_stock_qty") or 99999)])
        else:
            cur.execute("""
                INSERT INTO products (product_code, category_id, brand_id, name, efficacy_tags, shelf_life_days)
                VALUES (%s,%s,%s,%s,%s,%s)
            """, [data["product_code"], int(data["category_id"]), int(data["brand_id"]), data["name"],
                  data.get("remark", ""), int(data.get("shelf_life_days") or 1095)])
            pid = cur.lastrowid
            cur.execute("""
                INSERT INTO product_skus (product_id, sku_code, spec_name, cost_price, retail_price, min_stock_qty, max_stock_qty)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
            """, [pid, data["sku_code"], data["spec_name"], float(data.get("cost_price") or 0),
                  float(data.get("retail_price") or 0), int(data.get("min_stock_qty") or 0),
                  int(data.get("max_stock_qty") or 99999)])
        db.commit()
        return jsonify({"ok": True, "id": pid})
    except Exception:
        db.rollback()
        raise
    finally:
        cur.close()
        db.close()


@app.post("/api/products/delete")
def product_delete_api():
    pid = int((request.get_json(silent=True) or {}).get("id") or 0)
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("UPDATE products SET is_active=0, updated_at=NOW() WHERE id=%s", [pid])
        cur.execute("UPDATE product_skus SET is_active=0, updated_at=NOW() WHERE product_id=%s", [pid])
        db.commit()
        return jsonify({"ok": True})
    except Exception:
        db.rollback()
        raise
    finally:
        cur.close()
        db.close()


@app.get("/api/inventory")
def inventory_api():
    q = request.args.get("q", "").strip()
    wh = request.args.get("warehouse", "").strip()
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
    params = []
    if q:
        query += " AND (p.name LIKE %s OR sku.sku_code LIKE %s)"
        params.extend([f"%{q}%", f"%{q}%"])
    if wh:
        query += " AND wh.name = %s"
        params.append(wh)
    query += " GROUP BY wh.id, wh.name, sku.id, p.name, sku.sku_code, sku.spec_name, sku.min_stock_qty, sku.max_stock_qty ORDER BY wh.id, p.name"
    return jsonify(fetch_all(query, params))


@app.get("/api/meta")
def meta_api():
    return jsonify({
        "brands": fetch_all("SELECT id, name FROM brands WHERE is_active=1 ORDER BY id"),
        "categories": fetch_all("SELECT id, name FROM product_categories WHERE is_active=1 AND id<>1 ORDER BY sort_order, id"),
        "warehouses": fetch_all("SELECT id, name FROM warehouses WHERE is_active=1 ORDER BY id"),
    })


@app.get("/api/stock/options")
def stock_options_api():
    return jsonify({
        "skus": fetch_all("""
            SELECT sku.id, sku.sku_code, sku.spec_name, p.name
            FROM product_skus sku JOIN products p ON sku.product_id=p.id
            WHERE sku.is_active=1 AND p.is_active=1 ORDER BY p.name, sku.sku_code
        """),
        "warehouses": fetch_all("SELECT id, name FROM warehouses WHERE is_active=1 ORDER BY id"),
        "locations": fetch_all("""
            SELECT sl.id, sl.warehouse_id, wh.name AS warehouse, sl.location_code
            FROM storage_locations sl JOIN warehouses wh ON sl.warehouse_id=wh.id
            WHERE sl.is_active=1 ORDER BY wh.id, sl.location_code
        """),
        "batches": fetch_all("""
            SELECT pb.id, sku.sku_code, pb.batch_no, COALESCE(SUM(inv.quantity),0) AS quantity
            FROM product_batches pb JOIN product_skus sku ON pb.sku_id=sku.id
            LEFT JOIN inventory inv ON inv.batch_id=pb.id
            GROUP BY pb.id, sku.sku_code, pb.batch_no ORDER BY pb.id DESC
        """),
    })


@app.post("/api/stock/save")
def stock_save_api():
    data = request.get_json(silent=True) or {}
    stock_type = data.get("stock_type")
    qty = int(data.get("quantity") or 0)
    if qty < 0:
        return jsonify({"error": "数量不能小于 0"}), 400
    db = get_db()
    cur = db.cursor(dictionary=True)
    try:
        if stock_type == "IN":
            sku_id = int(data.get("sku_id") or 0)
            warehouse_id = int(data.get("warehouse_id") or 0)
            location_id = int(data.get("location_id") or 0)
            batch_no = data.get("batch_no") or f"BT{datetime.now().strftime('%Y%m%d%H%M%S')}"
            cur.execute("SELECT id FROM product_batches WHERE sku_id=%s AND batch_no=%s", [sku_id, batch_no])
            batch = cur.fetchone()
            if batch:
                batch_id = batch["id"]
            else:
                cur.execute("""
                    INSERT INTO product_batches (sku_id, batch_no, production_date, expiry_date, status, remark)
                    VALUES (%s,%s,%s,%s,%s,%s)
                """, [sku_id, batch_no, data.get("production_date") or date.today().isoformat(),
                      data.get("expiry_date") or (date.today() + timedelta(days=1095)).isoformat(),
                      "NORMAL", data.get("remark") or ""])
                batch_id = cur.lastrowid
            cur.execute("SELECT id FROM inventory WHERE sku_id=%s AND batch_id=%s AND warehouse_id=%s AND location_id=%s FOR UPDATE", [sku_id, batch_id, warehouse_id, location_id])
            inv = cur.fetchone()
            if inv:
                cur.execute("UPDATE inventory SET quantity=quantity+%s, updated_at=NOW() WHERE id=%s", [qty, inv["id"]])
            else:
                cur.execute("INSERT INTO inventory (sku_id, batch_id, warehouse_id, location_id, quantity, locked_quantity) VALUES (%s,%s,%s,%s,%s,0)", [sku_id, batch_id, warehouse_id, location_id, qty])
            order_no = f"IN-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            cur.execute("""
                INSERT INTO inbound_orders (order_no, warehouse_id, inbound_type, status, operator, remark, confirmed_at, completed_at)
                VALUES (%s,%s,%s,%s,%s,%s,NOW(),NOW())
            """, [order_no, warehouse_id, "MANUAL", "COMPLETED", data.get("operator") or "管理员", data.get("remark") or ""])
            cur.execute("INSERT INTO inbound_order_items (order_id, sku_id, batch_id, location_id, quantity) VALUES (%s,%s,%s,%s,%s)", [cur.lastrowid, sku_id, batch_id, location_id, qty])
        else:
            batch_id = int(data.get("batch_id") or 0)
            warehouse_id = int(data.get("warehouse_id") or 0)
            location_id = int(data.get("location_id") or 0)
            cur.execute("""
                SELECT id, quantity, sku_id, warehouse_id, location_id
                FROM inventory
                WHERE batch_id=%s AND warehouse_id=%s AND location_id=%s
                ORDER BY quantity DESC LIMIT 1 FOR UPDATE
            """, [batch_id, warehouse_id, location_id])
            inv = cur.fetchone()
            if not inv:
                cur.execute("SELECT id, quantity, sku_id, warehouse_id, location_id FROM inventory WHERE batch_id=%s ORDER BY quantity DESC LIMIT 1 FOR UPDATE", [batch_id])
                inv = cur.fetchone()
            if not inv:
                return jsonify({"error": "没有找到对应库存批次"}), 400
            if stock_type == "OUT":
                if inv["quantity"] < qty:
                    return jsonify({"error": "出库数量不能大于当前库存"}), 400
                cur.execute("UPDATE inventory SET quantity=quantity-%s, updated_at=NOW() WHERE id=%s", [qty, inv["id"]])
                order_no = f"OUT-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
                cur.execute("""
                    INSERT INTO outbound_orders (order_no, warehouse_id, outbound_type, status, customer_name, operator, remark, confirmed_at, completed_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
                """, [order_no, inv["warehouse_id"], "MANUAL", "COMPLETED", "手工出库", data.get("operator") or "管理员", data.get("remark") or ""])
                cur.execute("INSERT INTO outbound_order_items (order_id, sku_id, batch_id, location_id, quantity) VALUES (%s,%s,%s,%s,%s)", [cur.lastrowid, inv["sku_id"], batch_id, inv["location_id"], qty])
            elif stock_type == "ADJUST":
                old_qty = inv["quantity"]
                cur.execute("UPDATE inventory SET quantity=%s, updated_at=NOW() WHERE id=%s", [qty, inv["id"]])
                check_no = f"CK-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
                cur.execute("""
                    INSERT INTO inventory_checks (check_no, warehouse_id, check_type, status, operator, remark, checked_at, adjusted_at)
                    VALUES (%s,%s,%s,%s,%s,%s,NOW(),NOW())
                """, [check_no, inv["warehouse_id"], "ADJUST", "ADJUSTED", data.get("operator") or "管理员", data.get("remark") or ""])
                cur.execute("""
                    INSERT INTO inventory_check_items (check_id, sku_id, batch_id, location_id, system_qty, actual_qty, diff_reason, adjusted)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,1)
                """, [cur.lastrowid, inv["sku_id"], batch_id, inv["location_id"], old_qty, qty, f"手工调整，差异 {qty-old_qty}"])
        db.commit()
        return jsonify({"ok": True})
    except Exception:
        db.rollback()
        raise
    finally:
        cur.close()
        db.close()


@app.get("/api/expiry")
def expiry_api():
    return jsonify(fetch_all("""
        SELECT wh.name AS 仓库, sl.location_code AS 库位, p.name AS 产品名称, sku.sku_code AS SKU编码,
               pb.batch_no AS 批次号, pb.production_date AS 生产日期, pb.expiry_date AS 有效期至,
               DATEDIFF(pb.expiry_date, CURDATE()) AS 剩余天数, inv.quantity AS 库存数量,
               CASE WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 0 THEN '立即报损'
                    WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 30 THEN '紧急促销/报损'
                    WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 90 THEN '折扣促销/清货'
                    ELSE '优先出库' END AS 处置建议
        FROM inventory inv JOIN product_batches pb ON inv.batch_id=pb.id
        JOIN product_skus sku ON inv.sku_id=sku.id JOIN products p ON sku.product_id=p.id
        JOIN warehouses wh ON inv.warehouse_id=wh.id JOIN storage_locations sl ON inv.location_id=sl.id
        WHERE inv.quantity>0 AND DATEDIFF(pb.expiry_date, CURDATE()) <= 180
        ORDER BY pb.expiry_date
    """))


@app.get("/api/ledger")
def ledger_api():
    days = int(request.args.get("days", "30"))
    return jsonify(fetch_all("""
        SELECT CASE io_type WHEN 'IN' THEN '入库' ELSE '出库' END AS 类型,
               order_no AS 单号, product_name AS 产品名称, sku_code AS SKU编码, spec_name AS 规格,
               batch_no AS 批次号, warehouse_name AS 仓库, location_code AS 库位,
               quantity AS 数量, biz_type AS 业务类型, trans_time AS 时间
        FROM v_inventory_ledger WHERE trans_time >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
        ORDER BY trans_time DESC LIMIT 500
    """, [days]))


@app.get("/api/stats")
def stats_api():
    by_warehouse = fetch_all("""
        SELECT wh.name AS 仓库, SUM(inv.quantity) AS 总库存,
               SUM(inv.quantity-inv.locked_quantity) AS 可用库存,
               SUM((inv.quantity-inv.locked_quantity)*sku.retail_price) AS 零售货值
        FROM inventory inv JOIN warehouses wh ON inv.warehouse_id=wh.id JOIN product_skus sku ON inv.sku_id=sku.id
        GROUP BY wh.id, wh.name ORDER BY 零售货值 DESC
    """)
    by_brand = fetch_all("""
        SELECT b.name AS 品牌, COUNT(DISTINCT p.id) AS 产品数, SUM(inv.quantity) AS 总库存,
               SUM((inv.quantity-inv.locked_quantity)*sku.retail_price) AS 零售货值
        FROM inventory inv JOIN product_skus sku ON inv.sku_id=sku.id
        JOIN products p ON sku.product_id=p.id JOIN brands b ON p.brand_id=b.id
        GROUP BY b.id, b.name ORDER BY 零售货值 DESC
    """)
    top_value = fetch_all("""
        SELECT p.name AS 产品名称, sku.sku_code AS SKU编码, SUM(inv.quantity) AS 总库存,
               SUM((inv.quantity-inv.locked_quantity)*sku.retail_price) AS 零售货值
        FROM inventory inv JOIN product_skus sku ON inv.sku_id=sku.id JOIN products p ON sku.product_id=p.id
        GROUP BY sku.id, p.name, sku.sku_code ORDER BY 零售货值 DESC LIMIT 10
    """)
    stock_status = fetch_all("""
        SELECT 库存状态, COUNT(*) AS SKU数量 FROM (
            SELECT sku.id,
                CASE WHEN COALESCE(SUM(inv.quantity),0) <= sku.min_stock_qty THEN '低于最低库存'
                     WHEN COALESCE(SUM(inv.quantity),0) >= sku.max_stock_qty THEN '高于最高库存'
                     ELSE '正常' END AS 库存状态
            FROM product_skus sku LEFT JOIN inventory inv ON inv.sku_id=sku.id
            WHERE sku.is_active=1 GROUP BY sku.id, sku.min_stock_qty, sku.max_stock_qty
        ) x GROUP BY 库存状态
    """)
    return jsonify({"by_warehouse": by_warehouse, "by_brand": by_brand, "top_value": top_value, "stock_status": stock_status})


@app.get("/products/export")
def export_products():
    return export_query("""
        SELECT p.product_code AS 产品编号, p.name AS 产品名称, b.name AS 品牌, pc.name AS 分类,
               sku.sku_code AS SKU编码, sku.spec_name AS 规格, sku.cost_price AS 成本价, sku.retail_price AS 零售价
        FROM products p JOIN brands b ON p.brand_id=b.id JOIN product_categories pc ON p.category_id=pc.id
        LEFT JOIN product_skus sku ON sku.product_id=p.id AND sku.is_active=1
        WHERE p.is_active=1
    """, [], "产品清单.csv")


@app.get("/inventory/export")
def export_inventory():
    return export_query("""
        SELECT wh.name AS 仓库, p.name AS 产品名称, sku.sku_code AS SKU编码, sku.spec_name AS 规格,
               SUM(inv.quantity) AS 总库存, SUM(inv.quantity-inv.locked_quantity) AS 可用库存
        FROM inventory inv JOIN product_skus sku ON inv.sku_id=sku.id
        JOIN products p ON sku.product_id=p.id JOIN warehouses wh ON inv.warehouse_id=wh.id
        GROUP BY wh.id, p.id, sku.id
    """, [], "库存汇总.csv")


@app.get("/expiry/export")
def export_expiry():
    return export_query("SELECT * FROM v_export_expiry_stock", [], "临期库存预警.csv")


@app.get("/ledger/export")
def export_ledger():
    days = int(request.args.get("days", "30"))
    return export_query("SELECT * FROM v_inventory_ledger WHERE trans_time >= DATE_SUB(CURDATE(), INTERVAL %s DAY)", [days], f"出入库流水_{days}天.csv")


def fetch_all(query, params=None):
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute(query, params or [])
    rows = normalize_rows(cur.fetchall())
    cur.close()
    db.close()
    return rows


def normalize_rows(rows):
    return [{key: normalize_value(value) for key, value in row.items()} for row in rows]


def normalize_value(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat(sep=" ")
    if isinstance(value, date):
        return value.isoformat()
    return value


def export_query(query, params, filename):
    rows = fetch_all(query, params)
    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    data = output.getvalue().encode("utf-8-sig")
    output.close()
    mem = io.BytesIO(data)
    mem.seek(0)
    return send_file(mem, mimetype="text/csv; charset=utf-8-sig", as_attachment=True, download_name=filename)


if __name__ == "__main__":
    port = int(os.getenv("WEB_PORT", "5000"))
    print("=" * 60)
    print("  库存管理系统 - MySQL 多人内网版")
    print(f"  访问地址: http://localhost:{port}")
    print("=" * 60)
    app.run(host=os.getenv("WEB_HOST", "0.0.0.0"), port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")

"""
护肤品公司 - 供应商与包材管理系统
Flask + SQLite + Bootstrap 5 + Waitress
"""
import os
import sqlite3
import io
import re
import zipfile
from datetime import date, datetime
from xml.sax.saxutils import escape

from flask import Flask, g, render_template, request, redirect, url_for, flash, send_file

from config import DB_PATH

app = Flask(__name__)
app.secret_key = os.urandom(24).hex()


# ── 数据库 ──────────────────────────────────────────────
def ensure_db():
    """首次运行时自动创建数据库和表"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    if os.path.exists(DB_PATH):
        return
    schema = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema, "r", encoding="utf-8") as f:
        sql = f.read()
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(sql)
    conn.commit()
    conn.close()


def get_db():
    if "db" not in g:
        ensure_db()
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(exc=None):
    db = g.pop("db", None)
    if db:
        db.close()


def query(sql, params=None, one=False):
    cur = get_db().execute(sql, params or ())
    if one:
        return cur.fetchone()
    return cur.fetchall()


def execute(sql, params=None):
    db = get_db()
    cur = db.execute(sql, params or ())
    db.commit()
    return cur.lastrowid


def _col_name(index):
    name = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return name


def _safe_sheet_name(name):
    cleaned = re.sub(r"[\[\]:*?/\\]", "_", name).strip() or "Sheet"
    return cleaned[:31]


def _cell_xml(row_index, col_index, value, style=None):
    ref = f"{_col_name(col_index)}{row_index}"
    style_attr = f' s="{style}"' if style else ""
    if value is None:
        return f'<c r="{ref}"{style_attr}/>'
    if isinstance(value, bool):
        return f'<c r="{ref}" t="b"{style_attr}><v>{1 if value else 0}</v></c>'
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c r="{ref}"{style_attr}><v>{value}</v></c>'
    text = escape(str(value), {'"': "&quot;", "'": "&apos;"})
    return f'<c r="{ref}" t="inlineStr"{style_attr}><is><t>{text}</t></is></c>'


def _sheet_xml(headers, rows):
    xml_rows = []
    all_rows = [headers] + rows
    for row_index, row in enumerate(all_rows, start=1):
        cells = []
        for col_index, value in enumerate(row, start=1):
            cells.append(_cell_xml(row_index, col_index, value, style=1 if row_index == 1 else None))
        xml_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')

    col_defs = []
    for col_index, header in enumerate(headers, start=1):
        values = [header] + [row[col_index - 1] for row in rows[:200] if col_index - 1 < len(row)]
        width = min(max(max((len(str(v)) for v in values if v is not None), default=8) + 2, 10), 36)
        col_defs.append(f'<col min="{col_index}" max="{col_index}" width="{width}" customWidth="1"/>')

    last_cell = f"{_col_name(max(len(headers), 1))}{max(len(all_rows), 1)}"
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft"/>
    </sheetView>
  </sheetViews>
  <cols>{''.join(col_defs)}</cols>
  <sheetData>{''.join(xml_rows)}</sheetData>
  <autoFilter ref="A1:{last_cell}"/>
</worksheet>'''


def build_xlsx(sheets):
    output = io.BytesIO()
    created = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
''' + "".join(
            f'  <Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>\n'
            for i in range(1, len(sheets) + 1)
        ) + "</Types>")
        zf.writestr("_rels/.rels", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>''')
        zf.writestr("docProps/core.xml", f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Skincare Supplier System</dc:creator>
  <cp:lastModifiedBy>Skincare Supplier System</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>
</cp:coreProperties>''')
        zf.writestr("docProps/app.xml", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Skincare Supplier System</Application>
</Properties>''')
        zf.writestr("xl/styles.xml", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>''')
        workbook_sheets = []
        rels = []
        for index, sheet in enumerate(sheets, start=1):
            name = escape(_safe_sheet_name(sheet["name"]), {'"': "&quot;"})
            workbook_sheets.append(f'<sheet name="{name}" sheetId="{index}" r:id="rId{index}"/>')
            rels.append(f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>')
            zf.writestr(f"xl/worksheets/sheet{index}.xml", _sheet_xml(sheet["headers"], sheet["rows"]))
        zf.writestr("xl/workbook.xml", f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>{''.join(workbook_sheets)}</sheets>
</workbook>''')
        zf.writestr("xl/_rels/workbook.xml.rels", f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  {"".join(rels)}
  <Relationship Id="rId{len(sheets) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>''')
    output.seek(0)
    return output


def _rows_to_values(rows, fields):
    return [[row[field] for field in fields] for row in rows]


def _supplier_export():
    search = request.args.get("search", "")
    status = request.args.get("status", "")
    region = request.args.get("region", "")
    sql = "SELECT * FROM supplier WHERE 1=1"
    params = []
    if search:
        sql += " AND (name LIKE ? OR code LIKE ? OR short_name LIKE ?)"
        params.extend([f"%{search}%"] * 3)
    if status:
        sql += " AND cooperation_status = ?"
        params.append(status)
    if region:
        sql += " AND region = ?"
        params.append(region)
    sql += " ORDER BY updated_at DESC"
    fields = ["code", "name", "short_name", "region", "country", "cooperation_status", "composite_score",
              "legal_representative", "registered_capital", "established_date", "settlement_method",
              "payment_terms", "tax_rate", "website", "business_license", "remark"]
    headers = ["编码", "供应商全称", "简称", "地区", "国家", "合作状态", "评分", "法定代表人", "注册资本",
               "成立日期", "结算方式", "付款条件", "税率", "官网", "营业执照", "备注"]
    return {"name": "供应商", "headers": headers, "rows": _rows_to_values(query(sql, params), fields)}


def _material_export():
    category = request.args.get("category", "")
    search = request.args.get("search", "")
    sql = """SELECT m.*, mc.full_path cat_path
             FROM material m JOIN material_category mc ON mc.id = m.category_id WHERE 1=1"""
    params = []
    if category:
        sql += " AND (CAST(mc.id AS TEXT)=? OR CAST(mc.parent_id AS TEXT)=? OR mc.full_path LIKE ?)"
        params.extend([category, category, f"%{category}%"])
    if search:
        sql += " AND (m.name LIKE ? OR m.code LIKE ?)"
        params.extend([f"%{search}%"] * 2)
    sql += " ORDER BY mc.full_path, m.name"
    fields = ["code", "name", "cat_path", "material_type", "spec_capacity", "spec_color", "spec_finish",
              "printing_process", "printing_colors", "unit", "min_order_qty", "typical_lead_time", "status", "remark"]
    headers = ["编码", "名称", "分类", "材质", "规格", "颜色", "表面处理", "印刷工艺", "印刷色数",
               "单位", "最小起订量", "交期(天)", "状态", "备注"]
    return {"name": "包材", "headers": headers, "rows": _rows_to_values(query(sql, params), fields)}


def _quotation_export():
    search = request.args.get("search", "")
    status = request.args.get("status", "")
    sql = """SELECT q.*, s.name supplier_name
             FROM quotation q JOIN supplier s ON s.id=q.supplier_id WHERE 1=1"""
    params = []
    if search:
        sql += " AND (q.quotation_no LIKE ? OR s.name LIKE ?)"
        params.extend([f"%{search}%"] * 2)
    if status:
        sql += " AND q.status=?"
        params.append(status)
    sql += " ORDER BY q.quotation_date DESC LIMIT 200"
    fields = ["quotation_no", "supplier_name", "quotation_date", "valid_until", "currency", "exchange_rate",
              "incoterm", "is_tax_included", "is_shipping_included", "total_amount", "status", "contact_person",
              "contact_phone", "remark"]
    headers = ["报价单号", "供应商", "报价日期", "有效期至", "币种", "汇率", "贸易术语",
               "含税", "含运费", "总金额", "状态", "联系人", "联系电话", "备注"]
    return {"name": "报价单", "headers": headers, "rows": _rows_to_values(query(sql, params), fields)}


def _purchase_export():
    status = request.args.get("status", "")
    sql = """SELECT po.*, s.name supplier_name
             FROM purchase_order po JOIN supplier s ON s.id=po.supplier_id WHERE 1=1"""
    params = []
    if status:
        sql += " AND po.status=?"
        params.append(status)
    sql += " ORDER BY po.order_date DESC LIMIT 200"
    fields = ["order_no", "supplier_name", "order_date", "expected_delivery", "actual_delivery", "currency",
              "prod_qty_total", "received_qty", "total_amount", "paid_amount", "urgency", "status",
              "shipping_method", "tracking_no", "remark"]
    headers = ["订单号", "供应商", "下单日期", "预计到货", "实际到货", "币种", "生产总数", "已收货数量",
               "总金额", "已付金额", "紧急程度", "状态", "运输方式", "物流单号", "备注"]
    return {"name": "采购订单", "headers": headers, "rows": _rows_to_values(query(sql, params), fields)}


def _quality_export():
    result = request.args.get("result", "")
    sql = """SELECT qi.*, s.name supplier_name, po.order_no
             FROM quality_inspection qi
             JOIN purchase_order po ON po.id=qi.order_id
             JOIN supplier s ON s.id=po.supplier_id WHERE 1=1"""
    params = []
    if result:
        sql += " AND qi.result=?"
        params.append(result)
    sql += " ORDER BY qi.inspection_date DESC LIMIT 200"
    fields = ["inspection_no", "inspection_date", "supplier_name", "order_no", "inspector", "lot_qty",
              "sample_qty", "defect_qty", "defect_rate", "aql_level", "result", "handle_method", "remark"]
    headers = ["质检单号", "日期", "供应商", "订单号", "检验人", "批次数量", "抽样数量", "不良数量",
               "不良率", "AQL", "结论", "处理方式", "备注"]
    return {"name": "质检记录", "headers": headers, "rows": _rows_to_values(query(sql, params), fields)}


EXPORTS = {
    "suppliers": _supplier_export,
    "materials": _material_export,
    "quotations": _quotation_export,
    "purchases": _purchase_export,
    "qualities": _quality_export,
}


@app.route("/exports/<kind>.xlsx")
def export_excel(kind):
    if kind == "all":
        sheets = [builder() for builder in EXPORTS.values()]
        filename = f"包材管理系统导出_{date.today().isoformat()}.xlsx"
    elif kind in EXPORTS:
        sheet = EXPORTS[kind]()
        sheets = [sheet]
        filename = f"{sheet['name']}_{date.today().isoformat()}.xlsx"
    else:
        flash("未知导出类型", "danger")
        return redirect(url_for("dashboard"))

    return send_file(
        build_xlsx(sheets),
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# ── 模板全局 ────────────────────────────────────────────
@app.context_processor
def inject_now():
    return {"now": date.today()}


def status_badge(status):
    return {
        "POTENTIAL": "secondary", "TRIAL": "info", "QUALIFIED": "primary",
        "STRATEGIC": "success", "SUSPENDED": "warning", "BLACKLIST": "danger",
        "ACTIVE": "success", "INACTIVE": "secondary", "DISCONTINUED": "dark",
        "DRAFT": "secondary", "SENT": "info", "CONFIRMED": "primary",
        "IN_PRODUCTION": "warning", "SHIPPING": "info",
        "PARTIAL_RECEIVED": "warning", "RECEIVED": "success", "CANCELLED": "danger",
        "PARTIAL": "warning", "COMPLETED": "success",
        "PENDING": "secondary", "EXPIRED": "dark", "DEVELOPING": "info",
        "PASS": "success", "CONDITIONAL_PASS": "warning", "FAIL": "danger",
        "NORMAL": "info", "URGENT": "warning", "CRITICAL": "danger",
    }.get(status, "secondary")


app.jinja_env.globals["status_badge"] = status_badge


# ══════════════════════════════════════════════════════════
#  仪表盘
# ══════════════════════════════════════════════════════════
@app.route("/")
def dashboard():
    stats = {
        "supplier_total": query("SELECT COUNT(*) n FROM supplier", one=True)["n"],
        "supplier_active": query(
            "SELECT COUNT(*) n FROM supplier WHERE cooperation_status IN ('TRIAL','QUALIFIED','STRATEGIC')",
            one=True)["n"],
        "material_total": query("SELECT COUNT(*) n FROM material WHERE status='ACTIVE'", one=True)["n"],
        "po_active": query(
            "SELECT COUNT(*) n FROM purchase_order WHERE status NOT IN ('RECEIVED','CANCELLED','DRAFT')",
            one=True)["n"],
    }

    overdue = query("""
        SELECT COUNT(*) n FROM purchase_order_item poi
        JOIN purchase_order po ON po.id = poi.order_id
        WHERE poi.status IN ('PENDING','PARTIAL') AND poi.expected_date < date('now')
    """, one=True)
    stats["overdue_items"] = overdue["n"]

    cert_expiring = query("""
        SELECT COUNT(*) n FROM supplier_certification
        WHERE expiry_date BETWEEN date('now') AND date('now','+30 days')
    """, one=True)
    stats["cert_expiring"] = cert_expiring["n"]

    recent_orders = query("""
        SELECT po.id, po.order_no, po.order_date, po.status, po.urgency, s.name supplier_name
        FROM purchase_order po
        JOIN supplier s ON s.id = po.supplier_id
        ORDER BY po.created_at DESC LIMIT 10
    """)

    top_suppliers = query("""
        SELECT s.name, SUM(po.total_amount) total
        FROM purchase_order po
        JOIN supplier s ON s.id = po.supplier_id
        WHERE po.status NOT IN ('DRAFT','CANCELLED') AND strftime('%Y', po.order_date) = strftime('%Y','now')
        GROUP BY s.id ORDER BY total DESC LIMIT 5
    """)

    quality_rate = query("""
        SELECT COUNT(*) total_inspections,
               SUM(CASE WHEN result='PASS' THEN 1 ELSE 0 END) pass_count
        FROM quality_inspection
        WHERE inspection_date >= date('now','-12 months')
    """, one=True)

    return render_template("dashboard.html", stats=stats, recent_orders=recent_orders,
                           top_suppliers=top_suppliers, quality_rate=quality_rate)


# ══════════════════════════════════════════════════════════
#  供应商
# ══════════════════════════════════════════════════════════
@app.route("/suppliers")
def supplier_list():
    search = request.args.get("search", "")
    status = request.args.get("status", "")
    region = request.args.get("region", "")

    sql = "SELECT * FROM supplier WHERE 1=1"
    params = []
    if search:
        sql += " AND (name LIKE ? OR code LIKE ? OR short_name LIKE ?)"
        params.extend([f"%{search}%"] * 3)
    if status:
        sql += " AND cooperation_status = ?"
        params.append(status)
    if region:
        sql += " AND region = ?"
        params.append(region)
    sql += " ORDER BY updated_at DESC"

    suppliers = query(sql, params)
    regions = query("SELECT DISTINCT region FROM supplier WHERE region IS NOT NULL ORDER BY region")
    return render_template("supplier_list.html", suppliers=suppliers, regions=regions,
                           search=search, status=status, region=region)


@app.route("/suppliers/<int:sid>")
def supplier_detail(sid):
    s = query("SELECT * FROM supplier WHERE id=?", (sid,), one=True)
    if not s:
        flash("供应商不存在", "danger"); return redirect(url_for("supplier_list"))
    contacts = query("SELECT * FROM supplier_contact WHERE supplier_id=? ORDER BY is_primary DESC, sort_order", (sid,))
    certs = query("SELECT * FROM supplier_certification WHERE supplier_id=? ORDER BY expiry_date", (sid,))
    materials = query("""
        SELECT sm.*, m.name mat_name, m.code mat_code, m.spec_capacity, mc.full_path cat_path
        FROM supplier_material sm
        JOIN material m ON m.id = sm.material_id
        JOIN material_category mc ON mc.id = m.category_id
        WHERE sm.supplier_id=? ORDER BY sm.is_preferred DESC
    """, (sid,))
    evals = query("SELECT * FROM supplier_evaluation WHERE supplier_id=? ORDER BY eval_date DESC", (sid,))
    orders = query("SELECT * FROM purchase_order WHERE supplier_id=? ORDER BY order_date DESC LIMIT 20", (sid,))
    return render_template("supplier_detail.html", s=s, contacts=contacts, certs=certs,
                           materials=materials, evals=evals, orders=orders)


@app.route("/suppliers/new", methods=["GET", "POST"])
@app.route("/suppliers/<int:sid>/edit", methods=["GET", "POST"])
def supplier_form(sid=None):
    s = None
    if sid:
        s = query("SELECT * FROM supplier WHERE id=?", (sid,), one=True)
        if not s:
            flash("供应商不存在", "danger"); return redirect(url_for("supplier_list"))

    if request.method == "POST":
        data = request.form
        fields = ["code", "name", "short_name", "company_address", "factory_address",
                  "region", "country", "website", "business_license", "legal_representative",
                  "registered_capital", "established_date", "cooperation_status",
                  "settlement_method", "payment_terms", "tax_rate",
                  "composite_score", "remark"]
        vals = [data.get(f) or None for f in fields]
        vals.append(1 if data.get("is_general_taxpayer") else 0)

        if sid:
            fields.append("is_general_taxpayer")
            sets = ", ".join(f"{f}=?" for f in fields)
            vals.append(sid)
            execute(f"UPDATE supplier SET {sets}, updated_at=datetime('now','localtime') WHERE id=?", vals)
            flash("供应商已更新", "success")
            return redirect(url_for("supplier_detail", sid=sid))
        else:
            fields.append("is_general_taxpayer")
            phs = ", ".join("?" for _ in fields)
            cols = ", ".join(fields)
            execute(f"INSERT INTO supplier ({cols}) VALUES ({phs})", vals)
            flash("供应商已创建", "success")
            return redirect(url_for("supplier_list"))

    return render_template("supplier_form.html", s=s)


# ── 联系人 ───────────────────────────────────────────────
@app.route("/suppliers/<int:sid>/contacts/new", methods=["POST"])
def add_contact(sid):
    execute("""INSERT INTO supplier_contact
        (supplier_id, name, title, department, phone, mobile, email, wechat, is_primary)
        VALUES (?,?,?,?,?,?,?,?,?)""",
        (sid, request.form["name"], request.form.get("title"), request.form.get("department"),
         request.form.get("phone"), request.form.get("mobile"), request.form.get("email"),
         request.form.get("wechat"), 1 if request.form.get("is_primary") else 0))
    flash("联系人已添加", "success")
    return redirect(url_for("supplier_detail", sid=sid))


@app.route("/suppliers/<int:sid>/contacts/<int:cid>/delete", methods=["POST"])
def delete_contact(sid, cid):
    execute("DELETE FROM supplier_contact WHERE id=? AND supplier_id=?", (cid, sid))
    flash("联系人已删除", "success")
    return redirect(url_for("supplier_detail", sid=sid))


# ── 评估 ─────────────────────────────────────────────────
@app.route("/suppliers/<int:sid>/evaluate", methods=["POST"])
def add_evaluation(sid):
    execute("""INSERT INTO supplier_evaluation
        (supplier_id, eval_period, eval_date, evaluator,
         score_quality, score_delivery, score_price, score_service, score_flexibility,
         evaluation_summary, improvement_plan)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (sid, request.form["eval_period"], request.form["eval_date"], request.form["evaluator"],
         request.form.get("score_quality"), request.form.get("score_delivery"),
         request.form.get("score_price"), request.form.get("score_service"),
         request.form.get("score_flexibility"),
         request.form.get("evaluation_summary"), request.form.get("improvement_plan")))
    # 更新综合评分
    row = query("SELECT AVG(score_quality+score_delivery+score_price+score_service+score_flexibility)/5.0 s FROM supplier_evaluation WHERE supplier_id=?", (sid,), one=True)
    if row and row["s"]:
        execute("UPDATE supplier SET composite_score=ROUND(?,1) WHERE id=?", (row["s"], sid))
    flash("评估已保存", "success")
    return redirect(url_for("supplier_detail", sid=sid))


# ══════════════════════════════════════════════════════════
#  包材
# ══════════════════════════════════════════════════════════
@app.route("/materials")
def material_list():
    category = request.args.get("category", "")
    search = request.args.get("search", "")

    sql = """SELECT m.*, mc.full_path cat_path
             FROM material m JOIN material_category mc ON mc.id = m.category_id WHERE 1=1"""
    params = []
    if category:
        sql += " AND (CAST(mc.id AS TEXT)=? OR CAST(mc.parent_id AS TEXT)=? OR mc.full_path LIKE ?)"
        params.extend([category, category, f"%{category}%"])
    if search:
        sql += " AND (m.name LIKE ? OR m.code LIKE ?)"
        params.extend([f"%{search}%"] * 2)
    sql += " ORDER BY mc.full_path, m.name"

    materials = query(sql, params)
    categories = query("SELECT * FROM material_category WHERE level=2 AND is_active=1 ORDER BY full_path")
    return render_template("material_list.html", materials=materials, categories=categories,
                           search=search, category=category)


@app.route("/materials/<int:mid>")
def material_detail(mid):
    m = query("""SELECT m.*, mc.full_path cat_path
                 FROM material m JOIN material_category mc ON mc.id=m.category_id
                 WHERE m.id=?""", (mid,), one=True)
    if not m:
        flash("包材不存在", "danger"); return redirect(url_for("material_list"))

    spec = None
    spec_tables = ["material_spec_bottle", "material_spec_tube", "material_spec_dispenser",
                   "material_spec_cap", "material_spec_carton", "material_spec_label",
                   "material_spec_pouch", "material_spec_corrugated"]
    for tbl in spec_tables:
        spec = query(f"SELECT * FROM {tbl} WHERE material_id=?", (mid,), one=True)
        if spec:
            spec = dict(spec)
            spec["_type"] = tbl
            break

    suppliers = query("""
        SELECT sm.*, s.name sup_name, s.cooperation_status
        FROM supplier_material sm JOIN supplier s ON s.id=sm.supplier_id
        WHERE sm.material_id=? ORDER BY sm.is_preferred DESC, sm.latest_unit_price
    """, (mid,))
    quotations = query("""
        SELECT qi.*, q.quotation_date, s.name sup_name
        FROM quotation_item qi JOIN quotation q ON q.id=qi.quotation_id
        JOIN supplier s ON s.id=q.supplier_id
        WHERE qi.material_id=? ORDER BY q.quotation_date DESC LIMIT 20
    """, (mid,))
    return render_template("material_detail.html", m=m, spec=spec, suppliers=suppliers,
                           quotations=quotations)


@app.route("/materials/new", methods=["GET", "POST"])
@app.route("/materials/<int:mid>/edit", methods=["GET", "POST"])
def material_form(mid=None):
    m = None
    if mid:
        m = query("SELECT * FROM material WHERE id=?", (mid,), one=True)
        if not m:
            flash("包材不存在", "danger"); return redirect(url_for("material_list"))

    if request.method == "POST":
        data = request.form
        fields = ["code", "category_id", "name", "material_type", "spec_capacity",
                  "spec_color", "spec_finish", "printing_process", "printing_colors",
                  "mold_owner", "mold_lifecycle", "suitable_for",
                  "unit", "min_order_qty", "typical_lead_time", "status", "remark"]
        vals = [data.get(f) or None for f in fields]
        vals.append(1 if data.get("has_custom_mold") else 0)
        vals.append(1 if data.get("need_food_grade") else 0)
        vals.append(1 if data.get("need_medical_cert") else 0)
        fields += ["has_custom_mold", "need_food_grade", "need_medical_cert"]

        if mid:
            fields.pop(fields.index("code"))  # 不更新 code
            vals.pop(fields.index("code"))     # 移除 code 的值... wait this is tricky
            # Let me redo this more carefully
            pass

        if mid:
            # 重新构建，不包含 code
            fields2 = ["name", "category_id", "material_type", "spec_capacity",
                      "spec_color", "spec_finish", "printing_process", "printing_colors",
                      "mold_owner", "mold_lifecycle", "suitable_for",
                      "unit", "min_order_qty", "typical_lead_time", "status", "remark",
                      "has_custom_mold", "need_food_grade", "need_medical_cert"]
            vals2 = [data.get(f) or None for f in fields2]
            vals2[fields2.index("has_custom_mold")] = 1 if data.get("has_custom_mold") else 0
            vals2[fields2.index("need_food_grade")] = 1 if data.get("need_food_grade") else 0
            vals2[fields2.index("need_medical_cert")] = 1 if data.get("need_medical_cert") else 0
            sets = ", ".join(f"{f}=?" for f in fields2)
            vals2.append(mid)
            execute(f"UPDATE material SET {sets}, updated_at=datetime('now','localtime') WHERE id=?", vals2)
            flash("包材已更新", "success")
            return redirect(url_for("material_detail", mid=mid))
        else:
            vals[fields.index("has_custom_mold")] = 1 if data.get("has_custom_mold") else 0
            vals[fields.index("need_food_grade")] = 1 if data.get("need_food_grade") else 0
            vals[fields.index("need_medical_cert")] = 1 if data.get("need_medical_cert") else 0
            cols = ", ".join(fields)
            phs = ", ".join("?" for _ in fields)
            mid = execute(f"INSERT INTO material ({cols}) VALUES ({phs})", vals)
            flash("包材已创建", "success")
            return redirect(url_for("material_detail", mid=mid))

    categories = query("SELECT * FROM material_category WHERE is_active=1 ORDER BY full_path")
    return render_template("material_form.html", m=m, categories=categories)


# ══════════════════════════════════════════════════════════
#  报价单
# ══════════════════════════════════════════════════════════
@app.route("/quotations")
def quotation_list():
    search = request.args.get("search", "")
    status = request.args.get("status", "")

    sql = """SELECT q.*, s.name supplier_name
             FROM quotation q JOIN supplier s ON s.id=q.supplier_id WHERE 1=1"""
    params = []
    if search:
        sql += " AND (q.quotation_no LIKE ? OR s.name LIKE ?)"
        params.extend([f"%{search}%"] * 2)
    if status:
        sql += " AND q.status=?"
        params.append(status)
    sql += " ORDER BY q.quotation_date DESC LIMIT 200"
    return render_template("quotation_list.html", quotations=query(sql, params),
                           search=search, status=status)


@app.route("/quotations/new", methods=["GET", "POST"])
@app.route("/quotations/<int:qid>/edit", methods=["GET", "POST"])
def quotation_form(qid=None):
    q = None
    items = []
    if qid:
        q = query("""SELECT q.*, s.name supplier_name FROM quotation q
                     JOIN supplier s ON s.id=q.supplier_id WHERE q.id=?""", (qid,), one=True)
        if not q:
            flash("报价单不存在", "danger"); return redirect(url_for("quotation_list"))
        items = query("""SELECT qi.*, m.name mat_name, m.code mat_code
                         FROM quotation_item qi JOIN material m ON m.id=qi.material_id
                         WHERE qi.quotation_id=? ORDER BY qi.item_seq""", (qid,))

    if request.method == "POST":
        data = request.form
        qfields = ["quotation_no", "supplier_id", "quotation_date", "valid_until",
                   "currency", "exchange_rate", "incoterm", "contact_person", "contact_phone",
                   "status", "remark"]
        qvals = [data.get(f) or None for f in qfields]
        qvals.append(1 if data.get("is_tax_included") else 0)
        qvals.append(1 if data.get("is_shipping_included") else 0)
        qfields += ["is_tax_included", "is_shipping_included"]

        if qid:
            sets = ", ".join(f"{f}=?" for f in qfields)
            qvals.append(qid)
            execute(f"UPDATE quotation SET {sets}, updated_at=datetime('now','localtime') WHERE id=?", qvals)
            # 追加新明细
            mat_ids = request.form.getlist("item_material_id")
            if mat_ids:
                seq_start = len(items) + 1
                for i, mat_id in enumerate(mat_ids):
                    if mat_id:
                        execute("""INSERT INTO quotation_item
                            (quotation_id, material_id, item_seq, quantity, unit_price,
                             mold_fee, sample_fee, lead_time_days, remark)
                            VALUES (?,?,?,?,?,?,?,?,?)""",
                            (qid, mat_id, seq_start + i,
                             request.form.getlist("item_quantity")[i] or None,
                             request.form.getlist("item_unit_price")[i] or 0,
                             request.form.getlist("item_mold_fee")[i] or 0,
                             request.form.getlist("item_sample_fee")[i] or 0,
                             request.form.getlist("item_lead_time")[i] or None,
                             None))
            flash("报价单已更新", "success")
            return redirect(url_for("quotation_list"))
        else:
            cols = ", ".join(qfields)
            phs = ", ".join("?" for _ in qfields)
            qid = execute(f"INSERT INTO quotation ({cols}) VALUES ({phs})", qvals)
            mat_ids = request.form.getlist("item_material_id")
            seq = 1
            for i, mat_id in enumerate(mat_ids):
                if mat_id:
                    execute("""INSERT INTO quotation_item
                        (quotation_id, material_id, item_seq, quantity, unit_price,
                         mold_fee, sample_fee, lead_time_days, remark)
                        VALUES (?,?,?,?,?,?,?,?,?)""",
                        (qid, mat_id, seq,
                         request.form.getlist("item_quantity")[i] or None,
                         request.form.getlist("item_unit_price")[i] or 0,
                         request.form.getlist("item_mold_fee")[i] or 0,
                         request.form.getlist("item_sample_fee")[i] or 0,
                         request.form.getlist("item_lead_time")[i] or None,
                         None))
                    seq += 1
            flash("报价单已创建", "success")
            return redirect(url_for("quotation_list"))

    suppliers = query("SELECT id, name FROM supplier WHERE cooperation_status IN ('TRIAL','QUALIFIED','STRATEGIC') ORDER BY name")
    materials = query("SELECT id, name, spec_capacity, code FROM material WHERE status='ACTIVE' ORDER BY name")
    return render_template("quotation_form.html", q=q, items=items, suppliers=suppliers, materials=materials)


# ══════════════════════════════════════════════════════════
#  采购订单
# ══════════════════════════════════════════════════════════
@app.route("/purchases")
def purchase_list():
    status = request.args.get("status", "")
    sql = """SELECT po.*, s.name supplier_name
             FROM purchase_order po JOIN supplier s ON s.id=po.supplier_id WHERE 1=1"""
    params = []
    if status:
        sql += " AND po.status=?"
        params.append(status)
    sql += " ORDER BY po.order_date DESC LIMIT 200"
    return render_template("purchase_list.html", orders=query(sql, params), status=status)


@app.route("/purchases/<int:pid>")
def purchase_detail(pid):
    po = query("""SELECT po.*, s.name supplier_name, s.region
                  FROM purchase_order po JOIN supplier s ON s.id=po.supplier_id
                  WHERE po.id=?""", (pid,), one=True)
    if not po:
        flash("订单不存在", "danger"); return redirect(url_for("purchase_list"))
    items = query("""SELECT poi.*, m.name mat_name, m.code mat_code, m.spec_capacity
                     FROM purchase_order_item poi JOIN material m ON m.id=poi.material_id
                     WHERE poi.order_id=? ORDER BY poi.item_seq""", (pid,))
    deliveries = query("SELECT * FROM delivery_record WHERE order_id=? ORDER BY delivery_date DESC", (pid,))
    inspections = query("""SELECT qi.*, m.name mat_name
                           FROM quality_inspection qi
                           LEFT JOIN purchase_order_item poi ON poi.id=qi.order_item_id
                           LEFT JOIN material m ON m.id=poi.material_id
                           WHERE qi.order_id=? ORDER BY qi.inspection_date DESC""", (pid,))
    return render_template("purchase_detail.html", po=po, items=items, deliveries=deliveries,
                           inspections=inspections)


@app.route("/purchases/new", methods=["GET", "POST"])
@app.route("/purchases/<int:pid>/edit", methods=["GET", "POST"])
def purchase_form(pid=None):
    po = None
    items = []
    if pid:
        po = query("""SELECT po.*, s.name supplier_name FROM purchase_order po
                      JOIN supplier s ON s.id=po.supplier_id WHERE po.id=?""", (pid,), one=True)
        if not po:
            flash("订单不存在", "danger"); return redirect(url_for("purchase_list"))
        items = query("""SELECT poi.*, m.name mat_name, m.code mat_code
                         FROM purchase_order_item poi JOIN material m ON m.id=poi.material_id
                         WHERE poi.order_id=? ORDER BY poi.item_seq""", (pid,))

    if request.method == "POST":
        data = request.form
        fields = ["order_no", "supplier_id", "order_date", "expected_delivery",
                  "currency", "urgency", "status", "shipping_method", "tracking_no",
                  "contract_path", "remark"]
        vals = [data.get(f) or None for f in fields]
        vals.append(data.get("quotation_id") or None)
        fields.append("quotation_id")

        if pid:
            sets = ", ".join(f"{f}=?" for f in fields)
            vals.append(pid)
            execute(f"UPDATE purchase_order SET {sets}, updated_at=datetime('now','localtime') WHERE id=?", vals)
            flash("订单已更新", "success")
            return redirect(url_for("purchase_detail", pid=pid))
        else:
            cols = ", ".join(fields)
            phs = ", ".join("?" for _ in fields)
            pid = execute(f"INSERT INTO purchase_order ({cols}) VALUES ({phs})", vals)
            mat_ids = request.form.getlist("item_material_id")
            seq = 1
            for i, mat_id in enumerate(mat_ids):
                if mat_id:
                    execute("""INSERT INTO purchase_order_item
                        (order_id, material_id, item_seq, order_qty, unit_price, expected_date)
                        VALUES (?,?,?,?,?,?)""",
                        (pid, mat_id, seq,
                         request.form.getlist("item_order_qty")[i] or 0,
                         request.form.getlist("item_unit_price")[i] or 0,
                         request.form.getlist("item_expected_date")[i] or None))
                    seq += 1
            flash("订单已创建", "success")
            return redirect(url_for("purchase_detail", pid=pid))

    suppliers = query("SELECT id, name FROM supplier WHERE cooperation_status IN ('TRIAL','QUALIFIED','STRATEGIC') ORDER BY name")
    materials = query("SELECT id, name, spec_capacity, code FROM material WHERE status='ACTIVE' ORDER BY name")
    quotations = query("SELECT id, quotation_no FROM quotation WHERE status='CONFIRMED' ORDER BY quotation_date DESC")
    return render_template("purchase_form.html", po=po, items=items, suppliers=suppliers,
                           materials=materials, quotations=quotations)


@app.route("/purchases/<int:pid>/delivery", methods=["POST"])
def add_delivery(pid):
    execute("""INSERT INTO delivery_record
        (order_id, delivery_date, delivery_qty, carrier, tracking_no, estimated_arrival)
        VALUES (?,?,?,?,?,?)""",
        (pid, request.form["delivery_date"], request.form["delivery_qty"],
         request.form.get("carrier"), request.form.get("tracking_no"),
         request.form.get("estimated_arrival") or None))
    flash("发货记录已添加", "success")
    return redirect(url_for("purchase_detail", pid=pid))


@app.route("/purchases/<int:pid>/receive", methods=["POST"])
def receive_goods(pid):
    item_id = request.form["item_id"]
    qty = int(request.form["received_qty"])
    execute("UPDATE purchase_order_item SET received_qty = received_qty + ? WHERE id=?", (qty, item_id))
    item = query("SELECT * FROM purchase_order_item WHERE id=?", (item_id,), one=True)
    if item["received_qty"] >= item["order_qty"]:
        execute("UPDATE purchase_order_item SET status='COMPLETED' WHERE id=?", (item_id,))
    total_rcv = query("SELECT SUM(received_qty) s FROM purchase_order_item WHERE order_id=?", (pid,), one=True)
    if total_rcv and total_rcv["s"] is not None:
        execute("UPDATE purchase_order SET received_qty=? WHERE id=?", (total_rcv["s"], pid))
    flash("收货记录已更新", "success")
    return redirect(url_for("purchase_detail", pid=pid))


# ══════════════════════════════════════════════════════════
#  质检
# ══════════════════════════════════════════════════════════
@app.route("/qualities")
def quality_list():
    result = request.args.get("result", "")
    sql = """SELECT qi.*, s.name supplier_name, po.order_no
             FROM quality_inspection qi
             JOIN purchase_order po ON po.id=qi.order_id
             JOIN supplier s ON s.id=po.supplier_id WHERE 1=1"""
    params = []
    if result:
        sql += " AND qi.result=?"
        params.append(result)
    sql += " ORDER BY qi.inspection_date DESC LIMIT 200"
    return render_template("quality_list.html", inspections=query(sql, params), result=result)


@app.route("/qualities/new", methods=["GET", "POST"])
def quality_form():
    if request.method == "POST":
        data = request.form
        check_fields = ["check_dimensions", "check_appearance", "check_function",
                        "check_printing", "check_color", "check_material", "check_capacity",
                        "check_compatibility"]
        vals = {}
        for f in check_fields:
            vals[f] = 1 if data.get(f) else 0

        execute("""INSERT INTO quality_inspection
            (inspection_no, order_id, order_item_id, inspection_date, inspector,
             lot_qty, sample_qty, defect_qty, aql_level, aql_critical, aql_major, aql_minor,
             check_dimensions, check_appearance, check_function,
             check_printing, check_color, check_material, check_capacity, check_compatibility,
             inspection_detail, result, handle_method, remark)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (data["inspection_no"], data["order_id"], data.get("order_item_id") or None,
             data["inspection_date"], data.get("inspector"),
             data.get("lot_qty") or None, data.get("sample_qty") or None,
             data.get("defect_qty") or 0,
             data.get("aql_level"), data.get("aql_critical") or None,
             data.get("aql_major") or None, data.get("aql_minor") or None,
             vals["check_dimensions"], vals["check_appearance"], vals["check_function"],
             vals["check_printing"], vals["check_color"], vals["check_material"],
             vals["check_capacity"], vals["check_compatibility"],
             data.get("inspection_detail"), data["result"], data.get("handle_method"),
             data.get("remark")))
        flash("质检记录已保存", "success")
        return redirect(url_for("quality_list"))

    orders = query("""SELECT po.id, po.order_no FROM purchase_order po
                      WHERE po.status IN ('SHIPPING','PARTIAL_RECEIVED','RECEIVED')
                      ORDER BY po.order_date DESC LIMIT 100""")
    return render_template("quality_form.html", orders=orders)


@app.route("/qualities/<int:qid>")
def quality_detail(qid):
    qi = query("""SELECT qi.*, s.name supplier_name, po.order_no, m.name mat_name
                  FROM quality_inspection qi
                  JOIN purchase_order po ON po.id=qi.order_id
                  JOIN supplier s ON s.id=po.supplier_id
                  LEFT JOIN purchase_order_item poi ON poi.id=qi.order_item_id
                  LEFT JOIN material m ON m.id=poi.material_id
                  WHERE qi.id=?""", (qid,), one=True)
    if not qi:
        flash("记录不存在", "danger"); return redirect(url_for("quality_list"))
    return render_template("quality_detail.html", qi=qi)


# ══════════════════════════════════════════════════════════
#  启动
# ══════════════════════════════════════════════════════════
if __name__ == "__main__":
    import sys
    from waitress import serve

    host = "0.0.0.0"
    port = 5000
    print(f"包材管理系统已启动 → http://127.0.0.1:{port}")
    print(f"数据库: {DB_PATH}")
    serve(app, host=host, port=port, threads=4)

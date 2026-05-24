const SkincareProductsPage = {
  products: [],

  async render(container) {
    this.container = container;
    try { this.products = await API.get('/api/skincare/products'); } catch { this.products = []; }
    this.listView();
  },

  listView() {
    const c = this.container;
    c.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card accent"><div class="stat-num">${this.products.length}</div><div class="stat-label">产品数</div></div>
      </div>
      <button class="btn btn-primary btn-block" id="addProductBtn">+ 添加产品</button>
      <button class="btn btn-outline btn-sm btn-block" id="importProductBtn" style="margin-top:6px;background:var(--accent);color:#fff;border-color:var(--accent);">AI 导入产品（丢链接/贴文档）</button>
      <div id="productList" style="margin-top:14px;">
        ${this.products.length === 0
          ? '<div class="empty-state"><p>还没有产品，点击上方按钮添加第一个产品</p><p style="font-size:0.8rem;color:var(--text-dim);">产品库是 AI 写脚本的"弹药库"，越详细效果越好</p></div>'
          : this.products.map(p => `
            <div class="card entry-card" data-id="${p.id}">
              <div class="entry-header">
                <div style="flex:1;">
                  <div class="entry-title">${escapeHtml(p.name)}</div>
                  <div class="entry-meta">${escapeHtml(p.efficacy || '未设置功效')} | ${escapeHtml(p.target_audience || '未设置目标人群')}</div>
                  ${p.core_ingredients ? `<div class="entry-meta">成分：${escapeHtml(p.core_ingredients)}</div>` : ''}
                </div>
                <span class="badge badge-medium">${escapeHtml(p.brand_positioning || '未分类')}</span>
              </div>
            </div>
          `).join('')}
      </div>
    `;

    $('#addProductBtn').addEventListener('click', () => this.showModal());
    $('#importProductBtn').addEventListener('click', () => this.showImportModal());
    $$('.entry-card', c).forEach(el => {
      el.addEventListener('click', () => {
        const p = this.products.find(x => x.id === parseInt(el.dataset.id));
        if (p) this.showModal(p);
      });
    });
  },

  showImportModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width:600px;">
        <h3>AI 导入产品</h3>
        <p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:12px;">
          粘贴产品详情页链接或产品文档/介绍文案，AI 自动提取产品名、成分、功效、适用人群等并自动入库。
        </p>
        <div class="form-group"><label>产品链接（可选）</label><input id="impUrl" placeholder="商品详情页链接"></div>
        <div class="form-group"><label>或直接粘贴产品介绍文案</label><textarea id="impText" rows="8" placeholder="把产品详情页、宣传文案、产品说明书等文字粘贴到这里..."></textarea></div>
        <button class="btn btn-primary btn-block" id="doImportBtn">AI 分析并导入</button>
        <div id="importResult" style="margin-top:12px;"></div>
        <button class="btn btn-outline btn-sm close-modal" style="margin-top:8px;">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    modal.querySelector('.close-modal').addEventListener('click', close);

    modal.querySelector('#doImportBtn').addEventListener('click', async () => {
      const url = modal.querySelector('#impUrl').value.trim();
      const text = modal.querySelector('#impText').value.trim();
      if (!url && !text) return showToast('请输入链接或粘贴产品介绍');
      const btn = modal.querySelector('#doImportBtn');
      btn.disabled = true; btn.textContent = 'AI 分析中...';
      try {
        const result = await API.post('/api/skincare/products/import', { url, text });
        const r = modal.querySelector('#importResult');
        if (result.need_text) {
          r.innerHTML = `<p style="color:var(--yellow);font-size:0.85rem;">${escapeHtml(result.message)}</p>`;
        } else {
          r.innerHTML = `
            <div class="card" style="border-left:3px solid var(--green);">
              <h4 style="color:var(--green);">产品已导入</h4>
              <p style="font-size:0.85rem;"><strong>名称：</strong>${escapeHtml(result.name||'')}</p>
              <p style="font-size:0.85rem;"><strong>功效：</strong>${escapeHtml(result.efficacy||'')}</p>
              <p style="font-size:0.85rem;"><strong>成分：</strong>${escapeHtml(result.core_ingredients||'')}</p>
              <p style="font-size:0.85rem;"><strong>人群：</strong>${escapeHtml(result.target_audience||'')}</p>
              <p style="font-size:0.85rem;"><strong>话术：</strong>${(result.talking_points||[]).map(tp=>tp.content).join(' | ')||'无'}</p>
            </div>
          `;
          close();
          this.render(this.container);
          showToast('产品已导入，话术已自动生成');
        }
      } catch (e) { modal.querySelector('#importResult').innerHTML = `<p style="color:var(--red);">${escapeHtml(e.message)}</p>`; }
      btn.disabled = false; btn.textContent = 'AI 分析并导入';
    });
  },

  async showModal(product) {
    const isEdit = !!product;
    let talkingPoints = [];
    if (isEdit) {
      try { const d = await API.get(`/api/skincare/products/${product.id}`); talkingPoints = d.talking_points || []; } catch {}
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width:560px;">
        <h3>${isEdit ? '编辑产品' : '添加产品'}</h3>
        <div class="form-group"><label>产品名称 *</label><input id="prodName" value="${isEdit ? escapeHtml(product.name) : ''}"></div>
        <div class="form-group"><label>品牌定位</label><input id="prodPos" value="${isEdit ? escapeHtml(product.brand_positioning||'') : ''}" placeholder="如：新锐国货、高端院线"></div>
        <div class="form-group"><label>目标人群</label><input id="prodAud" value="${isEdit ? escapeHtml(product.target_audience||'') : ''}" placeholder="如：25-40岁熬夜党、敏感肌人群"></div>
        <div class="form-group"><label>核心成分</label><input id="prodIng" value="${isEdit ? escapeHtml(product.core_ingredients||'') : ''}" placeholder="如：山参胶原蛋白、烟酰胺"></div>
        <div class="form-group"><label>核心功效</label><input id="prodEff" value="${isEdit ? escapeHtml(product.efficacy||'') : ''}" placeholder="如：抗衰淡纹、美白提亮"></div>
        <div class="form-group"><label>价格</label><input id="prodPrice" value="${isEdit ? escapeHtml(product.price||'') : ''}" placeholder="如：¥199/30ml"></div>
        <div class="form-group"><label>规格</label><input id="prodSpecs" value="${isEdit ? escapeHtml(product.specs||'') : ''}" placeholder="如：30ml/瓶"></div>
        <div class="form-group"><label>使用场景</label><input id="prodScene" value="${isEdit ? escapeHtml(product.usage_scenarios||'') : ''}" placeholder="如：熬夜急救、换季修复、妆前打底"></div>

        ${isEdit ? `
        <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:14px;">
          <h4 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-dim);">深度分析（AI 生成）</h4>
          <div class="form-group"><label>天然成分分析</label><textarea id="prodNatural" rows="2" placeholder="AI 导入产品时自动填充">${escapeHtml(product.is_natural||'')}</textarea></div>
          <div class="form-group"><label>配方分析</label><textarea id="prodFormula" rows="3" placeholder="AI 导入产品时自动填充">${escapeHtml(product.formula_analysis||'')}</textarea></div>
          <div class="form-group"><label>竞品差异</label><textarea id="prodDiff" rows="3" placeholder="AI 导入产品时自动填充">${escapeHtml(product.competitor_diff||'')}</textarea></div>
          <button class="btn btn-sm btn-outline" id="competitorBtn" style="width:100%;">竞品挖掘 — AI 对比知识库竞品素材，找独特卖点</button>
          <div id="competitorResult" style="margin-top:8px;"></div>
        </div>

        <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:14px;">
          <h4 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-dim);">话术库</h4>
          <div id="tpList">
            ${talkingPoints.map(tp => `
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;" data-tpid="${tp.id}">
                <span class="badge badge-${tp.point_type === '卖点' ? 'in_progress' : tp.point_type === '异议应对' ? 'high' : 'medium'}" style="white-space:nowrap;">${escapeHtml(tp.point_type)}</span>
                <span style="flex:1;font-size:0.85rem;">${escapeHtml(tp.content)}</span>
                <button class="btn btn-sm btn-outline del-tp" data-id="${tp.id}">×</button>
              </div>
            `).join('')}
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <select id="newTpType" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text);">
              <option value="卖点">卖点</option>
              <option value="异议应对">异议应对</option>
              <option value="品牌介绍">品牌介绍</option>
            </select>
            <input id="newTpContent" placeholder="话术内容" style="flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text);">
            <button class="btn btn-sm btn-primary" id="addTpBtn">添加</button>
          </div>
        </div>` : ''}

        <div class="btn-group">
          <button class="btn btn-primary" id="saveProdBtn">${isEdit ? '保存' : '添加'}</button>
          ${isEdit ? '<button class="btn btn-danger btn-sm" id="delProdBtn">删除产品</button>' : ''}
          <button class="btn btn-outline btn-sm" id="closeModalBtn">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.remove());
    modal.querySelector('#closeModalBtn').addEventListener('click', () => modal.remove());

    const getFields = () => ({
      name: modal.querySelector('#prodName').value,
      brand_positioning: modal.querySelector('#prodPos').value,
      target_audience: modal.querySelector('#prodAud').value,
      core_ingredients: modal.querySelector('#prodIng').value,
      efficacy: modal.querySelector('#prodEff').value,
      price: modal.querySelector('#prodPrice').value,
      specs: modal.querySelector('#prodSpecs').value,
      usage_scenarios: modal.querySelector('#prodScene').value,
      is_natural: isEdit ? modal.querySelector('#prodNatural').value : '',
      formula_analysis: isEdit ? modal.querySelector('#prodFormula').value : '',
      competitor_diff: isEdit ? modal.querySelector('#prodDiff').value : ''
    });

    modal.querySelector('#saveProdBtn').addEventListener('click', async () => {
      try {
        if (isEdit) {
          await API.put(`/api/skincare/products/${product.id}`, getFields());
        } else {
          await API.post('/api/skincare/products', getFields());
        }
        modal.remove();
        this.render(this.container);
        showToast(isEdit ? '产品已更新' : '产品已添加');
      } catch (e) { showToast('保存失败: ' + e.message); }
    });

    if (isEdit) {
      // Competitor analysis button
      modal.querySelector('#competitorBtn').addEventListener('click', async () => {
        const btn = modal.querySelector('#competitorBtn');
        btn.disabled = true; btn.textContent = 'AI 分析中...';
        try {
          const result = await API.post(`/api/skincare/products/${product.id}/competitor-analysis`);
          const r = modal.querySelector('#competitorResult');
          r.innerHTML = `
            <div class="card" style="border-left:3px solid var(--accent);margin-top:8px;">
              <h4 style="font-size:0.85rem;color:var(--accent);">竞品挖掘完成</h4>
              ${result.differentiation_analysis ? `<p style="font-size:0.82rem;margin-top:4px;"><strong>差异分析：</strong>${escapeHtml(result.differentiation_analysis)}</p>` : ''}
              ${result.unique_advantages ? `<div style="font-size:0.82rem;margin-top:4px;"><strong>独特优势：</strong>${result.unique_advantages.map(a => '<br>• '+escapeHtml(a)).join('')}</div>` : ''}
              ${result.new_talking_points ? `<div style="font-size:0.82rem;margin-top:4px;"><strong>新话术：</strong>${result.new_talking_points.map(a => '<br>• '+escapeHtml(a)).join('')}</div>` : ''}
              ${result.competitor_gaps ? `<p style="font-size:0.82rem;margin-top:4px;"><strong>竞品弱点：</strong>${escapeHtml(result.competitor_gaps)}</p>` : ''}
              ${result.recommended_angles ? `<div style="font-size:0.82rem;margin-top:4px;"><strong>建议切入角度：</strong>${result.recommended_angles.map(a => '<br>• '+escapeHtml(a)).join('')}</div>` : ''}
            </div>
          `;
          // Refresh talking points
          const tpList = modal.querySelector('#tpList');
          if (tpList && result.talking_points) {
            tpList.innerHTML = result.talking_points.map(tp => `
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
                <span class="badge badge-${tp.point_type==='竞品挖掘'?'high':'in_progress'}" style="white-space:nowrap;">${escapeHtml(tp.point_type)}</span>
                <span style="flex:1;font-size:0.85rem;">${escapeHtml(tp.content)}</span>
                <button class="btn btn-sm btn-outline del-tp" data-id="${tp.id}">×</button>
              </div>
            `).join('');
          }
          // Update competitor_diff textarea
          try {
            const updated = await API.get(`/api/skincare/products/${product.id}`);
            modal.querySelector('#prodDiff').value = updated.competitor_diff || '';
          } catch {}
        } catch (e) { modal.querySelector('#competitorResult').innerHTML = `<p style="color:var(--red);font-size:0.82rem;">${escapeHtml(e.message)}</p>`; }
        btn.disabled = false; btn.textContent = '竞品挖掘 — AI 对比知识库竞品素材，找独特卖点';
      });

      modal.querySelector('#delProdBtn').addEventListener('click', async () => {
        if (!confirm('确定删除该产品及其所有话术吗？')) return;
        await API.del(`/api/skincare/products/${product.id}`);
        modal.remove();
        this.render(this.container);
        showToast('产品已删除');
      });

      // Talking point handlers
      modal.querySelector('#addTpBtn').addEventListener('click', async () => {
        const pt = modal.querySelector('#newTpType').value;
        const ct = modal.querySelector('#newTpContent').value.trim();
        if (!ct) return showToast('请输入话术内容');
        await API.post(`/api/skincare/products/${product.id}/talking-points`, { point_type: pt, content: ct });
        modal.remove();
        this.showModal(product);
      });

      modal.querySelectorAll('.del-tp').forEach(btn => {
        btn.addEventListener('click', async () => {
          await API.del(`/api/skincare/talking-points/${btn.dataset.id}`);
          modal.remove();
          this.showModal(product);
        });
      });
    }
  }
};

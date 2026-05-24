const SkincareKnowledgePage = {
  materials: [],
  container: null,
  filterCategory: '',
  searchTerm: '',

  async render(container) {
    this.container = container;
    await this.loadData();
    this.listView();
  },

  async loadData() {
    let url = '/api/skincare/knowledge?';
    if (this.filterCategory) url += 'category=' + encodeURIComponent(this.filterCategory) + '&';
    if (this.searchTerm) url += 'search=' + encodeURIComponent(this.searchTerm);
    try { this.materials = await API.get(url); } catch { this.materials = []; }
  },

  async listView() {
    const c = this.container;
    const categories = ['竞品分析', '行业知识', '用户反馈', '爆款参考', '话术灵感', '其他'];
    const counts = {};
    categories.forEach(cat => {
      counts[cat] = this.materials.filter(m => m.category === cat).length;
    });

    c.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card accent"><div class="stat-num">${this.materials.length}</div><div class="stat-label">知识素材</div></div>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;" id="catFilters">
        <button class="btn btn-sm ${this.filterCategory === '' ? 'btn-primary' : 'btn-outline'}" data-cat="">全部(${this.materials.length})</button>
        ${categories.map(cat => `
          <button class="btn btn-sm ${this.filterCategory === cat ? 'btn-primary' : 'btn-outline'}" data-cat="${cat}">${cat}(${counts[cat]||0})</button>
        `).join('')}
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input id="kwSearch" type="text" placeholder="搜索知识库..." value="${escapeHtml(this.searchTerm)}" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-size:0.85rem;">
        <button class="btn btn-primary btn-sm" id="addKwBtn">+ 添加素材</button>
        <button class="btn btn-outline btn-sm" id="importKwBtn" style="background:var(--accent);color:#fff;border-color:var(--accent);">AI 导入链接</button>
      </div>

      <div id="kwList">
        ${this.materials.length === 0
          ? `<div class="empty-state">
              <p>知识库还是空的</p>
              <p style="font-size:0.8rem;color:var(--text-dim);">把竞品话术、行业文章、用户评价、爆款脚本等丢进来<br>AI 写脚本时会自动引用这些素材</p>
              <p style="font-size:0.78rem;color:var(--accent);margin-top:8px;">可以投喂的内容举例：<br>• 竞品爆款视频的逐字稿<br>• 用户评论区的高频问题<br>• 行业KOL的观点/金句<br>• 自己觉得好的开头钩子<br>• 产品成分的科学文献摘要</p>
            </div>`
          : this.materials.map(m => `
            <div class="card entry-card" data-id="${m.id}" style="border-left:3px solid ${this.catColor(m.category)};">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;">
                    <span class="badge" style="background:${this.catColor(m.category)}22;color:${this.catColor(m.category)};">${escapeHtml(m.category)}</span>
                    ${m.tags ? m.tags.split(',').map(t => `<span class="badge badge-low">${escapeHtml(t.trim())}</span>`).join('') : ''}
                    ${m.product_name ? `<span class="badge badge-medium">${escapeHtml(m.product_name)}</span>` : ''}
                  </div>
                  <div class="entry-title">${escapeHtml(m.title)}</div>
                  ${m.content ? `<div class="entry-meta">${escapeHtml(m.content.slice(0,120))}${m.content.length > 120 ? '...' : ''}</div>` : ''}
                  ${m.source_url ? `<div class="entry-meta" style="font-size:0.75rem;">${escapeHtml(m.source_url)}</div>` : ''}
                  <div class="entry-meta">${formatDate(m.created_at)}</div>
                </div>
              </div>
            </div>
          `).join('')}
      </div>
    `;

    // Category filter buttons
    $$('#catFilters button', c).forEach(btn => {
      btn.addEventListener('click', async () => {
        this.filterCategory = btn.dataset.cat;
        await this.loadData();
        this.listView();
      });
    });

    // Search (debounced)
    let searchTimer;
    $('#kwSearch').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        this.searchTerm = e.target.value.trim();
        await this.loadData();
        this.listView();
      }, 400);
    });

    $('#addKwBtn').addEventListener('click', () => this.showModal());
    $('#importKwBtn').addEventListener('click', () => this.showImportModal());

    $$('.entry-card', c).forEach(el => {
      el.addEventListener('click', () => {
        const m = this.materials.find(x => x.id === parseInt(el.dataset.id));
        if (m) this.showModal(m);
      });
    });
  },

  showImportModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.zIndex = '350';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width:600px;">
        <h3>AI 导入链接</h3>
        <p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:12px;">
          粘贴参考链接，AI 会自动分析结构、提取金句、归纳要点，沉淀到知识库。<br>
          如果链接无法访问（如视频平台），请同时粘贴你复制的文案。
        </p>
        <div class="form-group"><label>链接</label><input id="impUrl" placeholder="粘贴视频/文章链接（可选）"></div>
        <div class="form-group"><label>文字内容（可选，链接无法抓取时使用）</label><textarea id="impText" rows="6" placeholder="如果链接打不开，手动粘贴你复制的文字内容到这里..."></textarea></div>
        <button class="btn btn-primary btn-block" id="doImportBtn">AI 解析并入库</button>
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
      if (!url && !text) return showToast('请至少输入链接或粘贴文字内容');
      const btn = modal.querySelector('#doImportBtn');
      btn.disabled = true; btn.textContent = 'AI 分析中...';
      try {
        const result = await API.post('/api/skincare/knowledge/import', { url, text });
        const r = modal.querySelector('#importResult');
        if (result.need_text) {
          r.innerHTML = `<p style="color:var(--yellow);font-size:0.85rem;">${escapeHtml(result.message)}</p>`;
        } else {
          r.innerHTML = `
            <div class="card" style="border-left:3px solid var(--green);">
              <h4 style="font-size:0.9rem;color:var(--green);">已导入知识库</h4>
              <p style="font-size:0.85rem;"><strong>标题：</strong>${escapeHtml(result.title||'')}</p>
              <p style="font-size:0.85rem;"><strong>分类：</strong>${escapeHtml(result.category||'')}</p>
              <p style="font-size:0.85rem;"><strong>标签：</strong>${escapeHtml(result.tags||'')}</p>
              ${result.hooks ? `<div style="margin-top:6px;font-size:0.85rem;"><strong>提取的钩子/金句：</strong><br>${escapeHtml(result.hooks)}</div>` : ''}
              ${result.structure ? `<div style="margin-top:4px;font-size:0.85rem;"><strong>内容结构：</strong>${escapeHtml(result.structure)}</div>` : ''}
              ${result.takeaways ? `<div style="margin-top:4px;font-size:0.85rem;"><strong>可学习点：</strong><br>${escapeHtml(result.takeaways)}</div>` : ''}
            </div>
          `;
        }
      } catch (e) { modal.querySelector('#importResult').innerHTML = `<p style="color:var(--red);font-size:0.85rem;">导入失败：${escapeHtml(e.message)}</p>`; }
      btn.disabled = false; btn.textContent = 'AI 解析并入库';
    });
  },

  async showModal(material) {
    const map = { '竞品分析': '#f44336', '行业知识': '#6c63ff', '用户反馈': '#4caf50', '爆款参考': '#ff9800', '话术灵感': '#03a9f4' };
    return map[cat] || '#888';
  },

  async showModal(material) {
    const isEdit = !!material;
    let products = [];
    try { products = await API.get('/api/skincare/products'); } catch {}
    const categories = ['竞品分析', '行业知识', '用户反馈', '爆款参考', '话术灵感', '其他'];

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.zIndex = '350';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width:640px;max-height:95vh;">
        <h3>${isEdit ? '编辑素材' : '添加知识素材'}</h3>
        <p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:10px;">
          把竞品脚本、行业知识、用户评论、参考视频文案等丢进来。AI 写脚本时会自动引用知识库中的内容。
        </p>
        <div class="form-group"><label>标题 *</label><input id="kwTitle" value="${isEdit ? escapeHtml(material.title) : ''}" placeholder="给素材起个名字，方便以后找"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group"><label>分类</label>
            <select id="kwCat">${categories.map(c => `<option value="${c}" ${isEdit && material.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </div>
          <div class="form-group"><label>关联产品（可选）</label>
            <select id="kwProd">
              <option value="">不关联</option>
              ${products.map(p => `<option value="${p.id}" ${isEdit && material.product_id === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group"><label>标签（逗号分隔，如：抗衰,精华,国货）</label><input id="kwTags" value="${isEdit ? escapeHtml(material.tags||'') : ''}" placeholder="抗衰,成分党,熬夜"></div>
        <div class="form-group"><label>内容 *</label><textarea id="kwContent" rows="10" placeholder="把素材内容粘贴到这里...&#10;&#10;比如：&#10;- 竞品爆款视频的逐字稿&#10;- 用户评论区高频问题&#10;- KOL的金句观点&#10;- 产品成分科学文献摘要&#10;- 你觉得好的开头钩子">${isEdit ? escapeHtml(material.content||'') : ''}</textarea></div>
        <div class="form-group"><label>来源链接（可选）</label><input id="kwUrl" value="${isEdit ? escapeHtml(material.source_url||'') : ''}" placeholder="参考视频/文章的URL"></div>
        <div class="btn-group">
          <button class="btn btn-primary" id="saveKwBtn">${isEdit ? '保存' : '添加到知识库'}</button>
          ${isEdit ? '<button class="btn btn-danger btn-sm" id="delKwBtn">删除</button>' : ''}
          <button class="btn btn-outline btn-sm close-modal">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    modal.querySelector('.close-modal').addEventListener('click', close);

    modal.querySelector('#saveKwBtn').addEventListener('click', async () => {
      const title = modal.querySelector('#kwTitle').value.trim();
      const content = modal.querySelector('#kwContent').value.trim();
      if (!title) return showToast('请输入标题');
      if (!content) return showToast('请输入内容');
      const data = {
        title,
        content,
        category: modal.querySelector('#kwCat').value,
        product_id: modal.querySelector('#kwProd').value ? parseInt(modal.querySelector('#kwProd').value) : null,
        tags: modal.querySelector('#kwTags').value,
        source_url: modal.querySelector('#kwUrl').value
      };
      try {
        if (isEdit) {
          await API.put(`/api/skincare/knowledge/${material.id}`, data);
        } else {
          await API.post('/api/skincare/knowledge', data);
        }
        close();
        await this.loadData();
        this.listView();
        showToast(isEdit ? '素材已更新' : '素材已添加到知识库，AI 写脚本时会自动引用');
      } catch (e) { showToast('保存失败: ' + e.message); }
    });

    if (isEdit) {
      modal.querySelector('#delKwBtn').addEventListener('click', async () => {
        if (!confirm('确定删除此素材吗？')) return;
        await API.del(`/api/skincare/knowledge/${material.id}`);
        close();
        await this.loadData();
        this.listView();
        showToast('已删除');
      });
    }
  }
};

const SkincareHotspotsPage = {
  hotspots: [],
  container: null,

  async render(container) {
    this.container = container;
    try { this.hotspots = await API.get('/api/skincare/hotspots'); } catch { this.hotspots = []; }
    this.listView();
  },

  listView() {
    const c = this.container;
    const savedCount = this.hotspots.filter(h => h.is_saved).length;
    c.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card accent"><div class="stat-num">${this.hotspots.length}</div><div class="stat-label">热点总数</div></div>
        <div class="stat-card green"><div class="stat-num">${savedCount}</div><div class="stat-label">已收藏</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" id="addHotspotBtn">+ 手动添加热点</button>
        <button class="btn btn-outline btn-sm" id="analyzeHotspotBtn">AI 分析热点</button>
        <button class="btn btn-outline btn-sm" id="importLinkBtn" style="background:var(--accent);color:#fff;border-color:var(--accent);">丢链接导入</button>
        <button class="btn btn-primary btn-sm" id="discoverBtn">AI 发现热点</button>
      </div>
      <div id="hotspotList">
        ${this.hotspots.length === 0
          ? '<div class="empty-state"><p>还没有热点素材</p><p style="font-size:0.8rem;">手动添加或让 AI 分析热点话题</p></div>'
          : this.hotspots.map(h => `
            <div class="card entry-card" data-id="${h.id}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div style="flex:1;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <span class="badge badge-${h.relevance_score >= 70 ? 'in_progress' : h.relevance_score >= 40 ? 'high' : 'medium'}">关联度 ${h.relevance_score || 0}</span>
                    <span class="badge badge-low">${escapeHtml(h.category || '未分类')}</span>
                    ${h.is_saved ? '<span class="badge badge-done">已收藏</span>' : ''}
                  </div>
                  <div class="entry-title">${escapeHtml(h.title)}</div>
                  ${h.summary ? `<div class="entry-meta">${escapeHtml(h.summary)}</div>` : ''}
                  ${h.analysis ? `<div class="entry-meta" style="color:var(--accent);">${escapeHtml(h.analysis)}</div>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
      </div>
    `;

    $('#addHotspotBtn').addEventListener('click', () => this.showAddModal());
    $('#analyzeHotspotBtn').addEventListener('click', () => this.showAnalyzeModal());
    $('#importLinkBtn').addEventListener('click', () => this.showImportModal());
    $('#discoverBtn').addEventListener('click', () => this.showDiscoverModal());

    $$('.entry-card', c).forEach(el => {
      el.addEventListener('click', () => {
        const h = this.hotspots.find(x => x.id === parseInt(el.dataset.id));
        if (h) this.showDetailModal(h);
      });
    });
  },

  showAddModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <h3>添加热点</h3>
        <div class="form-group"><label>热点标题 *</label><input id="htTitle" placeholder="如：#早C晚A翻车#"></div>
        <div class="form-group"><label>来源</label><input id="htSource" placeholder="如：抖音热搜、小红书"></div>
        <div class="form-group"><label>热度指数</label><input id="htHeat" type="number" placeholder="1-100"></div>
        <div class="form-group"><label>品类</label><input id="htCat" placeholder="如：抗衰、美白"></div>
        <div class="form-group"><label>概述</label><textarea id="htSummary" placeholder="这个热点讲了什么"></textarea></div>
        <div class="btn-group">
          <button class="btn btn-primary" id="saveHtBtn">保存</button>
          <button class="btn btn-outline btn-sm close-modal">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    modal.querySelector('.close-modal').addEventListener('click', close);
    modal.querySelector('#saveHtBtn').addEventListener('click', async () => {
      const data = {
        title: modal.querySelector('#htTitle').value,
        source: modal.querySelector('#htSource').value,
        heat_index: parseInt(modal.querySelector('#htHeat').value) || 0,
        category: modal.querySelector('#htCat').value,
        summary: modal.querySelector('#htSummary').value
      };
      if (!data.title) return showToast('请输入标题');
      try {
        await API.post('/api/skincare/hotspots', data);
        close();
        this.render(this.container);
        showToast('热点已添加');
      } catch (e) { showToast('添加失败: ' + e.message); }
    });
  },

  showImportModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.zIndex = '350';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width:600px;">
        <h3>丢链接导入</h3>
        <p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:12px;">
          粘贴参考视频/文章链接，AI 自动分析热点价值、提取关键信息，同时沉淀到知识库。<br>
          链接打不开的话，请手动粘贴你复制的文案到下方。
        </p>
        <div class="form-group"><label>链接</label><input id="impUrl" placeholder="如：短视频链接、公众号文章链接"></div>
        <div class="form-group"><label>文字内容（可选，链接无法抓取时粘贴）</label><textarea id="impText" rows="5" placeholder="粘贴视频文案/文章内容..."></textarea></div>
        <button class="btn btn-primary btn-block" id="doImportBtn">AI 解析</button>
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
      if (!url && !text) return showToast('请输入链接或粘贴内容');
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
              <h4 style="font-size:0.9rem;color:var(--green);">分析完成，已存入知识库</h4>
              <p style="font-size:0.85rem;"><strong>标题：</strong>${escapeHtml(result.title||'')}</p>
              <p style="font-size:0.85rem;"><strong>分类：</strong>${escapeHtml(result.category||'')}</p>
              ${result.hooks ? `<div style="margin-top:4px;font-size:0.85rem;"><strong>提取的钩子/金句：</strong><br>${escapeHtml(result.hooks)}</div>` : ''}
              ${result.structure ? `<div style="margin-top:4px;font-size:0.85rem;"><strong>内容结构：</strong>${escapeHtml(result.structure)}</div>` : ''}
              ${result.takeaways ? `<div style="margin-top:4px;font-size:0.85rem;"><strong>可学习点：</strong><br>${escapeHtml(result.takeaways)}</div>` : ''}
            </div>
          `;
          close();
          this.render(this.container);
          showToast('素材已导入知识库');
        }
      } catch (e) { modal.querySelector('#importResult').innerHTML = `<p style="color:var(--red);font-size:0.85rem;">${escapeHtml(e.message)}</p>`; }
      btn.disabled = false; btn.textContent = 'AI 解析';
    });
  },

  showDiscoverModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.zIndex = '350';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width:700px;max-height:95vh;overflow-y:auto;">
        <h3>AI 发现热点</h3>
        <p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:12px;">AI 基于当前护肤品市场趋势和你的产品线，推荐热门选题方向。点击下方开始。</p>
        <button class="btn btn-primary btn-block" id="startDiscoverBtn">开始分析</button>
        <div id="discoverResult" style="margin-top:12px;"></div>
        <button class="btn btn-outline btn-sm close-modal" style="margin-top:8px;">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    modal.querySelector('.close-modal').addEventListener('click', close);

    modal.querySelector('#startDiscoverBtn').addEventListener('click', async () => {
      const btn = modal.querySelector('#startDiscoverBtn');
      btn.disabled = true; btn.textContent = 'AI 分析中...';
      try {
        const result = await API.post('/api/skincare/hotspots/discover');
        const r = modal.querySelector('#discoverResult');
        r.innerHTML = `
          ${result.trend_summary ? `<div class="card" style="border-left:3px solid var(--accent);margin-bottom:12px;"><strong>趋势总结</strong><p style="font-size:0.85rem;margin-top:4px;">${escapeHtml(result.trend_summary)}</p></div>` : ''}
          ${(result.hotspots||[]).map((h, i) => `
            <div class="card" style="border-left:3px solid var(--green);margin-bottom:8px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;">${i+1}. ${escapeHtml(h.title)}</span>
                <button class="btn btn-sm btn-primary save-hotspot" data-index="${i}">收录</button>
              </div>
              <p style="font-size:0.82rem;color:var(--text-dim);margin-top:4px;">品类：${escapeHtml(h.category||'')} | 风格：${escapeHtml(h.content_style||'')}</p>
              <p style="font-size:0.82rem;margin-top:4px;">${escapeHtml(h.heat_reason||'')}</p>
              <p style="font-size:0.82rem;color:var(--accent);margin-top:2px;">关联：${escapeHtml(h.relevance||'')}</p>
              <p style="font-size:0.82rem;margin-top:2px;">切入角度：${escapeHtml(h.script_angle||'')}</p>
            </div>
          `).join('')}
        `;
        // Save hotspot buttons
        r.querySelectorAll('.save-hotspot').forEach(b => {
          b.addEventListener('click', async () => {
            const h = result.hotspots[parseInt(b.dataset.index)];
            await API.post('/api/skincare/hotspots', {
              title: h.title, category: h.category, summary: h.heat_reason,
              analysis: h.script_angle, heat_index: 70
            });
            b.textContent = '已收录'; b.disabled = true;
            showToast('热点已收录');
          });
        });
      } catch (e) { modal.querySelector('#discoverResult').innerHTML = `<p style="color:var(--red);">${escapeHtml(e.message)}</p>`; }
      btn.disabled = false; btn.textContent = '开始分析';
    });
  },

  showAnalyzeModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <h3>AI 热点分析</h3>
        <p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:12px;">粘贴热点标题或描述，AI 会分析热度原因、跟你的产品关联度、建议切入角度</p>
        <div class="form-group"><label>热点内容 *</label><textarea id="htContent" rows="3" placeholder="粘贴热搜标题、话题描述"></textarea></div>
        <div class="form-group"><label>品类</label><input id="htCat" placeholder="抗衰/美白/防晒..."></div>
        <button class="btn btn-primary btn-block" id="analyzeBtn">开始分析</button>
        <div id="analyzeResult" style="margin-top:14px;"></div>
        <div class="btn-group"><button class="btn btn-outline btn-sm close-modal">关闭</button></div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    modal.querySelector('.close-modal').addEventListener('click', close);

    modal.querySelector('#analyzeBtn').addEventListener('click', async () => {
      const title = modal.querySelector('#htContent').value.trim();
      if (!title) return showToast('请输入热点内容');
      const btn = modal.querySelector('#analyzeBtn');
      btn.disabled = true; btn.textContent = '分析中...';
      try {
        const result = await API.post('/api/skincare/hotspots/analyze', {
          title,
          category: modal.querySelector('#htCat').value
        });
        const r = modal.querySelector('#analyzeResult');
        r.innerHTML = `
          <div class="card" style="border-left:3px solid var(--accent);">
            <h4 style="font-size:0.9rem;color:var(--accent);">关联度：${result.relevance_score || 0}/100</h4>
            <p style="font-size:0.85rem;margin-top:6px;"><strong>概述：</strong>${escapeHtml(result.summary||'')}</p>
            ${result.analysis ? `<p style="font-size:0.85rem;margin-top:4px;"><strong>分析：</strong>${escapeHtml(result.analysis)}</p>` : ''}
            ${result.relevance_reason ? `<p style="font-size:0.85rem;margin-top:4px;"><strong>关联：</strong>${escapeHtml(result.relevance_reason)}</p>` : ''}
            ${result.script_angle ? `<p style="font-size:0.85rem;margin-top:4px;"><strong>切入角度：</strong>${escapeHtml(result.script_angle)}</p>` : ''}
          </div>
        `;
      } catch (e) { showToast('分析失败: ' + e.message); }
      btn.disabled = false; btn.textContent = '开始分析';
    });
  },

  showDetailModal(hotspot) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width:560px;">
        <h3>${escapeHtml(hotspot.title)}</h3>
        <div style="font-size:0.85rem;color:var(--text-dim);margin-bottom:8px;">
          ${escapeHtml(hotspot.category||'')} | 热度：${hotspot.heat_index||0} | 关联度：${hotspot.relevance_score||0}
        </div>
        <div class="form-group"><label>概述</label><textarea id="edSummary" rows="2">${escapeHtml(hotspot.summary||'')}</textarea></div>
        <div class="form-group"><label>分析</label><textarea id="edAnalysis" rows="2">${escapeHtml(hotspot.analysis||'')}</textarea></div>
        <div class="form-group"><label>品类</label><input id="edCat" value="${escapeHtml(hotspot.category||'')}"></div>
        <div class="btn-group">
          <button class="btn btn-primary btn-sm" id="saveHtBtn">保存</button>
          <button class="btn btn-sm ${hotspot.is_saved ? 'btn-outline' : 'btn-primary'}" id="toggleSaveBtn">${hotspot.is_saved ? '取消收藏' : '收藏'}</button>
          <button class="btn btn-danger btn-sm" id="delHtBtn">删除</button>
          <button class="btn btn-outline btn-sm close-modal">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    modal.querySelector('.close-modal').addEventListener('click', close);

    modal.querySelector('#saveHtBtn').addEventListener('click', async () => {
      await API.put(`/api/skincare/hotspots/${hotspot.id}`, {
        summary: modal.querySelector('#edSummary').value,
        analysis: modal.querySelector('#edAnalysis').value,
        category: modal.querySelector('#edCat').value
      });
      close();
      this.render(this.container);
      showToast('已保存');
    });

    modal.querySelector('#toggleSaveBtn').addEventListener('click', async () => {
      const newVal = hotspot.is_saved ? 0 : 1;
      await API.put(`/api/skincare/hotspots/${hotspot.id}`, { is_saved: newVal });
      close();
      this.render(this.container);
      showToast(newVal ? '已收藏' : '已取消收藏');
    });

    modal.querySelector('#delHtBtn').addEventListener('click', async () => {
      if (!confirm('确定删除吗？')) return;
      await API.del(`/api/skincare/hotspots/${hotspot.id}`);
      close();
      this.render(this.container);
      showToast('已删除');
    });
  }
};

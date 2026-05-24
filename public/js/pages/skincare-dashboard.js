const SkincareDashboardPage = {
  currentTab: 'overview',

  async render(container) {
    this.container = container;
    const tab = location.hash.split('?')[1] || '';
    if (tab === 'tab=products') this.currentTab = 'products';
    else if (tab === 'tab=hotspots') this.currentTab = 'hotspots';
    else if (tab === 'tab=scripts') this.currentTab = 'scripts';
    else if (tab === 'tab=videos') this.currentTab = 'videos';
    else if (tab === 'tab=analytics') this.currentTab = 'analytics';
    else if (tab === 'tab=templates') this.currentTab = 'templates';
    else if (tab === 'tab=knowledge') this.currentTab = 'knowledge';

    this.renderTabs();
    await this.renderContent();
  },

  renderTabs() {
    const tabs = [
      { id: 'overview', label: '总览' },
      { id: 'products', label: '产品库' },
      { id: 'templates', label: '模板' },
      { id: 'knowledge', label: '知识库' },
      { id: 'hotspots', label: '热点台' },
      { id: 'scripts', label: '脚本工坊' },
      { id: 'videos', label: '视频中心' },
      { id: 'analytics', label: '数据复盘' }
    ];
    const main = this.container;
    main.innerHTML = `
      <div class="filters-bar" style="justify-content:center;margin-bottom:16px;" id="skTabBar">
        ${tabs.map(t => `
          <button class="btn btn-sm ${this.currentTab === t.id ? 'btn-primary' : 'btn-outline'}" data-tab="${t.id}">${t.label}</button>
        `).join('')}
      </div>
      <div id="skTabContent"></div>
    `;
    $$('#skTabBar button', main).forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTab = btn.dataset.tab;
        this.render(this.container);
      });
    });
  },

  async renderContent() {
    const content = $('#skTabContent');
    content.innerHTML = '<p style="text-align:center;color:var(--text-dim);padding:30px;">加载中...</p>';

    try {
      switch (this.currentTab) {
        case 'overview': await this.renderOverview(content); break;
        case 'products': await SkincareProductsPage.render(content); break;
        case 'templates': await this.renderTemplatesView(content); break;
        case 'knowledge': await SkincareKnowledgePage.render(content); break;
        case 'hotspots': await SkincareHotspotsPage.render(content); break;
        case 'scripts': await SkincareScriptsPage.render(content); break;
        case 'videos': await SkincareVideosPage.render(content); break;
        case 'analytics': await SkincareAnalyticsPage.render(content); break;
      }
    } catch (e) {
      content.innerHTML = `<p style="color:var(--red);">加载失败: ${escapeHtml(e.message)}</p>`;
    }
  },

  async renderOverview(container) {
    try {
      const d = await API.get('/api/skincare/dashboard');
      container.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card accent" style="cursor:pointer;" data-nav="products"><div class="stat-num">${d.product_count}</div><div class="stat-label">产品</div></div>
          <div class="stat-card yellow" style="cursor:pointer;" data-nav="hotspots"><div class="stat-num">${d.hotspot_count}</div><div class="stat-label">热点素材</div></div>
          <div class="stat-card" style="cursor:pointer;" data-nav="scripts"><div class="stat-num">${d.script_count}</div><div class="stat-label">脚本（${d.draft_count}草稿）</div></div>
          <div class="stat-card green" style="cursor:pointer;" data-nav="videos"><div class="stat-num">${d.video_count}</div><div class="stat-label">视频</div></div>
        </div>

        <button class="btn btn-primary btn-block" id="quickScriptBtn">⚡ 快速生成脚本</button>

        ${d.recent_scripts && d.recent_scripts.length > 0 ? `
        <div class="card" style="margin-top:14px;">
          <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-dim);">最近脚本</h3>
          ${d.recent_scripts.map(s => `
            <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.85rem;display:flex;justify-content:space-between;">
              <span>${escapeHtml(s.title)}</span>
              <span class="badge badge-${s.status === 'final' ? 'done' : 'in_progress'}">${s.status === 'final' ? '定稿' : '草稿'}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${d.recent_hotspots && d.recent_hotspots.length > 0 ? `
        <div class="card">
          <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-dim);">最新热点</h3>
          ${d.recent_hotspots.map(h => `
            <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.85rem;">
              <span>${escapeHtml(h.title)}</span>
              <span class="badge badge-low" style="float:right;">关联度 ${h.relevance_score||0}</span>
            </div>
          `).join('')}
        </div>
        ` : '<div class="empty-state"><p style="margin-top:20px;">开始你的第一条视频脚本创作</p><p style="font-size:0.8rem;">1. 先去「产品库」录入产品 → 2. 去「热点台」找灵感 → 3. 来「脚本工坊」生成脚本</p></div>'}

        <div class="card" style="margin-top:14px;">
          <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-dim);">快速入口</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85rem;">
            <button class="btn btn-outline btn-sm" data-nav="products">管理产品</button>
            <button class="btn btn-outline btn-sm" data-nav="knowledge">知识库</button>
            <button class="btn btn-outline btn-sm" data-nav="hotspots">收集热点</button>
            <button class="btn btn-outline btn-sm" data-nav="scripts">写脚本</button>
            <button class="btn btn-outline btn-sm" data-nav="videos">记录视频</button>
            <button class="btn btn-outline btn-sm" data-nav="templates">脚本模板</button>
            <button class="btn btn-outline btn-sm" data-nav="analytics">查看数据</button>
          </div>
        </div>

        <div class="card" style="border-left:3px solid var(--accent);">
          <h3 style="font-size:0.9rem;margin-bottom:4px;">数据备份</h3>
          <p style="font-size:0.76rem;color:var(--text-dim);margin-bottom:8px;">每日 20:00 自动备份。部署前请先下载备份，部署后上传恢复。</p>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-sm btn-primary" id="downloadBackupBtn">下载备份</button>
            <button class="btn btn-sm btn-outline" id="restoreBackupBtn">上传恢复</button>
            <input type="file" id="restoreFileInput" accept=".json" style="display:none;">
          </div>
          <div id="restoreResult" style="margin-top:8px;"></div>
        </div>
      `;

      // Backup handlers
      const downloadBtn = $('#downloadBackupBtn');
      const restoreBtn = $('#restoreBackupBtn');
      const fileInput = $('#restoreFileInput');

      downloadBtn.addEventListener('click', async () => {
        try {
          const data = await API.get('/api/skincare/backup/export');
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'skincare-backup-' + new Date().toISOString().slice(0,10) + '.json';
          a.click();
          URL.revokeObjectURL(url);
          showToast('备份已下载');
        } catch (e) { showToast('下载失败: ' + e.message); }
      });

      restoreBtn.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          const result = await API.post('/api/skincare/backup/import', data);
          const r = $('#restoreResult');
          r.innerHTML = `<p style="color:var(--green);font-size:0.82rem;">恢复成功：${result.counts.products}产品, ${result.counts.scripts}脚本, ${result.counts.videos}视频</p>`;
          showToast('数据已恢复');
          this.render(this.container);
        } catch (e) {
          $('#restoreResult').innerHTML = `<p style="color:var(--red);font-size:0.82rem;">恢复失败：${escapeHtml(e.message)}</p>`;
        }
        fileInput.value = '';
      });

      // Navigation handlers
      container.querySelectorAll('[data-nav]').forEach(el => {
        el.addEventListener('click', () => {
          this.currentTab = el.dataset.nav;
          this.render(this.container);
        });
      });

      const quickBtn = $('#quickScriptBtn');
      if (quickBtn) {
        quickBtn.addEventListener('click', () => {
          this.currentTab = 'scripts';
          this.render(this.container);
          setTimeout(() => {
            const btn = document.getElementById('newScriptBtn');
            if (btn) btn.click();
          }, 300);
        });
      }
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red);">加载失败: ${escapeHtml(e.message)}</p>`;
    }
  },

  // Inline templates management
  templates: [],
  async renderTemplatesView(container) {
    try { this.templates = await API.get('/api/skincare/templates'); } catch { this.templates = []; }
    const styleLabels = { '痛点型': '痛点型', '成分科普型': '成分科普型', '对比评测型': '对比评测型', '场景种草型': '场景种草型' };

    container.innerHTML = `
      <button class="btn btn-primary btn-block" id="addTplBtn">+ 添加模板</button>
      <p style="font-size:0.78rem;color:var(--text-dim);text-align:center;margin-top:4px;">模板定义了脚本结构，AI 生成时可选参考</p>
      <div style="margin-top:14px;">
        ${this.templates.length === 0
          ? '<div class="empty-state"><p>暂无模板，添加模板可以让 AI 生成更符合你风格的脚本</p></div>'
          : this.templates.map(t => `
            <div class="card entry-card" data-id="${t.id}">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div style="flex:1;">
                  <div class="entry-title">${escapeHtml(t.name)}</div>
                  <div class="entry-meta">${escapeHtml(t.content_style)} | ${escapeHtml(t.platform)}</div>
                  <div class="entry-meta" style="font-size:0.78rem;">钩子：${escapeHtml((t.hook_template||'').slice(0,50))}${(t.hook_template||'').length > 50 ? '...' : ''}</div>
                </div>
              </div>
            </div>
          `).join('')}
      </div>
    `;

    $('#addTplBtn').addEventListener('click', () => this.showTplModal());

    $$('.entry-card', container).forEach(el => {
      el.addEventListener('click', () => {
        const t = this.templates.find(x => x.id === parseInt(el.dataset.id));
        if (t) this.showTplModal(t);
      });
    });
  },

  showTplModal(tpl) {
    const isEdit = !!tpl;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width:560px;">
        <h3>${isEdit ? '编辑模板' : '添加模板'}</h3>
        <div class="form-group"><label>模板名称 *</label><input id="tplName" value="${isEdit ? escapeHtml(tpl.name) : ''}" placeholder="如：抗衰精华痛点口播"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div class="form-group"><label>内容风格</label>
            <select id="tplStyle">
              <option value="痛点型" ${isEdit && tpl.content_style === '痛点型' ? 'selected' : ''}>痛点型</option>
              <option value="成分科普型" ${isEdit && tpl.content_style === '成分科普型' ? 'selected' : ''}>成分科普型</option>
              <option value="对比评测型" ${isEdit && tpl.content_style === '对比评测型' ? 'selected' : ''}>对比评测型</option>
              <option value="场景种草型" ${isEdit && tpl.content_style === '场景种草型' ? 'selected' : ''}>场景种草型</option>
            </select>
          </div>
          <div class="form-group"><label>适配平台</label>
            <select id="tplPlat">
              <option value="通用" ${isEdit && tpl.platform === '通用' ? 'selected' : ''}>通用</option>
              <option value="视频号" ${isEdit && tpl.platform === '视频号' ? 'selected' : ''}>视频号</option>
              <option value="抖音" ${isEdit && tpl.platform === '抖音' ? 'selected' : ''}>抖音</option>
            </select>
          </div>
        </div>
        <div class="form-group"><label>开头钩子模板</label><textarea id="tplHook" rows="2" placeholder="如：你有没有发现，[痛点描述]？其实不是[常见误解]，而是[真相]...">${isEdit ? escapeHtml(tpl.hook_template||'') : ''}</textarea></div>
        <div class="form-group"><label>中间内容模板</label><textarea id="tplBody" rows="3" placeholder="如：[产品名称]核心成分是[成分]，它[功效原理]。跟市面上其他产品不一样的是[差异化卖点]...">${isEdit ? escapeHtml(tpl.body_template||'') : ''}</textarea></div>
        <div class="form-group"><label>结尾CTA模板</label><textarea id="tplCta" rows="2" placeholder="如：[限时优惠/戳下方链接/点个关注]，[产品名称]帮你[解决什么问题]...">${isEdit ? escapeHtml(tpl.cta_template||'') : ''}</textarea></div>
        <div class="btn-group">
          <button class="btn btn-primary" id="saveTplBtn">${isEdit ? '保存' : '添加'}</button>
          ${isEdit ? '<button class="btn btn-danger btn-sm" id="delTplBtn">删除</button>' : ''}
          <button class="btn btn-outline btn-sm close-modal">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    modal.querySelector('.close-modal').addEventListener('click', close);

    modal.querySelector('#saveTplBtn').addEventListener('click', async () => {
      const data = {
        name: modal.querySelector('#tplName').value,
        content_style: modal.querySelector('#tplStyle').value,
        platform: modal.querySelector('#tplPlat').value,
        hook_template: modal.querySelector('#tplHook').value,
        body_template: modal.querySelector('#tplBody').value,
        cta_template: modal.querySelector('#tplCta').value
      };
      if (!data.name) return showToast('请输入模板名称');
      try {
        if (isEdit) { await API.put(`/api/skincare/templates/${tpl.id}`, data); }
        else { await API.post('/api/skincare/templates', data); }
        close();
        const content = this.container.querySelector('#skTabContent');
        if (content) this.renderTemplatesView(content);
        showToast(isEdit ? '已更新' : '已添加');
      } catch (e) { showToast('保存失败: ' + e.message); }
    });

    if (isEdit) {
      modal.querySelector('#delTplBtn').addEventListener('click', async () => {
        if (!confirm('确定删除吗？')) return;
        await API.del(`/api/skincare/templates/${tpl.id}`);
        close();
        const content = this.container.querySelector('#skTabContent');
        if (content) this.renderTemplatesView(content);
        showToast('已删除');
      });
    }
  }
};

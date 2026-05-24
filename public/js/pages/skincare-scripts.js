const SkincareScriptsPage = {
  scripts: [],
  products: [],
  hotspots: [],
  templates: [],
  container: null,

  async render(container) {
    this.container = container;
    try {
      [this.scripts, this.products, this.hotspots, this.templates] = await Promise.all([
        API.get('/api/skincare/scripts'),
        API.get('/api/skincare/products'),
        API.get('/api/skincare/hotspots'),
        API.get('/api/skincare/templates')
      ]);
    } catch {
      this.scripts = []; this.products = []; this.hotspots = []; this.templates = [];
    }
    this.listView();
  },

  listView() {
    const c = this.container;
    const draftCount = this.scripts.filter(s => s.status === 'draft').length;
    const finalCount = this.scripts.filter(s => s.status === 'final').length;

    c.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card accent"><div class="stat-num">${this.scripts.length}</div><div class="stat-label">总脚本</div></div>
        <div class="stat-card yellow"><div class="stat-num">${draftCount}</div><div class="stat-label">草稿</div></div>
        <div class="stat-card green"><div class="stat-num">${finalCount}</div><div class="stat-label">已定稿</div></div>
      </div>
      <button class="btn btn-primary btn-block" id="newScriptBtn" ${this.products.length === 0 ? 'disabled' : ''}>
        ${this.products.length === 0 ? '请先添加产品' : '+ 生成新脚本'}
      </button>
      ${this.products.length === 0 ? '<p style="font-size:0.8rem;color:var(--text-dim);text-align:center;margin-top:4px;">需要先到「产品库」添加产品，AI 才能结合产品写脚本</p>' : ''}

      <div id="scriptList" style="margin-top:14px;">
        ${this.scripts.length === 0
          ? '<div class="empty-state"><p>暂无脚本，点击上方按钮开始创作</p></div>'
          : this.scripts.map(s => `
            <div class="card entry-card" data-id="${s.id}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">
                    <span class="badge badge-${s.status === 'final' ? 'done' : 'in_progress'}">${s.status === 'final' ? '已定稿' : '草稿'}</span>
                    <span class="badge badge-medium">${escapeHtml(s.script_type||'')}</span>
                    <span class="badge badge-low">${escapeHtml(s.content_style||'')}</span>
                    <span class="badge badge-low">${s.duration_sec || 30}s</span>
                    <span class="badge badge-low">${escapeHtml(s.platform||'视频号')}</span>
                  </div>
                  <div class="entry-title">${escapeHtml(s.title)}</div>
                  ${s.product_name ? `<div class="entry-meta">产品：${escapeHtml(s.product_name)}</div>` : ''}
                  ${s.hotspot_title ? `<div class="entry-meta">热点：${escapeHtml(s.hotspot_title)}</div>` : ''}
                  <div class="entry-meta">${formatDate(s.updated_at)}</div>
                </div>
              </div>
            </div>
          `).join('')}
      </div>
    `;

    $('#newScriptBtn').addEventListener('click', () => this.showGenerateForm());

    $$('.entry-card', c).forEach(el => {
      el.addEventListener('click', () => {
        const s = this.scripts.find(x => x.id === parseInt(el.dataset.id));
        if (s) this.showScriptEditor(s);
      });
    });
  },

  async showGenerateForm() {
    // Reload latest data
    try {
      const [hotspots, templates] = await Promise.all([
        API.get('/api/skincare/hotspots'),
        API.get('/api/skincare/templates')
      ]);
      this.hotspots = hotspots;
      this.templates = templates;
    } catch {}

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width:520px;">
        <h3>生成新脚本</h3>
        <div class="form-group">
          <label>关联产品 *</label>
          <select id="genProduct">
            ${this.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>选择卖点（可选，不选则全部使用）</label>
          <div id="talkingPointCheckboxes" style="max-height:120px;overflow-y:auto;font-size:0.82rem;padding:4px 0;">
            <span style="color:var(--text-dim);">选择产品后自动加载卖点...</span>
          </div>
        </div>

        <div class="form-group">
          <label>关联热点（可选）</label>
          <select id="genHotspot">
            <option value="">不使用热点</option>
            ${this.hotspots.map(h => `<option value="${h.id}">${escapeHtml(h.title)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>参考模板（可选）</label>
          <select id="genTemplate">
            <option value="">不使用模板</option>
            ${this.templates.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group"><label>脚本类型</label>
            <select id="genType">
              <option value="口播脚本">口播脚本</option>
              <option value="分镜脚本">分镜脚本</option>
              <option value="字幕配音脚本">字幕配音脚本</option>
            </select>
          </div>
          <div class="form-group"><label>内容风格</label>
            <select id="genStyle">
              <option value="痛点型">痛点型</option>
              <option value="成分科普型">成分科普型</option>
              <option value="对比评测型">对比评测型</option>
              <option value="场景种草型">场景种草型</option>
              <option value="悬念反转型">悬念反转型</option>
              <option value="教程教学型">教程教学型</option>
              <option value="创始人IP型">创始人IP型</option>
              <option value="素人实测型">素人实测型</option>
              <option value="情绪疗愈型">情绪疗愈型</option>
              <option value="数据说服型">数据说服型</option>
            </select>
          </div>
          <div class="form-group"><label>时长</label>
            <select id="genDur">
              <option value="15">15秒</option>
              <option value="30" selected>30秒</option>
              <option value="60">60秒</option>
              <option value="90">90秒</option>
            </select>
          </div>
          <div class="form-group"><label>大概字数</label>
            <select id="genWords">
              <option value="100">约100字</option>
              <option value="200" selected>约200字</option>
              <option value="300">约300字</option>
              <option value="500">约500字</option>
            </select>
          </div>
          <div class="form-group"><label>平台</label>
            <select id="genPlat">
              <option value="视频号" selected>视频号（慢节奏）</option>
              <option value="抖音">抖音（快节奏）</option>
              <option value="小红书">小红书</option>
              <option value="通用">通用</option>
            </select>
          </div>
        </div>
        <div class="form-group"><label>主题方向（可选）</label><input id="genTheme" placeholder="如：抗衰越早越好、成分党如何选精华、熬夜后急救步骤"></div>
        <div class="form-group"><label>自定义要求（可选）</label><textarea id="genNotes" rows="2" placeholder="如：开头要制造焦虑感、中间多讲成分原理、结尾加限时优惠、不要提竞品名称..."></textarea></div>
        <button class="btn btn-primary btn-block" id="genScriptBtn">AI 生成脚本</button>
        <p style="font-size:0.78rem;color:var(--text-dim);text-align:center;margin-top:6px;">生成约需 5-15 秒</p>
        <div id="genResult" style="margin-top:12px;"></div>
        <button class="btn btn-outline btn-sm close-modal" style="margin-top:8px;">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    modal.querySelector('.close-modal').addEventListener('click', close);

    // Load talking points when product changes
    const tpContainer = modal.querySelector('#talkingPointCheckboxes');
    modal.querySelector('#genProduct').addEventListener('change', async () => {
      const pid = modal.querySelector('#genProduct').value;
      if (!pid) { tpContainer.innerHTML = '<span style="color:var(--text-dim);">请先选择产品</span>'; return; }
      try {
        const data = await API.get(`/api/skincare/products/${pid}`);
        const points = data.talking_points || [];
        if (points.length === 0) {
          tpContainer.innerHTML = '<span style="color:var(--text-dim);">该产品暂无卖点话术</span>';
        } else {
          tpContainer.innerHTML = points.map(tp => `
            <label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;">
              <input type="checkbox" class="tp-checkbox" value="${tp.id}" checked style="accent-color:var(--accent);">
              <span>${escapeHtml(tp.content)}</span>
              <span style="color:var(--text-dim);font-size:0.72rem;">[${escapeHtml(tp.point_type)}]</span>
            </label>
          `).join('');
        }
      } catch { tpContainer.innerHTML = '<span style="color:var(--text-dim);">加载失败</span>'; }
    });
    // Trigger initial load
    modal.querySelector('#genProduct').dispatchEvent(new Event('change'));

    modal.querySelector('#genScriptBtn').addEventListener('click', async () => {
      const btn = modal.querySelector('#genScriptBtn');
      btn.disabled = true; btn.textContent = '生成中...';
      try {
        const data = {
          product_id: parseInt(modal.querySelector('#genProduct').value),
          hot_topic_id: modal.querySelector('#genHotspot').value ? parseInt(modal.querySelector('#genHotspot').value) : null,
          template_id: modal.querySelector('#genTemplate').value ? parseInt(modal.querySelector('#genTemplate').value) : null,
          script_type: modal.querySelector('#genType').value,
          content_style: modal.querySelector('#genStyle').value,
          duration_sec: parseInt(modal.querySelector('#genDur').value),
          word_count: parseInt(modal.querySelector('#genWords').value),
          platform: modal.querySelector('#genPlat').value,
          theme_direction: modal.querySelector('#genTheme').value,
          custom_notes: modal.querySelector('#genNotes').value,
          selected_point_ids: Array.from(modal.querySelectorAll('.tp-checkbox:checked')).map(cb => parseInt(cb.value))
        };
        const script = await API.post('/api/skincare/scripts/generate', data);
        const r = modal.querySelector('#genResult');
        r.innerHTML = `
          <div class="card" style="border-left:3px solid var(--green);">
            <h4 style="font-size:0.85rem;color:var(--green);">生成成功！</h4>
            <div class="summary-output" style="max-height:200px;margin-top:8px;">${escapeHtml(script.content)}</div>
          </div>
        `;
        close();
        this.render(this.container);
        // Auto-open editor
        setTimeout(() => {
          const s = this.scripts.find(x => x.id === script.id);
          if (s) this.showScriptEditor(s);
        }, 200);
      } catch (e) {
        modal.querySelector('#genResult').innerHTML = `<p style="color:var(--red);font-size:0.85rem;">生成失败：${escapeHtml(e.message)}</p>`;
      }
      btn.disabled = false; btn.textContent = 'AI 生成脚本';
    });
  },

  async showScriptEditor(script) {
    const fullScript = await API.get(`/api/skincare/scripts/${script.id}`);
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.zIndex = '350';
    const stb = fullScript.storyboard ? (() => { try { return JSON.parse(fullScript.storyboard); } catch { return null; } })() : null;

    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width:700px;max-height:95vh;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div>
            <span class="badge badge-${fullScript.status === 'final' ? 'done' : 'in_progress'}">${fullScript.status === 'final' ? '已定稿' : '草稿'}</span>
            <span class="badge badge-medium">${escapeHtml(fullScript.script_type)}</span>
            <span class="badge badge-low">${escapeHtml(fullScript.content_style)} | ${fullScript.duration_sec}s | ${escapeHtml(fullScript.platform)}</span>
          </div>
        </div>

        <div class="form-group"><label>脚本标题</label><input id="edTitle" value="${escapeHtml(fullScript.title)}"></div>

        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          <button class="btn btn-sm btn-primary" id="saveScriptBtn">保存</button>
          <button class="btn btn-sm btn-outline" id="reviseScriptBtn">AI 修改</button>
          <button class="btn btn-sm btn-outline" id="storyboardBtn">${stb ? '重新生成分镜' : '生成拍摄指导'}</button>
          <button class="btn btn-sm btn-outline" id="titlesBtn">生成标题</button>
          <button class="btn btn-sm ${fullScript.status === 'final' ? 'btn-outline' : 'btn-primary'}" id="toggleStatusBtn">${fullScript.status === 'final' ? '改为草稿' : '标记定稿'}</button>
          <button class="btn btn-sm btn-danger" id="delScriptBtn">删除</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div>
            <label style="font-size:0.8rem;color:var(--text-dim);">脚本内容</label>
            <textarea id="edContent" rows="16" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-size:0.85rem;font-family:inherit;resize:vertical;margin-top:4px;">${escapeHtml(fullScript.content)}</textarea>
          </div>
          <div>
            <label style="font-size:0.8rem;color:var(--text-dim);">${stb ? '分镜/拍摄指导' : '拍摄指导（点击上方按钮生成）'}</label>
            ${stb ? `
              <div style="font-size:0.82rem;margin-top:4px;max-height:340px;overflow-y:auto;background:var(--surface2);border-radius:8px;padding:10px;">
                ${stb.storyboard ? `
                  <table style="width:100%;font-size:0.78rem;border-collapse:collapse;">
                    <tr style="color:var(--text-dim);"><th style="padding:4px;text-align:left;">镜号</th><th>时长</th><th>画面</th><th>运镜</th></tr>
                    ${stb.storyboard.map(s => `
                      <tr><td style="padding:4px;">${s.镜号}</td><td>${s.时长秒}s</td><td>${escapeHtml(s.画面内容||'')}</td><td>${escapeHtml(s.运镜方式||'')}</td></tr>
                      ${s.备注 ? `<tr><td colspan="4" style="padding:2px 4px;color:var(--text-dim);font-size:0.72rem;">备注：${escapeHtml(s.备注)}</td></tr>` : ''}
                    `).join('')}
                  </table>
                ` : ''}
                ${stb.checklist ? `<p style="margin-top:8px;font-weight:600;">拍摄 CheckList</p><ul style="padding-left:16px;">${Object.entries(stb.checklist).map(([k,v]) => `<li>${k}：${v}</li>`).join('')}</ul>` : ''}
                ${stb.editing ? `<p style="margin-top:6px;font-weight:600;">剪辑建议</p><p style="font-size:0.78rem;">${Object.entries(stb.editing).map(([k,v]) => `${k}：${v}`).join('<br>')}</p>` : ''}
              </div>
            ` : '<p style="font-size:0.8rem;color:var(--text-dim);margin-top:8px;">点击「生成拍摄指导」，AI 会根据脚本自动拆解分镜表、拍摄checklist和剪辑建议</p>'}
          </div>
        </div>

        <div id="revisePanel" class="hidden" style="display:flex;gap:8px;margin-bottom:8px;">
          <input id="reviseInst" placeholder="输入修改指令，如：把第三句改得更口语化" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-size:0.85rem;">
          <button class="btn btn-sm btn-primary" id="doReviseBtn">执行</button>
          <button class="btn btn-sm btn-outline" id="cancelReviseBtn">取消</button>
        </div>

        <div id="titlesResult" style="margin-top:8px;"></div>

        <button class="btn btn-outline btn-sm close-modal" style="margin-top:8px;">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => { modal.remove(); this.render(this.container); };
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    modal.querySelector('.close-modal').addEventListener('click', close);

    modal.querySelector('#saveScriptBtn').addEventListener('click', async () => {
      await API.put(`/api/skincare/scripts/${script.id}`, {
        title: modal.querySelector('#edTitle').value,
        content: modal.querySelector('#edContent').value
      });
      showToast('已保存');
    });

    modal.querySelector('#reviseScriptBtn').addEventListener('click', () => {
      modal.querySelector('#revisePanel').style.display = 'flex';
    });
    modal.querySelector('#cancelReviseBtn').addEventListener('click', () => {
      modal.querySelector('#revisePanel').style.display = 'none';
    });
    modal.querySelector('#doReviseBtn').addEventListener('click', async () => {
      const inst = modal.querySelector('#reviseInst').value.trim();
      if (!inst) return showToast('请输入修改指令');
      modal.querySelector('#doReviseBtn').disabled = true;
      try {
        const updated = await API.post(`/api/skincare/scripts/${script.id}/revise`, { instruction: inst });
        modal.querySelector('#edContent').value = updated.content;
        modal.querySelector('#revisePanel').style.display = 'none';
        showToast('AI 已修改脚本');
      } catch (e) { showToast('修改失败: ' + e.message); }
      modal.querySelector('#doReviseBtn').disabled = false;
    });

    modal.querySelector('#storyboardBtn').addEventListener('click', async () => {
      modal.querySelector('#storyboardBtn').disabled = true;
      modal.querySelector('#storyboardBtn').textContent = '生成中...';
      try {
        await API.post(`/api/skincare/scripts/${script.id}/storyboard`);
        showToast('拍摄指导已生成');
        modal.remove();
        const updated = await API.get(`/api/skincare/scripts/${script.id}`);
        this.showScriptEditor(updated);
      } catch (e) { showToast('生成失败: ' + e.message); }
      modal.querySelector('#storyboardBtn').disabled = false;
      modal.querySelector('#storyboardBtn').textContent = '生成拍摄指导';
    });

    modal.querySelector('#titlesBtn').addEventListener('click', async () => {
      modal.querySelector('#titlesBtn').disabled = true;
      try {
        const result = await API.post(`/api/skincare/scripts/${script.id}/titles`);
        const r = modal.querySelector('#titlesResult');
        r.innerHTML = `
          <div class="card" style="border-left:3px solid var(--accent);">
            <h4 style="font-size:0.85rem;">推荐标题</h4>
            ${result.titles.map(t => `
              <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.85rem;">
                <span style="flex:1;">${escapeHtml(t)}</span>
                <button class="btn btn-sm btn-outline copy-title-btn" data-text="${escapeHtml(t)}">复制</button>
              </div>
            `).join('')}
          </div>
        `;
        r.querySelectorAll('.copy-title-btn').forEach(btn => {
          btn.addEventListener('click', () => copyToClipboard(btn.dataset.text));
        });
      } catch (e) { showToast('生成失败: ' + e.message); }
      modal.querySelector('#titlesBtn').disabled = false;
    });

    modal.querySelector('#toggleStatusBtn').addEventListener('click', async () => {
      const newStatus = fullScript.status === 'final' ? 'draft' : 'final';
      await API.put(`/api/skincare/scripts/${script.id}`, { status: newStatus });
      showToast(newStatus === 'final' ? '已定稿' : '已改为草稿');
      modal.remove();
      const updated = await API.get(`/api/skincare/scripts/${script.id}`);
      this.showScriptEditor(updated);
    });

    modal.querySelector('#delScriptBtn').addEventListener('click', async () => {
      if (!confirm('确定删除此脚本吗？')) return;
      await API.del(`/api/skincare/scripts/${script.id}`);
      close();
      showToast('已删除');
    });
  }
};

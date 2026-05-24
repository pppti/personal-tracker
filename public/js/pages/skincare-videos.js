const SkincareVideosPage = {
  videos: [],
  container: null,

  async render(container) {
    this.container = container;
    try { this.videos = await API.get('/api/skincare/videos'); } catch { this.videos = []; }
    this.listView();
  },

  listView() {
    const c = this.container;
    const totalViews = this.videos.reduce((s, v) => s + (v.views || 0), 0);
    const totalLikes = this.videos.reduce((s, v) => s + (v.likes || 0), 0);

    c.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card accent"><div class="stat-num">${this.videos.length}</div><div class="stat-label">视频数</div></div>
        <div class="stat-card green"><div class="stat-num">${totalViews.toLocaleString()}</div><div class="stat-label">总播放量</div></div>
        <div class="stat-card yellow"><div class="stat-num">${totalLikes.toLocaleString()}</div><div class="stat-label">总点赞</div></div>
      </div>
      <button class="btn btn-primary btn-block" id="addVideoBtn">+ 记录发布视频</button>
      <div id="videoList" style="margin-top:14px;">
        ${this.videos.length === 0
          ? '<div class="empty-state"><p>暂未记录视频</p><p style="font-size:0.8rem;">发布视频后在这里记录，追踪播放和转化数据</p></div>'
          : this.videos.map(v => `
            <div class="card entry-card" data-id="${v.id}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div style="flex:1;min-width:0;">
                  <div class="entry-title">${escapeHtml(v.title)}</div>
                  ${v.script_title ? `<div class="entry-meta">脚本：${escapeHtml(v.script_title)}</div>` : ''}
                  <div class="entry-meta">${escapeHtml(v.platform||'视频号')} | ${v.publish_date ? formatDate(v.publish_date) : '未设置发布日期'}</div>
                  <div class="entry-meta">播放 ${(v.views||0).toLocaleString()} | 赞 ${(v.likes||0).toLocaleString()} | 评 ${(v.comments||0).toLocaleString()} | 分享 ${(v.shares||0).toLocaleString()}</div>
                  ${v.tags ? `<div class="entry-meta">标签：${escapeHtml(v.tags)}</div>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
      </div>
    `;

    $('#addVideoBtn').addEventListener('click', () => this.showModal());
    $$('.entry-card', c).forEach(el => {
      el.addEventListener('click', () => {
        const v = this.videos.find(x => x.id === parseInt(el.dataset.id));
        if (v) this.showModal(v);
      });
    });
  },

  async showModal(video) {
    const isEdit = !!video;
    let scripts = [];
    try { scripts = await API.get('/api/skincare/scripts'); } catch {}

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width:540px;">
        <h3>${isEdit ? '编辑视频记录' : '记录新视频'}</h3>
        <div class="form-group"><label>视频标题 *</label><input id="vTitle" value="${isEdit ? escapeHtml(video.title) : ''}"></div>
        <div class="form-group"><label>描述</label><textarea id="vDesc">${isEdit ? escapeHtml(video.description||'') : ''}</textarea></div>
        <div class="form-group"><label>标签（逗号分隔）</label><input id="vTags" value="${isEdit ? escapeHtml(video.tags||'') : ''}" placeholder="抗衰,精华,国货"></div>
        <div class="form-group"><label>关联脚本</label>
          <select id="vScript"><option value="">不关联</option>
            ${scripts.map(s => `<option value="${s.id}" ${isEdit && video.script_id === s.id ? 'selected' : ''}>${escapeHtml(s.title)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>视频链接</label><input id="vUrl" value="${isEdit ? escapeHtml(video.video_url||'') : ''}" placeholder="粘贴视频号/抖音链接，方便后期回顾分析"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group"><label>发布日期</label><input id="vDate" type="date" value="${isEdit && video.publish_date ? video.publish_date.slice(0,10) : ''}"></div>
          <div class="form-group"><label>平台</label>
            <select id="vPlat">
              <option value="视频号" ${isEdit && video.platform === '视频号' ? 'selected' : ''}>视频号</option>
              <option value="抖音" ${isEdit && video.platform === '抖音' ? 'selected' : ''}>抖音</option>
              <option value="小红书" ${isEdit && video.platform === '小红书' ? 'selected' : ''}>小红书</option>
            </select>
          </div>
        </div>
        ${isEdit ? `
        <h4 style="font-size:0.85rem;color:var(--text-dim);margin:12px 0 8px;">数据追踪</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          <div class="form-group"><label>播放量</label><input id="vViews" type="number" value="${video.views||0}"></div>
          <div class="form-group"><label>点赞</label><input id="vLikes" type="number" value="${video.likes||0}"></div>
          <div class="form-group"><label>评论</label><input id="vComments" type="number" value="${video.comments||0}"></div>
          <div class="form-group"><label>分享</label><input id="vShares" type="number" value="${video.shares||0}"></div>
          <div class="form-group"><label>商品点击</label><input id="vClicks" type="number" value="${video.clicks||0}"></div>
        </div>
        <div class="form-group"><label>备注</label><textarea id="vNotes">${escapeHtml(video.notes||'')}</textarea></div>
        ` : ''}
        <div class="btn-group">
          <button class="btn btn-primary" id="saveVBtn">${isEdit ? '保存' : '添加'}</button>
          ${isEdit ? '<button class="btn btn-danger btn-sm" id="delVBtn">删除</button>' : ''}
          <button class="btn btn-outline btn-sm close-modal">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    modal.querySelector('.close-modal').addEventListener('click', close);

    modal.querySelector('#saveVBtn').addEventListener('click', async () => {
      const data = {
        title: modal.querySelector('#vTitle').value,
        description: modal.querySelector('#vDesc').value,
        tags: modal.querySelector('#vTags').value,
        script_id: modal.querySelector('#vScript').value ? parseInt(modal.querySelector('#vScript').value) : null,
        publish_date: modal.querySelector('#vDate').value || null,
        platform: modal.querySelector('#vPlat').value,
        video_url: modal.querySelector('#vUrl').value
      };
      if (!data.title) return showToast('请输入标题');
      if (isEdit) {
        Object.assign(data, {
          views: parseInt(modal.querySelector('#vViews').value) || 0,
          likes: parseInt(modal.querySelector('#vLikes').value) || 0,
          comments: parseInt(modal.querySelector('#vComments').value) || 0,
          shares: parseInt(modal.querySelector('#vShares').value) || 0,
          clicks: parseInt(modal.querySelector('#vClicks').value) || 0,
          notes: modal.querySelector('#vNotes').value,
          video_url: modal.querySelector('#vUrl').value
        });
      }
      try {
        if (isEdit) {
          await API.put(`/api/skincare/videos/${video.id}`, data);
        } else {
          await API.post('/api/skincare/videos', data);
        }
        close();
        this.render(this.container);
        showToast(isEdit ? '已更新' : '已添加');
      } catch (e) { showToast('保存失败: ' + e.message); }
    });

    if (isEdit) {
      modal.querySelector('#delVBtn').addEventListener('click', async () => {
        if (!confirm('确定删除吗？')) return;
        await API.del(`/api/skincare/videos/${video.id}`);
        close();
        this.render(this.container);
        showToast('已删除');
      });
    }
  }
};

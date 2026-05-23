const EntriesPage = {
  entries: [],
  filter: { status: '', category: '', search: '' },

  async render(container) {
    this.container = container;
    this.entries = await API.get('/api/entries');

    const categories = [...new Set(this.entries.map(e => e.category).filter(Boolean))];

    container.innerHTML = `
      <div class="filters-bar">
        <input type="text" id="filterSearch" placeholder="搜索..." value="${escapeHtml(this.filter.search)}">
        <select id="filterStatus">
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="in_progress">进行中</option>
          <option value="done">已完成</option>
        </select>
        <select id="filterCategory">
          <option value="">全部分类</option>
          ${categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary btn-block" id="addEntryBtn">+ 新建记录</button>
      <div style="display:flex;gap:8px;margin-top:6px;">
        <button class="btn btn-outline btn-sm" id="exportEntriesBtn">导出 CSV</button>
        <button class="btn btn-outline btn-sm" id="exportEntriesJsonBtn">导出 JSON</button>
      </div>
      <div id="entriesList" style="margin-top:14px;"></div>
    `;

    $('#filterStatus').value = this.filter.status;
    $('#filterCategory').value = this.filter.category;

    $('#filterSearch').addEventListener('input', (e) => {
      this.filter.search = e.target.value;
      this.renderList();
    });
    $('#filterStatus').addEventListener('change', (e) => {
      this.filter.status = e.target.value;
      this.renderList();
    });
    $('#filterCategory').addEventListener('change', (e) => {
      this.filter.category = e.target.value;
      this.renderList();
    });
    $('#addEntryBtn').addEventListener('click', () => {
      this.showModal(null, () => this.refresh());
    });

    $('#exportEntriesBtn').addEventListener('click', () => this.exportCSV());
    $('#exportEntriesJsonBtn').addEventListener('click', () => this.exportJSON());

    this.renderList();
  },

  exportCSV() {
    const head = '标题,内容,状态,分类,优先级,进度,截止日期,创建时间,更新时间';
    const rows = this.entries.map(e =>
      `"${(e.title||'').replace(/"/g,'""')}","${(e.content||'').replace(/"/g,'""')}","${statusLabel(e.status)}","${e.category||''}","${e.priority||''}",${e.progress||0},"${e.deadline||''}","${e.created_at||''}","${e.updated_at||''}"`
    );
    const csv = '﻿' + head + '\n' + rows.join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'entries.csv';
    a.click(); URL.revokeObjectURL(url);
    showToast('CSV 已导出');
  },

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.entries, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'entries.json';
    a.click(); URL.revokeObjectURL(url);
    showToast('JSON 已导出');
  },

  getFiltered() {
    return this.entries.filter(e => {
      if (this.filter.status && e.status !== this.filter.status) return false;
      if (this.filter.category && e.category !== this.filter.category) return false;
      if (this.filter.search) {
        const q = this.filter.search.toLowerCase();
        if (!e.title.toLowerCase().includes(q) && !(e.content || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  },

  renderList() {
    const list = $('#entriesList');
    const filtered = this.getFiltered();
    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>暂无记录</p></div>';
      return;
    }
    list.innerHTML = filtered.map(e => `
      <div class="card entry-card" data-id="${e.id}">
        <div class="entry-header">
          <div>
            <div class="entry-title">${escapeHtml(e.title)}</div>
            ${e.content ? `<div style="font-size:0.82rem;color:var(--text-dim);margin-top:2px;">${escapeHtml(e.content.slice(0, 100))}${e.content.length > 100 ? '...' : ''}</div>` : ''}
          </div>
          <span class="badge badge-${e.status}">${statusLabel(e.status)}</span>
        </div>
        <div class="entry-meta">
          ${e.category ? `<span>${escapeHtml(e.category)}</span> &middot; ` : ''}
          <span>${formatDate(e.created_at)}</span>
        </div>
      </div>
    `).join('');

    $$('.entry-card', list).forEach(card => {
      card.addEventListener('click', () => {
        const entry = this.entries.find(e => e.id === parseInt(card.dataset.id));
        if (entry) this.showModal(entry, () => this.refresh());
      });
    });
  },

  async refresh() {
    this.entries = await API.get('/api/entries');
    this.renderList();
  },

  showModal(entry, onSaved) {
    const isEdit = !!entry;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <h3>${isEdit ? '编辑记录' : '新建记录'}</h3>
        <form id="entryForm">
          <div class="form-group">
            <label>标题 *</label>
            <input type="text" id="entryTitle" value="${isEdit ? escapeHtml(entry.title) : ''}" required placeholder="输入工作内容标题">
          </div>
          <div class="form-group">
            <label>内容 <button type="button" class="btn btn-sm btn-outline" id="voiceBtn" title="语音输入">🎤</button></label>
            <textarea id="entryContent" rows="4" placeholder="详细描述...">${isEdit ? escapeHtml(entry.content || '') : ''}</textarea>
            <span id="voiceStatus" style="display:none;font-size:0.78rem;color:var(--accent);">正在聆听...请说话</span>
          </div>
          <div class="form-group">
            <label>状态</label>
            <select id="entryStatus">
              <option value="pending" ${isEdit && entry.status === 'pending' ? 'selected' : ''}>待处理</option>
              <option value="in_progress" ${isEdit && entry.status === 'in_progress' ? 'selected' : ''}>进行中</option>
              <option value="done" ${isEdit && entry.status === 'done' ? 'selected' : ''}>已完成</option>
            </select>
          </div>
          <div class="form-group">
            <label>分类</label>
            <input type="text" id="entryCategory" value="${isEdit ? escapeHtml(entry.category || '') : ''}" placeholder="例如：工作、个人、学习">
          </div>
          <div class="form-group">
            <label>截止日期</label>
            <input type="date" id="entryDeadline" value="${isEdit && entry.deadline ? entry.deadline : ''}">
          </div>
          <div class="form-group">
            <label>优先级</label>
            <select id="entryPriority">
              <option value="low" ${isEdit && entry.priority === 'low' ? 'selected' : ''}>低</option>
              <option value="medium" ${isEdit && (entry.priority === 'medium' || !entry.priority) ? 'selected' : ''}>中</option>
              <option value="high" ${isEdit && entry.priority === 'high' ? 'selected' : ''}>高</option>
              <option value="urgent" ${isEdit && entry.priority === 'urgent' ? 'selected' : ''}>紧急</option>
            </select>
          </div>
          ${isEdit ? `
            <div class="form-group">
              <label>进度：${entry.progress || 0}%</label>
              <input type="range" id="entryProgress" min="0" max="100" value="${entry.progress || 0}" step="5" style="width:100%;">
            </div>
          ` : ''}
          <div class="btn-group">
            <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '创建'}</button>
            ${isEdit ? '<button type="button" class="btn btn-danger" id="deleteEntryBtn">删除</button>' : ''}
            <button type="button" class="btn btn-outline" id="cancelEntryBtn">取消</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => {
      if (modal._recognition) {
        try { modal._recognition.stop(); } catch {}
      }
      modal.remove();
    };
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    $('#cancelEntryBtn').addEventListener('click', close);

    // 语音输入
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.interimResults = false;
      recognition.continuous = false;
      modal._recognition = recognition;

      $('#voiceBtn').addEventListener('click', () => {
        if ($('#voiceStatus').style.display === 'none') {
          recognition.start();
          $('#voiceStatus').style.display = 'block';
          $('#voiceBtn').textContent = '⏹';
        } else {
          recognition.stop();
        }
      });

      recognition.addEventListener('result', (e) => {
        const transcript = e.results[0][0].transcript;
        const ta = $('#entryContent');
        ta.value = ta.value ? ta.value + ' ' + transcript : transcript;
        $('#voiceStatus').style.display = 'none';
        $('#voiceBtn').textContent = '🎤';
      });

      recognition.addEventListener('error', () => {
        $('#voiceStatus').style.display = 'none';
        $('#voiceBtn').textContent = '🎤';
        showToast('语音识别失败，请重试');
      });

      recognition.addEventListener('end', () => {
        $('#voiceStatus').style.display = 'none';
        $('#voiceBtn').textContent = '🎤';
      });
    } else {
      $('#voiceBtn').style.display = 'none';
    }

    $('#entryForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        title: $('#entryTitle').value,
        content: $('#entryContent').value,
        status: $('#entryStatus').value,
        category: $('#entryCategory').value,
        deadline: $('#entryDeadline').value || null,
        priority: $('#entryPriority').value
      };
      if (isEdit) {
        data.progress = parseInt($('#entryProgress').value) || 0;
        if (data.progress >= 100 && data.status !== 'done') data.status = 'done';
      }
      try {
        if (isEdit) {
          await API.put(`/api/entries/${entry.id}`, data);
        } else {
          await API.post('/api/entries', data);
        }
        close();
        if (onSaved) onSaved();
        showToast(isEdit ? '记录已更新' : '记录已创建');
      } catch (err) {
        showToast('错误：' + err.message);
      }
    });

    if (isEdit) {
      $('#deleteEntryBtn').addEventListener('click', async () => {
        if (!confirm('确定要删除这条记录吗？')) return;
        try {
          await API.del(`/api/entries/${entry.id}`);
          close();
          if (onSaved) onSaved();
          showToast('记录已删除');
        } catch (err) {
          showToast('错误：' + err.message);
        }
      });
    }
  }
};

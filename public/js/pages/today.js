const TodayPage = {
  async render(container) {
    const today = new Date().toISOString().slice(0, 10);
    const todayEntries = await API.get('/api/entries/today');
    const allReminders = await API.get('/api/reminders');

    const allEntries = await API.get('/api/entries');
    const [workflows] = await Promise.all([
      API.get('/api/workflows')
    ]);

    // Sub-tasks from active workflows
    const workflowSubs = allEntries.filter(e => e.parent_id && e.status !== 'done');
    // Group by parent
    const parentMap = {};
    for (const sub of workflowSubs) {
      if (!parentMap[sub.parent_id]) parentMap[sub.parent_id] = [];
      parentMap[sub.parent_id].push(sub);
    }

    const overdue = todayEntries.filter(e => e.deadline && e.deadline < today);
    const dueToday = todayEntries.filter(e => e.deadline && e.deadline === today);
    const inProgress = todayEntries.filter(e => e.status === 'in_progress' && (!e.deadline || e.deadline >= today));
    const pending = todayEntries.filter(e => e.status === 'pending' && (!e.deadline || e.deadline >= today));
    const upcomingReminders = allReminders.filter(r => !r.notified).slice(0, 8);

    container.innerHTML = `
      <div style="margin-bottom:16px;">
        <h2 style="font-size:1.1rem;">今日待办</h2>
        <p style="font-size:0.8rem;color:var(--text-dim);">${new Date().toLocaleDateString('zh-CN', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</p>
      </div>

      ${overdue.length > 0 ? `
        <div class="card" style="border-left:3px solid var(--red);">
          <h3 style="font-size:0.9rem;color:var(--red);margin-bottom:8px;">已过期 (${overdue.length})</h3>
          ${overdue.map(e => this.renderEntry(e)).join('')}
        </div>
      ` : ''}

      ${dueToday.length > 0 ? `
        <div class="card" style="border-left:3px solid var(--yellow);">
          <h3 style="font-size:0.9rem;color:var(--yellow);margin-bottom:8px;">今天截止 (${dueToday.length})</h3>
          ${dueToday.map(e => this.renderEntry(e)).join('')}
        </div>
      ` : ''}

      ${inProgress.length > 0 ? `
        <div class="card">
          <h3 style="font-size:0.9rem;color:var(--text-dim);margin-bottom:8px;">进行中 (${inProgress.length})</h3>
          ${inProgress.map(e => this.renderEntry(e)).join('')}
        </div>
      ` : ''}

      ${pending.length > 0 ? `
        <div class="card">
          <h3 style="font-size:0.9rem;color:var(--text-dim);margin-bottom:8px;">待处理 (${pending.length})</h3>
          ${pending.map(e => this.renderEntry(e)).join('')}
        </div>
      ` : ''}

      ${upcomingReminders.length > 0 ? `
        <div class="card">
          <h3 style="font-size:0.9rem;color:var(--text-dim);margin-bottom:8px;">即将提醒 (${upcomingReminders.length})</h3>
          ${upcomingReminders.map(r => `
            <div class="reminder-row">
              <span class="reminder-msg">${escapeHtml(r.message)}</span>
              <span class="reminder-time">${formatDate(r.remind_at)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${Object.keys(parentMap).length > 0 ? `
        <div class="card" style="border-left:3px solid var(--accent);">
          <h3 style="font-size:0.9rem;color:var(--accent);margin-bottom:8px;">流程步骤 (${workflowSubs.length})</h3>
          ${Object.entries(parentMap).map(([pid, subs]) => {
            const parent = allEntries.find(e => e.id === parseInt(pid));
            return `
              <div style="margin-bottom:6px;">
                <div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:2px;">${parent ? escapeHtml(parent.title) : ''}</div>
                ${subs.map(s => this.renderEntry(s)).join('')}
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}

      ${workflows.length > 0 ? `
        <div class="card" style="border-left:3px solid var(--green);">
          <h3 style="font-size:0.9rem;color:var(--green);margin-bottom:8px;">快速启动流程</h3>
          ${workflows.slice(0, 3).map(w => {
            const steps = JSON.parse(w.steps || '[]');
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
                <div>
                  <span style="font-size:0.85rem;">${escapeHtml(w.name)}</span>
                  <span style="font-size:0.72rem;color:var(--text-dim);margin-left:6px;">${steps.length}步</span>
                </div>
                <button class="btn btn-sm btn-primary quick-start-btn" data-id="${w.id}">启动</button>
              </div>
            `;
          }).join('')}
          <a href="#workflows" style="font-size:0.78rem;color:var(--accent);display:block;margin-top:6px;">查看全部模板 →</a>
        </div>
      ` : ''}

      ${overdue.length === 0 && dueToday.length === 0 && inProgress.length === 0 && pending.length === 0 && Object.keys(parentMap).length === 0 ? `
        <div class="empty-state">
          <p>今天没有待办事项</p>
          <button class="btn btn-primary" id="todayAddBtn">+ 新建记录</button>
        </div>
      ` : ''}

      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" id="todayQuickAddBtn">+ 快速添加</button>
        <a href="#ai-chat" style="text-decoration:none;"><button class="btn btn-outline btn-sm">告诉AI今天做什么</button></a>
      </div>
    `;

    $('#todayQuickAddBtn')?.addEventListener('click', () => {
      EntriesPage.showModal(null, () => this.render(container));
    });
    $('#todayAddBtn')?.addEventListener('click', () => {
      EntriesPage.showModal(null, () => this.render(container));
    });

    // Quick start workflow buttons
    $$('.quick-start-btn', container).forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        btn.textContent = '...';
        btn.disabled = true;
        try {
          const data = await API.post(`/api/workflows/${btn.dataset.id}/start`, {});
          showToast(`流程已启动：${data.subEntries.length} 个子任务已添加到今日待办`);
          this.render(container);
        } catch (err) {
          showToast('错误：' + err.message);
          btn.textContent = '启动';
          btn.disabled = false;
        }
      });
    });

    $$('.today-entry', container).forEach(el => {
      el.addEventListener('click', async () => {
        const id = parseInt(el.dataset.id);
        const data = await API.get(`/api/entries/${id}`);
        this.showDetail(data, () => this.render(container));
      });
    });

    $$('.today-progress-btn', container).forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        const pct = parseInt(btn.dataset.pct);
        try {
          await API.put(`/api/entries/${id}`, { progress: pct, status: pct >= 100 ? 'done' : 'in_progress' });
          this.render(container);
          showToast(pct >= 100 ? '已完成！' : `进度更新至 ${pct}%`);
        } catch (err) {
          showToast('错误：' + err.message);
        }
      });
    });
  },

  renderEntry(e) {
    const p = e.progress || 0;
    const deadline = e.deadline ? new Date(e.deadline) : null;
    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = deadline && e.deadline < today;

    return `
      <div class="today-entry card" data-id="${e.id}" style="padding:12px;margin-bottom:6px;cursor:pointer;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div style="flex:1;">
            <div style="font-size:0.9rem;font-weight:500;">${escapeHtml(e.title)}</div>
            <div style="font-size:0.78rem;color:var(--text-dim);margin-top:2px;">
              ${e.category ? `<span>${escapeHtml(e.category)}</span> &middot; ` : ''}
              ${deadline ? `<span style="color:${isOverdue ? 'var(--red)' : 'var(--text-dim)'};">截止：${deadline.toLocaleDateString('zh-CN')}</span> &middot; ` : ''}
              <span class="badge badge-${e.priority || 'medium'}" style="font-size:0.7rem;">${priorityLabel(e.priority || 'medium')}</span>
            </div>
          </div>
          <span class="badge badge-${e.status}">${statusLabel(e.status)}</span>
        </div>
        ${e.status !== 'done' ? `
          <div style="margin-top:8px;display:flex;align-items:center;gap:6px;">
            <div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${p}%;background:${p >= 80 ? 'var(--green)' : p >= 30 ? 'var(--accent)' : 'var(--yellow)'};border-radius:2px;transition:width 0.3s;"></div>
            </div>
            <span style="font-size:0.75rem;color:var(--text-dim);min-width:32px;">${p}%</span>
            <button class="btn btn-sm btn-outline today-progress-btn" data-id="${e.id}" data-pct="${Math.min(100, p + 25)}" style="font-size:0.7rem;padding:3px 8px;">+25%</button>
          </div>
        ` : ''}
      </div>
    `;
  },

  showDetail(entry, onUpdated) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    const logs = entry.progressLogs || [];
    const p = entry.progress || 0;

    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <h3>${escapeHtml(entry.title)}</h3>
        <div style="font-size:0.85rem;color:var(--text-dim);margin-bottom:12px;">
          <span class="badge badge-${entry.status}">${statusLabel(entry.status)}</span>
          <span class="badge badge-${entry.priority || 'medium'}">${priorityLabel(entry.priority || 'medium')}</span>
          ${entry.deadline ? `<span>截止：${entry.deadline}</span>` : ''}
        </div>
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px;">
            <span>进度</span><span>${p}%</span>
          </div>
          <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${p}%;background:var(--accent);border-radius:3px;"></div>
          </div>
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;">
          ${[0, 25, 50, 75, 100].map(v => `
            <button class="btn btn-sm ${v === 100 ? 'btn-primary' : 'btn-outline'} progress-set-btn" data-pct="${v}">${v === 0 ? '开始' : v === 100 ? '完成' : v + '%'}</button>
          `).join('')}
        </div>

        <div class="form-group">
          <label>添加进度备注</label>
          <div style="display:flex;gap:6px;">
            <input type="text" id="progressNote" placeholder="更新了什么？" style="flex:1;">
            <button class="btn btn-primary btn-sm" id="addProgressBtn">添加</button>
          </div>
        </div>

        ${logs.length > 0 ? `
          <div style="margin-top:12px;">
            <h4 style="font-size:0.82rem;color:var(--text-dim);margin-bottom:6px;">进度历史</h4>
            ${logs.map(l => `
              <div style="font-size:0.78rem;padding:6px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;">
                <span>${escapeHtml(l.note || '进度 ' + l.progress + '%')}</span>
                <span style="color:var(--text-dim);">${formatDate(l.created_at)}</span>
              </div>
            `).join('')}
          </div>
        ` : '<p style="font-size:0.78rem;color:var(--text-dim);">暂无进度记录</p>'}

        <div class="btn-group" style="margin-top:14px;">
          <button class="btn btn-outline btn-sm" id="closeDetailBtn">关闭</button>
          <button class="btn btn-outline btn-sm" id="editDetailBtn">编辑</button>
          ${entry.status === 'done' ? '<button class="btn btn-accent btn-sm" id="retrospectiveBtn">AI 复盘</button>' : ''}
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    $('#closeDetailBtn').addEventListener('click', close);
    $('#editDetailBtn').addEventListener('click', () => {
      close();
      const fullEntry = { ...entry, progressLogs: undefined };
      EntriesPage.showModal(fullEntry, () => {
        if (onUpdated) onUpdated();
      });
    });

    $$('.progress-set-btn', modal).forEach(btn => {
      btn.addEventListener('click', async () => {
        const pct = parseInt(btn.dataset.pct);
        const status = pct >= 100 ? 'done' : pct > 0 ? 'in_progress' : 'pending';
        try {
          await API.put(`/api/entries/${entry.id}`, { progress: pct, status });
          if (pct === 100) {
            await API.post(`/api/entries/${entry.id}/logs`, { progress: 100, note: '已完成！' });
          }
          close();
          if (onUpdated) onUpdated();
          showToast(pct >= 100 ? '已完成！' : `进度更新至 ${pct}%`);
        } catch (err) {
          showToast('错误：' + err.message);
        }
      });
    });

    const retroBtn = $('#retrospectiveBtn');
    if (retroBtn) {
      retroBtn.addEventListener('click', async () => {
        retroBtn.textContent = '分析中...';
        retroBtn.disabled = true;
        try {
          const data = await API.post('/api/deepseek/retrospective', { entryId: entry.id });
          const retroDiv = document.createElement('div');
          retroDiv.style.cssText = 'margin-top:12px;padding:12px;background:var(--surface2);border-radius:8px;font-size:0.82rem;line-height:1.6;white-space:pre-wrap;';
          retroDiv.textContent = data.retrospective;
          const title = document.createElement('h4');
          title.style.cssText = 'font-size:0.85rem;color:var(--accent);margin-bottom:6px;';
          title.textContent = 'AI 复盘分析';
          retroDiv.prepend(title);
          retroBtn.replaceWith(retroDiv);
        } catch (err) {
          showToast('错误：' + err.message);
          retroBtn.textContent = 'AI 复盘';
          retroBtn.disabled = false;
        }
      });
    }

    $('#addProgressBtn').addEventListener('click', async () => {
      const note = $('#progressNote').value.trim();
      if (!note) return;
      try {
        await API.post(`/api/entries/${entry.id}/logs`, { progress: entry.progress || 0, note });
        close();
        if (onUpdated) onUpdated();
        showToast('进度已记录');
      } catch (err) {
        showToast('错误：' + err.message);
      }
    });
  }
};

function priorityLabel(p) {
  const map = { urgent: '紧急', high: '高', medium: '中', low: '低' };
  return map[p] || '中';
}

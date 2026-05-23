const TodayPage = {
  async render(container) {
    const today = new Date().toISOString().slice(0, 10);
    const todayEntries = await API.get('/api/entries/today');
    const allReminders = await API.get('/api/reminders');

    const allEntries = await API.get('/api/entries');
    const [workflows] = await Promise.all([
      API.get('/api/workflows')
    ]);

    // Find projects (entries with sub-steps)
    const projects = allEntries.filter(e => {
      return allEntries.some(sub => sub.parent_id === e.id) && e.status !== 'done';
    });
    // Map project → step count
    const projectStepCount = {};
    for (const p of projects) {
      projectStepCount[p.id] = allEntries.filter(s => s.parent_id === p.id && s.status === 'done').length;
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

      ${projects.length > 0 ? `
        <div class="card" style="border-left:3px solid var(--accent);">
          <h3 style="font-size:0.9rem;color:var(--accent);margin-bottom:8px;">进行中的项目 (${projects.length})</h3>
          ${projects.map(p => {
            const totalSteps = allEntries.filter(s => s.parent_id === p.id).length;
            const doneSteps = projectStepCount[p.id] || 0;
            return `
              <div class="card project-card" data-id="${p.id}" style="padding:10px;margin-bottom:4px;cursor:pointer;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <span style="font-size:0.88rem;font-weight:500;">${escapeHtml(p.title)}</span>
                    <span style="font-size:0.72rem;color:var(--text-dim);margin-left:6px;">${doneSteps}/${totalSteps}步</span>
                  </div>
                  <span class="badge badge-${p.status}">${statusLabel(p.status)}</span>
                </div>
                <div style="margin-top:6px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
                  <div style="height:100%;width:${totalSteps>0?Math.round(doneSteps/totalSteps*100):0}%;background:var(--accent);"></div>
                </div>
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

      ${overdue.length === 0 && dueToday.length === 0 && inProgress.length === 0 && pending.length === 0 && projects.length === 0 ? `
        <div class="empty-state">
          <p>今天没有待办事项</p>
          <button class="btn btn-primary" id="todayAddBtn">+ 新建记录</button>
        </div>
      ` : ''}

      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button class="btn btn-primary btn-sm" id="todayQuickAddBtn">+ 快速添加</button>
        <a href="#ai-chat" style="text-decoration:none;"><button class="btn btn-outline btn-sm">告诉AI今天做什么</button></a>
        <button class="btn btn-outline btn-sm" id="todayBatchBtn" style="color:var(--red);">批量删除</button>
        <button class="btn btn-danger btn-sm" id="todayDoDeleteBtn" style="display:none;">确认删除</button>
        <span id="todayBatchCount" style="display:none;font-size:0.78rem;color:var(--red);"></span>
      </div>
    `;

    // Batch delete mode
    this.todaySelected = this.todaySelected || new Set();
    this.batchMode = false;
    $('#todayBatchBtn').addEventListener('click', () => {
      this.batchMode = !this.batchMode;
      $('#todayBatchBtn').textContent = this.batchMode ? '取消' : '批量删除';
      $('#todayDoDeleteBtn').style.display = this.batchMode ? '' : 'none';
      $('#todayBatchCount').style.display = this.batchMode ? '' : 'none';
      if (!this.batchMode) { this.todaySelected.clear(); }
      this.render(container);
    });

    $('#todayDoDeleteBtn').addEventListener('click', async () => {
      if (this.todaySelected.size === 0) { showToast('请先勾选要删除的记录'); return; }
      if (!confirm(`确定删除 ${this.todaySelected.size} 条记录？`)) return;
      try {
        await API.post('/api/entries/batch-delete', { ids: [...this.todaySelected] });
        showToast(`已删除 ${this.todaySelected.size} 条`);
        this.todaySelected.clear();
        this.batchMode = false;
        this.render(container);
      } catch (err) { showToast('错误：' + err.message); }
    });

    // Update checkbox handling
    $$('.today-checkbox', container).forEach(cb => {
      cb.addEventListener('change', () => {
        const id = parseInt(cb.dataset.id);
        if (cb.checked) this.todaySelected.add(id);
        else this.todaySelected.delete(id);
        $('#todayBatchCount').textContent = `已选 ${this.todaySelected.size} 条`;
      });
    });
    if (this.batchMode) {
      $('#todayBatchCount').textContent = `已选 ${this.todaySelected.size} 条`;
    }

    $('#todayQuickAddBtn')?.addEventListener('click', () => {
      EntriesPage.showModal(null, () => this.render(container));
    });
    $('#todayAddBtn')?.addEventListener('click', () => {
      EntriesPage.showModal(null, () => this.render(container));
    });

    // Project card click → detail view
    $$('.project-card', container).forEach(card => {
      card.addEventListener('click', async () => {
        try {
          const data = await API.get(`/api/entries/project/${card.dataset.id}`);
          this.showProjectDetail(data, () => this.render(container));
        } catch (err) { showToast('错误：' + err.message); }
      });
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

    // Entry click: batch mode → toggle checkbox, normal → detail
    $$('.today-entry', container).forEach(el => {
      el.addEventListener('click', (e) => {
        if (this.batchMode) {
          const cb = el.querySelector('.today-checkbox');
          if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); }
          return;
        }
        if (e.target.closest('.today-progress-btn')) return; // Don't open detail when clicking progress
        const id = parseInt(el.dataset.id);
        API.get(`/api/entries/${id}`).then(data => this.showDetail(data, () => this.render(container))).catch(() => {});
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
    const cbStyle = this.batchMode ? '' : 'display:none;';

    return `
      <div class="today-entry card" data-id="${e.id}" style="padding:12px;margin-bottom:6px;${this.batchMode?'cursor:default;':''}">
        ${this.batchMode ? `<input type="checkbox" class="today-checkbox" data-id="${e.id}" style="position:absolute;right:10px;top:10px;width:18px;height:18px;z-index:1;" ${this.todaySelected&&this.todaySelected.has(e.id)?'checked':''}>` : ''}
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
  },

  showProjectDetail(data, onUpdated) {
    const { project, steps } = data;
    const modal = document.createElement('div');
    modal.className = 'modal';
    const doneCount = steps.filter(s => s.status === 'done').length;
    const totalPct = steps.length > 0 ? Math.round(doneCount / steps.length * 100) : 0;

    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width:560px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <h3 style="margin:0;">${escapeHtml(project.title)}</h3>
          <span class="badge badge-${project.status}">${statusLabel(project.status)}</span>
        </div>
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px;">
            <span>项目进度</span><span>${doneCount}/${steps.length}步 (${totalPct}%)</span>
          </div>
          <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${totalPct}%;background:var(--accent);border-radius:3px;"></div>
          </div>
        </div>

        <div id="projectSteps" style="max-height:40vh;overflow-y:auto;">
          ${steps.map((s, i) => `
            <div class="project-step" data-id="${s.id}" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
              <input type="checkbox" class="step-check" ${s.status==='done'?'checked':''} style="width:18px;height:18px;flex-shrink:0;">
              <input type="text" class="step-title" value="${escapeHtml(s.title)}" style="flex:1;background:transparent;border:none;color:var(--text);font-size:0.85rem;padding:4px;text-decoration:${s.status==='done'?'line-through':'none'};">
              <button class="btn btn-sm btn-outline del-step-btn" data-id="${s.id}" style="font-size:0.65rem;padding:2px 6px;flex-shrink:0;">✕</button>
            </div>
          `).join('')}
        </div>

        <div style="display:flex;gap:6px;margin-top:10px;">
          <input type="text" id="newStepInput" placeholder="添加新步骤..." style="flex:1;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text);font-size:0.82rem;">
          <button class="btn btn-primary btn-sm" id="addStepBtn">+ 添加</button>
        </div>
        <div class="btn-group" style="margin-top:12px;">
          <button class="btn btn-outline btn-sm" id="closeProjectBtn">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => { modal.remove(); if (onUpdated) onUpdated(); };
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    $('#closeProjectBtn').addEventListener('click', close);

    // Toggle step done
    $$('.step-check', modal).forEach(cb => {
      cb.addEventListener('change', async () => {
        const id = parseInt(cb.closest('.project-step').dataset.id);
        const status = cb.checked ? 'done' : 'pending';
        try { await API.put(`/api/entries/${id}`, { status }); }
        catch { cb.checked = !cb.checked; }
      });
    });

    // Edit step title (save on blur)
    $$('.step-title', modal).forEach(inp => {
      inp.addEventListener('blur', async () => {
        const id = parseInt(inp.closest('.project-step').dataset.id);
        try { await API.put(`/api/entries/${id}`, { title: inp.value }); } catch {}
      });
    });

    // Delete step
    $$('.del-step-btn', modal).forEach(btn => {
      btn.addEventListener('click', async () => {
        try { await API.del(`/api/entries/${btn.dataset.id}`); btn.closest('.project-step').remove(); } catch {}
      });
    });

    // Add new step
    $('#addStepBtn').addEventListener('click', async () => {
      const title = $('#newStepInput').value.trim();
      if (!title) return;
      try {
        const res = await API.post('/api/entries', { title, status: 'pending', parent_id: project.id, category: project.category });
        const div = document.createElement('div');
        div.className = 'project-step';
        div.dataset.id = res.id;
        div.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);';
        div.innerHTML = `<input type="checkbox" class="step-check" style="width:18px;height:18px;"><input type="text" class="step-title" value="${escapeHtml(title)}" style="flex:1;background:transparent;border:none;color:var(--text);font-size:0.85rem;padding:4px;"><button class="btn btn-sm btn-outline del-step-btn" data-id="${res.id}" style="font-size:0.65rem;padding:2px 6px;">✕</button>`;
        $('#projectSteps').appendChild(div);
        $('#newStepInput').value = '';
        div.querySelector('.del-step-btn').addEventListener('click', async function() { try { await API.del(`/api/entries/${this.dataset.id}`); this.closest('.project-step').remove(); } catch {} });
        div.querySelector('.step-check').addEventListener('change', async function() { try { await API.put(`/api/entries/${res.id}`, { status: this.checked ? 'done' : 'pending' }); } catch { this.checked = !this.checked; } });
        div.querySelector('.step-title').addEventListener('blur', async function() { try { await API.put(`/api/entries/${res.id}`, { title: this.value }); } catch {} });
      } catch (err) { showToast('错误：' + err.message); }
    });
  }
};

function priorityLabel(p) {
  const map = { urgent: '紧急', high: '高', medium: '中', low: '低' };
  return map[p] || '中';
}

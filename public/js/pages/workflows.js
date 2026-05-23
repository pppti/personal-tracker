const WorkflowsPage = {
  async render(container) {
    const [workflows, entries] = await Promise.all([
      API.get('/api/workflows'),
      API.get('/api/entries')
    ]);

    // Find entries that have sub-tasks (active workflow runs)
    const activeRuns = entries.filter(e =>
      entries.some(sub => sub.parent_id === e.id)
    );

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h2 style="font-size:1rem;">流程模板</h2>
        <button class="btn btn-sm btn-outline" id="aiGenWfBtn">AI 生成模板</button>
        <button class="btn btn-sm btn-primary" id="newWfBtn">+ 新建模板</button>
      </div>

      <div id="aiGenResult"></div>

      ${activeRuns.length > 0 ? `
        <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-dim);">进行中的流程</h3>
        ${activeRuns.map(e => {
          const subs = entries.filter(s => s.parent_id === e.id);
          const doneSubs = subs.filter(s => s.status === 'done').length;
          return `
            <div class="card" style="cursor:pointer;" data-entry-id="${e.id}" onclick="location.hash='#entries?parent=${e.id}'">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-weight:500;">${escapeHtml(e.title)}</div>
                  <div style="font-size:0.78rem;color:var(--text-dim);">${doneSubs}/${subs.length} 步完成</div>
                </div>
                <div style="width:60px;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
                  <div style="height:100%;width:${subs.length > 0 ? Math.round(doneSubs/subs.length*100) : 0}%;background:var(--accent);border-radius:3px;"></div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      ` : ''}

      <h3 style="font-size:0.9rem;margin:16px 0 8px;color:var(--text-dim);">可用模板 (${workflows.length})</h3>
      ${workflows.length === 0 ? `
        <div class="empty-state">
          <p>还没有流程模板</p>
          <p style="font-size:0.8rem;color:var(--text-dim);">完成一些任务后，让 AI 帮你分析并生成模板</p>
        </div>
      ` : workflows.map(w => {
        const steps = JSON.parse(w.steps || '[]');
        return `
          <div class="card" style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div style="flex:1;">
                <div style="font-weight:500;">${escapeHtml(w.name)}</div>
                ${w.description ? `<div style="font-size:0.82rem;color:var(--text-dim);margin-top:2px;">${escapeHtml(w.description)}</div>` : ''}
                <div style="font-size:0.75rem;color:var(--text-dim);margin-top:4px;">${w.category ? escapeHtml(w.category) + ' &middot; ' : ''}${steps.length} 个步骤</div>
              </div>
              <button class="btn btn-sm btn-primary start-wf-btn" data-id="${w.id}">启动</button>
            </div>
            ${steps.length > 0 ? `
              <div style="margin-top:8px;font-size:0.8rem;color:var(--text-dim);">
                ${steps.map((s, i) => `<div>${i+1}. ${escapeHtml(s)}</div>`).join('')}
              </div>
            ` : ''}
            <div style="margin-top:6px;display:flex;gap:4px;">
              <button class="btn btn-sm btn-outline edit-wf-btn" data-id="${w.id}" style="font-size:0.7rem;">编辑</button>
              <button class="btn btn-sm btn-outline del-wf-btn" data-id="${w.id}" style="font-size:0.7rem;">删除</button>
            </div>
          </div>
        `;
      }).join('')}
    `;

    // Start workflow → show project overview immediately
    $$('.start-wf-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.textContent = '...';
        btn.disabled = true;
        try {
          const data = await API.post(`/api/workflows/${btn.dataset.id}/start`, {});
          showToast(`项目已创建：${data.mainEntry.title}`);
          // Show project overview
          const projData = await API.get(`/api/entries/project/${data.mainEntry.id}`);
          this.showProjectOverview(projData, container);
        } catch (err) {
          showToast('错误：' + err.message);
          btn.textContent = '启动';
          btn.disabled = false;
        }
      });
    });

    // Edit workflow
    $$('.edit-wf-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const wf = await API.get(`/api/workflows/${btn.dataset.id}`);
          this.showEditModal(wf, container);
        } catch (err) { showToast('错误：' + err.message); }
      });
    });

    // Delete workflow
    $$('.del-wf-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('删除此模板？正在进行中的流程不受影响。')) return;
        try {
          await API.del(`/api/workflows/${btn.dataset.id}`);
          showToast('模板已删除');
          this.render(container);
        } catch (err) {
          showToast('错误：' + err.message);
        }
      });
    });

    // Manual create workflow
    $('#newWfBtn').addEventListener('click', () => this.showCreateModal(container));

    // AI generate workflow
    $('#aiGenWfBtn').addEventListener('click', async () => {
      const el = $('#aiGenResult');
      el.innerHTML = '<div class="card" style="text-align:center;color:var(--text-dim);padding:12px;">AI 正在分析你的已完成任务...</div>';
      try {
        const data = await API.post('/api/deepseek/generate-workflow', {});
        if (data.workflow) {
          el.innerHTML = `<div class="card" style="border-left:3px solid var(--green);">
            <div style="font-weight:500;color:var(--green);">已生成新模板：${escapeHtml(data.workflow.name)}</div>
            <div style="font-size:0.82rem;color:var(--text-dim);margin-top:4px;">${data.message}</div>
          </div>`;
          this.render(container);
        } else {
          el.innerHTML = `<div class="card" style="color:var(--text-dim);">${escapeHtml(data.message)}</div>`;
        }
      } catch (err) {
        el.innerHTML = `<div class="card" style="color:var(--red);">错误：${escapeHtml(err.message)}</div>`;
      }
    });
  },

  showEditModal(wf, container) {
    const steps = wf.steps || JSON.parse(wf.steps_text || '[]');
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <h3>编辑流程模板</h3>
        <form id="editWfForm">
          <div class="form-group"><label>名称</label><input type="text" id="editWfName" value="${escapeHtml(wf.name)}"></div>
          <div class="form-group"><label>描述</label><input type="text" id="editWfDesc" value="${escapeHtml(wf.description||'')}"></div>
          <div class="form-group"><label>分类</label><input type="text" id="editWfCategory" value="${escapeHtml(wf.category||'')}"></div>
          <div class="form-group"><label>步骤（每行一个）</label><textarea id="editWfSteps" rows="8">${steps.map(s => escapeHtml(s)).join('\n')}</textarea></div>
          <div class="btn-group">
            <button type="submit" class="btn btn-primary">保存</button>
            <button type="button" class="btn btn-outline" id="cancelEditWfBtn">取消</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    $('#cancelEditWfBtn').addEventListener('click', close);
    $('#editWfForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const newSteps = $('#editWfSteps').value.split('\n').map(s => s.trim()).filter(s => s);
      if (newSteps.length === 0) { showToast('请至少填写一个步骤'); return; }
      try {
        await API.put(`/api/workflows/${wf.id}`, {
          name: $('#editWfName').value,
          description: $('#editWfDesc').value,
          category: $('#editWfCategory').value,
          steps: newSteps
        });
        close();
        showToast('模板已更新');
        this.render(container);
      } catch (err) { showToast('错误：' + err.message); }
    });
  },

  showProjectOverview(data, container) {
    const { project, steps } = data;
    const modal = document.createElement('div');
    modal.className = 'modal';
    const doneCount = steps.filter(s => s.status === 'done').length;
    const totalPct = steps.length > 0 ? Math.round(doneCount / steps.length * 100) : 0;

    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width:560px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <h3>项目总览</h3>
          <span class="badge badge-${project.status}">${statusLabel(project.status)}</span>
        </div>
        <div style="font-weight:600;font-size:1rem;margin-bottom:4px;">${escapeHtml(project.title)}</div>
        ${project.content ? `<div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:8px;">${escapeHtml(project.content)}</div>` : ''}
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px;">
            <span>项目进度</span><span>${doneCount}/${steps.length}步 (${totalPct}%)</span>
          </div>
          <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${totalPct}%;background:var(--accent);border-radius:4px;transition:width 0.3s;"></div>
          </div>
        </div>

        <div style="max-height:40vh;overflow-y:auto;">
          ${steps.map((s, i) => `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
              <span style="font-size:1.1rem;">${s.status==='done'?'✅':'⬜'}</span>
              <span style="flex:1;font-size:0.85rem;text-decoration:${s.status==='done'?'line-through':'none'};color:${s.status==='done'?'var(--text-dim)':'var(--text)'};">${escapeHtml(s.title)}</span>
            </div>
          `).join('')}
        </div>

        <div style="margin-top:12px;font-size:0.8rem;color:var(--text-dim);text-align:center;">
          去「今日待办」点击此项目卡片可自由增删改步骤
        </div>
        <div class="btn-group" style="margin-top:10px;">
          <button class="btn btn-primary btn-sm" id="gotoTodayBtn">去今日待办</button>
          <button class="btn btn-outline btn-sm" id="closeOverviewBtn">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    $('#closeOverviewBtn').addEventListener('click', close);
    $('#gotoTodayBtn').addEventListener('click', () => {
      close();
      location.hash = '#today';
    });
  },

  showCreateModal(container) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <h3>新建流程模板</h3>
        <form id="wfForm">
          <div class="form-group">
            <label>流程名称 *</label>
            <input type="text" id="wfName" required placeholder="如：Bug修复流程">
          </div>
          <div class="form-group">
            <label>描述</label>
            <input type="text" id="wfDesc" placeholder="流程用途说明">
          </div>
          <div class="form-group">
            <label>分类</label>
            <input type="text" id="wfCategory" placeholder="如：开发、运维、设计">
          </div>
          <div class="form-group">
            <label>步骤（每行一个）</label>
            <textarea id="wfSteps" rows="6" placeholder="接到需求报告&#10;分析问题根因&#10;制定修复方案&#10;代码修改&#10;测试验证&#10;上线部署&#10;复盘总结"></textarea>
          </div>
          <div class="btn-group">
            <button type="submit" class="btn btn-primary">创建</button>
            <button type="button" class="btn btn-outline" id="cancelWfBtn">取消</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    $('#cancelWfBtn').addEventListener('click', close);

    $('#wfForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const steps = $('#wfSteps').value.split('\n').map(s => s.trim()).filter(s => s);
      if (steps.length === 0) { showToast('请至少填写一个步骤'); return; }
      try {
        await API.post('/api/workflows', {
          name: $('#wfName').value,
          description: $('#wfDesc').value,
          category: $('#wfCategory').value,
          steps
        });
        close();
        showToast('流程模板已创建');
        this.render(container);
      } catch (err) {
        showToast('错误：' + err.message);
      }
    });
  }
};

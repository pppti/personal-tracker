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
            <div style="margin-top:6px;">
              <button class="btn btn-sm btn-outline del-wf-btn" data-id="${w.id}" style="font-size:0.7rem;">删除</button>
            </div>
          </div>
        `;
      }).join('')}
    `;

    // Start workflow
    $$('.start-wf-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.textContent = '...';
        btn.disabled = true;
        try {
          const data = await API.post(`/api/workflows/${btn.dataset.id}/start`, {});
          showToast(`流程已启动：${data.mainEntry.title}（${data.subEntries.length} 个子任务）`);
          this.render(container);
        } catch (err) {
          showToast('错误：' + err.message);
          btn.textContent = '启动';
          btn.disabled = false;
        }
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
  }
};

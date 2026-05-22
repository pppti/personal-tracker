const DashboardPage = {
  async render(container) {
    const [entries, reminders] = await Promise.all([
      API.get('/api/entries'),
      API.get('/api/reminders')
    ]);

    const total = entries.length;
    const done = entries.filter(e => e.status === 'done').length;
    const inProgress = entries.filter(e => e.status === 'in_progress').length;
    const pending = entries.filter(e => e.status === 'pending').length;
    const upcoming = reminders.filter(r => !r.notified).slice(0, 5);

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card accent"><div class="stat-num">${total}</div><div class="stat-label">总记录数</div></div>
        <div class="stat-card green"><div class="stat-num">${done}</div><div class="stat-label">已完成</div></div>
        <div class="stat-card yellow"><div class="stat-num">${inProgress}</div><div class="stat-label">进行中</div></div>
        <div class="stat-card"><div class="stat-num">${pending}</div><div class="stat-label">待处理</div></div>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <button class="btn btn-primary" id="quickAddBtn">+ 新建记录</button>
        <button class="btn btn-outline" onclick="location.hash='#summary'">生成汇总</button>
      </div>

      <div class="card">
        <h3 style="font-size:0.9rem;margin-bottom:10px;color:var(--text-dim);">待触发提醒</h3>
        ${upcoming.length === 0
          ? '<p style="color:var(--text-dim);font-size:0.85rem;">暂无待触发提醒</p>'
          : upcoming.map(r => `
            <div class="reminder-row">
              <span class="reminder-msg">${escapeHtml(r.message)}</span>
              <span class="reminder-time">${formatDate(r.remind_at)}</span>
            </div>
          `).join('')}
      </div>

      <div class="card">
        <h3 style="font-size:0.9rem;margin-bottom:10px;color:var(--text-dim);">最近记录</h3>
        ${entries.slice(0, 8).map(e => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <span style="font-size:0.9rem;">${escapeHtml(e.title)}</span>
            <span class="badge badge-${e.status}">${statusLabel(e.status)}</span>
          </div>
        `).join('')}
        ${entries.length > 8 ? `<p style="margin-top:8px;font-size:0.8rem;color:var(--text-dim);">...还有 ${entries.length - 8} 条</p>` : ''}
        ${entries.length === 0 ? '<p style="color:var(--text-dim);font-size:0.85rem;">暂无记录，点击上方按钮开始</p>' : ''}
      </div>
    `;

    $('#quickAddBtn').addEventListener('click', () => {
      EntriesPage.showModal(null, () => DashboardPage.render(container));
    });
  }
};

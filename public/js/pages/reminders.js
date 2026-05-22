const RemindersPage = {
  async render(container) {
    this.container = container;
    const reminders = await API.get('/api/reminders');
    const upcoming = reminders.filter(r => !r.notified);
    const past = reminders.filter(r => r.notified);

    container.innerHTML = `
      <h2 style="font-size:1rem;margin-bottom:14px;">添加提醒</h2>
      <form id="reminderForm">
        <div class="form-group">
          <label>提醒内容</label>
          <input type="text" id="reminderMsg" placeholder="要提醒什么？" required>
        </div>
        <div class="form-group">
          <label>提醒时间</label>
          <input type="datetime-local" id="reminderTime" required>
        </div>
        <button type="submit" class="btn btn-primary btn-block">设置提醒</button>
      </form>

      <h3 style="font-size:0.9rem;margin:20px 0 10px;color:var(--text-dim);">即将触发 (${upcoming.length})</h3>
      <div class="card" id="upcomingList">
        ${upcoming.length === 0 ? '<p style="color:var(--text-dim);font-size:0.85rem;">暂无</p>' :
          upcoming.map(r => `
            <div class="reminder-row">
              <div>
                <div class="reminder-msg">${escapeHtml(r.message)}</div>
                <div class="reminder-time">${formatDate(r.remind_at)}</div>
              </div>
              <button class="btn btn-outline btn-sm delete-reminder" data-id="${r.id}">删除</button>
            </div>
          `).join('')}
      </div>

      <h3 style="font-size:0.9rem;margin:20px 0 10px;color:var(--text-dim);">已触发 (${past.length})</h3>
      <div class="card">
        ${past.length === 0 ? '<p style="color:var(--text-dim);font-size:0.85rem;">暂无</p>' :
          past.map(r => `
            <div class="reminder-row">
              <div>
                <div class="reminder-msg">${escapeHtml(r.message)}</div>
                <div class="reminder-time">${formatDate(r.remind_at)}</div>
              </div>
              <span style="font-size:0.75rem;color:var(--green);">已通知</span>
            </div>
          `).join('')}
      </div>
    `;

    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const defaultTime = now.toISOString().slice(0, 16);
    $('#reminderTime').value = defaultTime;

    $('#reminderForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = $('#reminderMsg').value;
      const remind_at = $('#reminderTime').value;
      try {
        await API.post('/api/reminders', { message, remind_at });
        showToast('提醒已设置');
        this.render(container);
      } catch (err) {
        showToast('错误：' + err.message);
      }
    });

    $$('.delete-reminder').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await API.del(`/api/reminders/${btn.dataset.id}`);
          showToast('提醒已删除');
          this.render(container);
        } catch (err) {
          showToast('错误：' + err.message);
        }
      });
    });
  }
};

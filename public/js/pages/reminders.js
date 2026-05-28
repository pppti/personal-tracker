const RemindersPage = {
  async render(container) {
    this.container = container;
    const reminders = await API.get('/api/reminders');
    const recurringList = reminders.filter(r => !!r.recurring);
    const upcoming = reminders.filter(r => !r.notified && !r.recurring);
    const past = reminders.filter(r => r.notified && !r.recurring);

    container.innerHTML = `
      <h2 style="font-size:1rem;margin-bottom:14px;">添加提醒</h2>
      <form id="reminderForm">
        <div class="form-group">
          <label>提醒内容</label>
          <input type="text" id="reminderMsg" placeholder="要提醒什么？" required>
        </div>
        <div class="form-group">
          <label>重复类型</label>
          <select id="reminderRecurring">
            <option value="">一次性</option>
            <option value="daily">每天</option>
            <option value="monthly">每月</option>
          </select>
        </div>
        <div class="form-group" id="oneTimeGroup">
          <label>日期和时间</label>
          <input type="datetime-local" id="reminderDateTime">
        </div>
        <div class="form-group" id="dailyTimeGroup" style="display:none;">
          <label>每天几点</label>
          <input type="time" id="dailyTime">
        </div>
        <div class="form-group" id="monthlyGroup" style="display:none;">
          <label>每月几号</label>
          <select id="monthlyDay">
            ${Array.from({length:28},(_,i)=>`<option value="${String(i+1).padStart(2,'0')}">${i+1}号</option>`).join('')}
          </select>
          <label style="margin-top:8px;">几点</label>
          <input type="time" id="monthlyTime">
        </div>
        <button type="submit" class="btn btn-primary btn-block">设置提醒</button>
      </form>

      ${recurringList.length > 0 ? `
        <h3 style="font-size:0.9rem;margin:20px 0 10px;color:var(--accent);">定期提醒 (${recurringList.length})</h3>
        <div class="card" id="recurringList">
          ${recurringList.map(r => {
            const label = r.recurring === 'daily' ? '每天' : r.recurring === 'monthly' ? `每月${r.remind_at.split(',')[0]}号` : '';
            const time = r.recurring === 'daily' ? r.remind_at : r.recurring === 'monthly' ? r.remind_at.split(',')[1] : '';
            return `
              <div class="reminder-row">
                <div>
                  <div class="reminder-msg">${escapeHtml(r.message)}</div>
                  <div class="reminder-time">${label} ${time}</div>
                </div>
                <button class="btn btn-outline btn-sm del-rem-btn" data-id="${r.id}">删除</button>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}

      <h3 style="font-size:0.9rem;margin:20px 0 10px;color:var(--text-dim);">一次性提醒 - 即将触发 (${upcoming.length})</h3>
      <div class="card" id="upcomingList">
        ${upcoming.length === 0 ? '<p style="color:var(--text-dim);font-size:0.85rem;">暂无</p>' :
          upcoming.map(r => `
            <div class="reminder-row">
              <div>
                <div class="reminder-msg">${escapeHtml(r.message)}</div>
                <div class="reminder-time">${formatDate(r.remind_at)}</div>
              </div>
              <button class="btn btn-outline btn-sm del-rem-btn" data-id="${r.id}">删除</button>
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

    // Set defaults
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    $('#reminderDateTime').value = now.toISOString().slice(0, 16);

    // Toggle form fields based on recurring type
    $('#reminderRecurring').addEventListener('change', () => {
      const type = $('#reminderRecurring').value;
      $('#oneTimeGroup').style.display = type === '' ? '' : 'none';
      $('#dailyTimeGroup').style.display = type === 'daily' ? '' : 'none';
      $('#monthlyGroup').style.display = type === 'monthly' ? '' : 'none';
    });

    $('#reminderForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = $('#reminderMsg').value;
      const recurring = $('#reminderRecurring').value || null;
      let remind_at;
      if (recurring === 'daily') {
        remind_at = $('#dailyTime').value || '09:00';
      } else if (recurring === 'monthly') {
        const day = $('#monthlyDay').value;
        const time = $('#monthlyTime').value || '09:00';
        remind_at = `${day},${time}`;
      } else {
        remind_at = $('#reminderDateTime').value;
        if (!remind_at) { showToast('请选择时间'); return; }
      }
      try {
        await API.post('/api/reminders', { message, remind_at, recurring });
        showToast('提醒已设置');
        this.render(container);
      } catch (err) {
        showToast('错误：' + err.message);
      }
    });

    // Delete events
    $('#upcomingList').addEventListener('click', async (e) => {
      const btn = e.target.closest('.del-rem-btn');
      if (!btn) return;
      e.stopPropagation();
      btn.textContent = '...'; btn.disabled = true;
      try {
        await API.del(`/api/reminders/${btn.dataset.id}`);
        showToast('提醒已删除');
        this.render(container);
      } catch (err) {
        showToast('错误：' + err.message);
        btn.textContent = '删除'; btn.disabled = false;
      }
    });

    const recurringListEl = $('#recurringList');
    if (recurringListEl) {
      recurringListEl.addEventListener('click', async (e) => {
        const btn = e.target.closest('.del-rem-btn');
        if (!btn) return;
        e.stopPropagation();
        btn.textContent = '...'; btn.disabled = true;
        try {
          await API.del(`/api/reminders/${btn.dataset.id}`);
          showToast('提醒已删除');
          this.render(container);
        } catch (err) {
          showToast('错误：' + err.message);
          btn.textContent = '删除'; btn.disabled = false;
        }
      });
    }
  }
};

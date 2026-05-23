const SettingsPage = {
  async render(container) {
    const settings = await API.get('/api/settings');

    container.innerHTML = `
      <h2 style="font-size:1rem;margin-bottom:14px;">消息推送 (ntfy.sh)</h2>
      <div class="card">
        <p style="font-size:0.82rem;color:var(--text-dim);margin-bottom:12px;">
          在手机上安装 <strong>ntfy</strong> App，订阅一个主题，然后在下方填入主题名。
          服务器会自动将提醒推送到你的手机。
        </p>
        <div class="form-group">
          <label>服务器地址</label>
          <input type="text" id="ntfyServer" value="${escapeHtml(settings.ntfy_server || 'https://ntfy.sh')}" placeholder="https://ntfy.sh">
        </div>
        <div class="form-group">
          <label>主题名称</label>
          <input type="text" id="ntfyTopic" value="${escapeHtml(settings.ntfy_topic || '')}" placeholder="例如：my-tracker-abc123">
        </div>
        <button class="btn btn-primary" id="saveNtfyBtn">保存</button>
        <span id="ntfyStatus" style="margin-left:10px;font-size:0.82rem;color:var(--green);display:none;">已保存</span>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" id="testPushBtn">测试推送</button>
          <button class="btn btn-outline btn-sm" id="enableBrowserNotifyBtn">开启浏览器通知</button>
          <button class="btn btn-outline btn-sm" id="webPushBtn">开启 Web Push</button>
        </div>
        <p id="pushTestResult" style="margin-top:8px;font-size:0.8rem;display:none;"></p>
      </div>

      <h2 style="font-size:1rem;margin:20px 0 14px;">DeepSeek AI</h2>
      <div class="card">
        <p style="font-size:0.82rem;color:var(--text-dim);margin-bottom:12px;">
          从 <a href="https://platform.deepseek.com" target="_blank" style="color:var(--accent);">platform.deepseek.com</a> 获取 API Key，启用 AI 智能汇总和对话功能。
        </p>
        <div class="form-group">
          <label>API Key</label>
          <input type="password" id="deepseekKey" value="${escapeHtml(settings.deepseek_key || '')}" placeholder="sk-...">
        </div>
        <div class="form-group">
          <label>模型</label>
          <input type="text" id="deepseekModel" value="${escapeHtml(settings.deepseek_model || 'deepseek-chat')}" placeholder="deepseek-chat">
        </div>
        <button class="btn btn-primary" id="saveDeepSeekBtn">保存</button>
        <span id="dsStatus" style="margin-left:10px;font-size:0.82rem;color:var(--green);display:none;">已保存</span>
      </div>

      <h2 style="font-size:1rem;margin:20px 0 14px;">修改密码</h2>
      <div class="card">
        <form id="changePwForm">
          <div class="form-group">
            <label>当前密码</label>
            <input type="password" id="currentPw" required>
          </div>
          <div class="form-group">
            <label>新密码</label>
            <input type="password" id="newPw" required minlength="4" placeholder="至少4个字符">
          </div>
          <button type="submit" class="btn btn-primary">修改密码</button>
        </form>
        <p id="pwMsg" style="margin-top:8px;font-size:0.82rem;display:none;"></p>
      </div>

      <h2 style="font-size:1rem;margin:20px 0 14px;">数据管理</h2>
      <div class="card">
        <button class="btn btn-outline" id="exportDataBtn">导出全部数据 (JSON)</button>
      </div>
    `;

    $('#saveNtfyBtn').addEventListener('click', async () => {
      try {
        await API.put('/api/settings', {
          ntfy_server: $('#ntfyServer').value,
          ntfy_topic: $('#ntfyTopic').value
        });
        const s = $('#ntfyStatus');
        s.style.display = 'inline';
        setTimeout(() => { s.style.display = 'none'; }, 2000);
      } catch (err) {
        showToast('错误：' + err.message);
      }
    });

    $('#testPushBtn').addEventListener('click', async () => {
      const topic = $('#ntfyTopic').value;
      if (!topic) { showToast('请先填写主题名称'); return; }
      $('#testPushBtn').textContent = '发送中...';
      $('#testPushBtn').disabled = true;
      try {
        const data = await API.post('/api/settings/test-push', { topic });
        const el = $('#pushTestResult');
        el.style.display = 'block';
        el.style.color = 'var(--green)';
        el.textContent = '测试推送已发送！请查看手机 ntfy App 是否收到消息。如果没收到，检查：1) 手机 ntfy App 是否订阅了同一主题 2) 手机是否允许 ntfy 后台运行';
        showToast('推送已发送');
      } catch (err) {
        const el = $('#pushTestResult');
        el.style.display = 'block';
        el.style.color = 'var(--red)';
        el.textContent = '推送失败：' + err.message;
      }
      $('#testPushBtn').textContent = '测试推送';
      $('#testPushBtn').disabled = false;
    });

    $('#enableBrowserNotifyBtn').addEventListener('click', async () => {
      if (!('Notification' in window)) {
        showToast('你的浏览器不支持通知');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        showToast('浏览器通知已开启');
        new Notification('个人工作追踪', { body: '通知功能已就绪！即使 ntfy 连不上，浏览器也能弹出提醒。' });
      } else {
        showToast('通知权限被拒绝，请在浏览器设置中手动开启');
      }
    });

    $('#webPushBtn').addEventListener('click', async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        showToast('你的浏览器不支持 Web Push');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const vapidData = await API.get('/api/push/vapid-public');
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidData.publicKey
        });
        await API.post('/api/push/subscribe', { subscription: sub });
        $('#webPushBtn').textContent = 'Web Push 已开启';
        $('#webPushBtn').style.background = 'var(--green)';
        showToast('Web Push 已开启！关闭 App 也能收到推送');
      } catch (err) {
        showToast('Web Push 开启失败：' + err.message);
      }
    });

    $('#saveDeepSeekBtn').addEventListener('click', async () => {
      try {
        await API.put('/api/settings', {
          deepseek_key: $('#deepseekKey').value,
          deepseek_model: $('#deepseekModel').value
        });
        const s = $('#dsStatus');
        s.style.display = 'inline';
        setTimeout(() => { s.style.display = 'none'; }, 2000);
      } catch (err) {
        showToast('错误：' + err.message);
      }
    });

    $('#changePwForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('#pwMsg');
      try {
        await API.post('/api/auth/change-password', {
          current: $('#currentPw').value,
          new: $('#newPw').value
        });
        msg.style.color = 'var(--green)';
        msg.textContent = '密码已修改！';
        msg.style.display = 'block';
        $('#currentPw').value = '';
        $('#newPw').value = '';
      } catch (err) {
        msg.style.color = 'var(--red)';
        msg.textContent = err.message === 'Current password incorrect' ? '当前密码错误' :
          err.message === 'New password must be at least 4 characters' ? '新密码至少需要4个字符' : err.message;
        msg.style.display = 'block';
      }
    });

    $('#exportDataBtn').addEventListener('click', async () => {
      try {
        const token = API.getToken();
        const res = await fetch('/api/settings/export', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tracker-backup.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('数据已导出');
      } catch (err) {
        showToast('错误：' + err.message);
      }
    });
  }
};

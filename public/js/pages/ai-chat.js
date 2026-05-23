const AIChatPage = {
  async render(container) {
    container.innerHTML = `
      <div class="card" style="margin-bottom:12px;padding:12px 16px;font-size:0.82rem;color:var(--text-dim);background:var(--surface2);border-radius:8px;">
        你可以直接对我说：<br>
        "今天完成了仪表盘设计，花了3小时" → 自动创建记录并分类<br>
        "明天下午3点提醒我开会" → 自动设置闹钟<br>
        "帮我复盘这个项目" → AI 复盘分析 & 生成流程模板
      </div>
      <div id="chatMessages" style="max-height:calc(100vh - 280px);overflow-y:auto;margin-bottom:12px;"></div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" id="chatVoiceBtn" title="语音输入">🎤</button>
        <input type="text" id="chatInput" placeholder="说说你做了什么，或者需要什么帮助..." style="flex:1;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-size:0.9rem;">
        <button class="btn btn-primary" id="chatSendBtn">发送</button>
      </div>
      <span id="chatVoiceStatus" style="display:none;font-size:0.78rem;color:var(--accent);margin-top:4px;">正在聆听...</span>
    `;

    $('#chatSendBtn').addEventListener('click', () => this.send());
    $('#chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });

    // Voice input for AI chat
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.interimResults = false;
      recognition.continuous = false;

      $('#chatVoiceBtn').addEventListener('click', () => {
        if ($('#chatVoiceStatus').style.display === 'none' || !$('#chatVoiceStatus').style.display) {
          recognition.start();
          $('#chatVoiceStatus').style.display = 'block';
          $('#chatVoiceBtn').textContent = '⏹';
        } else {
          recognition.stop();
        }
      });

      recognition.addEventListener('result', (e) => {
        const transcript = e.results[0][0].transcript;
        const input = $('#chatInput');
        input.value = input.value ? input.value + ' ' + transcript : transcript;
        $('#chatVoiceStatus').style.display = 'none';
        $('#chatVoiceBtn').textContent = '🎤';
        // Auto-send if there's text
        if (input.value.trim()) this.send();
      });

      recognition.addEventListener('error', () => {
        $('#chatVoiceStatus').style.display = 'none';
        $('#chatVoiceBtn').textContent = '🎤';
      });

      recognition.addEventListener('end', () => {
        $('#chatVoiceStatus').style.display = 'none';
        $('#chatVoiceBtn').textContent = '🎤';
      });
    } else {
      $('#chatVoiceBtn').style.display = 'none';
    }
  },

  async send() {
    const input = $('#chatInput');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    input.focus();

    const msgs = $('#chatMessages');
    msgs.innerHTML += `
      <div style="margin-bottom:10px;display:flex;justify-content:flex-end;">
        <div style="max-width:85%;background:var(--accent);color:#fff;padding:10px 14px;border-radius:16px 16px 4px 16px;font-size:0.9rem;word-break:break-word;">${escapeHtml(message)}</div>
      </div>
    `;
    msgs.innerHTML += `
      <div style="margin-bottom:10px;display:flex;gap:8px;" id="thinkingMsg">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:0.8rem;flex-shrink:0;">AI</div>
        <div style="color:var(--text-dim);padding:10px 0;font-size:0.85rem;">思考中...</div>
      </div>
    `;
    msgs.scrollTop = msgs.scrollHeight;

    try {
      const data = await API.post('/api/deepseek/chat/action', { message });
      const thinkingEl = document.getElementById('thinkingMsg');
      if (thinkingEl) thinkingEl.remove();

      let actionHtml = '';
      if (data.actions && data.actions.length > 0) {
        actionHtml = data.actions.map(a => {
          if (a.action === 'create_entry') {
            const e = a.entry;
            return `<div style="margin-top:8px;padding:10px 12px;background:var(--surface2);border-radius:8px;border-left:3px solid var(--accent);font-size:0.82rem;">
              <strong>已创建记录</strong><br>
              标题：${escapeHtml(e.title)}<br>
              状态：<span class="badge badge-${e.status}">${statusLabel(e.status)}</span><br>
              分类：${escapeHtml(e.category || '未分类')}
            </div>`;
          }
          if (a.action === 'set_reminder') {
            const r = a.reminder;
            return `<div style="margin-top:8px;padding:10px 12px;background:var(--surface2);border-radius:8px;border-left:3px solid var(--yellow);font-size:0.82rem;">
              <strong>已设置提醒</strong><br>
              内容：${escapeHtml(r.message)}<br>
              时间：${formatDate(r.remind_at)}
            </div>`;
          }
          return '';
        }).join('');
      }

      msgs.innerHTML += `
        <div style="margin-bottom:10px;display:flex;gap:8px;">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:0.8rem;flex-shrink:0;">AI</div>
          <div style="max-width:85%;">
            <div style="background:var(--surface);border:1px solid var(--border);padding:10px 14px;border-radius:4px 16px 16px 16px;font-size:0.9rem;line-height:1.6;word-break:break-word;">${escapeHtml(data.reply)}</div>
            ${actionHtml}
          </div>
        </div>
      `;
    } catch (err) {
      const thinkingEl = document.getElementById('thinkingMsg');
      if (thinkingEl) thinkingEl.remove();
      msgs.innerHTML += `
        <div style="margin-bottom:10px;display:flex;gap:8px;">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:0.8rem;flex-shrink:0;">AI</div>
          <div style="color:var(--red);padding:10px 14px;font-size:0.85rem;">${escapeHtml(err.message)}</div>
        </div>
      `;
    }
    msgs.scrollTop = msgs.scrollHeight;
  }
};

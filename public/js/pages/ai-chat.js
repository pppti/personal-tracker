const AIChatPage = {
  history: [],

  async render(container) {
    container.innerHTML = `
      <div class="card" style="margin-bottom:10px;padding:10px 14px;font-size:0.78rem;color:var(--text-dim);background:var(--surface2);border-radius:8px;">
        连续对话，试试说：<br>
        "帮我梳理一个Bug修复的标准流程" → "第4步改成代码审查" → "再加一步：发布上线"<br>
        "我今天完成了仪表盘首页开发" → "把这条改成已完成，进度100%"
        ${this.history.length > 0 ? `<br><a href="#" id="clearHistory" style="color:var(--red);font-size:0.75rem;">清除对话历史</a>` : ''}
      </div>
      <div id="chatMessages" style="max-height:calc(100vh - 300px);overflow-y:auto;margin-bottom:10px;"></div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" id="chatVoiceBtn" title="语音输入">🎤</button>
        <input type="text" id="chatInput" placeholder="说说你想做什么..." style="flex:1;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-size:0.9rem;">
        <button class="btn btn-primary" id="chatSendBtn">发送</button>
      </div>
      <span id="chatVoiceStatus" style="display:none;font-size:0.78rem;color:var(--accent);">正在聆听...</span>
    `;

    // Render existing history
    const msgsEl = $('#chatMessages');
    for (const h of this.history) {
      if (h.role === 'user') {
        msgsEl.innerHTML += `<div style="margin-bottom:8px;display:flex;justify-content:flex-end;"><div style="max-width:85%;background:var(--accent);color:#fff;padding:8px 12px;border-radius:14px 14px 4px 14px;font-size:0.88rem;">${escapeHtml(h.content)}</div></div>`;
      } else if (h.role === 'assistant') {
        msgsEl.innerHTML += `<div style="margin-bottom:8px;display:flex;gap:6px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:0.7rem;flex-shrink:0;">AI</div><div style="background:var(--surface);border:1px solid var(--border);padding:8px 12px;border-radius:4px 14px 14px 14px;font-size:0.88rem;line-height:1.5;max-width:85%;">${escapeHtml(h.content)}</div></div>`;
      }
    }
    msgsEl.scrollTop = msgsEl.scrollHeight;

    $('#chatSendBtn').addEventListener('click', () => this.send());
    $('#chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
    });
    $('#clearHistory')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.history = [];
      this.render(container);
    });

    // Voice input
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      let recognition = null;
      $('#chatVoiceBtn').addEventListener('click', () => {
        if (recognition) { recognition.stop(); recognition = null; $('#chatVoiceStatus').style.display = 'none'; $('#chatVoiceBtn').textContent = '🎤'; return; }
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;
        recognition.addEventListener('result', (e) => {
          const t = e.results[0][0].transcript;
          $('#chatInput').value = $('#chatInput').value ? $('#chatInput').value + ' ' + t : t;
          $('#chatVoiceStatus').style.display = 'none';
          $('#chatVoiceBtn').textContent = '🎤';
          recognition = null;
          if ($('#chatInput').value.trim()) this.send();
        });
        recognition.addEventListener('error', () => {
          $('#chatVoiceStatus').style.display = 'none';
          $('#chatVoiceBtn').textContent = '🎤';
          recognition = null;
        });
        recognition.addEventListener('end', () => {
          $('#chatVoiceStatus').style.display = 'none';
          $('#chatVoiceBtn').textContent = '🎤';
          recognition = null;
        });
        recognition.start();
        $('#chatVoiceStatus').style.display = 'block';
        $('#chatVoiceBtn').textContent = '⏹';
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
    msgs.innerHTML += `<div style="margin-bottom:8px;display:flex;justify-content:flex-end;"><div style="max-width:85%;background:var(--accent);color:#fff;padding:8px 12px;border-radius:14px 14px 4px 14px;font-size:0.88rem;">${escapeHtml(message)}</div></div>`;
    msgs.innerHTML += `<div style="margin-bottom:8px;display:flex;gap:6px;" id="thinkingMsg"><div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:0.7rem;flex-shrink:0;">AI</div><div style="color:var(--text-dim);padding:8px 0;font-size:0.85rem;">思考中...</div></div>`;
    msgs.scrollTop = msgs.scrollHeight;

    try {
      const data = await API.post('/api/deepseek/chat/action', {
        message,
        history: this.history.slice(-16)
      });

      // Save to history
      this.history.push({ role: 'user', content: message });
      this.history.push({ role: 'assistant', content: data.reply });

      const thinkingEl = document.getElementById('thinkingMsg');
      if (thinkingEl) thinkingEl.remove();

      let actionsHtml = '';
      if (data.actions && data.actions.length > 0) {
        actionsHtml = data.actions.map(a => {
          if (a.action === 'create_entry') {
            const e = a.entry;
            return `<div style="margin-top:6px;padding:8px 10px;background:var(--surface2);border-radius:6px;border-left:3px solid var(--accent);font-size:0.78rem;">
              已创建：<strong>${escapeHtml(e.title)}</strong> ${statusLabel(e.status)} ${e.category||''}
            </div>`;
          }
          if (a.action === 'edit_entry') {
            const e = a.entry;
            return `<div style="margin-top:6px;padding:8px 10px;background:var(--surface2);border-radius:6px;border-left:3px solid var(--green);font-size:0.78rem;">
              已修改：<strong>${escapeHtml(e.title)}</strong> → ${statusLabel(e.status)} ${e.progress||0}%
            </div>`;
          }
          if (a.action === 'create_workflow') {
            const w = a.workflow;
            const steps = JSON.parse(w.steps||'[]');
            return `<div style="margin-top:6px;padding:8px 10px;background:var(--surface2);border-radius:6px;border-left:3px solid var(--accent);font-size:0.78rem;">
              已创建模板：<strong>${escapeHtml(w.name)}</strong><br>
              ${steps.map((s,i) => `${i+1}. ${escapeHtml(s)}`).join('<br>')}
            </div>`;
          }
          if (a.action === 'update_workflow') {
            const w = a.workflow;
            const steps = JSON.parse(w.steps||'[]');
            return `<div style="margin-top:6px;padding:8px 10px;background:var(--surface2);border-radius:6px;border-left:3px solid var(--yellow);font-size:0.78rem;">
              已更新模板：<strong>${escapeHtml(w.name)}</strong><br>
              ${steps.map((s,i) => `${i+1}. ${escapeHtml(s)}`).join('<br>')}
            </div>`;
          }
          if (a.action === 'set_reminder') {
            return `<div style="margin-top:6px;padding:8px 10px;background:var(--surface2);border-radius:6px;border-left:3px solid var(--yellow);font-size:0.78rem;">
              已设提醒：${escapeHtml(a.reminder.message)}（${a.reminder.remind_at}）
            </div>`;
          }
          return '';
        }).join('');
      }

      msgs.innerHTML += `<div style="margin-bottom:8px;display:flex;gap:6px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:0.7rem;flex-shrink:0;">AI</div><div style="max-width:85%;"><div style="background:var(--surface);border:1px solid var(--border);padding:8px 12px;border-radius:4px 14px 14px 14px;font-size:0.88rem;line-height:1.5;">${escapeHtml(data.reply)}</div>${actionsHtml}</div></div>`;
    } catch (err) {
      const thinkingEl = document.getElementById('thinkingMsg');
      if (thinkingEl) thinkingEl.remove();
      msgs.innerHTML += `<div style="margin-bottom:8px;display:flex;gap:6px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:0.7rem;flex-shrink:0;">AI</div><div style="color:var(--red);padding:8px 12px;font-size:0.85rem;">${escapeHtml(err.message)}</div></div>`;
    }
    msgs.scrollTop = msgs.scrollHeight;
  }
};

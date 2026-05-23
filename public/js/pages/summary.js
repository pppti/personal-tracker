const SummaryPage = {
  result: null,

  async render(container) {
    this.container = container;
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    container.innerHTML = `
      <h2 style="font-size:1rem;margin-bottom:14px;">生成汇总</h2>
      <div class="form-group">
        <label>开始日期</label>
        <input type="date" id="summaryStart" value="${weekAgo}">
      </div>
      <div class="form-group">
        <label>结束日期</label>
        <input type="date" id="summaryEnd" value="${today}">
      </div>
      <button class="btn btn-primary btn-block" id="generateBtn">生成汇总</button>
      <button class="btn btn-outline btn-block" id="aiSummaryBtn" style="margin-top:8px;">AI 智能汇总 (DeepSeek)</button>
      <div id="summaryResult"></div>
      <div id="aiResult"></div>

      <h2 style="font-size:1rem;margin:24px 0 14px;">AI 助手</h2>
      <div class="card">
        <p style="font-size:0.82rem;color:var(--text-dim);margin-bottom:10px;">基于你的工作记录智能问答。请先在设置中配置 DeepSeek API Key。</p>
        <div id="chatMessages" style="max-height:300px;overflow-y:auto;margin-bottom:10px;"></div>
        <div style="display:flex;gap:8px;">
          <input type="text" id="chatInput" placeholder="例如：我这周主要做了什么？" style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-size:0.9rem;">
          <button class="btn btn-primary" id="chatSendBtn">发送</button>
        </div>
      </div>
    `;

    $('#generateBtn').addEventListener('click', () => this.generate());
    $('#aiSummaryBtn').addEventListener('click', () => this.aiSummary());
    $('#chatSendBtn').addEventListener('click', () => this.chatSend());
    $('#chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.chatSend();
    });

    if (this.result) {
      this.renderResult();
    }
  },

  async generate() {
    const startDate = $('#summaryStart').value;
    const endDate = $('#summaryEnd').value;
    try {
      this.result = await API.post('/api/summary/generate', { startDate, endDate });
      this.renderResult();
    } catch (err) {
      showToast('错误：' + err.message);
    }
  },

  renderResult() {
    const r = this.result;
    const el = $('#summaryResult');
    el.innerHTML = `
      <div class="stats-grid" style="margin-top:14px;">
        <div class="stat-card accent"><div class="stat-num">${r.stats.total}</div><div class="stat-label">总数</div></div>
        <div class="stat-card green"><div class="stat-num">${r.stats.done}</div><div class="stat-label">已完成</div></div>
        <div class="stat-card yellow"><div class="stat-num">${r.stats.inProgress}</div><div class="stat-label">进行中</div></div>
        <div class="stat-card"><div class="stat-num">${r.stats.completionRate}%</div><div class="stat-label">完成率</div></div>
      </div>

      ${Object.keys(r.byCategory).length > 0 ? `
        <div class="card">
          <h4 style="font-size:0.85rem;color:var(--text-dim);margin-bottom:8px;">按分类统计</h4>
          ${Object.entries(r.byCategory).map(([cat, s]) => `
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;padding:4px 0;">
              <span>${escapeHtml(cat)}</span>
              <span>${s.done}/${s.total} 已完成</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${r.entries && r.entries.length > 0 ? `
        <div class="card">
          <h4 style="font-size:0.85rem;color:var(--text-dim);margin-bottom:10px;">明细 (${r.entries.length}条)</h4>
          ${r.entries.map(e => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div style="flex:1;">
                  <span style="font-size:0.9rem;font-weight:500;">${escapeHtml(e.title)}</span>
                  ${e.content ? `<div style="font-size:0.8rem;color:var(--text-dim);margin-top:2px;">${escapeHtml(e.content.slice(0, 200))}${e.content.length>200?'...':''}</div>` : ''}
                  <div style="font-size:0.75rem;color:var(--text-dim);margin-top:4px;">
                    ${e.category ? `<span>${escapeHtml(e.category)}</span> &middot; ` : ''}
                    ${e.deadline ? `<span>截止：${e.deadline}</span> &middot; ` : ''}
                    ${e.priority ? `<span class="badge badge-${e.priority}" style="font-size:0.65rem;">${e.priority}</span> &middot; ` : ''}
                    ${e.progress > 0 ? `<span>进度：${e.progress}%</span> &middot; ` : ''}
                    <span>${formatDate(e.created_at)}</span>
                  </div>
                </div>
                <span class="badge badge-${e.status}">${statusLabel(e.status)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="btn-group">
        <button class="btn btn-primary" id="copySummaryBtn">复制文本</button>
        <button class="btn btn-outline" id="copyMdBtn">复制 Markdown</button>
        <button class="btn btn-outline" id="downloadTxtBtn">下载 .txt</button>
        <button class="btn btn-outline" id="downloadMdBtn">下载 .md</button>
      </div>
    `;

    const exportData = async (format) => {
      const data = await API.post('/api/summary/export', {
        startDate: r.period.startDate,
        endDate: r.period.endDate,
        format
      });
      return data;
    };

    $('#copySummaryBtn').addEventListener('click', async () => {
      const data = await API.post('/api/summary/export', {
        startDate: r.period.startDate,
        endDate: r.period.endDate
      });
      copyToClipboard(data.text);
    });

    $('#copyMdBtn').addEventListener('click', async () => {
      const data = await API.post('/api/summary/export', {
        startDate: r.period.startDate,
        endDate: r.period.endDate
      });
      copyToClipboard(data.markdown);
    });

    $('#downloadTxtBtn').addEventListener('click', () => {
      exportData('txt').then(text => {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `summary-${r.period.startDate || 'all'}-to-${r.period.endDate || 'all'}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      });
    });

    $('#downloadMdBtn').addEventListener('click', () => {
      exportData('md').then(text => {
        const blob = new Blob([text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `summary-${r.period.startDate || 'all'}-to-${r.period.endDate || 'all'}.md`;
        a.click();
        URL.revokeObjectURL(url);
      });
    });
  },

  async aiSummary() {
    const el = $('#aiResult');
    el.innerHTML = '<div class="card" style="text-align:center;color:var(--text-dim);padding:20px;">正在生成 AI 汇总...</div>';
    try {
      const data = await API.post('/api/deepseek/ai-summary', {
        startDate: $('#summaryStart').value,
        endDate: $('#summaryEnd').value,
        language: 'zh'
      });
      el.innerHTML = `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 style="font-size:0.85rem;color:var(--text-dim);">AI 智能汇总</h4>
            <button class="btn btn-sm btn-outline" id="copyAiBtn">复制</button>
          </div>
          <div style="font-size:0.88rem;line-height:1.7;white-space:pre-wrap;" id="aiSummaryText">${escapeHtml(data.summary)}</div>
        </div>
      `;
      $('#copyAiBtn').addEventListener('click', () => copyToClipboard(data.summary));
    } catch (err) {
      el.innerHTML = `<div class="card" style="color:var(--red);">错误：${escapeHtml(err.message)}</div>`;
    }
  },

  async chatSend() {
    const input = $('#chatInput');
    const question = input.value.trim();
    if (!question) return;
    input.value = '';

    const msgs = $('#chatMessages');
    msgs.innerHTML += `<div style="margin-bottom:8px;"><strong style="color:var(--accent);">你：</strong> ${escapeHtml(question)}</div>`;
    msgs.innerHTML += '<div style="margin-bottom:8px;color:var(--text-dim);"><strong>AI：</strong> 思考中...</div>';
    msgs.scrollTop = msgs.scrollHeight;

    try {
      const data = await API.post('/api/deepseek/chat', { question });
      msgs.lastElementChild.innerHTML = `<strong style="color:var(--green);">AI：</strong> ${escapeHtml(data.answer)}`;
    } catch (err) {
      msgs.lastElementChild.innerHTML = `<strong style="color:var(--red);">错误：</strong> ${escapeHtml(err.message)}`;
    }
    msgs.scrollTop = msgs.scrollHeight;
  }
};

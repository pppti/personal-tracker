const SkincareTopicsPage = {
  async render(container) {
    this.container = container;
    container.innerHTML = `
      <p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:12px;">AI 结合你的产品卖点、热点素材和行业知识，策划高转化率的选题方案。</p>
      <div class="form-group"><label>关注方向（可选）</label><input id="topicFocus" placeholder="如：抗衰科普、成分党向、性价比对比...留空则综合策划"></div>
      <button class="btn btn-primary btn-block" id="genTopicsBtn">AI 策划选题</button>
      <p style="font-size:0.75rem;color:var(--text-dim);text-align:center;margin-top:4px;">生成约需 10-20 秒</p>
      <div id="topicsResult"></div>
    `;

    $('#genTopicsBtn').addEventListener('click', async () => {
      const btn = $('#genTopicsBtn');
      const area = $('#topicsResult');
      btn.disabled = true; btn.textContent = 'AI 策划中...';
      area.innerHTML = '<p style="text-align:center;color:var(--text-dim);padding:20px;">正在分析产品卖点 + 热点趋势...</p>';
      try {
        const result = await API.post('/api/skincare/topics/suggest', {
          focus: $('#topicFocus').value
        });
        area.innerHTML = `
          ${result.creative_topics && result.creative_topics.length > 0 ? `
          <h3 style="font-size:0.95rem;margin:16px 0 8px;color:var(--accent);">创意选题 (${result.creative_topics.length}个)</h3>
          ${result.creative_topics.map((t, i) => `
            <div class="card" style="border-left:3px solid var(--accent);margin-bottom:8px;">
              <p style="font-weight:600;">${i+1}. ${escapeHtml(t.topic)}</p>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0;">
                <span class="badge badge-in_progress">${escapeHtml(t.angle||'')}</span>
                <span class="badge badge-medium">${escapeHtml(t.style||'')}</span>
              </div>
              ${t.hook ? `<p style="font-size:0.82rem;color:var(--accent);margin-top:4px;">钩子：${escapeHtml(t.hook)}</p>` : ''}
              ${t.structure ? `<p style="font-size:0.82rem;margin-top:2px;">结构：${escapeHtml(t.structure)}</p>` : ''}
              ${t.why ? `<p style="font-size:0.8rem;color:var(--text-dim);margin-top:2px;">理由：${escapeHtml(t.why)}</p>` : ''}
            </div>
          `).join('')}
          ` : ''}

          ${result.series_suggestion ? `
          <div class="card" style="border-left:3px solid var(--green);">
            <h3 style="font-size:0.9rem;color:var(--green);">系列建议</h3>
            <p style="font-size:0.85rem;margin-top:4px;">${escapeHtml(result.series_suggestion)}</p>
          </div>` : ''}

          ${result.weekly_plan ? `
          <div class="card" style="border-left:3px solid var(--yellow);">
            <h3 style="font-size:0.9rem;color:var(--yellow);">一周排期建议</h3>
            ${result.weekly_plan.map((p, i) => `
              <p style="font-size:0.85rem;padding:4px 0;border-bottom:1px solid var(--border);">${escapeHtml(p)}</p>
            `).join('')}
          </div>` : ''}
        `;
      } catch (e) { area.innerHTML = `<p style="color:var(--red);">${escapeHtml(e.message)}</p>`; }
      btn.disabled = false; btn.textContent = '重新策划';
    });
  }
};

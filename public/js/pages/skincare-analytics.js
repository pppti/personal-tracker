const SkincareAnalyticsPage = {
  async render(container) {
    this.container = container;
    try {
      const stats = await API.get('/api/skincare/analytics');
      this.renderStats(container, stats);
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p>加载失败：${escapeHtml(e.message)}</p></div>`;
    }
  },

  renderStats(container, stats) {
    const hasVideos = stats.total_videos > 0;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card accent"><div class="stat-num">${stats.total_scripts}</div><div class="stat-label">总脚本</div></div>
        <div class="stat-card green"><div class="stat-num">${stats.final_scripts}</div><div class="stat-label">已定稿</div></div>
        <div class="stat-card"><div class="stat-num">${stats.total_videos}</div><div class="stat-label">发布视频</div></div>
      </div>

      ${hasVideos ? `
      <div class="stats-grid">
        <div class="stat-card accent"><div class="stat-num">${(stats.total_views||0).toLocaleString()}</div><div class="stat-label">总播放量</div></div>
        <div class="stat-card green"><div class="stat-num">${(stats.total_likes||0).toLocaleString()}</div><div class="stat-label">总点赞</div></div>
        <div class="stat-card yellow"><div class="stat-num">${(stats.total_comments||0).toLocaleString()}</div><div class="stat-label">总评论</div></div>
        <div class="stat-card"><div class="stat-num">${(stats.total_shares||0).toLocaleString()}</div><div class="stat-label">总分享</div></div>
      </div>

      <div class="card">
        <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-dim);">互动率</h3>
        <div style="font-size:0.85rem;display:grid;grid-template-columns:1fr 1fr;gap:4px;">
          <p>平均播放：${Math.round(stats.total_views / stats.total_videos).toLocaleString()}</p>
          <p>点赞率：${stats.total_views > 0 ? (stats.total_likes / stats.total_views * 100).toFixed(2) : 0}%</p>
          <p>评论率：${stats.total_views > 0 ? (stats.total_comments / stats.total_views * 100).toFixed(2) : 0}%</p>
          <p>商品点击：${(stats.total_clicks||0).toLocaleString()}</p>
        </div>
      </div>
      ` : '<div class="empty-state"><p>暂无视频数据</p><p style="font-size:0.8rem;">发布视频并录入数据后，这里会显示分析报表</p></div>'}

      ${stats.by_content_style && stats.by_content_style.length > 0 ? `
      <div class="card">
        <h3 style="font-size:0.9rem;margin-bottom:6px;color:var(--text-dim);">按内容风格</h3>
        ${stats.by_content_style.map(s => `
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.85rem;border-bottom:1px solid var(--border);">
            <span>${escapeHtml(s.content_style||'未知')}</span><span>${s.count} 条</span>
          </div>
        `).join('')}
      </div>` : ''}

      ${stats.by_platform && stats.by_platform.length > 0 ? `
      <div class="card">
        <h3 style="font-size:0.9rem;margin-bottom:6px;color:var(--text-dim);">按平台</h3>
        ${stats.by_platform.map(s => `
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.85rem;border-bottom:1px solid var(--border);">
            <span>${escapeHtml(s.platform||'未知')}</span><span>${s.count} 条 | 播放 ${(s.views||0).toLocaleString()}</span>
          </div>
        `).join('')}
      </div>` : ''}

      <button class="btn btn-primary btn-block" id="genReportBtn" style="margin-top:14px;">
        生成 AI 复盘报告
      </button>
      <p style="font-size:0.75rem;color:var(--text-dim);text-align:center;margin-top:4px;">AI 会综合分析你的视频数据、脚本、产品和热点，生成改进方向和选题建议</p>
      <div id="reportArea"></div>
    `;

    $('#genReportBtn').addEventListener('click', () => this.generateReport());
  },

  async generateReport() {
    const area = $('#reportArea');
    const btn = $('#genReportBtn');
    btn.disabled = true; btn.textContent = 'AI 分析中（约15-30秒）...';
    area.innerHTML = '<p style="text-align:center;color:var(--text-dim);padding:20px;">正在综合分析你的所有数据...</p>';

    try {
      const report = await API.post('/api/skincare/analytics/report', {});

      if (report.error || report.raw) {
        area.innerHTML = `<div class="card" style="border-left:3px solid var(--yellow);">
          <p style="font-size:0.85rem;">${escapeHtml(report.raw || report.error)}</p>
        </div>`;
        btn.disabled = false; btn.textContent = '重新生成报告';
        return;
      }

      // Render the AI report
      area.innerHTML = `
        ${report.summary ? `
        <div class="card" style="border-left:3px solid var(--accent);margin-top:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h3 style="font-size:1rem;">复盘总览</h3>
            ${report.summary.total_score ? `<span style="font-size:1.2rem;font-weight:700;color:var(--accent);">${escapeHtml(String(report.summary.total_score))}</span>` : ''}
          </div>
          <p style="font-size:0.9rem;line-height:1.6;">${escapeHtml(report.summary.overview||'')}</p>
          ${report.summary.key_metrics ? `<p style="font-size:0.85rem;color:var(--text-dim);margin-top:6px;">${escapeHtml(report.summary.key_metrics)}</p>` : ''}
        </div>` : ''}

        ${report.what_worked && report.what_worked.length > 0 ? `
        <div class="card" style="border-left:3px solid var(--green);">
          <h3 style="font-size:0.95rem;color:var(--green);margin-bottom:10px;">做得好的</h3>
          ${report.what_worked.map(w => `
            <div style="padding:8px 0;border-bottom:1px solid var(--border);">
              <p style="font-size:0.9rem;font-weight:600;">${escapeHtml(w.point)}</p>
              ${w.data ? `<p style="font-size:0.8rem;color:var(--text-dim);">数据：${escapeHtml(w.data)}</p>` : ''}
              ${w.keep ? `<span class="badge badge-done">继续</span>` : ''}
            </div>
          `).join('')}
        </div>` : ''}

        ${report.what_to_improve && report.what_to_improve.length > 0 ? `
        <div class="card" style="border-left:3px solid var(--yellow);">
          <h3 style="font-size:0.95rem;color:var(--yellow);margin-bottom:10px;">需要改进</h3>
          ${report.what_to_improve.map(w => `
            <div style="padding:8px 0;border-bottom:1px solid var(--border);">
              <p style="font-size:0.9rem;font-weight:600;">${escapeHtml(w.point)}</p>
              ${w.reason ? `<p style="font-size:0.82rem;color:var(--text-dim);">原因：${escapeHtml(w.reason)}</p>` : ''}
              ${w.action ? `<p style="font-size:0.82rem;color:var(--accent);">建议：${escapeHtml(w.action)}</p>` : ''}
            </div>
          `).join('')}
        </div>` : ''}

        ${report.topic_suggestions && report.topic_suggestions.length > 0 ? `
        <div class="card" style="border-left:3px solid var(--accent);">
          <h3 style="font-size:0.95rem;color:var(--accent);margin-bottom:10px;">选题建议</h3>
          ${report.topic_suggestions.map((t, i) => `
            <div style="padding:8px 0;border-bottom:1px solid var(--border);">
              <p style="font-size:0.9rem;font-weight:600;"><span style="color:var(--accent);">${i+1}.</span> ${escapeHtml(t.topic)}</p>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0;">
                ${t.angle ? `<span class="badge badge-in_progress">角度：${escapeHtml(t.angle)}</span>` : ''}
                ${t.style ? `<span class="badge badge-medium">风格：${escapeHtml(t.style)}</span>` : ''}
              </div>
              ${t.reason ? `<p style="font-size:0.82rem;color:var(--text-dim);">${escapeHtml(t.reason)}</p>` : ''}
            </div>
          `).join('')}
        </div>` : ''}

        ${report.next_week_plan ? `
        <div class="card" style="border-left:3px solid var(--green);">
          <h3 style="font-size:0.95rem;margin-bottom:6px;">下周行动建议</h3>
          ${report.next_week_plan.focus ? `<p style="font-size:0.9rem;font-weight:600;color:var(--accent);margin-bottom:6px;">重点：${escapeHtml(report.next_week_plan.focus)}</p>` : ''}
          ${report.next_week_plan.actions ? report.next_week_plan.actions.map((a, i) => `
            <div style="display:flex;align-items:flex-start;gap:6px;padding:4px 0;font-size:0.85rem;">
              <span style="color:var(--accent);font-weight:700;">${i+1}.</span>
              <span>${escapeHtml(a)}</span>
            </div>
          `).join('') : ''}
        </div>` : ''}
      `;

      btn.textContent = '重新生成报告';
    } catch (e) {
      area.innerHTML = `<p style="color:var(--red);padding:12px;">生成失败：${escapeHtml(e.message)}</p>`;
    }
    btn.disabled = false;
  }
};

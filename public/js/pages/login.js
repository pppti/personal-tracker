const LoginPage = {
  async render(container) {
    const status = await API.post('/api/auth/status');
    const isSetup = status.setup;

    const div = document.createElement('div');
    div.id = 'auth-screen';
    div.className = 'login-container';
    div.innerHTML = `
      <div class="login-card">
        <h1>个人工作追踪</h1>
        <p>${isSetup ? '请输入密码登录' : '首次使用，请设置登录密码'}</p>
        <form id="loginForm">
          <div class="form-group">
            <input type="password" id="loginPassword" placeholder="密码" autocomplete="current-password" required minlength="4">
          </div>
          ${!isSetup ? '<p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:12px;">此密码将用于所有设备的后续登录。</p>' : ''}
          <button type="submit" class="btn btn-primary btn-block">${isSetup ? '登录' : '设置密码并进入'}</button>
        </form>
        <p id="loginError" style="color:var(--red);margin-top:12px;font-size:0.85rem;display:none;"></p>
      </div>
    `;
    container.appendChild(div);

    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = $('#loginPassword').value;
      const errEl = $('#loginError');
      errEl.style.display = 'none';

      try {
        const endpoint = isSetup ? '/api/auth/login' : '/api/auth/setup';
        const data = await API.post(endpoint, { password });
        API.setToken(data.token);
        div.remove();
        location.hash = '#dashboard';
        router.route();
      } catch (err) {
        errEl.textContent = err.message === 'Wrong password' ? '密码错误' :
          err.message === 'Not set up yet' ? '尚未初始化' :
          err.message === 'Password must be at least 4 characters' ? '密码至少需要4个字符' : err.message;
        errEl.style.display = 'block';
        $('#loginPassword').value = '';
      }
    });
  }
};

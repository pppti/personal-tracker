const router = {
  currentPage: null,

  init() {
    this.bindNav();
    this.bindMenu();
    this.bindLogout();
    window.addEventListener('hashchange', () => this.route());
    this.route();
  },

  bindNav() {
    $$('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeSidebar();
        location.hash = el.getAttribute('href');
      });
    });
  },

  bindMenu() {
    $('#menuBtn').addEventListener('click', () => this.openSidebar());
    $('#overlay').addEventListener('click', () => this.closeSidebar());
  },

  bindLogout() {
    $('#logoutBtn').addEventListener('click', () => {
      API.clearToken();
      location.hash = '#login';
    });
  },

  openSidebar() {
    $('#sidebar').classList.add('open');
    $('#overlay').classList.remove('hidden');
  },

  closeSidebar() {
    $('#sidebar').classList.remove('open');
    $('#overlay').classList.add('hidden');
  },

  async route() {
    const token = API.getToken();
    if (!token) {
      this.showAuthScreen();
      return;
    }
    this.showAppShell();
    const hash = location.hash.slice(1) || 'dashboard';
    const page = hash.split('?')[0];
    this.highlightNav(page);

    const titles = {
      dashboard: '工作台',
      today: '今日待办',
      workflows: '流程模板',
      entries: '工作记录',
      'ai-chat': 'AI 助手',
      summary: '汇总导出',
      reminders: '提醒闹钟',
      skincare: '创作',
      settings: '设置'
    };
    $('#pageTitle').textContent = titles[page] || page;
    this.closeSidebar();

    const main = $('#main-content');
    main.innerHTML = '';

    try {
      switch (page) {
        case 'dashboard': await DashboardPage.render(main); break;
        case 'today': await TodayPage.render(main); break;
        case 'workflows': await WorkflowsPage.render(main); break;
        case 'entries': await EntriesPage.render(main); break;
        case 'ai-chat': await AIChatPage.render(main); break;
        case 'summary': await SummaryPage.render(main); break;
        case 'reminders': await RemindersPage.render(main); break;
        case 'skincare': await SkincareDashboardPage.render(main); break;
        case 'settings': await SettingsPage.render(main); break;
        default: main.innerHTML = '<p>页面未找到</p>';
      }
    } catch (e) {
      if (e.message === 'Unauthorized') {
        this.showAuthScreen();
        return;
      }
      main.innerHTML = '<p>页面加载失败</p>';
      console.error(e);
    }
  },

  highlightNav(page) {
    $$('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
  },

  showAuthScreen() {
    $('#topbar').classList.add('hidden');
    $('#sidebar').classList.add('hidden');
    $('#main-content').innerHTML = '';
    const oldAuth = document.getElementById('auth-screen');
    if (oldAuth) oldAuth.remove();
    LoginPage.render(document.body);
  },

  showAppShell() {
    const existing = $('#app');
    if (existing) {
      $('#topbar').classList.remove('hidden');
      $('#sidebar').classList.remove('hidden');
      const oldAuth = document.getElementById('auth-screen');
      if (oldAuth) oldAuth.remove();
    }
    this.startReminderPoll();
  },

  startReminderPoll() {
    if (this._polling) return;
    this._polling = true;
    this._notifiedIds = this._notifiedIds || new Set();
    this._checkReminders();
    this._pollInterval = setInterval(() => this._checkReminders(), 30000);
  },

  async _checkReminders() {
    try {
      if (!API.getToken()) return;
      const reminders = await API.get('/api/reminders');
      const now = new Date();
      for (const r of reminders) {
        if (r.notified || this._notifiedIds.has(r.id)) continue;
        const remindTime = new Date(r.remind_at.replace(' ', 'T'));
        if (remindTime <= now) {
          this._notifiedIds.add(r.id);
          // Browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('提醒', { body: r.message, icon: '/icon-192.png' });
          }
          // Toast
          showToast('提醒：' + r.message);
        }
      }
    } catch {}
  }
};

document.addEventListener('DOMContentLoaded', () => router.init());

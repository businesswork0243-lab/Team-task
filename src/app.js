// Main Application for Operations Workspace
import {
  BRANDS, CLIENTS, TEAM_MEMBERS, TASKS_DATA, HOLIDAYS_2026_OCT,
  STATUS_LIST, getClient, getMember, getBrand,
  getSessionUser, setSessionUser, loadSavedState, persistState
} from './data.js';
import { icon, workspaceLogo } from './icons.js';
import {
  isConfigured, getDbClients, getDbTeamMembers, getDbTasks,
  insertDbTask, updateDbTask, insertDbTeamMember, subscribeToTaskChanges
} from './supabase.js';

class WorkspaceApp {
  constructor() {
    const saved = loadSavedState();
    const sessionUserId = getSessionUser();

    this.state = {
      isLoggedIn: Boolean(sessionUserId),
      currentView: 'dashboard', // 'dashboard' | 'tasks' | 'clients'
      viewAs: sessionUserId || 'rakesh',
      loginTab: 'signup', // 'profiles' | 'email' | 'signup' (Default to signup if requested)
      tasks: saved?.tasks || JSON.parse(JSON.stringify(TASKS_DATA)),
      clients: saved?.clients || JSON.parse(JSON.stringify(CLIENTS)),
      teamMembers: saved?.teamMembers || TEAM_MEMBERS,
      activeStatusFilter: saved?.activeStatusFilter || 'total',
      selectedBrand: saved?.selectedBrand || 'all',
      selectedAssignee: saved?.selectedAssignee || 'all',
      currentYear: 2026,
      currentMonth: 9, // 0-indexed: 9 = October
      searchQuery: '',
      modalOpen: false,
      modalType: 'addTask', // 'addTask' | 'taskDetail' | 'addMember'
      selectedTask: null,
      toast: null,
      cloudConnected: isConfigured
    };

    this.initEventListeners();
    this.render();
    this.initDatabase();
  }

  async initDatabase() {
    if (isConfigured) {
      try {
        const [cloudClients, cloudTeam, cloudTasks] = await Promise.all([
          getDbClients(),
          getDbTeamMembers(),
          getDbTasks()
        ]);

        this.setState({
          clients: cloudClients,
          teamMembers: cloudTeam,
          tasks: cloudTasks,
          cloudConnected: true
        });

        // Real-time listener for tasks across multiple users
        this._unsubscribe = subscribeToTaskChanges(async () => {
          const freshTasks = await getDbTasks();
          this.setState({ tasks: freshTasks });
          this.toast('Sync: Tasks updated from cloud database.');
        });
      } catch (err) {
        console.warn('Could not sync with Supabase, using local state:', err);
      }
    }
  }

  setState(updater) {
    if (typeof updater === 'function') {
      this.state = { ...this.state, ...updater(this.state) };
    } else {
      this.state = { ...this.state, ...updater };
    }
    persistState(this.state);
    this.render();
  }

  initEventListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.state.modalOpen) {
        this.setState({ modalOpen: false, selectedTask: null });
      }
    });
  }

  toast(msg) {
    clearTimeout(this._toastTimer);
    this.setState({ toast: msg });
    this._toastTimer = setTimeout(() => {
      this.setState({ toast: null });
    }, 3500);
  }

  login(userId) {
    setSessionUser(userId);
    const member = this.state.teamMembers.find(m => m.id === userId) || this.state.teamMembers[0];
    this.setState({
      isLoggedIn: true,
      viewAs: userId,
      currentView: 'dashboard'
    });
    this.toast(`Welcome, ${member.name}! Signed in as ${member.role}.`);
  }

  logout() {
    setSessionUser(null);
    this.setState({
      isLoggedIn: false,
      loginTab: 'signup', // show signup/login choice
      currentView: 'dashboard'
    });
    this.toast('Logged out successfully.');
  }

  async createNewMember({ name, email, role, password }) {
    const isFounder = role === 'Owner & Founder';
    let allowedClients = [];
    if (isFounder || role === 'Operations lead' || role === 'Finance lead') {
      allowedClients = ['arc3', 'mer', 'sah', 'oak', 'lum'];
    } else if (role === 'Designer') {
      allowedClients = ['arc3', 'mer', 'oak'];
    } else if (role === 'Developer') {
      allowedClients = ['sah', 'oak', 'lum'];
    }

    const newId = 'u_' + Date.now();
    const newMember = {
      id: newId,
      name,
      email,
      role,
      badge: role.split(' ')[0],
      isFounder,
      allowedClients
    };

    const updatedTeam = [...this.state.teamMembers, newMember];

    this.setState({
      teamMembers: updatedTeam,
      modalOpen: false
    });

    if (isConfigured) {
      await insertDbTeamMember(newMember);
    }

    this.login(newId);
    this.toast(`Nayi ID ban gayi! Welcome, ${newMember.name}!`);
  }

  getCurrentUser() {
    return this.state.teamMembers.find(m => m.id === this.state.viewAs) || this.state.teamMembers[0];
  }

  isFounder() {
    return this.getCurrentUser().isFounder;
  }

  getVisibleClients() {
    const user = this.getCurrentUser();
    if (user.isFounder) return this.state.clients;
    return this.state.clients.filter(c => (user.allowedClients || []).includes(c.id));
  }

  getVisibleTasks() {
    const user = this.getCurrentUser();
    let tasks = this.state.tasks;

    // Filter by allowed clients if not founder
    if (!user.isFounder) {
      tasks = tasks.filter(t => (user.allowedClients || []).includes(t.client) || t.assignee === user.id);
    }

    // Filter by selected assignee dropdown
    if (this.state.selectedAssignee !== 'all') {
      tasks = tasks.filter(t => t.assignee === this.state.selectedAssignee);
    }

    // Filter by selected brand dropdown
    if (this.state.selectedBrand !== 'all') {
      tasks = tasks.filter(t => {
        const client = getClient(t.client);
        return client && client.brand === this.state.selectedBrand;
      });
    }

    // Filter by search query
    if (this.state.searchQuery.trim()) {
      const q = this.state.searchQuery.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (getClient(t.client)?.name || '').toLowerCase().includes(q)
      );
    }

    return tasks;
  }

  render() {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    // If user is logged out, render the Login/Registration Screen
    if (!this.state.isLoggedIn) {
      appEl.innerHTML = this.renderLoginPage();
      this.attachLoginEvents();
      return;
    }

    const user = this.getCurrentUser();
    const isFounder = user.isFounder;
    const visibleClients = this.getVisibleClients();
    const visibleTasks = this.getVisibleTasks();

    appEl.innerHTML = `
      <div class="app-layout">
        <!-- SIDEBAR -->
        <aside class="sidebar">
          <div class="sidebar-header">
            ${workspaceLogo(32)}
            <div class="sidebar-header-titles">
              <span class="sidebar-app-name">Operations</span>
              <span class="sidebar-workspace-name">Workspace</span>
            </div>
          </div>

          <nav class="sidebar-nav">
            <button class="nav-link ${this.state.currentView === 'dashboard' ? 'active' : ''}" data-nav="dashboard">
              ${icon('dashboard', 18)}
              <span class="nav-link-label">Dashboard</span>
            </button>

            <button class="nav-link ${this.state.currentView === 'tasks' ? 'active' : ''}" data-nav="tasks">
              ${icon('tasks', 18)}
              <span class="nav-link-label">Tasks</span>
              <span class="nav-badge">${this.state.tasks.length}</span>
            </button>

            <button class="nav-link ${this.state.currentView === 'clients' ? 'active' : ''}" data-nav="clients">
              ${icon('clients', 18)}
              <span class="nav-link-label">Clients</span>
              <span class="nav-badge">${visibleClients.length}</span>
            </button>
          </nav>

          <div class="sidebar-footer">
            <label class="sidebar-footer-label" for="viewing-as-select">VIEWING AS</label>
            <select id="viewing-as-select" class="viewing-as-select">
              ${this.state.teamMembers.map(m => `
                <option value="${m.id}" ${this.state.viewAs === m.id ? 'selected' : ''}>
                  ${m.name} · ${m.role}
                </option>
              `).join('')}
            </select>

            <button id="sidebar-add-member-btn" class="chip" style="width:100%;height:32px;justify-content:center;margin-top:4px;border-color:#334155;background:#1E293B;color:#F8FAFC;font-size:11.5px;cursor:pointer">
              ${icon('plus', 14)}
              <span>Add New User / ID</span>
            </button>

            <span class="sidebar-footer-caption">
              Access is enforced per person, per client.
            </span>
            <button id="logout-btn" class="logout-btn" title="Sign out of current account">
              ${icon('logout', 14)}
              Log out
            </button>
          </div>
        </aside>

        <!-- MAIN AREA -->
        <main class="main-content">
          <!-- TOP HEADER -->
          <header class="app-header">
            <div class="header-left">
              <div style="display:flex;align-items:center;gap:10px">
                <span class="header-breadcrumb">Overview</span>
                ${this.state.cloudConnected ? `
                  <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:#ECFDF5;color:#059669;display:inline-flex;align-items:center;gap:4px">
                    <span style="width:6px;height:6px;border-radius:50%;background:#10B981"></span>
                    Cloud Database
                  </span>
                ` : `
                  <span style="font-size:11px;font-weight:500;padding:2px 8px;border-radius:999px;background:#F1F5F9;color:#64748B;display:inline-flex;align-items:center;gap:4px" title="Configure VITE_SUPABASE_URL in .env or Vercel">
                    <span style="width:6px;height:6px;border-radius:50%;background:#94A3B8"></span>
                    Local Store
                  </span>
                `}
              </div>
              <h1 class="header-title">${this.state.currentView === 'dashboard' ? 'Dashboard' : (this.state.currentView === 'tasks' ? 'Tasks' : 'Clients')}</h1>
            </div>

            <div class="header-right">
              <div class="search-bar">
                ${icon('search', 16)}
                <input
                  id="search-input"
                  type="text"
                  placeholder="Search clients and team"
                  value="${this.escapeHtml(this.state.searchQuery)}"
                />
              </div>
              <button id="add-btn" class="add-btn">
                ${icon('plus', 16)}
                <span>Add</span>
              </button>
            </div>
          </header>

          <!-- PAGE BODY -->
          <div class="page-body">
            <!-- BANNER 1: RESTRICTION BANNER -->
            ${!isFounder ? `
              <div class="dark-restriction-banner">
                <span>Viewing as ${user.name}. ${visibleClients.length} of ${CLIENTS.length} clients visible, finance on 0.</span>
                <button id="back-to-founder-btn" class="back-to-founder-btn">
                  Back to founder view
                </button>
              </div>

              <!-- BANNER 2: VIEW ONLY BLUE NOTICE -->
              <div class="blue-info-banner">
                <span>View only. You can see Dashboard but can't add or change anything here.</span>
              </div>
            ` : ''}

            <!-- RENDER ACTIVE VIEW -->
            ${this.state.currentView === 'dashboard' ? this.renderDashboard(visibleTasks) : ''}
            ${this.state.currentView === 'tasks' ? this.renderTasksView(visibleTasks) : ''}
            ${this.state.currentView === 'clients' ? this.renderClientsView(visibleClients) : ''}
          </div>
        </main>

        <!-- MODAL & TOAST -->
        ${this.state.modalOpen ? this.renderModal() : ''}
        ${this.state.toast ? `<div class="toast-msg">${this.escapeHtml(this.state.toast)}</div>` : ''}
      </div>
    `;

    this.attachEvents();
  }

  renderLoginPage() {
    return `
      <div class="login-page-container">
        <div class="login-card">
          <div class="login-card-header">
            ${workspaceLogo(48)}
            <h1 class="login-title">Operations Workspace</h1>
            <p class="login-subtitle">Nayi ID banayein ya existing profile se sign in karein.</p>
          </div>

          <div class="login-tabs">
            <button class="login-tab-btn ${this.state.loginTab === 'signup' ? 'active' : ''}" data-login-tab="signup">
              + Create New ID (Sign Up)
            </button>
            <button class="login-tab-btn ${this.state.loginTab === 'profiles' ? 'active' : ''}" data-login-tab="profiles">
              Team Profiles (1-Click)
            </button>
            <button class="login-tab-btn ${this.state.loginTab === 'email' ? 'active' : ''}" data-login-tab="email">
              Sign In with Email
            </button>
          </div>

          <!-- TAB 1: SIGN UP (CREATE NEW ID) -->
          ${this.state.loginTab === 'signup' ? `
            <form id="signup-form" class="login-form-box">
              <label class="login-form-group">
                Full Name (Pura Naam)
                <input id="signup-name" type="text" class="login-input" placeholder="e.g. Sameer Thakur" required />
              </label>

              <label class="login-form-group">
                Email Address
                <input id="signup-email" type="email" class="login-input" placeholder="e.g. sameer@workspace.com" required />
              </label>

              <label class="login-form-group">
                Workspace Role & Permission
                <select id="signup-role" class="login-input" style="background:#fff;cursor:pointer">
                  <option value="Owner & Founder">Owner & Founder (Full access to all 5 clients)</option>
                  <option value="Operations lead">Operations lead (Manage tasks & all clients)</option>
                  <option value="Designer">Designer (Design clients: ARC3, Meridian, Oakline)</option>
                  <option value="Developer">Developer (Tech clients: Sahyadri, Oakline, Lumen)</option>
                  <option value="Finance lead">Finance lead (All client finances & reports)</option>
                  <option value="Team member" selected>Team member (Standard member view)</option>
                </select>
              </label>

              <label class="login-form-group">
                Create Password
                <input id="signup-password" type="password" class="login-input" placeholder="Choose a password" required value="workspace123" />
              </label>

              <button type="submit" class="login-submit-btn" style="background:#10B981">
                + Create ID & Enter Workspace (Nayi ID Banayein)
              </button>
            </form>
          ` : ''}

          <!-- TAB 2: PROFILES SELECTOR -->
          ${this.state.loginTab === 'profiles' ? `
            <div class="user-profiles-grid">
              ${this.state.teamMembers.map(m => {
                const isF = m.isFounder;
                const initials = m.name.split(' ').map(w => w[0]).slice(0, 2).join('');
                return `
                  <button class="user-profile-select-btn" data-login-user="${m.id}">
                    <div class="user-avatar-circle ${isF ? 'founder' : ''}">
                      ${initials}
                    </div>
                    <div class="user-info-meta">
                      <span class="user-info-name">${m.name}</span>
                      <span class="user-info-role">${m.role}</span>
                      <span class="user-access-tag">${isF ? '5 clients (Full Access)' : (m.allowedClients.length ? `${m.allowedClients.length} clients visible` : 'View only (0 clients)')}</span>
                    </div>
                  </button>
                `;
              }).join('')}
            </div>
          ` : ''}

          <!-- TAB 3: EMAIL & PASSWORD LOGIN -->
          ${this.state.loginTab === 'email' ? `
            <form id="email-login-form" class="login-form-box">
              <label class="login-form-group">
                Registered Email Address
                <input id="login-email" type="email" class="login-input" placeholder="e.g. rakesh@workspace.com" required value="rakesh@workspace.com" />
              </label>

              <label class="login-form-group">
                Password
                <input id="login-password" type="password" class="login-input" placeholder="••••••••" required value="workspace123" />
              </label>

              <button type="submit" class="login-submit-btn">
                Sign In to Workspace
              </button>
            </form>
          ` : ''}
        </div>

        ${this.state.toast ? `<div class="toast-msg">${this.escapeHtml(this.state.toast)}</div>` : ''}
      </div>
    `;
  }

  attachLoginEvents() {
    // Tab switching
    document.querySelectorAll('[data-login-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setState({ loginTab: btn.getAttribute('data-login-tab') });
      });
    });

    // Profile card click to login
    document.querySelectorAll('[data-login-user]').forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = btn.getAttribute('data-login-user');
        this.login(userId);
      });
    });

    // Sign up form
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
      signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name')?.value.trim();
        const email = document.getElementById('signup-email')?.value.trim().toLowerCase();
        const role = document.getElementById('signup-role')?.value;
        const password = document.getElementById('signup-password')?.value;

        if (!name || !email) return;

        // Check if email already registered
        const existing = this.state.teamMembers.find(m => m.email && m.email.toLowerCase() === email);
        if (existing) {
          this.toast('Yeh email pehle se registered hai! Signing in...');
          this.login(existing.id);
          return;
        }

        await this.createNewMember({ name, email, role, password });
      });
    }

    // Email login form
    const emailForm = document.getElementById('email-login-form');
    if (emailForm) {
      emailForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email')?.value.trim().toLowerCase();
        const matched = this.state.teamMembers.find(m => m.email && m.email.toLowerCase() === email);
        if (matched) {
          this.login(matched.id);
        } else {
          // If not matched, automatically create ID or inform
          this.toast('Email not found. Nayi ID banane ke liye Create New ID tab use karein.');
          this.setState({ loginTab: 'signup' });
        }
      });
    }
  }

  renderDashboard(visibleTasks) {
    const statusCounts = {
      total: visibleTasks.length,
      not_started: visibleTasks.filter(t => t.status === 'not_started').length,
      in_progress: visibleTasks.filter(t => t.status === 'in_progress').length,
      review: visibleTasks.filter(t => t.status === 'review').length,
      blocked: visibleTasks.filter(t => t.status === 'blocked').length,
      completed: visibleTasks.filter(t => t.status === 'completed').length,
      late: visibleTasks.filter(t => t.status === 'late').length
    };

    return `
      <!-- STATUS CARDS ROW -->
      <div class="status-cards-row">
        ${STATUS_LIST.map(st => `
          <div
            class="status-metric-card ${this.state.activeStatusFilter === st.id ? 'active' : ''}"
            data-status-filter="${st.id}"
          >
            <span class="status-metric-num">${statusCounts[st.id] ?? 0}</span>
            <span class="status-metric-label">${st.label}</span>
          </div>
        `).join('')}
      </div>

      <!-- CALENDAR CONTROLS BAR -->
      <div class="calendar-controls-bar">
        <div class="calendar-nav-left">
          <button id="prev-month-btn" class="icon-nav-btn" aria-label="Previous month">
            ${icon('chevron-left', 16)}
          </button>
          <div class="month-badge">October 2026</div>
          <button id="next-month-btn" class="icon-nav-btn" aria-label="Next month">
            ${icon('chevron-right', 16)}
          </button>
          <button id="today-btn" class="today-btn">Today</button>
        </div>

        <div class="calendar-filters-right">
          <select id="assignee-filter-select" class="filter-select">
            <option value="all" ${this.state.selectedAssignee === 'all' ? 'selected' : ''}>All assignees</option>
            ${this.state.teamMembers.map(m => `
              <option value="${m.id}" ${this.state.selectedAssignee === m.id ? 'selected' : ''}>${m.name}</option>
            `).join('')}
          </select>

          <select id="brand-filter-select" class="filter-select">
            ${BRANDS.map(b => `
              <option value="${b.id}" ${this.state.selectedBrand === b.id ? 'selected' : ''}>${b.name}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- CALENDAR GRID -->
      <div class="calendar-grid-card">
        <div class="calendar-week-header">
          <span>MON</span>
          <span>TUE</span>
          <span>WED</span>
          <span>THU</span>
          <span>FRI</span>
          <span>SAT</span>
          <span>SUN</span>
        </div>

        <div class="calendar-month-cells">
          ${this.renderCalendarCells(visibleTasks)}
        </div>
      </div>
    `;
  }

  renderCalendarCells(visibleTasks) {
    const cells = [];

    // Pre-month days: Sep 28, 29, 30
    const prevDays = [28, 29, 30];
    prevDays.forEach(d => {
      cells.push(`
        <div class="calendar-cell out-of-month">
          <div class="calendar-cell-top">
            <span class="calendar-day-number">${d}</span>
          </div>
        </div>
      `);
    });

    // October days 1 to 31
    for (let day = 1; day <= 31; day++) {
      const dateStr = `2026-10-${String(day).padStart(2, '0')}`;
      const holiday = HOLIDAYS_2026_OCT[dateStr];
      const isCurrentHighlight = day === 1;

      let dayTasks = visibleTasks.filter(t => t.date === dateStr);
      if (this.state.activeStatusFilter !== 'total') {
        dayTasks = dayTasks.filter(t => t.status === this.state.activeStatusFilter);
      }

      cells.push(`
        <div class="calendar-cell ${isCurrentHighlight ? 'current-highlight' : ''}" data-day="${dateStr}">
          <div class="calendar-cell-top">
            <span class="calendar-day-number">${day}</span>
          </div>

          ${holiday ? `<span class="holiday-tag">${holiday}</span>` : ''}

          ${dayTasks.map(t => `
            <div class="task-pill ${isCurrentHighlight ? 'in-highlight-cell' : ''}" data-task-id="${t.id}">
              <span>&#x25A2;</span>
              <span>1 task</span>
            </div>
          `).join('')}
        </div>
      `);
    }

    // Trailing days of November
    cells.push(`
      <div class="calendar-cell out-of-month">
        <div class="calendar-cell-top">
          <span class="calendar-day-number">1</span>
        </div>
      </div>
    `);

    return cells.join('');
  }

  renderTasksView(visibleTasks) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:14px;color:var(--text-muted)">Showing ${visibleTasks.length} active tasks</span>
      </div>

      <div class="tasks-container">
        ${visibleTasks.map(t => {
          const client = getClient(t.client);
          const assignee = getMember(t.assignee) || this.state.teamMembers.find(m => m.id === t.assignee);
          const st = STATUS_LIST.find(s => s.id === t.status) || STATUS_LIST[1];

          return `
            <div class="task-card-item" data-task-id="${t.id}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <span style="font-weight:700;font-size:15px">${t.title}</span>
                <span class="task-status-badge" style="background:${st.bg};color:${st.color};border:1px solid ${st.border}">
                  ${st.label}
                </span>
              </div>
              <p style="font-size:13px;color:var(--text-muted);line-height:1.4">${t.description}</p>
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--text-muted);border-top:1px solid #F1F5F9;padding-top:10px">
                <span>Client: <strong>${client?.name || 'N/A'}</strong></span>
                <span>Assignee: <strong>${assignee?.name || 'Unassigned'}</strong></span>
                <span>Date: ${t.date}</span>
              </div>
            </div>
          `;
        }).join('')}
        ${!visibleTasks.length ? `<div style="padding:40px;color:var(--text-muted)">No tasks match the selected criteria.</div>` : ''}
      </div>
    `;
  }

  renderClientsView(visibleClients) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:14px;color:var(--text-muted)">Showing ${visibleClients.length} clients</span>
      </div>

      <div class="clients-grid">
        ${visibleClients.map(c => `
          <div class="client-card-item">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:700;font-size:16px">${c.name}</span>
              <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:#F1F5F9;color:#334155">${c.status}</span>
            </div>
            <div style="font-size:13px;color:var(--text-muted)">
              <div>Contact: <strong>${c.contact}</strong></div>
              <div style="margin-top:4px">Monthly Retainer: <strong>₹${c.retainer.toLocaleString('en-IN')}</strong></div>
              <div style="margin-top:4px">Member since: ${c.since}</div>
            </div>
          </div>
        `).join('')}
        ${!visibleClients.length ? `<div style="padding:40px;color:var(--text-muted)">No clients visible to your current role.</div>` : ''}
      </div>
    `;
  }

  renderModal() {
    if (this.state.modalType === 'addMember') {
      return `
        <div class="modal-overlay" id="modal-overlay">
          <form class="modal-content" id="add-member-modal-form">
            <div class="modal-header">
              <h2 class="modal-title">+ Add New Team ID</h2>
              <button type="button" id="modal-close-btn" class="modal-close-btn">${icon('close', 18)}</button>
            </div>

            <label class="modal-form-group">
              Full Name (Pura Naam)
              <input name="name" class="modal-input" placeholder="e.g. Sameer Thakur" required />
            </label>

            <label class="modal-form-group">
              Email Address
              <input name="email" type="email" class="modal-input" placeholder="e.g. sameer@workspace.com" required />
            </label>

            <label class="modal-form-group">
              Role & Permission
              <select name="role" class="modal-select">
                <option value="Owner & Founder">Owner & Founder (Full access to all 5 clients)</option>
                <option value="Operations lead">Operations lead (Manage tasks & all clients)</option>
                <option value="Designer">Designer (Design clients: ARC3, Meridian, Oakline)</option>
                <option value="Developer">Developer (Tech clients: Sahyadri, Oakline, Lumen)</option>
                <option value="Finance lead">Finance lead (All client finances & reports)</option>
                <option value="Team member" selected>Team member (Standard member view)</option>
              </select>
            </label>

            <div class="modal-actions">
              <button type="button" id="modal-cancel-btn" class="today-btn">Cancel</button>
              <button type="submit" class="add-btn" style="height:38px;background:#10B981">Create Member ID</button>
            </div>
          </form>
        </div>
      `;
    }

    if (this.state.modalType === 'taskDetail' && this.state.selectedTask) {
      const t = this.state.selectedTask;
      const client = getClient(t.client);
      const assignee = getMember(t.assignee) || this.state.teamMembers.find(m => m.id === t.assignee);
      const st = STATUS_LIST.find(s => s.id === t.status) || STATUS_LIST[1];

      return `
        <div class="modal-overlay" id="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title">${t.title}</h2>
              <button id="modal-close-btn" class="modal-close-btn">${icon('close', 18)}</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px;font-size:13.5px">
              <div>
                <span class="task-status-badge" style="background:${st.bg};color:${st.color};border:1px solid ${st.border}">
                  ${st.label}
                </span>
              </div>
              <p style="color:var(--text-muted);line-height:1.5">${t.description}</p>
              <div style="display:flex;flex-direction:column;gap:6px;background:#F8FAFC;padding:12px;border-radius:8px">
                <div>Client: <strong>${client?.name || 'N/A'}</strong></div>
                <div>Assignee: <strong>${assignee?.name || 'Unassigned'}</strong></div>
                <div>Scheduled Date: <strong>${t.date}</strong></div>
                <div>Estimated hours: <strong>${t.hours}h</strong></div>
              </div>
            </div>
            <div class="modal-actions">
              <button id="modal-done-btn" class="add-btn" style="height:36px">Close</button>
            </div>
          </div>
        </div>
      `;
    }

    // Default: Add Task Modal
    return `
      <div class="modal-overlay" id="modal-overlay">
        <form class="modal-content" id="new-task-form">
          <div class="modal-header">
            <h2 class="modal-title">New Task</h2>
            <button type="button" id="modal-close-btn" class="modal-close-btn">${icon('close', 18)}</button>
          </div>

          <label class="modal-form-group">
            Task Title
            <input name="title" class="modal-input" placeholder="e.g. Q4 campaign concepts" required />
          </label>

          <label class="modal-form-group">
            Client
            <select name="client" class="modal-select" required>
              ${this.state.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </label>

          <label class="modal-form-group">
            Assignee
            <select name="assignee" class="modal-select" required>
              ${this.state.teamMembers.map(m => `<option value="${m.id}">${m.name} (${m.role})</option>`).join('')}
            </select>
          </label>

          <label class="modal-form-group">
            Due Date
            <input name="date" type="date" class="modal-input" value="2026-10-01" required />
          </label>

          <div class="modal-actions">
            <button type="button" id="modal-cancel-btn" class="today-btn">Cancel</button>
            <button type="submit" class="add-btn" style="height:38px">Create Task</button>
          </div>
        </form>
      </div>
    `;
  }

  attachEvents() {
    // Navigation
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setState({ currentView: btn.getAttribute('data-nav') });
      });
    });

    // Viewing as selector
    const viewingAsSelect = document.getElementById('viewing-as-select');
    if (viewingAsSelect) {
      viewingAsSelect.addEventListener('change', (e) => {
        this.login(e.target.value);
      });
    }

    // Back to founder view
    const backBtn = document.getElementById('back-to-founder-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.login('founder');
      });
    }

    // Add Member button inside sidebar
    const addMemberBtn = document.getElementById('sidebar-add-member-btn');
    if (addMemberBtn) {
      addMemberBtn.addEventListener('click', () => {
        this.setState({ modalOpen: true, modalType: 'addMember' });
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.logout();
      });
    }

    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.setState({ searchQuery: e.target.value });
      });
    }

    // Add button
    const addBtn = document.getElementById('add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (!this.isFounder()) {
          this.toast("View only. You don't have permission to create tasks.");
          return;
        }
        this.setState({ modalOpen: true, modalType: 'addTask' });
      });
    }

    // Status filter cards
    document.querySelectorAll('[data-status-filter]').forEach(card => {
      card.addEventListener('click', () => {
        const filter = card.getAttribute('data-status-filter');
        this.setState({ activeStatusFilter: filter });
      });
    });

    // Assignee and Brand select
    const assigneeSelect = document.getElementById('assignee-filter-select');
    if (assigneeSelect) {
      assigneeSelect.addEventListener('change', (e) => {
        this.setState({ selectedAssignee: e.target.value });
      });
    }

    const brandSelect = document.getElementById('brand-filter-select');
    if (brandSelect) {
      brandSelect.addEventListener('change', (e) => {
        this.setState({ selectedBrand: e.target.value });
      });
    }

    // Today reset
    const todayBtn = document.getElementById('today-btn');
    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        this.setState({ activeStatusFilter: 'total', selectedAssignee: 'all', selectedBrand: 'all' });
        this.toast('Reset to current month view.');
      });
    }

    // Task click to open details
    document.querySelectorAll('[data-task-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = el.getAttribute('data-task-id');
        const task = this.state.tasks.find(t => t.id === taskId);
        if (task) {
          this.setState({ modalOpen: true, modalType: 'taskDetail', selectedTask: task });
        }
      });
    });

    // Modal Close
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.setState({ modalOpen: false, selectedTask: null });
      });
    }

    const cancelBtn = document.getElementById('modal-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.setState({ modalOpen: false, selectedTask: null });
      });
    }

    const doneBtn = document.getElementById('modal-done-btn');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => {
        this.setState({ modalOpen: false, selectedTask: null });
      });
    }

    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          this.setState({ modalOpen: false, selectedTask: null });
        }
      });
    }

    // Add Member modal form submit
    const addMemberForm = document.getElementById('add-member-modal-form');
    if (addMemberForm) {
      addMemberForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(addMemberForm);
        const name = fd.get('name')?.trim();
        const email = fd.get('email')?.trim().toLowerCase();
        const role = fd.get('role');

        if (!name || !email) return;

        await this.createNewMember({ name, email, role });
      });
    }

    // New task form submit
    const newTaskForm = document.getElementById('new-task-form');
    if (newTaskForm) {
      newTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(newTaskForm);
        const newTask = {
          id: 't' + Date.now(),
          title: fd.get('title'),
          client: fd.get('client'),
          assignee: fd.get('assignee'),
          status: 'not_started',
          date: fd.get('date'),
          hours: 8,
          priority: 'Medium',
          description: 'Custom created task via workspace dashboard.'
        };

        this.setState(s => ({
          tasks: [newTask, ...s.tasks],
          modalOpen: false
        }));

        if (isConfigured) {
          await insertDbTask(newTask);
        }

        this.toast(`Task “${newTask.title}” created successfully!`);
      });
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Start app
document.addEventListener('DOMContentLoaded', () => {
  window.app = new WorkspaceApp();
});

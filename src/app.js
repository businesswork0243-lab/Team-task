// Complete Multi-Tenant Application for Operations Workspace
import {
  BRANDS, STATUS_LIST, HOLIDAYS_2026_OCT, SAMPLE_CLIENTS, SAMPLE_TASKS,
  getWorkspaces, saveWorkspace, deleteWorkspace, purgeLegacyStorage,
  getActiveWorkspaceId, setActiveWorkspaceId,
  getSessionUserId, setSessionUserId
} from './data.js';
import { icon, workspaceLogo } from './icons.js';
import {
  isConfigured, getDbWorkspaces, insertDbWorkspace,
  getDbClients, insertDbClient, deleteDbClient,
  getDbTeamMembers, insertDbTeamMember, findDbUserByEmail, fetchFullWorkspace, clearDbWorkspaceData,
  getDbTasks, insertDbTask, updateDbTask, deleteDbTask,
  subscribeToWorkspaceChanges
} from './supabase.js';

class WorkspaceApp {
  constructor() {
    this.state = {
      isLoggedIn: false,
      authTab: 'signup', // 'signup' | 'signin' | 'sandbox'
      currentView: 'dashboard', // 'dashboard' | 'tasks' | 'clients'

      // Multi-tenant core
      workspaces: getWorkspaces(),
      activeWorkspace: null,
      currentUser: null,

      // Tenant isolated data
      clients: [],
      tasks: [],
      teamMembers: [],

      // Filters & controls
      activeStatusFilter: 'total',
      selectedBrand: 'all',
      selectedAssignee: 'all',
      searchQuery: '',

      // Modals
      modalOpen: false,
      modalType: 'addTask', // 'addTask' | 'addClient' | 'addMember' | 'taskDetail'
      selectedTask: null,
      toast: null,
      cloudConnected: isConfigured
    };

    this.initSession();
    this.initEventListeners();
    this.render();
  }

  async initSession() {
    purgeLegacyStorage();
    const wsId = getActiveWorkspaceId();
    const userId = getSessionUserId();
    const allWs = getWorkspaces();

    if (isConfigured && wsId) {
      try {
        const fullWs = await fetchFullWorkspace(wsId);
        if (fullWs) {
          const user = (fullWs.teamMembers || []).find(m => m.id === userId) || fullWs.teamMembers?.[0];
          if (user) {
            this.setState({
              isLoggedIn: true,
              activeWorkspace: fullWs,
              currentUser: user,
              clients: fullWs.clients || [],
              tasks: fullWs.tasks || [],
              teamMembers: fullWs.teamMembers || []
            });
            return;
          }
        }
      } catch (e) {
        console.warn('Cloud session restore error', e);
      }
    }

    if (wsId && userId) {
      const activeWs = allWs.find(w => w.id === wsId);
      if (activeWs) {
        const team = activeWs.teamMembers || [];
        const user = team.find(m => m.id === userId);
        if (user) {
          this.state.isLoggedIn = true;
          this.state.activeWorkspace = activeWs;
          this.state.currentUser = user;
          this.state.clients = activeWs.clients || [];
          this.state.tasks = activeWs.tasks || [];
          this.state.teamMembers = team;
        }
      }
    }
  }

  setState(updater) {
    if (typeof updater === 'function') {
      this.state = { ...this.state, ...updater(this.state) };
    } else {
      this.state = { ...this.state, ...updater };
    }
    this.saveActiveTenant();
    this.render();
  }

  saveActiveTenant() {
    if (this.state.activeWorkspace) {
      const updatedWs = {
        ...this.state.activeWorkspace,
        clients: this.state.clients,
        tasks: this.state.tasks,
        teamMembers: this.state.teamMembers
      };
      saveWorkspace(updatedWs);
    }
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

  // Multi-tenant registration
  async registerNewTenant({ companyName, fullName, email, password, role }) {
    const wsId = 'ws_' + Date.now();
    const userId = 'u_' + Date.now();
    const isFounder = role === 'Owner & Founder';

    const founderMember = {
      id: userId,
      workspaceId: wsId,
      name: fullName,
      email,
      password: password || 'workspace123',
      role,
      isFounder,
      allowedClients: ['*'] // full access
    };

    const newWorkspace = {
      id: wsId,
      name: companyName,
      ownerId: userId,
      clients: [],
      tasks: [],
      teamMembers: [founderMember]
    };

    // Save locally
    saveWorkspace(newWorkspace);
    setActiveWorkspaceId(wsId);
    setSessionUserId(userId);

    // Save to Supabase Cloud if configured
    if (isConfigured) {
      await insertDbWorkspace(newWorkspace);
      await insertDbTeamMember(founderMember);
    }

    this.setState({
      isLoggedIn: true,
      activeWorkspace: newWorkspace,
      currentUser: founderMember,
      workspaces: getWorkspaces(),
      clients: [],
      tasks: [],
      teamMembers: [founderMember],
      currentView: 'dashboard'
    });

    this.toast(`Workspace “${companyName}” ban gaya! Welcome, ${fullName}!`);
  }

  loginUser(wsId, userId) {
    const allWs = getWorkspaces();
    const targetWs = allWs.find(w => w.id === wsId);
    if (!targetWs) return;

    const user = (targetWs.teamMembers || []).find(m => m.id === userId);
    if (!user) return;

    setActiveWorkspaceId(wsId);
    setSessionUserId(userId);

    this.setState({
      isLoggedIn: true,
      activeWorkspace: targetWs,
      currentUser: user,
      clients: targetWs.clients || [],
      tasks: targetWs.tasks || [],
      teamMembers: targetWs.teamMembers || [],
      currentView: 'dashboard'
    });

    this.toast(`Welcome back, ${user.name}!`);
  }

  async loginWithEmail(email, password) {
    if (!email) {
      this.toast('Kripya email enter karein.');
      return;
    }

    // 1. Supabase Cloud Check
    if (isConfigured) {
      try {
        const cloudUser = await findDbUserByEmail(email, password);
        if (cloudUser) {
          const fullWs = await fetchFullWorkspace(cloudUser.workspace_id);
          if (fullWs) {
            setActiveWorkspaceId(fullWs.id);
            setSessionUserId(cloudUser.id);
            saveWorkspace(fullWs);

            this.setState({
              isLoggedIn: true,
              activeWorkspace: fullWs,
              currentUser: cloudUser,
              clients: fullWs.clients || [],
              tasks: fullWs.tasks || [],
              teamMembers: fullWs.teamMembers || [],
              currentView: 'dashboard'
            });
            this.toast(`Welcome back, ${cloudUser.name}!`);
            return;
          }
        }
      } catch (e) {
        console.warn('Cloud login error', e);
      }
    }

    // 2. Local Workspaces Check
    const allWs = getWorkspaces();
    for (const ws of allWs) {
      const match = (ws.teamMembers || []).find(m =>
        m.email.toLowerCase() === email.toLowerCase() &&
        (!password || !m.password || m.password === password)
      );
      if (match) {
        setActiveWorkspaceId(ws.id);
        setSessionUserId(match.id);
        this.setState({
          isLoggedIn: true,
          activeWorkspace: ws,
          currentUser: match,
          clients: ws.clients || [],
          tasks: ws.tasks || [],
          teamMembers: ws.teamMembers || [],
          currentView: 'dashboard'
        });
        this.toast(`Welcome back, ${match.name}!`);
        return;
      }
    }

    this.toast('Invalid Email ya Password. Kripya check karein ya naya Workspace banayein.');
  }

  deleteWorkspaceEntry(wsId) {
    if (!confirm('Is workspace ko delete karein?')) return;
    deleteWorkspace(wsId);
    this.setState({ workspaces: getWorkspaces() });
    this.toast('Workspace delete ho gaya.');
  }

  logout() {
    setActiveWorkspaceId(null);
    setSessionUserId(null);

    this.setState({
      isLoggedIn: false,
      activeWorkspace: null,
      currentUser: null,
      clients: [],
      tasks: [],
      teamMembers: [],
      authTab: 'signin',
      currentView: 'dashboard',
      workspaces: getWorkspaces()
    });

    this.toast('Logged out successfully.');
  }

  // 1-Click Load Sample Demo Data into current tenant
  loadSampleDemoData() {
    if (!this.state.activeWorkspace) return;

    const wsId = this.state.activeWorkspace.id;
    const userId = this.state.currentUser.id;

    const sampleClientsWithWs = SAMPLE_CLIENTS.map(c => ({
      ...c,
      id: 'c_' + Date.now() + Math.floor(Math.random() * 1000),
      workspaceId: wsId
    }));

    const sampleTasksWithWs = SAMPLE_TASKS.map((t, idx) => ({
      ...t,
      id: 't_' + Date.now() + idx,
      workspaceId: wsId,
      client: sampleClientsWithWs[idx % sampleClientsWithWs.length].id,
      assignee: userId
    }));

    const updatedClients = [...this.state.clients, ...sampleClientsWithWs];
    const updatedTasks = [...this.state.tasks, ...sampleTasksWithWs];

    this.setState({
      clients: updatedClients,
      tasks: updatedTasks
    });

    if (isConfigured) {
      sampleClientsWithWs.forEach(c => insertDbClient(c));
      sampleTasksWithWs.forEach(t => insertDbTask(t));
    }

    this.toast('Sample demo data loaded successfully!');
  }

  // 1-Click Wipe All Data for this tenant
  async clearAllWorkspaceData() {
    if (!confirm('Kya aap is workspace ka saara data (clients aur tasks) permanently delete karna chahte hain?')) return;

    const wsId = this.state.activeWorkspace?.id;
    this.setState({
      clients: [],
      tasks: []
    });

    if (isConfigured && wsId) {
      await clearDbWorkspaceData(wsId);
    }

    this.toast('Saara data delete ho gaya! Workspace bilkul clean hai.');
  }

  // Client CRUD
  async createClient({ name, brand, retainer, contact }) {
    if (!this.state.activeWorkspace) return;

    const newClient = {
      id: 'client_' + Date.now(),
      workspaceId: this.state.activeWorkspace.id,
      name,
      brand: brand || 'main',
      retainer: Number(retainer) || 0,
      since: 'Oct 2026',
      contact: contact || '',
      status: 'Active'
    };

    const updated = [newClient, ...this.state.clients];
    this.setState({
      clients: updated,
      modalOpen: false
    });

    if (isConfigured) {
      await insertDbClient(newClient);
    }

    this.toast(`Client “${name}” create ho gaya!`);
  }

  async removeClient(clientId) {
    if (!confirm('Is client ko delete karein? Iske tasks bhi delete ho jayenge.')) return;

    const updatedClients = this.state.clients.filter(c => c.id !== clientId);
    const updatedTasks = this.state.tasks.filter(t => t.client !== clientId);

    this.setState({
      clients: updatedClients,
      tasks: updatedTasks
    });

    if (isConfigured) {
      await deleteDbClient(clientId);
    }

    this.toast('Client delete ho gaya.');
  }

  // Task CRUD
  async createTask({ title, client, assignee, date, hours, priority, description }) {
    if (!this.state.activeWorkspace) return;

    const newTask = {
      id: 'task_' + Date.now(),
      workspaceId: this.state.activeWorkspace.id,
      title,
      client: client || (this.state.clients[0]?.id || ''),
      assignee: assignee || this.state.currentUser.id,
      status: 'not_started',
      date: date || '2026-10-01',
      hours: Number(hours) || 8,
      priority: priority || 'Medium',
      description: description || 'Custom workspace task.'
    };

    const updated = [newTask, ...this.state.tasks];
    this.setState({
      tasks: updated,
      modalOpen: false
    });

    if (isConfigured) {
      await insertDbTask(newTask);
    }

    this.toast(`Task “${title}” create ho gaya!`);
  }

  async removeTask(taskId) {
    const updatedTasks = this.state.tasks.filter(t => t.id !== taskId);
    this.setState({
      tasks: updatedTasks,
      modalOpen: false,
      selectedTask: null
    });

    if (isConfigured) {
      await deleteDbTask(taskId);
    }

    this.toast('Task delete ho gaya.');
  }

  // Member CRUD
  async createTeamMember({ name, email, password, role }) {
    if (!this.state.activeWorkspace) return;

    const isFounder = role === 'Owner & Founder';
    const newMember = {
      id: 'u_' + Date.now(),
      workspaceId: this.state.activeWorkspace.id,
      name,
      email,
      password: password || 'team123',
      role,
      isFounder,
      allowedClients: isFounder ? ['*'] : this.state.clients.map(c => c.id)
    };

    const updatedTeam = [...this.state.teamMembers, newMember];
    this.setState({
      teamMembers: updatedTeam,
      modalOpen: false
    });

    if (isConfigured) {
      await insertDbTeamMember(newMember);
    }

    this.toast(`Naya member “${name}” ID create ho gaya!`);
  }

  // Render entrypoint
  render() {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    if (!this.state.isLoggedIn) {
      appEl.innerHTML = this.renderAuthScreen();
      this.attachAuthEvents();
      return;
    }

    const ws = this.state.activeWorkspace;
    const user = this.state.currentUser;
    const clients = this.state.clients;
    const tasks = this.state.tasks;

    appEl.innerHTML = `
      <div class="app-layout">
        <!-- SIDEBAR -->
        <aside class="sidebar">
          <div class="sidebar-header">
            ${workspaceLogo(32)}
            <div class="sidebar-header-titles">
              <span class="sidebar-app-name">Operations</span>
              <span class="sidebar-workspace-name">${this.escapeHtml(ws.name)}</span>
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
              <span class="nav-badge">${tasks.length}</span>
            </button>

            <button class="nav-link ${this.state.currentView === 'clients' ? 'active' : ''}" data-nav="clients">
              ${icon('clients', 18)}
              <span class="nav-link-label">Clients</span>
              <span class="nav-badge">${clients.length}</span>
            </button>
          </nav>

          <div class="sidebar-footer">
            <label class="sidebar-footer-label">Logged In User</label>
            <div style="display:flex;align-items:center;gap:8px;padding:4px 0">
              <span style="width:28px;height:28px;border-radius:50%;background:#4F46E5;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">
                ${user.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </span>
              <div style="flex:1;min-width:0;line-height:1.2">
                <div style="font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${user.name}</div>
                <div style="font-size:11px;color:#94A3B8">${user.role}</div>
              </div>
            </div>

            <!-- Viewing as selector if multiple members exist -->
            ${this.state.teamMembers.length > 1 ? `
              <label class="sidebar-footer-label" style="margin-top:4px">SWITCH ROLE / VIEW</label>
              <select id="switch-user-select" class="viewing-as-select">
                ${this.state.teamMembers.map(m => `
                  <option value="${m.id}" ${user.id === m.id ? 'selected' : ''}>${m.name} (${m.role})</option>
                `).join('')}
              </select>
            ` : ''}

            <button id="sidebar-add-member-btn" class="sidebar-action-btn">
              ${icon('plus', 14)}
              <span>+ Add Team Member ID</span>
            </button>

            <button id="logout-btn" class="logout-btn">
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
                <span class="header-breadcrumb">${this.escapeHtml(ws.name)}</span>
                ${this.state.cloudConnected ? `
                  <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:#ECFDF5;color:#059669;display:inline-flex;align-items:center;gap:4px">
                    <span style="width:6px;height:6px;border-radius:50%;background:#10B981"></span>
                    Cloud Multi-Tenant
                  </span>
                ` : `
                  <span style="font-size:11px;font-weight:500;padding:2px 8px;border-radius:999px;background:#F1F5F9;color:#64748B;display:inline-flex;align-items:center;gap:4px">
                    <span style="width:6px;height:6px;border-radius:50%;background:#94A3B8"></span>
                    Local Workspace
                  </span>
                `}
              </div>
              <h1 class="header-title">${this.state.currentView === 'dashboard' ? 'Dashboard' : (this.state.currentView === 'tasks' ? 'Tasks' : 'Clients')}</h1>
            </div>

            <div class="header-right">
              <div class="search-bar">
                ${icon('search', 16)}
                <input id="search-input" type="text" placeholder="Search clients and tasks..." value="${this.escapeHtml(this.state.searchQuery)}" />
              </div>

              <button id="header-add-client-btn" class="outline-btn">
                ${icon('plus', 14)}
                <span>Client</span>
              </button>

              <button id="header-add-task-btn" class="add-btn">
                ${icon('plus', 14)}
                <span>Task</span>
              </button>
            </div>
          </header>

          <!-- PAGE BODY -->
          <div class="page-body">
            <!-- WORKSPACE ONBOARDING & DATA CONTROLS BAR -->
            <div class="workspace-onboarding-bar">
              <div class="workspace-onboarding-bar-left">
                <span>Workspace: <strong>${this.escapeHtml(ws.name)}</strong> · ${clients.length} Clients · ${tasks.length} Tasks</span>
              </div>
              <div class="workspace-onboarding-bar-right">
                <button id="load-sample-btn" class="small-btn">
                  ⚡ Load Sample Demo Data
                </button>
                ${(clients.length > 0 || tasks.length > 0) ? `
                  <button id="clear-data-btn" class="small-btn danger">
                    🗑️ Clear All Data
                  </button>
                ` : ''}
              </div>
            </div>

            <!-- ACTIVE VIEW CONTENT -->
            ${this.state.currentView === 'dashboard' ? this.renderDashboard() : ''}
            ${this.state.currentView === 'tasks' ? this.renderTasksView() : ''}
            ${this.state.currentView === 'clients' ? this.renderClientsView() : ''}
          </div>
        </main>

        <!-- MODAL & TOAST -->
        ${this.state.modalOpen ? this.renderModal() : ''}
        ${this.state.toast ? `<div class="toast-msg">${this.escapeHtml(this.state.toast)}</div>` : ''}
      </div>
    `;

    this.attachWorkspaceEvents();
  }

  // ========================================================
  // AUTHENTICATION & MULTI-TENANT SIGNUP SCREEN
  // ========================================================
  renderAuthScreen() {
    const allWs = getWorkspaces();

    return `
      <div class="login-page-container">
        <div class="login-card">
          <div class="login-card-header">
            ${workspaceLogo(48)}
            <h1 class="login-title">Operations Workspace</h1>
            <p class="login-subtitle">Multi-Tenant Platform. Apna naya workspace banayein ya existing ID se login karein.</p>
          </div>

          <div class="login-tabs">
            <button class="login-tab-btn ${this.state.authTab === 'signup' ? 'active' : ''}" data-auth-tab="signup">
              + Register New Workspace (Nayi ID)
            </button>
            <button class="login-tab-btn ${this.state.authTab === 'signin' ? 'active' : ''}" data-auth-tab="signin">
              Sign In (Existing User)
            </button>
          </div>

          <!-- TAB 1: REGISTER NEW TENANT / WORKSPACE -->
          ${this.state.authTab === 'signup' ? `
            <form id="register-tenant-form" class="login-form-box">
              <label class="login-form-group">
                Company / Agency Workspace Name
                <input id="reg-ws-name" type="text" class="login-input" placeholder="e.g. Thakur Operations / Acme Media" required />
              </label>

              <label class="login-form-group">
                Your Full Name (Pura Naam)
                <input id="reg-full-name" type="text" class="login-input" placeholder="e.g. Sameer Thakur" required />
              </label>

              <label class="login-form-group">
                Email Address
                <input id="reg-email" type="email" class="login-input" placeholder="e.g. sameer@mycompany.com" required />
              </label>

              <label class="login-form-group">
                Account Role
                <select id="reg-role" class="login-input" style="cursor:pointer">
                  <option value="Owner & Founder" selected>Owner & Founder (Full control over all clients & team)</option>
                  <option value="Operations lead">Operations lead</option>
                  <option value="Team member">Team member</option>
                </select>
              </label>

              <label class="login-form-group">
                Set Password
                <input id="reg-password" type="password" class="login-input" placeholder="Choose a password" required value="workspace123" />
              </label>

              <button type="submit" class="login-submit-btn">
                <span>+ Create My Workspace & Launch Dashboard</span>
              </button>
            </form>
          ` : ''}

          <!-- TAB 2: SIGN IN TO EXISTING WORKSPACE -->
          ${this.state.authTab === 'signin' ? `
            <div style="display:flex;flex-direction:column;gap:16px">
              <form id="email-signin-form" class="login-form-box" style="margin-bottom:0">
                <label class="login-form-group">
                  Your Account Email
                  <input id="signin-email" type="email" class="login-input" placeholder="e.g. sameer@mycompany.com" required />
                </label>

                <label class="login-form-group">
                  Password
                  <input id="signin-password" type="password" class="login-input" placeholder="Enter your password" required />
                </label>

                <button type="submit" class="login-submit-btn">
                  <span>Sign In to Workspace</span>
                </button>
              </form>

              <div style="position:relative;text-align:center;margin:4px 0">
                <div style="position:absolute;top:50%;left:0;right:0;border-top:1px solid #E2E8F0"></div>
                <span style="position:relative;background:#fff;padding:0 10px;font-size:11px;font-weight:700;color:#94A3B8;letter-spacing:0.5px">
                  OR QUICK SELECT SAVED WORKSPACE
                </span>
              </div>

              ${allWs.length ? `
                <div style="display:flex;flex-direction:column;gap:8px">
                  ${allWs.map(w => {
                    const owner = (w.teamMembers || [])[0];
                    return `
                      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-radius:8px;border:1px solid #E2E8F0;background:#F8FAFC">
                        <div style="min-width:0;flex:1">
                          <div style="font-weight:700;font-size:14px;color:#0F172A">${this.escapeHtml(w.name)}</div>
                          <div style="font-size:12px;color:#64748B">${(w.teamMembers || []).length} team member(s) · ${(w.clients || []).length} client(s)</div>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px">
                          <button class="small-btn signin-ws-btn" data-ws-id="${w.id}" data-user-id="${owner ? owner.id : ''}" style="background:#4F46E5;color:#fff;border-color:#4F46E5">
                            Open
                          </button>
                          <button class="small-btn danger delete-ws-btn" data-ws-id="${w.id}" title="Delete workspace from browser" style="padding:4px 8px">
                            🗑️
                          </button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : `
                <div style="padding:14px;text-align:center;color:#64748B;font-size:12.5px;background:#F8FAFC;border-radius:8px;border:1px dashed #CBD5E1">
                  Is browser me koi saved workspace nahi hai. Nayi ID banane ke liye upar <strong>+ Register New Workspace</strong> click karein!
                </div>
              `}
            </div>
          ` : ''}
        </div>

        ${this.state.toast ? `<div class="toast-msg">${this.escapeHtml(this.state.toast)}</div>` : ''}
      </div>
    `;
  }

  attachAuthEvents() {
    document.querySelectorAll('[data-auth-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setState({ authTab: btn.getAttribute('data-auth-tab') });
      });
    });

    const regForm = document.getElementById('register-tenant-form');
    if (regForm) {
      regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const companyName = document.getElementById('reg-ws-name')?.value.trim();
        const fullName = document.getElementById('reg-full-name')?.value.trim();
        const email = document.getElementById('reg-email')?.value.trim().toLowerCase();
        const role = document.getElementById('reg-role')?.value;
        const password = document.getElementById('reg-password')?.value;

        if (!companyName || !fullName || !email) return;

        await this.registerNewTenant({ companyName, fullName, email, password, role });
      });
    }

    const emailSigninForm = document.getElementById('email-signin-form');
    if (emailSigninForm) {
      emailSigninForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signin-email')?.value.trim();
        const password = document.getElementById('signin-password')?.value;
        await this.loginWithEmail(email, password);
      });
    }

    document.querySelectorAll('.signin-ws-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const wsId = btn.getAttribute('data-ws-id');
        const userId = btn.getAttribute('data-user-id');
        this.loginUser(wsId, userId);
      });
    });

    document.querySelectorAll('.delete-ws-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const wsId = btn.getAttribute('data-ws-id');
        this.deleteWorkspaceEntry(wsId);
      });
    });
  }

  // ========================================================
  // DASHBOARD VIEW
  // ========================================================
  renderDashboard() {
    const clients = this.state.clients;
    const tasks = this.state.tasks;

    // If completely empty workspace, render Onboarding Empty State
    if (!clients.length && !tasks.length) {
      return `
        <div class="empty-state-box">
          <div class="empty-state-icon">
            ${icon('dashboard', 26)}
          </div>
          <h2 class="empty-state-title">Welcome to your clean Workspace!</h2>
          <p class="empty-state-desc">
            Aapka workspace abhi bilkul fresh hai — isme koi purana ya demo data nahi hai. Aap apna pehla Client ya Task add karke shuruat kar sakte hain.
          </p>
          <div class="empty-state-actions">
            <button id="empty-add-client-btn" class="add-btn">
              ${icon('plus', 16)}
              <span>+ Add Your First Client</span>
            </button>
            <button id="empty-add-task-btn" class="outline-btn">
              ${icon('plus', 16)}
              <span>+ Add First Task</span>
            </button>
          </div>
        </div>
      `;
    }

    // Filter tasks
    let visibleTasks = tasks;
    if (this.state.selectedAssignee !== 'all') {
      visibleTasks = visibleTasks.filter(t => t.assignee === this.state.selectedAssignee);
    }
    if (this.state.selectedBrand !== 'all') {
      visibleTasks = visibleTasks.filter(t => {
        const c = clients.find(cl => cl.id === t.client);
        return c && c.brand === this.state.selectedBrand;
      });
    }

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
      <!-- STATUS METRICS ROW -->
      <div class="status-cards-row">
        ${STATUS_LIST.map(st => `
          <div class="status-metric-card ${this.state.activeStatusFilter === st.id ? 'active' : ''}" data-status-filter="${st.id}">
            <span class="status-metric-num">${statusCounts[st.id] ?? 0}</span>
            <span class="status-metric-label">${st.label}</span>
          </div>
        `).join('')}
      </div>

      <!-- CALENDAR CONTROLS BAR -->
      <div class="calendar-controls-bar">
        <div class="calendar-nav-left">
          <button class="icon-nav-btn">${icon('chevron-left', 16)}</button>
          <div class="month-badge">October 2026</div>
          <button class="icon-nav-btn">${icon('chevron-right', 16)}</button>
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
    [28, 29, 30].forEach(d => {
      cells.push(`
        <div class="calendar-cell out-of-month">
          <div class="calendar-cell-top"><span class="calendar-day-number">${d}</span></div>
        </div>
      `);
    });

    for (let day = 1; day <= 31; day++) {
      const dateStr = `2026-10-${String(day).padStart(2, '0')}`;
      const holiday = HOLIDAYS_2026_OCT[dateStr];
      const isToday = day === 1;

      let dayTasks = visibleTasks.filter(t => t.date === dateStr);
      if (this.state.activeStatusFilter !== 'total') {
        dayTasks = dayTasks.filter(t => t.status === this.state.activeStatusFilter);
      }

      cells.push(`
        <div class="calendar-cell ${isToday ? 'current-highlight' : ''}" data-day="${dateStr}">
          <div class="calendar-cell-top">
            <span class="calendar-day-number">${day}</span>
          </div>
          ${holiday ? `<span class="holiday-tag">${holiday}</span>` : ''}
          ${dayTasks.map(t => `
            <div class="task-pill" data-task-id="${t.id}" title="${t.title}">
              <span>&#x25A2;</span>
              <span>${t.title}</span>
            </div>
          `).join('')}
        </div>
      `);
    }

    cells.push(`
      <div class="calendar-cell out-of-month">
        <div class="calendar-cell-top"><span class="calendar-day-number">1</span></div>
      </div>
    `);

    return cells.join('');
  }

  // ========================================================
  // TASKS VIEW
  // ========================================================
  renderTasksView() {
    const clients = this.state.clients;
    const tasks = this.state.tasks;

    if (!tasks.length) {
      return `
        <div class="empty-state-box">
          <div class="empty-state-icon">${icon('tasks', 26)}</div>
          <h2 class="empty-state-title">No tasks found</h2>
          <p class="empty-state-desc">Aapke workspace me koi task nahi hai. Naya task create karne ke liye button par click karein.</p>
          <button id="view-add-task-btn" class="add-btn">+ Add New Task</button>
        </div>
      `;
    }

    return `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13.5px;color:var(--text-muted)">Total ${tasks.length} tasks scheduled</span>
        <button id="view-add-task-btn" class="add-btn">+ Add Task</button>
      </div>

      <div class="cards-grid-layout">
        ${tasks.map(t => {
          const client = clients.find(c => c.id === t.client);
          const assignee = this.state.teamMembers.find(m => m.id === t.assignee);
          const st = STATUS_LIST.find(s => s.id === t.status) || STATUS_LIST[1];

          return `
            <div class="card-item" data-task-id="${t.id}">
              <div class="card-item-top">
                <span style="font-weight:700;font-size:15px;color:#0F172A">${t.title}</span>
                <button class="delete-icon-btn delete-task-btn" data-task-id="${t.id}" title="Delete task">
                  ${icon('close', 16)}
                </button>
              </div>

              <div>
                <span class="task-status-badge" style="background:${st.bg};color:${st.color};border:1px solid ${st.border}">${st.label}</span>
              </div>

              <p style="font-size:13px;color:var(--text-muted);line-height:1.4">${t.description || 'No description'}</p>

              <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--text-muted);border-top:1px solid #F1F5F9;padding-top:10px">
                <span>Client: <strong>${client ? client.name : 'N/A'}</strong></span>
                <span>Assignee: <strong>${assignee ? assignee.name : 'Unassigned'}</strong></span>
                <span>Date: ${t.date}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ========================================================
  // CLIENTS VIEW
  // ========================================================
  renderClientsView() {
    const clients = this.state.clients;

    if (!clients.length) {
      return `
        <div class="empty-state-box">
          <div class="empty-state-icon">${icon('clients', 26)}</div>
          <h2 class="empty-state-title">No clients in this workspace</h2>
          <p class="empty-state-desc">Abhi koi client add nahi hua hai. Apna pehla client register karein.</p>
          <button id="view-add-client-btn" class="add-btn">+ Add Client</button>
        </div>
      `;
    }

    return `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13.5px;color:var(--text-muted)">Total ${clients.length} active clients</span>
        <button id="view-add-client-btn" class="add-btn">+ Add Client</button>
      </div>

      <div class="cards-grid-layout">
        ${clients.map(c => `
          <div class="card-item">
            <div class="card-item-top">
              <span style="font-weight:700;font-size:16px">${c.name}</span>
              <button class="delete-icon-btn delete-client-btn" data-client-id="${c.id}" title="Delete client">
                ${icon('close', 16)}
              </button>
            </div>

            <div style="font-size:13px;color:var(--text-muted);display:flex;flex-direction:column;gap:4px">
              <div>Contact Person: <strong>${c.contact || 'N/A'}</strong></div>
              <div>Monthly Retainer: <strong>₹${Number(c.retainer).toLocaleString('en-IN')}</strong></div>
              <div>Category: <strong>${c.brand}</strong></div>
              <div>Since: ${c.since}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ========================================================
  // MODALS
  // ========================================================
  renderModal() {
    // 1. ADD CLIENT MODAL
    if (this.state.modalType === 'addClient') {
      return `
        <div class="modal-overlay" id="modal-overlay">
          <form class="modal-content" id="add-client-form">
            <div class="modal-header">
              <h2 class="modal-title">+ Add Client to Workspace</h2>
              <button type="button" id="modal-close-btn" class="modal-close-btn">${icon('close', 18)}</button>
            </div>

            <label class="modal-form-group">
              Client / Company Name
              <input name="name" class="modal-input" placeholder="e.g. Reliance Retail / Tata Sons" required />
            </label>

            <label class="modal-form-group">
              Brand / Category
              <select name="brand" class="modal-select">
                <option value="main">Primary Brand</option>
                <option value="studio">Design Studio</option>
                <option value="tech">Technology</option>
                <option value="marketing">Marketing</option>
              </select>
            </label>

            <label class="modal-form-group">
              Monthly Retainer (₹)
              <input name="retainer" type="number" class="modal-input" placeholder="e.g. 150000" required />
            </label>

            <label class="modal-form-group">
              Primary Contact Person
              <input name="contact" class="modal-input" placeholder="e.g. Rajesh Sharma" required />
            </label>

            <div class="modal-actions">
              <button type="button" id="modal-cancel-btn" class="today-btn">Cancel</button>
              <button type="submit" class="add-btn">Save Client</button>
            </div>
          </form>
        </div>
      `;
    }

    // 2. ADD TASK MODAL
    if (this.state.modalType === 'addTask') {
      return `
        <div class="modal-overlay" id="modal-overlay">
          <form class="modal-content" id="add-task-form">
            <div class="modal-header">
              <h2 class="modal-title">+ Create New Task</h2>
              <button type="button" id="modal-close-btn" class="modal-close-btn">${icon('close', 18)}</button>
            </div>

            <label class="modal-form-group">
              Task Title
              <input name="title" class="modal-input" placeholder="e.g. Website re-design sprint 1" required />
            </label>

            <label class="modal-form-group">
              Client
              <select name="client" class="modal-select">
                ${this.state.clients.length ? `
                  ${this.state.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                ` : `<option value="">No clients (General Task)</option>`}
              </select>
            </label>

            <label class="modal-form-group">
              Assignee
              <select name="assignee" class="modal-select">
                ${this.state.teamMembers.map(m => `<option value="${m.id}">${m.name} (${m.role})</option>`).join('')}
              </select>
            </label>

            <label class="modal-form-group">
              Due Date
              <input name="date" type="date" class="modal-input" value="2026-10-01" required />
            </label>

            <label class="modal-form-group">
              Estimated Hours
              <input name="hours" type="number" class="modal-input" value="8" />
            </label>

            <label class="modal-form-group">
              Description
              <textarea name="description" class="modal-input" style="height:60px;padding:8px" placeholder="Task details and instructions"></textarea>
            </label>

            <div class="modal-actions">
              <button type="button" id="modal-cancel-btn" class="today-btn">Cancel</button>
              <button type="submit" class="add-btn">Create Task</button>
            </div>
          </form>
        </div>
      `;
    }

    // 3. ADD TEAM MEMBER MODAL
    if (this.state.modalType === 'addMember') {
      return `
        <div class="modal-overlay" id="modal-overlay">
          <form class="modal-content" id="add-member-form">
            <div class="modal-header">
              <h2 class="modal-title">+ Add Team Member ID</h2>
              <button type="button" id="modal-close-btn" class="modal-close-btn">${icon('close', 18)}</button>
            </div>

            <label class="modal-form-group">
              Full Name (Pura Naam)
              <input name="name" class="modal-input" placeholder="e.g. Rohit Verma" required />
            </label>

            <label class="modal-form-group">
              Email Address
              <input name="email" type="email" class="modal-input" placeholder="e.g. rohit@workspace.com" required />
            </label>

            <label class="modal-form-group">
              Login Password
              <input name="password" type="password" class="modal-input" placeholder="Set member login password" value="workspace123" required />
            </label>

            <label class="modal-form-group">
              Role & Access Level
              <select name="role" class="modal-select">
                <option value="Operations lead">Operations lead (Manage tasks & clients)</option>
                <option value="Designer">Designer</option>
                <option value="Developer">Developer</option>
                <option value="Finance lead">Finance lead</option>
                <option value="Team member" selected>Team member (Standard access)</option>
              </select>
            </label>

            <div class="modal-actions">
              <button type="button" id="modal-cancel-btn" class="today-btn">Cancel</button>
              <button type="submit" class="add-btn">Add Member</button>
            </div>
          </form>
        </div>
      `;
    }

    // 4. TASK DETAIL MODAL
    if (this.state.modalType === 'taskDetail' && this.state.selectedTask) {
      const t = this.state.selectedTask;
      const client = this.state.clients.find(c => c.id === t.client);
      const assignee = this.state.teamMembers.find(m => m.id === t.assignee);
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

              <p style="color:var(--text-muted);line-height:1.5">${t.description || 'No description provided.'}</p>

              <div style="display:flex;flex-direction:column;gap:6px;background:#F8FAFC;padding:12px;border-radius:8px">
                <div>Client: <strong>${client ? client.name : 'N/A'}</strong></div>
                <div>Assignee: <strong>${assignee ? assignee.name : 'Unassigned'}</strong></div>
                <div>Due Date: <strong>${t.date}</strong></div>
                <div>Logged hours: <strong>${t.hours}h</strong></div>
              </div>
            </div>

            <div class="modal-actions" style="justify-content:space-between">
              <button id="detail-delete-task-btn" class="small-btn danger">Delete Task</button>
              <button id="modal-done-btn" class="add-btn" style="height:36px">Close</button>
            </div>
          </div>
        </div>
      `;
    }

    return '';
  }

  // ========================================================
  // WORKSPACE EVENT ATTACHMENT
  // ========================================================
  attachWorkspaceEvents() {
    // Nav
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setState({ currentView: btn.getAttribute('data-nav') });
      });
    });

    // Switch Role dropdown
    const switchUserSelect = document.getElementById('switch-user-select');
    if (switchUserSelect) {
      switchUserSelect.addEventListener('change', (e) => {
        const uId = e.target.value;
        const user = this.state.teamMembers.find(m => m.id === uId);
        if (user) {
          setSessionUserId(user.id);
          this.setState({ currentUser: user });
          this.toast(`Viewing workspace as ${user.name} (${user.role})`);
        }
      });
    }

    // Add Member button in sidebar
    const addMemberBtn = document.getElementById('sidebar-add-member-btn');
    if (addMemberBtn) {
      addMemberBtn.addEventListener('click', () => {
        this.setState({ modalOpen: true, modalType: 'addMember' });
      });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.logout();
      });
    }

    // Header buttons
    const headerAddClient = document.getElementById('header-add-client-btn');
    if (headerAddClient) {
      headerAddClient.addEventListener('click', () => {
        this.setState({ modalOpen: true, modalType: 'addClient' });
      });
    }

    const headerAddTask = document.getElementById('header-add-task-btn');
    if (headerAddTask) {
      headerAddTask.addEventListener('click', () => {
        this.setState({ modalOpen: true, modalType: 'addTask' });
      });
    }

    // Onboarding buttons
    const emptyAddClient = document.getElementById('empty-add-client-btn') || document.getElementById('view-add-client-btn');
    if (emptyAddClient) {
      emptyAddClient.addEventListener('click', () => {
        this.setState({ modalOpen: true, modalType: 'addClient' });
      });
    }

    const emptyAddTask = document.getElementById('empty-add-task-btn') || document.getElementById('view-add-task-btn');
    if (emptyAddTask) {
      emptyAddTask.addEventListener('click', () => {
        this.setState({ modalOpen: true, modalType: 'addTask' });
      });
    }

    const loadSampleBtn = document.getElementById('load-sample-btn');
    if (loadSampleBtn) {
      loadSampleBtn.addEventListener('click', () => {
        this.loadSampleDemoData();
      });
    }

    const clearDataBtn = document.getElementById('clear-data-btn');
    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', () => {
        this.clearAllWorkspaceData();
      });
    }

    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.setState({ searchQuery: e.target.value });
      });
    }

    // Status filter cards
    document.querySelectorAll('[data-status-filter]').forEach(card => {
      card.addEventListener('click', () => {
        this.setState({ activeStatusFilter: card.getAttribute('data-status-filter') });
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
        this.toast('Reset to default view.');
      });
    }

    // Delete Client buttons
    document.querySelectorAll('.delete-client-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cid = btn.getAttribute('data-client-id');
        this.removeClient(cid);
      });
    });

    // Delete Task buttons
    document.querySelectorAll('.delete-task-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tid = btn.getAttribute('data-task-id');
        this.removeTask(tid);
      });
    });

    // Task click to open details
    document.querySelectorAll('[data-task-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.delete-task-btn')) return;
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

    const detailDelete = document.getElementById('detail-delete-task-btn');
    if (detailDelete && this.state.selectedTask) {
      detailDelete.addEventListener('click', () => {
        this.removeTask(this.state.selectedTask.id);
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

    // Add Client Form submit
    const addClientForm = document.getElementById('add-client-form');
    if (addClientForm) {
      addClientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(addClientForm);
        await this.createClient({
          name: fd.get('name'),
          brand: fd.get('brand'),
          retainer: fd.get('retainer'),
          contact: fd.get('contact')
        });
      });
    }

    // Add Task Form submit
    const addTaskForm = document.getElementById('add-task-form');
    if (addTaskForm) {
      addTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(addTaskForm);
        await this.createTask({
          title: fd.get('title'),
          client: fd.get('client'),
          assignee: fd.get('assignee'),
          date: fd.get('date'),
          hours: fd.get('hours'),
          description: fd.get('description')
        });
      });
    }

    // Add Member Form submit
    const addMemberForm = document.getElementById('add-member-form');
    if (addMemberForm) {
      addMemberForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(addMemberForm);
        await this.createTeamMember({
          name: fd.get('name'),
          email: fd.get('email'),
          password: fd.get('password'),
          role: fd.get('role')
        });
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

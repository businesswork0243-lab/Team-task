// Supabase layer: auth, workspaces, membership and item storage.
// Exposes window.Cloud for the page logic in index.html.
(function () {
  const cfg = window.APP_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && window.supabase.createClient);
  const REMEMBER = 'ops.remember', LAST_WS = 'ops.lastWorkspace';

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };
  // Session lives in localStorage when "Keep me signed in" is ticked, otherwise in sessionStorage.
  const storage = {
    getItem(k) { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch (e) { return null; } },
    setItem(k, v) {
      try {
        const keep = localStorage.getItem(REMEMBER) !== '0';
        (keep ? localStorage : sessionStorage).setItem(k, v);
        (keep ? sessionStorage : localStorage).removeItem(k);
      } catch (e) { /* storage blocked */ }
    },
    removeItem(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) { /* storage blocked */ } },
  };

  // Captured before supabase-js strips the hash from the URL.
  let recovery = /type=recovery/.test(location.hash + location.search);

  const sb = enabled
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;
  const clientId = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2) + Date.now();
  const authListeners = [];
  if (sb) {
    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') recovery = true;
      authListeners.forEach((fn) => { try { fn(event, session); } catch (e) { console.error(e); } });
    });
  }

  const must = ({ data, error }) => { if (error) throw error; return data; };

  function errText(e) {
    if (!e) return 'Unknown error occurred.';
    let m = '';
    if (typeof e === 'string') {
      m = e;
    } else if (e instanceof Error) {
      m = e.message || '';
    } else if (typeof e === 'object') {
      m = e.message || e.error_description || e.details || e.hint || (typeof e.error === 'string' ? e.error : '') || '';
      if (!m) {
        try { m = JSON.stringify(e); } catch (_) { m = String(e); }
      }
    } else {
      m = String(e);
    }
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) {
      return 'Failed to fetch: Cannot reach the database. Check your internet connection.';
    }
    if (/invalid login credentials/i.test(m)) return 'Email or password is incorrect.';
    if (/email not confirmed/i.test(m)) return 'Confirm your email first. Check your inbox for the link.';
    if (/already registered|already been registered/i.test(m)) return 'An account already uses this email. Log in instead.';
    if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
    if (/password should be|weak password/i.test(m)) return 'Choose a stronger password (at least 8 characters).';
    if (/row-level security|permission denied|not authorized|violates row-level security/i.test(m)) {
      return 'Permission denied by database security policies (RLS). You might not be signed in or lack permissions in this workspace.';
    }
    if (/app_my_workspaces|app_set_member_login|app_items|does not exist|schema cache|could not find the function/i.test(m)) {
      return 'The database schema is not up to date. Run supabase/schema.sql in the Supabase SQL Editor.';
    }
    if (/jwt expired|session expired|invalid token/i.test(m)) {
      return 'Your session has expired. Please log out and sign in again.';
    }
    return m || 'Something went wrong. Try again.';
  }

  async function user() {
    const { data } = await sb.auth.getSession();
    return (data && data.session && data.session.user) || null;
  }

  async function loadItems(ws) {
    const out = [], page = 1000;
    for (let from = 0; ; from += page) {
      const rows = must(await sb.from('app_items')
        .select('coll,id,data,seq')
        .eq('workspace_id', ws).eq('deleted', false)
        .order('seq', { ascending: true })
        .range(from, from + page - 1));
      out.push(...rows);
      if (rows.length < page) return out;
    }
  }

  async function saveRows(ws, rows) {
    if (!enabled || !sb) throw new Error('Database connection is not initialized.');
    if (!ws) throw new Error('No active workspace selected.');
    if (!rows || !rows.length) return;
    const stamped = rows.map((r) => ({
      workspace_id: ws, coll: r.coll, id: r.id,
      data: r.deleted ? null : r.data, deleted: !!r.deleted, client_id: clientId,
    }));
    for (let i = 0; i < stamped.length; i += 250) {
      const res = await sb.from('app_items').upsert(stamped.slice(i, i + 250), { onConflict: 'workspace_id,coll,id' });
      must(res);
    }
  }

  function subscribe(ws, onRow, onStatus) {
    const ch = sb.channel('ws-' + ws + '-' + clientId.slice(0, 8))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_items', filter: 'workspace_id=eq.' + ws }, (p) => {
        const r = p.new;
        if (!r || !r.coll || r.client_id === clientId) return;
        onRow({ coll: r.coll, id: r.id, data: r.data, deleted: !!r.deleted });
      })
      .subscribe((status) => onStatus && onStatus(status));
    return () => { sb.removeChannel(ch); };
  }

  // ---------- Web Push ----------
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const pushSupported = !!(enabled && cfg.vapidPublicKey && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext);
  const swReady = 'serviceWorker' in navigator && window.isSecureContext
    ? navigator.serviceWorker.register('/sw.js').catch((e) => { console.warn('service worker', e); return null; })
    : Promise.resolve(null);
  const b64ToBytes = (s) => {
    const b = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(b, (c) => c.charCodeAt(0));
  };
  async function currentSub(create) {
    const reg = (await swReady) && (await navigator.serviceWorker.ready);
    if (!reg) return null;
    let sub = await reg.pushManager.getSubscription();
    if (!sub && create) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(cfg.vapidPublicKey) });
    return sub;
  }
  async function saveSub(sub) {
    const j = sub.toJSON();
    must(await sb.rpc('app_save_push_sub', { p_endpoint: j.endpoint, p_sub: j }));
  }

  window.Cloud = {
    enabled,
    // 'on' | 'off' (can be turned on) | 'denied' | 'ios-install' (iPhone: add to Home Screen first) | 'unsupported'
    pushStatus(on) {
      if (!pushSupported) return isIOS && !standalone && enabled ? 'ios-install' : 'unsupported';
      if (Notification.permission === 'denied') return 'denied';
      return on ? 'on' : 'off';
    },
    // Turns alerts on for this device (asks for permission). Returns true when on.
    async enablePush() {
      if (!pushSupported) throw new Error(isIOS && !standalone ? 'On iPhone, add this site to the Home Screen first, then open it from there.' : 'This browser does not support alerts.');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('Alerts were not allowed in this browser.');
      await saveSub(await currentSub(true));
      return true;
    },
    // On login: if this device already allowed alerts, make sure it is saved for this user.
    async syncPush() {
      if (!pushSupported || Notification.permission !== 'granted') return false;
      try { await saveSub(await currentSub(true)); return true; } catch (e) { console.warn('push sync', e); return false; }
    },
    // On logout: stop alerts for this device.
    async disablePush() {
      if (!pushSupported) return;
      try {
        const sub = await currentSub(false);
        if (!sub) return;
        await sb.from('app_push_subs').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      } catch (e) { console.warn('push off', e); }
    },
    // Asks the server to push the given (already saved) notifications to their recipients.
    async sendPush(ws, ids) {
      try {
        const { data } = await sb.auth.getSession();
        const token = data && data.session && data.session.access_token;
        if (!token || !ids.length) return;
        const r = await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ ws, ids }) });
        if (!r.ok) console.warn('push', r.status, await r.text());
      } catch (e) { console.warn('push', e); }
    },
    onOpenUrl(fn) {
      if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'open-url') fn(e.data.url); });
    },
    clientId,
    errText,
    isRecovery: () => recovery,
    clearRecovery: () => { recovery = false; },
    onAuth: (fn) => { authListeners.push(fn); },
    user,
    async signIn(email, password, remember) {
      ls.set(REMEMBER, remember === false ? '0' : '1');
      return must(await sb.auth.signInWithPassword({ email, password })).user;
    },
    async signUp(email, password, meta) {
      ls.set(REMEMBER, '1');
      return must(await sb.auth.signUp({ email, password, options: { data: meta, emailRedirectTo: location.origin } }));
    },
    async signOut() { await sb.auth.signOut(); },
    async resetPassword(email) {
      must(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin }));
    },
    async updatePassword(password) { return must(await sb.auth.updateUser({ password })).user; },
    lastWorkspace: () => ls.get(LAST_WS),
    rememberWorkspace: (id) => ls.set(LAST_WS, id),
    async myWorkspaces() { return must(await sb.rpc('app_my_workspaces')) || []; },
    async createWorkspace(name, personId) {
      const rows = must(await sb.rpc('app_create_workspace', { p_name: name, p_person_id: personId }));
      return Array.isArray(rows) ? rows[0] : rows;
    },
    loadItems,
    saveRows,
    subscribe,
    async listMembers(ws) {
      return must(await sb.from('app_members').select('email,person_id,role,user_id').eq('workspace_id', ws));
    },
    async upsertMembers(ws, rows) {
      must(await sb.from('app_members').upsert(rows.map((r) => ({ ...r, workspace_id: ws })), { onConflict: 'workspace_id,email' }));
    },
    async renameWorkspace(ws, name) {
      const rows = must(await sb.from('app_workspaces').update({ name }).eq('id', ws).select('id'));
      if (!rows || !rows.length) throw new Error('Only a workspace owner can rename the workspace.');
    },
    async setMemberLogin(ws, email, password, personId, name) {
      return must(await sb.rpc('app_set_member_login', { p_ws: ws, p_email: email, p_password: password, p_person_id: personId, p_name: name || null }));
    },
    async deleteMembers(ws, emails) {
      must(await sb.from('app_members').delete().eq('workspace_id', ws).in('email', emails));
    },
  };
})();

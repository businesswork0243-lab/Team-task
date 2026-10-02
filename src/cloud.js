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
    const m = String((e && (e.message || e.error_description)) || e || '');
    if (/invalid login credentials/i.test(m)) return 'Email or password is incorrect.';
    if (/email not confirmed/i.test(m)) return 'Confirm your email first. Check your inbox for the link.';
    if (/already registered|already been registered/i.test(m)) return 'An account already uses this email. Log in instead.';
    if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
    if (/password should be|weak password/i.test(m)) return 'Choose a stronger password (at least 8 characters).';
    if (/failed to fetch|network/i.test(m)) return 'Cannot reach the server. Check your connection.';
    if (/app_my_workspaces|app_set_member_login|app_items|does not exist|schema cache|could not find the function/i.test(m)) return 'The database is not up to date. Run supabase/schema.sql in the Supabase SQL Editor.';
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
    const stamped = rows.map((r) => ({
      workspace_id: ws, coll: r.coll, id: r.id,
      data: r.deleted ? null : r.data, deleted: !!r.deleted, client_id: clientId,
    }));
    for (let i = 0; i < stamped.length; i += 250) {
      must(await sb.from('app_items').upsert(stamped.slice(i, i + 250), { onConflict: 'workspace_id,coll,id' }));
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

  window.Cloud = {
    enabled,
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

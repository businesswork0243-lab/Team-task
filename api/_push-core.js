// Sends Web Push alerts for task notifications. Called by the browser of the
// person who created the notifications, right after they were saved.
// Files starting with "_" in api/ are not exposed as routes on Vercel.

const MAX_AGE_MS = 15 * 60 * 1000;

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// admin: Supabase client with the service role key. push: the web-push module.
export async function sendPushes({ token, ws, ids }, { admin, push, now = Date.now() }) {
  if (!token) throw new HttpError(401, 'Not signed in.');
  if (!ws || !Array.isArray(ids) || !ids.length) throw new HttpError(400, 'Missing workspace or notification ids.');

  const { data: auth, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !auth || !auth.user) throw new HttpError(401, 'Session expired. Log in again.');

  const { data: me } = await admin.from('app_members').select('person_id')
    .eq('workspace_id', ws).eq('user_id', auth.user.id).maybeSingle();
  if (!me) throw new HttpError(403, 'Not a member of this workspace.');

  const { data: rows } = await admin.from('app_items').select('id,data,updated_at')
    .eq('workspace_id', ws).eq('coll', 'notifs').eq('deleted', false)
    .in('id', ids.slice(0, 20).map(String));
  const { data: wsRow } = await admin.from('app_workspaces').select('name').eq('id', ws).maybeSingle();
  const title = (wsRow && wsRow.name) || 'Operations';

  let sent = 0, skipped = 0, devices = 0;
  for (const r of rows || []) {
    const n = r.data || {};
    // Only the author may trigger the push, only once, and only for fresh, unread notifications.
    if (n.by !== me.person_id || n.read || !n.to || now - Date.parse(r.updated_at) > MAX_AGE_MS) { skipped++; continue; }
    const { error: logErr } = await admin.from('app_push_log').insert({ workspace_id: ws, notif_id: r.id });
    if (logErr) { skipped++; continue; }

    const { data: targets } = await admin.from('app_members').select('user_id')
      .eq('workspace_id', ws).eq('person_id', n.to).not('user_id', 'is', null);
    const userIds = (targets || []).map((t) => t.user_id);
    if (!userIds.length) continue;

    const { data: subs } = await admin.from('app_push_subs').select('endpoint,sub').in('user_id', userIds);
    const payload = JSON.stringify({ title, body: n.text || 'You have a new task.', tag: r.id, url: n.task ? '/?task=' + encodeURIComponent(n.task) : '/' });
    for (const s of subs || []) {
      try {
        await push.sendNotification(s.sub, payload, { TTL: 24 * 60 * 60 });
        devices++;
      } catch (e) {
        // 404/410: the browser dropped this subscription.
        if (e && (e.statusCode === 404 || e.statusCode === 410)) await admin.from('app_push_subs').delete().eq('endpoint', s.endpoint);
        else console.error('push failed', e && (e.statusCode || e.message));
      }
    }
    sent++;
  }
  return { sent, skipped, devices };
}

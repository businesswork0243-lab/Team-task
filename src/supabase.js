// Multi-Tenant Supabase Service Layer
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  supabaseAnonKey.length > 20 &&
  !supabaseUrl.includes('your-project')
);

export const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// 1. WORKSPACE OPERATIONS
export async function getDbWorkspaces() {
  if (!isConfigured || !supabase) return [];
  try {
    const { data } = await supabase.from('workspaces').select('*');
    return data || [];
  } catch (e) {
    return [];
  }
}

export async function insertDbWorkspace(ws) {
  if (!isConfigured || !supabase) return ws;
  try {
    const { data } = await supabase
      .from('workspaces')
      .insert([{ id: ws.id, name: ws.name, owner_id: ws.ownerId }])
      .select();
    return data?.[0] || ws;
  } catch (e) {
    return ws;
  }
}

// 2. CLIENTS OPERATIONS (FILTERED BY WORKSPACE)
export async function getDbClients(workspaceId) {
  if (!isConfigured || !supabase || !workspaceId) return [];
  try {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('name');
    return data || [];
  } catch (e) {
    return [];
  }
}

export async function insertDbClient(client) {
  if (!isConfigured || !supabase) return client;
  try {
    const { data } = await supabase
      .from('clients')
      .insert([{
        id: client.id,
        workspace_id: client.workspaceId,
        name: client.name,
        brand: client.brand || 'main',
        retainer: Number(client.retainer) || 0,
        since: client.since || 'Oct 2026',
        contact: client.contact || '',
        status: client.status || 'Active'
      }])
      .select();
    return data?.[0] || client;
  } catch (e) {
    return client;
  }
}

export async function deleteDbClient(clientId) {
  if (!isConfigured || !supabase) return true;
  try {
    await supabase.from('clients').delete().eq('id', clientId);
    return true;
  } catch (e) {
    return false;
  }
}

// 3. TEAM MEMBERS OPERATIONS (FILTERED BY WORKSPACE)
export async function getDbTeamMembers(workspaceId) {
  if (!isConfigured || !supabase || !workspaceId) return [];
  try {
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('workspace_id', workspaceId);
    return (data || []).map(m => ({
      ...m,
      allowedClients: m.allowed_clients || m.allowedClients || []
    }));
  } catch (e) {
    return [];
  }
}

export async function insertDbTeamMember(member) {
  if (!isConfigured || !supabase) return member;
  try {
    const { data } = await supabase
      .from('team_members')
      .insert([{
        id: member.id,
        workspace_id: member.workspaceId,
        name: member.name,
        email: member.email,
        password: member.password || 'workspace123',
        role: member.role,
        is_founder: Boolean(member.isFounder),
        allowed_clients: member.allowedClients || []
      }])
      .select();
    return data?.[0] || member;
  } catch (e) {
    return member;
  }
}

export async function findDbUserByEmail(email, password) {
  if (!isConfigured || !supabase) return null;
  try {
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .ilike('email', email.trim());
    if (!data || !data.length) return null;
    const match = data.find(u => !password || u.password === password);
    return match || null;
  } catch (e) {
    return null;
  }
}

export async function fetchFullWorkspace(workspaceId) {
  if (!isConfigured || !supabase || !workspaceId) return null;
  try {
    const [wsRes, teamRes, clientsRes, tasksRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
      getDbTeamMembers(workspaceId),
      getDbClients(workspaceId),
      getDbTasks(workspaceId)
    ]);
    if (!wsRes.data) return null;
    return {
      id: wsRes.data.id,
      name: wsRes.data.name,
      ownerId: wsRes.data.owner_id,
      teamMembers: teamRes,
      clients: clientsRes,
      tasks: tasksRes
    };
  } catch (e) {
    return null;
  }
}

export async function clearDbWorkspaceData(workspaceId) {
  if (!isConfigured || !supabase || !workspaceId) return true;
  try {
    await supabase.from('tasks').delete().eq('workspace_id', workspaceId);
    await supabase.from('clients').delete().eq('workspace_id', workspaceId);
    return true;
  } catch (e) {
    return false;
  }
}

// 4. TASKS OPERATIONS (FILTERED BY WORKSPACE)
export async function getDbTasks(workspaceId) {
  if (!isConfigured || !supabase || !workspaceId) return [];
  try {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('date', { ascending: true });
    return data || [];
  } catch (e) {
    return [];
  }
}

export async function insertDbTask(task) {
  if (!isConfigured || !supabase) return task;
  try {
    const { data } = await supabase
      .from('tasks')
      .insert([{
        id: task.id,
        workspace_id: task.workspaceId,
        title: task.title,
        client: task.client,
        assignee: task.assignee,
        status: task.status || 'not_started',
        date: task.date,
        hours: Number(task.hours) || 0,
        priority: task.priority || 'Medium',
        description: task.description || ''
      }])
      .select();
    return data?.[0] || task;
  } catch (e) {
    return task;
  }
}

export async function updateDbTask(id, updates) {
  if (!isConfigured || !supabase) return true;
  try {
    await supabase.from('tasks').update(updates).eq('id', id);
    return true;
  } catch (e) {
    return false;
  }
}

export async function deleteDbTask(id) {
  if (!isConfigured || !supabase) return true;
  try {
    await supabase.from('tasks').delete().eq('id', id);
    return true;
  } catch (e) {
    return false;
  }
}

// 5. REALTIME WORKSPACE LISTENER
export function subscribeToWorkspaceChanges(workspaceId, onTaskChange) {
  if (!isConfigured || !supabase || !workspaceId) return () => {};

  const channel = supabase
    .channel(`ws-realtime-${workspaceId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` },
      (payload) => onTaskChange(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Supabase Cloud Database Client & Service Layer
import { createClient } from '@supabase/supabase-js';
import { CLIENTS, TEAM_MEMBERS, TASKS_DATA } from './data.js';

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

// Database Service Functions
export async function getDbClients() {
  if (!isConfigured || !supabase) {
    return CLIENTS;
  }
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    if (error || !data || !data.length) {
      console.warn('Using local clients fallback:', error);
      return CLIENTS;
    }
    return data;
  } catch (err) {
    console.error('Error fetching clients from Supabase:', err);
    return CLIENTS;
  }
}

export async function getDbTeamMembers() {
  if (!isConfigured || !supabase) {
    return TEAM_MEMBERS;
  }
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('*');
    if (error || !data || !data.length) {
      return TEAM_MEMBERS;
    }
    return data.map(m => ({
      ...m,
      allowedClients: m.allowed_clients || m.allowedClients || []
    }));
  } catch (err) {
    console.error('Error fetching team members:', err);
    return TEAM_MEMBERS;
  }
}

export async function insertDbTeamMember(member) {
  if (!isConfigured || !supabase) {
    return member;
  }
  try {
    const { data, error } = await supabase
      .from('team_members')
      .insert([{
        id: member.id,
        name: member.name,
        role: member.role,
        is_founder: Boolean(member.isFounder),
        allowed_clients: member.allowedClients || []
      }])
      .select();
    if (error) {
      console.error('Failed to insert team member into Supabase:', error);
    }
    return (data && data[0]) ? data[0] : member;
  } catch (err) {
    console.error('Insert team member error:', err);
    return member;
  }
}

export async function getDbTasks() {
  if (!isConfigured || !supabase) {
    return TASKS_DATA;
  }
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('date', { ascending: true });
    if (error || !data || !data.length) {
      console.warn('Using local tasks fallback:', error);
      return TASKS_DATA;
    }
    return data;
  } catch (err) {
    console.error('Error fetching tasks from Supabase:', err);
    return TASKS_DATA;
  }
}

export async function insertDbTask(task) {
  if (!isConfigured || !supabase) {
    return task;
  }
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        id: task.id,
        title: task.title,
        client: task.client,
        assignee: task.assignee,
        status: task.status,
        date: task.date,
        hours: task.hours || 0,
        priority: task.priority || 'Medium',
        description: task.description || ''
      }])
      .select();
    if (error) {
      console.error('Failed to insert task into Supabase:', error);
    }
    return (data && data[0]) ? data[0] : task;
  } catch (err) {
    console.error('Insert error:', err);
    return task;
  }
}

export async function updateDbTask(id, updates) {
  if (!isConfigured || !supabase) {
    return true;
  }
  try {
    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id);
    if (error) {
      console.error('Failed to update task in Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Update error:', err);
    return false;
  }
}

export function subscribeToTaskChanges(onChange) {
  if (!isConfigured || !supabase) {
    return () => {};
  }

  const channel = supabase
    .channel('tasks-realtime-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      (payload) => {
        onChange(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

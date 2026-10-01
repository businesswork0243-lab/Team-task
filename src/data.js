// Multi-Tenant Data Layer for Operations Workspace

export const BRANDS = [
  { id: 'all', name: 'All brands' },
  { id: 'main', name: 'Primary Brand' },
  { id: 'studio', name: 'Design Studio' },
  { id: 'tech', name: 'Technology' },
  { id: 'marketing', name: 'Marketing' }
];

export const STATUS_LIST = [
  { id: 'total', label: 'TOTAL', color: '#4F46E5', bg: '#EEF2FF', border: '#6366F1' },
  { id: 'not_started', label: 'NOT STARTED', color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
  { id: 'in_progress', label: 'IN PROGRESS', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { id: 'review', label: 'REVIEW', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { id: 'blocked', label: 'BLOCKED', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { id: 'completed', label: 'COMPLETED', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { id: 'late', label: 'LATE', color: '#991B1B', bg: '#FEF2F2', border: '#FCA5A5' }
];

export const HOLIDAYS_2026_OCT = {
  '2026-10-02': 'Gandhi Jayanti',
  '2026-10-20': 'Dussehra / Vijayadashami'
};

// Optional Sample Data for users who want to explore with 1-click
export const SAMPLE_CLIENTS = [
  { id: 'c1', name: 'Apex Media', brand: 'marketing', retainer: 250000, since: 'May 2026', contact: 'Aarav Patel', status: 'Active' },
  { id: 'c2', name: 'Zenith Health', brand: 'tech', retainer: 180000, since: 'Jan 2026', contact: 'Dr. Sunita Rao', status: 'Active' },
  { id: 'c3', name: 'Blue Horizon Logistics', brand: 'main', retainer: 320000, since: 'Feb 2025', contact: 'Vikram Joshi', status: 'Active' }
];

export const SAMPLE_TASKS = [
  {
    id: 'st1',
    title: 'Brand identity refresh kickoff',
    client: 'c1',
    assignee: '', // will link to current user
    status: 'in_progress',
    date: '2026-10-01',
    hours: 12,
    priority: 'High',
    description: 'Initial client alignment call and visual moodboard sign-off.'
  },
  {
    id: 'st2',
    title: 'Q4 Budget & Retainer Reconciliation',
    client: 'c2',
    assignee: '',
    status: 'review',
    date: '2026-10-06',
    hours: 6,
    priority: 'Medium',
    description: 'Review monthly contractor spend and production deliverables.'
  },
  {
    id: 'st3',
    title: 'Warehouse telemetry dashboard deployment',
    client: 'c3',
    assignee: '',
    status: 'not_started',
    date: '2026-10-12',
    hours: 24,
    priority: 'High',
    description: 'Final staging regression testing before client hand-off.'
  }
];

// Multi-Tenant Local Storage Keys
const WS_KEY = 'ops_multi_tenant_workspaces_v2';
const ACTIVE_WS_KEY = 'ops_active_workspace_id_v2';
const ACTIVE_USER_KEY = 'ops_active_user_id_v2';

export function getWorkspaces() {
  try {
    const raw = localStorage.getItem(WS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveWorkspace(ws) {
  try {
    const all = getWorkspaces();
    const idx = all.findIndex(w => w.id === ws.id);
    if (idx >= 0) {
      all[idx] = ws;
    } else {
      all.push(ws);
    }
    localStorage.setItem(WS_KEY, JSON.stringify(all));
  } catch (e) {}
}

export function getActiveWorkspaceId() {
  return localStorage.getItem(ACTIVE_WS_KEY) || null;
}

export function setActiveWorkspaceId(id) {
  if (!id) {
    localStorage.removeItem(ACTIVE_WS_KEY);
  } else {
    localStorage.setItem(ACTIVE_WS_KEY, id);
  }
}

export function getSessionUserId() {
  return localStorage.getItem(ACTIVE_USER_KEY) || null;
}

export function setSessionUserId(id) {
  if (!id) {
    localStorage.removeItem(ACTIVE_USER_KEY);
  } else {
    localStorage.setItem(ACTIVE_USER_KEY, id);
  }
}

export function deleteWorkspace(wsId) {
  try {
    const all = getWorkspaces().filter(w => w.id !== wsId);
    localStorage.setItem(WS_KEY, JSON.stringify(all));
    if (getActiveWorkspaceId() === wsId) {
      setActiveWorkspaceId(null);
      setSessionUserId(null);
    }
  } catch (e) {}
}

export function purgeLegacyStorage() {
  try {
    localStorage.removeItem('ops_workspace_state');
    localStorage.removeItem('ops_sample_data');
    localStorage.removeItem('ops_active_user_id');
  } catch (e) {}
}

// Data and domain logic for Operations Workspace

export const BRANDS = [
  { id: 'all', name: 'All brands' },
  { id: 'hep', name: 'Hephaestus Studio' },
  { id: 'kln', name: 'Kiln' },
  { id: 'ntg', name: 'Northgate' },
  { id: 'tlw', name: 'Tallow' }
];

export const CLIENTS = [
  { id: 'arc3', name: 'ARC3', brand: 'hep', retainer: 420000, since: 'Mar 2026', contact: 'Karan Shah', status: 'Active' },
  { id: 'mer', name: 'Meridian Foods', brand: 'kln', retainer: 180000, since: 'Nov 2024', contact: 'Meera Iyer', status: 'Active' },
  { id: 'sah', name: 'Sahyadri Logistics', brand: 'ntg', retainer: 240000, since: 'Jun 2025', contact: 'Aditi Kulkarni', status: 'Active' },
  { id: 'oak', name: 'Oakline Clinics', brand: 'hep', retainer: 150000, since: 'Jan 2026', contact: 'Dr Nikhil Bose', status: 'Active' },
  { id: 'lum', name: 'Lumen Schools', brand: 'tlw', retainer: 95000, since: 'Apr 2026', contact: 'Farah Khan', status: 'Active' }
];

export const TEAM_MEMBERS = [
  {
    id: 'founder',
    name: 'Founder (You)',
    email: 'founder@workspace.com',
    role: 'Owner & Founder',
    badge: 'Owner',
    isFounder: true,
    allowedClients: ['arc3', 'mer', 'sah', 'oak', 'lum']
  },
  {
    id: 'rakesh',
    name: 'Rakesh Kumar',
    email: 'rakesh@workspace.com',
    role: 'Team member',
    badge: 'Team',
    isFounder: false,
    allowedClients: [] // 0 of 5 clients visible
  },
  {
    id: 'priya',
    name: 'Priya Nair',
    email: 'priya@workspace.com',
    role: 'Operations lead',
    badge: 'Operations',
    isFounder: false,
    allowedClients: ['arc3', 'mer', 'sah', 'oak', 'lum']
  },
  {
    id: 'rohan',
    name: 'Rohan Das',
    email: 'rohan@workspace.com',
    role: 'Designer',
    badge: 'Designer',
    isFounder: false,
    allowedClients: ['arc3', 'mer', 'oak']
  },
  {
    id: 'sana',
    name: 'Sana Kapoor',
    email: 'sana@workspace.com',
    role: 'Finance lead',
    badge: 'Finance',
    isFounder: false,
    allowedClients: ['arc3', 'mer', 'sah', 'oak', 'lum']
  },
  {
    id: 'dev',
    name: 'Dev Malhotra',
    email: 'dev@workspace.com',
    role: 'Developer',
    badge: 'Developer',
    isFounder: false,
    allowedClients: ['sah', 'oak', 'lum']
  }
];

// Initial 9 tasks
export const TASKS_DATA = [
  {
    id: 't1',
    title: 'Q4 campaign concepts',
    client: 'arc3',
    assignee: 'rohan',
    status: 'not_started',
    date: '2026-10-01',
    hours: 12,
    priority: 'High',
    description: 'Create moodboard and initial visual direction for the Q4 promotional push.'
  },
  {
    id: 't2',
    title: 'Monthly spend report',
    client: 'mer',
    assignee: 'sana',
    status: 'in_progress',
    date: '2026-10-05',
    hours: 4,
    priority: 'Medium',
    description: 'Compile September production and vendor expenses for client sign-off.'
  },
  {
    id: 't3',
    title: 'Patient intake form redesign',
    client: 'oak',
    assignee: 'rohan',
    status: 'review',
    date: '2026-10-06',
    hours: 18,
    priority: 'High',
    description: 'Update mobile UX for online patient consultation registration.'
  },
  {
    id: 't4',
    title: 'Investor update draft',
    client: 'arc3',
    assignee: 'founder',
    status: 'blocked',
    date: '2026-10-07',
    hours: 6,
    priority: 'Medium',
    description: 'Draft quarterly progress deck pending financial reconciliation numbers.'
  },
  {
    id: 't5',
    title: 'Admissions microsite',
    client: 'lum',
    assignee: 'dev',
    status: 'in_progress',
    date: '2026-10-08',
    hours: 24,
    priority: 'High',
    description: 'Develop responsive landing pages for the 2027 admissions cycle.'
  },
  {
    id: 't6',
    title: 'Route dashboard, phase 2',
    client: 'sah',
    assignee: 'dev',
    status: 'completed',
    date: '2026-10-10',
    hours: 32,
    priority: 'Medium',
    description: 'Integrate real-time GPS telemetry feed with logistics operations.'
  },
  {
    id: 't7',
    title: 'Parent newsletter template',
    client: 'lum',
    assignee: 'rohan',
    status: 'not_started',
    date: '2026-10-12',
    hours: 8,
    priority: 'Low',
    description: 'Build reusable HTML email template matching the updated brand guidelines.'
  },
  {
    id: 't8',
    title: 'Clinic site migration',
    client: 'oak',
    assignee: 'dev',
    status: 'not_started',
    date: '2026-10-14',
    hours: 16,
    priority: 'High',
    description: 'Deploy the new staging build to AWS production cluster.'
  },
  {
    id: 't9',
    title: 'Menu card print proofs',
    client: 'mer',
    assignee: 'priya',
    status: 'late',
    date: '2026-09-29',
    hours: 10,
    priority: 'Medium',
    description: 'Final color inspection with printer before 5,000 unit print run.'
  }
];

export const HOLIDAYS_2026_OCT = {
  '2026-10-02': 'Gandhi Jayanti',
  '2026-10-20': 'Dussehra / Vijayadashami'
};

export const STATUS_LIST = [
  { id: 'total', label: 'TOTAL', color: '#4F46E5', bg: '#EEF2FF', border: '#6366F1' },
  { id: 'not_started', label: 'NOT STARTED', color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
  { id: 'in_progress', label: 'IN PROGRESS', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { id: 'review', label: 'REVIEW', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { id: 'blocked', label: 'BLOCKED', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { id: 'completed', label: 'COMPLETED', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { id: 'late', label: 'LATE', color: '#991B1B', bg: '#FEF2F2', border: '#FCA5A5' }
];

export function getClient(id) {
  return CLIENTS.find(c => c.id === id);
}

export function getMember(id) {
  return TEAM_MEMBERS.find(m => m.id === id);
}

export function getBrand(id) {
  return BRANDS.find(b => b.id === id);
}

// Session & LocalStorage helpers
const AUTH_KEY = 'ops_auth_current_user_v1';
const STORAGE_KEY = 'ops_workspace_state_v1';

export function getSessionUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return 'rakesh'; // default active user session
    return raw;
  } catch (e) {
    return 'rakesh';
  }
}

export function setSessionUser(userId) {
  try {
    if (!userId) {
      localStorage.removeItem(AUTH_KEY);
    } else {
      localStorage.setItem(AUTH_KEY, userId);
    }
  } catch (e) {}
}

export function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function persistState(state) {
  try {
    const payload = {
      viewAs: state.viewAs,
      tasks: state.tasks,
      clients: state.clients,
      teamMembers: state.teamMembers,
      activeStatusFilter: state.activeStatusFilter,
      selectedBrand: state.selectedBrand,
      selectedAssignee: state.selectedAssignee,
      currentYear: state.currentYear,
      currentMonth: state.currentMonth
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {}
}

export function resetSavedState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AUTH_KEY);
  } catch (e) {}
}

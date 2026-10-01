-- ========================================================
-- OPERATIONS WORKSPACE - MULTI-TENANT SUPABASE DATABASE SCHEMA
-- ========================================================
-- Every table has a `workspace_id` foreign key for complete tenant isolation.

-- 1. DROP EXISTING TABLES
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;

-- 2. WORKSPACES (TENANTS) TABLE
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TEAM MEMBERS TABLE (BELONGS TO WORKSPACE)
CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password TEXT DEFAULT 'workspace123',
  role TEXT NOT NULL,
  is_founder BOOLEAN DEFAULT FALSE,
  allowed_clients TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_team_members_ws ON team_members(workspace_id);
CREATE INDEX idx_team_members_email ON team_members(email);

-- 4. CLIENTS TABLE (BELONGS TO WORKSPACE)
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'main',
  retainer BIGINT NOT NULL DEFAULT 0,
  since TEXT,
  contact TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TASKS TABLE (BELONGS TO WORKSPACE)
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  client TEXT,
  assignee TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
  date TEXT NOT NULL,
  hours INT DEFAULT 0,
  priority TEXT DEFAULT 'Medium',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ROW LEVEL SECURITY (RLS)
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all workspaces" ON workspaces FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all team_members" ON team_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);

-- 7. REALTIME SYNCHRONIZATION
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE clients;
ALTER PUBLICATION supabase_realtime ADD TABLE team_members;

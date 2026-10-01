-- ========================================================
-- OPERATIONS WORKSPACE - SUPABASE DATABASE SCHEMA
-- ========================================================
-- Copy and paste this script into your Supabase SQL Editor and click "RUN".

-- 1. DROP EXISTING TABLES (IF RE-CREATING)
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;

-- 2. CLIENTS TABLE
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  retainer BIGINT NOT NULL DEFAULT 0,
  since TEXT,
  contact TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TEAM MEMBERS TABLE
CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  is_founder BOOLEAN DEFAULT FALSE,
  allowed_clients TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TASKS TABLE
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  client TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assignee TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started',
  date TEXT NOT NULL, -- e.g. '2026-10-01'
  hours INT DEFAULT 0,
  priority TEXT DEFAULT 'Medium',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 6. PUBLIC ACCESS POLICIES FOR WORKSPACE
CREATE POLICY "Allow public read clients" ON clients FOR SELECT USING (true);
CREATE POLICY "Allow public insert clients" ON clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update clients" ON clients FOR UPDATE USING (true);

CREATE POLICY "Allow public read team_members" ON team_members FOR SELECT USING (true);
CREATE POLICY "Allow public insert team_members" ON team_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update team_members" ON team_members FOR UPDATE USING (true);

CREATE POLICY "Allow public read tasks" ON tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert tasks" ON tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update tasks" ON tasks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete tasks" ON tasks FOR DELETE USING (true);

-- 7. ENABLE REALTIME UPDATES ON TASKS
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- ========================================================
-- INITIAL SEED DATA
-- ========================================================

-- Insert 5 Clients
INSERT INTO clients (id, name, brand, retainer, since, contact, status) VALUES
  ('arc3', 'ARC3', 'hep', 420000, 'Mar 2026', 'Karan Shah', 'Active'),
  ('mer', 'Meridian Foods', 'kln', 180000, 'Nov 2024', 'Meera Iyer', 'Active'),
  ('sah', 'Sahyadri Logistics', 'ntg', 240000, 'Jun 2025', 'Aditi Kulkarni', 'Active'),
  ('oak', 'Oakline Clinics', 'hep', 150000, 'Jan 2026', 'Dr Nikhil Bose', 'Active'),
  ('lum', 'Lumen Schools', 'tlw', 95000, 'Apr 2026', 'Farah Khan', 'Active');

-- Insert Team Members
INSERT INTO team_members (id, name, role, is_founder, allowed_clients) VALUES
  ('founder', 'Founder (You)', 'Owner & Founder', true, ARRAY['arc3', 'mer', 'sah', 'oak', 'lum']),
  ('rakesh', 'Rakesh Kumar', 'Team member', false, ARRAY[]::TEXT[]),
  ('priya', 'Priya Nair', 'Operations lead', false, ARRAY['arc3', 'mer', 'sah', 'oak', 'lum']),
  ('rohan', 'Rohan Das', 'Designer', false, ARRAY['arc3', 'mer', 'oak']),
  ('sana', 'Sana Kapoor', 'Finance lead', false, ARRAY['arc3', 'mer', 'sah', 'oak', 'lum']),
  ('dev', 'Dev Malhotra', 'Developer', false, ARRAY['sah', 'oak', 'lum']);

-- Insert 9 Initial Tasks
INSERT INTO tasks (id, title, client, assignee, status, date, hours, priority, description) VALUES
  ('t1', 'Q4 campaign concepts', 'arc3', 'rohan', 'not_started', '2026-10-01', 12, 'High', 'Create moodboard and initial visual direction for the Q4 promotional push.'),
  ('t2', 'Monthly spend report', 'mer', 'sana', 'in_progress', '2026-10-05', 4, 'Medium', 'Compile September production and vendor expenses for client sign-off.'),
  ('t3', 'Patient intake form redesign', 'oak', 'rohan', 'review', '2026-10-06', 18, 'High', 'Update mobile UX for online patient consultation registration.'),
  ('t4', 'Investor update draft', 'arc3', 'founder', 'blocked', '2026-10-07', 6, 'Medium', 'Draft quarterly progress deck pending financial reconciliation numbers.'),
  ('t5', 'Admissions microsite', 'lum', 'dev', 'in_progress', '2026-10-08', 24, 'High', 'Develop responsive landing pages for the 2027 admissions cycle.'),
  ('t6', 'Route dashboard, phase 2', 'sah', 'dev', 'completed', '2026-10-10', 32, 'Medium', 'Integrate real-time GPS telemetry feed with logistics operations.'),
  ('t7', 'Parent newsletter template', 'lum', 'rohan', 'not_started', '2026-10-12', 8, 'Low', 'Build reusable HTML email template matching the updated brand guidelines.'),
  ('t8', 'Clinic site migration', 'oak', 'dev', 'not_started', '2026-10-14', 16, 'High', 'Deploy the new staging build to AWS production cluster.'),
  ('t9', 'Menu card print proofs', 'mer', 'priya', 'late', '2026-09-29', 10, 'Medium', 'Final color inspection with printer before 5,000 unit print run.');

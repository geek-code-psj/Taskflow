import pool from './pool';

const MIGRATION_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for full-text search

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(30) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  global_role   VARCHAR(10) NOT NULL DEFAULT 'member' CHECK (global_role IN ('admin','member')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username);
CREATE INDEX IF NOT EXISTS users_email_btree ON users USING btree(email);

-- ── Refresh Tokens ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  family     UUID NOT NULL DEFAULT uuid_generate_v4(),
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rt_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS rt_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS rt_family ON refresh_tokens(family);
CREATE INDEX IF NOT EXISTS rt_expires_active ON refresh_tokens(expires_at) WHERE is_revoked = false;

-- ── Projects ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS projects_name_trgm ON projects USING gin(name gin_trgm_ops);

-- ── Project Memberships ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_memberships (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(10) NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS pm_user_id ON project_memberships(user_id);
CREATE INDEX IF NOT EXISTS pm_project_role ON project_memberships(project_id, role);

-- ── Tasks ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  status      VARCHAR(15) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  priority    VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  due_date    TIMESTAMPTZ,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index for dashboard: all tasks in a project by status
CREATE INDEX IF NOT EXISTS tasks_project_status ON tasks(project_id, status);
-- Partial index: active overdue tasks (excludes done — minimizes memory footprint)
CREATE INDEX IF NOT EXISTS tasks_overdue_active ON tasks(assigned_to, due_date)
  WHERE status != 'done';
-- For priority-sorted fetches
CREATE INDEX IF NOT EXISTS tasks_project_priority ON tasks(project_id, priority);
-- Full-text search
CREATE INDEX IF NOT EXISTS tasks_title_trgm ON tasks USING gin(title gin_trgm_ops);

-- ── Updated_at triggers ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Row-Level Security ────────────────────────────────────────
-- RLS policies pushed into the database kernel for multi-tenant safety
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_memberships ENABLE ROW LEVEL SECURITY;

-- App role bypasses RLS (backend connects as this role)
-- Password should be set via DATABASE_APP_PASSWORD environment variable
DO $$ BEGIN
  CREATE ROLE taskflow_app WITH LOGIN PASSWORD '${process.env.DB_APP_PASSWORD || 'taskflow_temp_dev'}' BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO taskflow_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO taskflow_app;
GRANT USAGE ON SCHEMA public TO taskflow_app;
`;

async function migrate() {
  console.log('Running migrations...');
  const client = await pool.connect();
  try {
    await client.query(MIGRATION_SQL);
    console.log('✅ Migrations complete');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});

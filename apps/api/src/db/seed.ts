import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool, { query } from './pool';

async function seed() {
  console.log('Seeding database...');

  const adminId = uuidv4();
  const member1Id = uuidv4();
  const member2Id = uuidv4();
  const projectId = uuidv4();
  const project2Id = uuidv4();

  const adminHash = await bcrypt.hash('Admin@1234', 12);
  const memberHash = await bcrypt.hash('Member@1234', 12);

  // Users
  await query(
    `INSERT INTO users (id, username, email, password_hash, global_role) VALUES
      ($1, 'admin_user', 'admin@taskflow.dev', $2, 'admin'),
      ($3, 'alice_dev', 'alice@taskflow.dev', $4, 'member'),
      ($5, 'bob_design', 'bob@taskflow.dev', $4, 'member')
    ON CONFLICT (email) DO NOTHING`,
    [adminId, adminHash, member1Id, memberHash, member2Id]
  );

  // Projects
  await query(
    `INSERT INTO projects (id, name, description, created_by) VALUES
      ($1, 'TaskFlow Platform', 'Main product engineering project', $2),
      ($3, 'Design System', 'UI component library and brand guidelines', $2)
    ON CONFLICT DO NOTHING`,
    [projectId, adminId, project2Id]
  );

  // Memberships
  await query(
    `INSERT INTO project_memberships (project_id, user_id, role) VALUES
      ($1, $2, 'admin'), ($1, $3, 'member'), ($1, $4, 'member'),
      ($5, $2, 'admin'), ($5, $3, 'admin')
    ON CONFLICT DO NOTHING`,
    [projectId, adminId, member1Id, member2Id, project2Id]
  );

  // Tasks
  const tasks = [
    { title: 'Set up CI/CD pipeline', status: 'done', priority: 'high', assigned: adminId },
    { title: 'Implement JWT refresh rotation', status: 'done', priority: 'high', assigned: adminId },
    { title: 'Build dashboard analytics', status: 'in_progress', priority: 'high', assigned: member1Id },
    { title: 'Write API documentation', status: 'in_progress', priority: 'medium', assigned: member1Id },
    { title: 'Add drag-and-drop Kanban', status: 'todo', priority: 'medium', assigned: member2Id },
    { title: 'Performance profiling', status: 'todo', priority: 'low', assigned: member2Id },
    { title: 'Security audit', status: 'todo', priority: 'high', assigned: null,
      due_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }, // overdue
    { title: 'Load testing', status: 'todo', priority: 'medium', assigned: member1Id,
      due_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() }, // overdue
  ];

  for (const t of tasks) {
    await query(
      `INSERT INTO tasks (title, status, priority, project_id, created_by, assigned_to, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
      [t.title, t.status, t.priority, projectId, adminId, t.assigned ?? null, (t as any).due_date ?? null]
    );
  }

  console.log('✅ Seed complete');
  console.log('');
  console.log('Demo credentials:');
  console.log('  Admin:  admin@taskflow.dev  / Admin@1234');
  console.log('  Member: alice@taskflow.dev  / Member@1234');
  console.log('  Member: bob@taskflow.dev    / Member@1234');
}

seed()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => pool.end());

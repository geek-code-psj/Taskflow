import { Request, Response } from 'express';
import { query } from '../db/pool';
import { sendSuccess, sendError, sendPaginated } from '../lib/response';
import { Task } from '@taskflow/types';

const TASK_SELECT = `
  t.id, t.title, t.description, t.status, t.priority,
  t.due_date, t.project_id, t.created_by, t.assigned_to,
  t.created_at, t.updated_at,
  json_build_object('id', a.id, 'username', a.username, 'email', a.email) as assignee,
  json_build_object('id', c.id, 'username', c.username, 'email', c.email) as creator,
  json_build_object('id', p.id, 'name', p.name) as project,
  (t.due_date IS NOT NULL AND t.due_date < NOW() AND t.status != 'done') as is_overdue
`;

const TASK_JOINS = `
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  LEFT JOIN users a ON a.id = t.assigned_to
  LEFT JOIN users c ON c.id = t.created_by
`;

export const listTasks = async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const q = req.query;
  
  // Safely extract query params as strings, handling arrays
  const getString = (val: any, def = ''): string => {
    if (Array.isArray(val)) return String(val[0] || def);
    return String(val || def);
  };

  const status = getString(q.status);
  const priority = getString(q.priority);
  const assigned_to = getString(q.assigned_to);
  const overdue = getString(q.overdue);
  const search = getString(q.search);
  const sort = getString(q.sort, 'created_at');
  const order = getString(q.order, 'desc');
  const page = getString(q.page, '1');
  const limit = getString(q.limit, '20');

  const conditions: string[] = ['t.project_id = $1'];
  const params: (string | number)[] = [projectId];

  if (status) { params.push(status); conditions.push(`t.status = $${params.length}`); }
  if (priority) { params.push(priority); conditions.push(`t.priority = $${params.length}`); }
  if (assigned_to) { params.push(assigned_to); conditions.push(`t.assigned_to = $${params.length}`); }
  if (overdue === 'true') { conditions.push(`t.due_date < NOW() AND t.status != 'done'`); }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`t.title ILIKE $${params.length}`);
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const where = `WHERE ${conditions.join(' AND ')}`;

  const allowedSorts: Record<string, string> = {
    created_at: 't.created_at', due_date: 't.due_date',
    priority: `CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`,
    status: 't.status',
  };
  const sortClause = allowedSorts[sort] ?? 't.created_at';
  const orderClause = order === 'asc' ? 'ASC' : 'DESC';

  params.push(parseInt(limit), offset);

  const { rows } = await query<Task & { total: string }>(
    `SELECT ${TASK_SELECT}, COUNT(*) OVER() as total
     ${TASK_JOINS}
     ${where}
     ORDER BY ${sortClause} ${orderClause} NULLS LAST
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows[0] ? parseInt((rows[0] as any).total as string, 10) : 0;
  sendPaginated(res, rows, total, parseInt(page), parseInt(limit));
};

export const getTask = async (req: Request, res: Response): Promise<void> => {
  const { projectId, taskId } = req.params;
  const { rows } = await query<Task>(
    `SELECT ${TASK_SELECT} ${TASK_JOINS}
     WHERE t.id = $1 AND t.project_id = $2`,
    [taskId, projectId]
  );
  if (!rows.length) { sendError(res, 'Task not found', 404); return; }
  sendSuccess(res, rows[0]);
};

export const createTask = async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { title, description, status, priority, due_date, assigned_to } = req.body;
  const userId = req.user!.sub;

  // Verify assignee is a project member (global admins can assign to non-members)
  if (assigned_to) {
    const { rowCount } = await query(
      `SELECT 1 FROM project_memberships WHERE project_id = $1 AND user_id = $2`,
      [projectId, assigned_to]
    );
    // Both project admins AND members can now create tasks; only project admins can assign to non-members
    const isProjectAdmin = (req as any).projectRole === 'admin';
    if (!rowCount && !isProjectAdmin) {
      sendError(res, 'Assignee is not a member of this project', 400);
      return;
    }
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO tasks (title, description, status, priority, due_date, project_id, created_by, assigned_to)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [title, description ?? null, status ?? 'todo', priority ?? 'medium',
     due_date ?? null, projectId, userId, assigned_to ?? null]
  );

  const { rows: taskRows } = await query<Task>(
    `SELECT ${TASK_SELECT} ${TASK_JOINS} WHERE t.id = $1`,
    [rows[0]!.id]
  );

  sendSuccess(res, taskRows[0], 'Task created', 201);
};

export const updateTask = async (req: Request, res: Response): Promise<void> => {
  const { projectId, taskId } = req.params;
  const userId = req.user!.sub;
  const projectRole = (req as any).projectRole;

  // Fetch existing task to check ownership
  const { rows: existing } = await query<{ assigned_to: string | null; created_by: string }>(
    'SELECT assigned_to, created_by FROM tasks WHERE id = $1 AND project_id = $2',
    [taskId, projectId]
  );
  if (!existing.length) { sendError(res, 'Task not found', 404); return; }

  const task = existing[0]!;
  const isProjectAdmin = projectRole === 'admin' || req.user!.role === 'admin';
  const isAssignee = task.assigned_to === userId;
  const isCreator = task.created_by === userId;

  // Members can only update status of tasks assigned to them
  if (!isProjectAdmin && !isCreator) {
    if (!isAssignee) {
      sendError(res, 'You can only update tasks assigned to you', 403);
      return;
    }
    // Members restricted to status-only updates
    const disallowedFields = ['title', 'description', 'priority', 'due_date', 'assigned_to'];
    const hasDisallowed = disallowedFields.some((f) => f in req.body);
    if (hasDisallowed) {
      sendError(res, 'Members can only update the status of their assigned tasks', 403);
      return;
    }
  }

  const { title, description, status, priority, due_date, assigned_to } = req.body;
  const sets: string[] = [];
  const params: any[] = [];

  if (title !== undefined) { params.push(title); sets.push(`title = $${params.length}`); }
  if (description !== undefined) { params.push(description); sets.push(`description = $${params.length}`); }
  if (status !== undefined) { params.push(status); sets.push(`status = $${params.length}`); }
  if (priority !== undefined) { params.push(priority); sets.push(`priority = $${params.length}`); }
  if (due_date !== undefined) { params.push(due_date); sets.push(`due_date = $${params.length}`); }
  if (assigned_to !== undefined) { params.push(assigned_to); sets.push(`assigned_to = $${params.length}`); }

  if (!sets.length) { sendError(res, 'No fields to update', 400); return; }

  params.push(taskId, projectId);
  await query(
    `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND project_id = $${params.length}`,
    params
  );

  const { rows } = await query<Task>(
    `SELECT ${TASK_SELECT} ${TASK_JOINS} WHERE t.id = $1`,
    [taskId]
  );
  sendSuccess(res, rows[0], 'Task updated');
};

export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  const { projectId, taskId } = req.params;
  const { rowCount } = await query(
    'DELETE FROM tasks WHERE id = $1 AND project_id = $2',
    [taskId, projectId]
  );
  if (!rowCount) { sendError(res, 'Task not found', 404); return; }
  sendSuccess(res, null, 'Task deleted');
};

import { Request, Response } from 'express';
import { query, transaction } from '../db/pool';
import { sendSuccess, sendError, sendPaginated } from '../lib/response';
import { Project, ProjectMember } from '@taskflow/types';

export const listProjects = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.sub;
  const isAdmin = req.user!.role === 'admin';
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  const baseWhere = isAdmin
    ? ''
    : 'WHERE pm.user_id = $1';

  const params: any[] = isAdmin ? [limit, offset] : [userId, limit, offset];
  const paramOffset = isAdmin ? 1 : 2;

  const { rows } = await query<Project & { total: string }>(
    `SELECT p.id, p.name, p.description, p.created_by, p.created_at, p.updated_at,
            u.username as creator_username, u.email as creator_email,
            COUNT(DISTINCT pm2.user_id)::int as member_count,
            COUNT(DISTINCT t.id)::int as task_count,
            pm_me.role as user_role,
            COUNT(*) OVER() as total
     FROM projects p
     JOIN users u ON u.id = p.created_by
     LEFT JOIN project_memberships pm ON pm.project_id = p.id ${isAdmin ? '' : 'AND pm.user_id = $1'}
     LEFT JOIN project_memberships pm2 ON pm2.project_id = p.id
     LEFT JOIN project_memberships pm_me ON pm_me.project_id = p.id AND pm_me.user_id = ${isAdmin ? '$3' : '$1'}
     LEFT JOIN tasks t ON t.project_id = p.id
     ${baseWhere}
     GROUP BY p.id, u.username, u.email, pm_me.role
     ORDER BY p.created_at DESC
     LIMIT $${paramOffset} OFFSET $${paramOffset + 1}`,
    params
  );

  const total = rows[0] ? parseInt(rows[0].total) : 0;
  sendPaginated(res, rows, total, page, limit);
};

export const getProject = async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;

  const { rows } = await query<Project>(
    `SELECT p.*, u.username as creator_username, u.email as creator_email,
            COUNT(DISTINCT pm.user_id)::int as member_count,
            COUNT(DISTINCT t.id)::int as task_count
     FROM projects p
     JOIN users u ON u.id = p.created_by
     LEFT JOIN project_memberships pm ON pm.project_id = p.id
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE p.id = $1
     GROUP BY p.id, u.username, u.email`,
    [projectId]
  );

  if (!rows.length) { sendError(res, 'Project not found', 404); return; }
  sendSuccess(res, rows[0]);
};

export const createProject = async (req: Request, res: Response): Promise<void> => {
  const { name, description } = req.body;
  const userId = req.user!.sub;

  const result = await transaction(async (client) => {
    const { rows } = await client.query<Project>(
      `INSERT INTO projects (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description ?? null, userId]
    );
    const project = rows[0]!;

    // Creator auto-added as admin
    await client.query(
      `INSERT INTO project_memberships (project_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [project.id, userId]
    );

    return project;
  });

  sendSuccess(res, result, 'Project created', 201);
};

export const updateProject = async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { name, description } = req.body;

  const sets: string[] = [];
  const params: any[] = [];
  if (name !== undefined) { params.push(name); sets.push(`name = $${params.length}`); }
  if (description !== undefined) { params.push(description); sets.push(`description = $${params.length}`); }

  if (!sets.length) { sendError(res, 'No fields to update', 400); return; }

  params.push(projectId);
  const { rows } = await query<Project>(
    `UPDATE projects SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );

  if (!rows.length) { sendError(res, 'Project not found', 404); return; }
  sendSuccess(res, rows[0], 'Project updated');
};

export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { rowCount } = await query('DELETE FROM projects WHERE id = $1', [projectId]);
  if (!rowCount) { sendError(res, 'Project not found', 404); return; }
  sendSuccess(res, null, 'Project deleted');
};

// ── Members ────────────────────────────────────────────────────
export const listMembers = async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { rows } = await query<ProjectMember>(
    `SELECT pm.user_id, pm.project_id, pm.role, pm.joined_at,
            u.username, u.email
     FROM project_memberships pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY pm.joined_at ASC`,
    [projectId]
  );
  sendSuccess(res, rows);
};

export const addMember = async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { email, role } = req.body;

  const { rows: userRows } = await query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );
  if (!userRows.length) { sendError(res, 'User with that email not found', 404); return; }

  const userId = userRows[0]!.id;
  await query(
    `INSERT INTO project_memberships (project_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3`,
    [projectId, userId, role]
  );
  sendSuccess(res, { project_id: projectId, user_id: userId, role }, 'Member added', 201);
};

export const updateMemberRole = async (req: Request, res: Response): Promise<void> => {
  const { projectId, userId } = req.params;
  const { role } = req.body;

  const { rowCount } = await query(
    `UPDATE project_memberships SET role = $1
     WHERE project_id = $2 AND user_id = $3`,
    [role, projectId, userId]
  );
  if (!rowCount) { sendError(res, 'Member not found', 404); return; }
  sendSuccess(res, null, 'Role updated');
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
  const { projectId, userId } = req.params;
  const requesterId = req.user!.sub;

  if (userId === requesterId) {
    sendError(res, 'You cannot remove yourself from the project', 400);
    return;
  }

  const { rowCount } = await query(
    `DELETE FROM project_memberships WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  if (!rowCount) { sendError(res, 'Member not found', 404); return; }
  sendSuccess(res, null, 'Member removed');
};

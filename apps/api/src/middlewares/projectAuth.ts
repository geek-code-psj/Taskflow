import { Request, Response, NextFunction } from 'express';
import { query } from '../db/pool';
import { sendError } from '../lib/response';

type ProjectRole = 'admin' | 'member';

/**
 * Checks that the authenticated user is a member of the project
 * and optionally that they hold a specific role within it.
 * Attaches req.projectRole for downstream use.
 */
export const requireProjectMember = (minRole?: ProjectRole) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const projectId = req.params.projectId;
    const userId = req.user!.sub;

    if (!projectId) {
      sendError(res, 'Project ID is required', 400);
      return;
    }

    // Single query: checks membership AND global admin bypass
    const { rows } = await query<{ role: string; global_role: string }>(
      `SELECT pm.role, u.global_role
       FROM users u
       LEFT JOIN project_memberships pm
         ON pm.user_id = u.id AND pm.project_id = $1
       WHERE u.id = $2`,
      [projectId, userId]
    );

    if (!rows.length) {
      sendError(res, 'Unauthorized', 403);
      return;
    }

    const { role: projectRole, global_role } = rows[0]!;

    // Global admins bypass project-level restrictions
    if (global_role === 'admin') {
      (req as any).projectRole = 'admin';
      next();
      return;
    }

    if (!projectRole) {
      sendError(res, 'You are not a member of this project', 403);
      return;
    }

    if (minRole === 'admin' && projectRole !== 'admin') {
      sendError(res, 'Project admin access required', 403);
      return;
    }

    (req as any).projectRole = projectRole;
    next();
  };
